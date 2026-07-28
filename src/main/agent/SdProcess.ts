import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { SdRpcClient } from "./SdRpcClient";
import { SdLocator } from "./SdLocator";
import type { AppSettings } from "../../shared/types";
import { toWindowsHostPath, toWslLinuxPath } from "../wsl/WslPaths";

type SdProcessSettings = Pick<
  AppSettings,
  | "sdProxyEnabled"
  | "sdProxyUrl"
  | "sdProxyBypass"
  | "customSdPath"
  | "wslEnabled"
  | "wslDistro"
  | "wslUser"
>;

type SdProcessLocator = Pick<
  SdLocator,
  "resolveCommand" | "createInvocation" | "createProcessEnv"
>;

type VersionCacheEntry =
  | { status: "pending"; promise: Promise<boolean> }
  | { status: "done"; ok: boolean; minorVersion: number | null };

export class SdProcess extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams;
  private rpc?: SdRpcClient;
  /** 从 --version 解析出的次版本号（第二段），用于启动诊断和信任标志兼容性判断。 */
  private sdMinorVersion: number | null = null;
  /**
   * sd --version 只用于启动失败后的诊断，不应阻塞真正的 RPC 进程启动。
   * 按 command 路径缓存结果，避免连续打开多个 Agent 时重复启动 Node shim。
   */
  private static readonly versionCache = new Map<string, VersionCacheEntry>();

  /**
   * --approve/--no-approve 信任标志在 sd 0.79.0 引入。
   * 检查次版本号是否 >= 79（当前 sd 版本为 0.x.y，次版本号对应第二段）。
   * 未来 sd 升级到 1.x+ 后需要同步更新此检查。
   */
  private static versionSupportsTrustFlags(minorVersion: number | null): boolean {
    if (minorVersion === null) return false;
    return minorVersion >= 79;
  }

  /** 启动失败 / 异常退出时的诊断信息 */
  private diagnostics: {
    command: string;
    args: string[];
    cwd: string;
    stderr: string[];
    exitCode: number | null;
    exitSignal: string | null;
    customSdPath: string | undefined;
    versionCheck: boolean;
  } | null = null;

  constructor(
    private readonly cwd: string,
    private readonly settings?: SdProcessSettings,
    private readonly locator: SdProcessLocator = new SdLocator(),
  ) {
    super();
  }

  /** 返回诊断信息（进程启动失败或异常退出后调用） */
  getDiagnostics(): Readonly<{
    command: string;
    args: string[];
    cwd: string;
    stderr: string[];
    exitCode: number | null;
    exitSignal: string | null;
    customSdPath: string | undefined;
    versionCheck: boolean;
  }> | null {
    return this.diagnostics;
  }

  async start(sessionPath?: string, trustOverride?: "approve" | "no-approve", noSession?: boolean): Promise<SdRpcClient> {
    if (this.proc) return this.rpc!;

    // 信任确认由桌面端 AgentManager.ensureProjectTrust 在启动 sd 前完成，不再静默 --approve。
    // sd 在 RPC 模式下 project_trust 事件 hasUI 恒为 false，故信任弹窗由桌面端自行处理。
    const args = ["--mode", "rpc"];
    if (noSession) args.push("--no-session");
    if (sessionPath) args.push("--session", sessionPath);

    // 用户手动指定的 sd 路径优先于自动检测，解决 npm global、nvm 等路径未在 PATH 中的问题
    const command = this.locator.resolveCommand(this.settings?.customSdPath, this.settings?.wslEnabled, this.settings?.wslDistro, this.settings?.wslUser);

    // 信任覆盖：用 --approve/--no-approve 覆盖 sd 的 trustStore 决策（本次生效，不落盘）。
    // trust-session 用 --approve 让 sd 本次加载项目资源；deny 用 --no-approve 以不信任模式启动。
    // --approve/--no-approve 从 sd 0.79.0 开始支持。对老版本 sd 不传递这些参数，
    // 避免 "unknown option" 错误导致 RPC 进程启动失败。
    if (trustOverride) {
      await this.ensureVersionCheck(command);
      const cached = SdProcess.versionCache.get(command);
      if (cached?.status === "done" && SdProcess.versionSupportsTrustFlags(cached.minorVersion)) {
        if (trustOverride === "approve") args.push("--approve");
        else if (trustOverride === "no-approve") args.push("--no-approve");
      }
      // 版本不支持信任标志时静默跳过：老版本 sd 无 trust 系统，自动加载所有资源。
    }

    let spawnCwd = this.cwd;
    let diagnosticCwd = this.cwd;
    let finalSdArgs = args;
    let wslCwd: string | undefined;
    if (command.startsWith("wsl://")) {
      const distro = this.settings?.wslDistro;
      if (!distro) throw new Error("WSL distribution is unavailable for sd startup.");
      const environment = { distro };
      wslCwd = toWslLinuxPath(this.cwd, environment);
      spawnCwd = toWindowsHostPath(this.cwd, environment);
      diagnosticCwd = wslCwd;

      const sessionIndex = args.indexOf("--session");
      if (sessionIndex >= 0) {
        finalSdArgs = args.map((arg, index) =>
          index === sessionIndex + 1 ? toWslLinuxPath(arg, environment) : arg,
        );
      }
    }
    const invocation = this.locator.createInvocation(
      command,
      finalSdArgs,
      wslCwd ? { wslCwd } : undefined,
    );
    const finalArgs = invocation.args;

    // 初始化诊断信息。信任场景的版本检测已在上方同步完成。
    // 非信任场景仍异步触发，不阻塞 RPC 启动。
    const cachedVersion = SdProcess.versionCache.get(command);
    this.sdMinorVersion = cachedVersion?.status === "done" ? cachedVersion.minorVersion : this.sdMinorVersion;
    this.diagnostics = {
      command: command,
      args: finalArgs,
      cwd: diagnosticCwd,
      stderr: [],
      exitCode: null,
      exitSignal: null,
      customSdPath: this.settings?.customSdPath,
      versionCheck: cachedVersion?.status === "done" ? cachedVersion.ok : false,
    };
    if (!trustOverride) {
      void this.ensureVersionCheck(command);
    }

    // 打印等效命令行，方便在终端重现排查
    console.log('[SdProcess] spawn等效命令:', [invocation.command, ...finalArgs].map(a => a.includes(' ') ? `"${a}"` : a).join(' '));
    console.log('[SdProcess] spawn参数:', JSON.stringify({ command: invocation.command, shell: invocation.shell, cwd: spawnCwd, wslCwd: diagnosticCwd, argsCount: finalArgs.length }));

    // 每个 agent 绑定独立 cwd，确保 sd 自己发现项目级 AGENTS.md、settings 和 session 分组。
    // 打包后的 Electron 不一定继承用户终端 PATH；这里补齐跨平台 Node 工具链常见 bin 目录，尽量让已安装 sd 的用户开箱即用。
    // Windows 下通过 SdLocator.createInvocation 显式包裹含空格的 npm shim 路径，避免 cmd 拆分路径导致 agent 启动失败。
    this.proc = spawn(invocation.command, finalArgs, {
      cwd: spawnCwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: invocation.shell,
      env: this.locator.createProcessEnv(this.settings, invocation.pathPrefix, invocation.wsl),
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });

    this.rpc = new SdRpcClient(this.proc.stdin, this.proc.stdout);

    this.rpc.on("event", event => this.emit("event", event));
    this.rpc.on("protocol-error", line => this.emit("protocol-error", line));
    // 转发 RPC 日志到 AgentManager，用于前端调试面板展示
    this.rpc.on("log", entry => this.emit("rpc-log", entry));

    this.proc.stderr.on("data", chunk => {
      const text = chunk.toString("utf8");
      // 缓冲启动期 stderr（上限 8KB），供启动失败后诊断展示
      if (this.diagnostics) {
        this.diagnostics.stderr.push(text);
        const total = this.diagnostics.stderr.reduce((s, l) => s + l.length, 0);
        if (total > 8192) this.diagnostics.stderr = [this.diagnostics.stderr.join("").slice(-4096)];
      }
      // stderr 不属于 RPC 协议，单独暴露给 UI 的日志面板，避免污染 JSONL stdout。
      this.emit("stderr", text);
    });

    this.proc.on("error", error => this.emit("error", error));
    this.proc.on("exit", (code, signal) => {
      // 退出时更新诊断信息
      if (this.diagnostics) {
        this.diagnostics.exitCode = code;
        this.diagnostics.exitSignal = signal;
      }
      this.rpc?.close(new Error(`sd exited: code=${code ?? "null"}, signal=${signal ?? "null"}`));
      this.emit("exit", { code, signal });
      this.proc = undefined;
      this.rpc = undefined;
    });

    return this.rpc;
  }

  get client() {
    if (!this.rpc) throw new Error("sd process is not running");
    return this.rpc;
  }

  isRunning(): boolean {
    return this.proc !== undefined && this.rpc !== undefined;
  }

  stop() {
    if (!this.proc) return;
    this.proc.kill();
  }

  /** 后台执行 sd --version：更新诊断缓存，但不阻塞 start()/spawn。 */
  private ensureVersionCheck(command: string): Promise<boolean> {
    const cached = SdProcess.versionCache.get(command);
    if (cached?.status === "done") {
      this.sdMinorVersion = cached.minorVersion;
      if (this.diagnostics?.command === command) this.diagnostics.versionCheck = cached.ok;
      return Promise.resolve(cached.ok);
    }
    if (cached?.status === "pending") return cached.promise;

    const promise = new Promise<boolean>((resolve) => {
      const invocation = this.locator.createInvocation(command, ["--version"]);
      execFile(invocation.command, invocation.args, {
        encoding: "utf8" as const,
        timeout: 5_000,
        shell: false,
        env: this.locator.createProcessEnv(this.settings, invocation.pathPrefix),
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      }, (error, stdout) => {
        const ok = !error;
        const minorVersion = ok ? this.parseMinorVersion(stdout.trim()) : 0;
        SdProcess.versionCache.set(command, { status: "done", ok, minorVersion });
        this.sdMinorVersion = minorVersion;
        if (this.diagnostics?.command === command) this.diagnostics.versionCheck = ok;
        this.emit("version-check", { ok, minorVersion });
        resolve(ok);
      });
    });
    SdProcess.versionCache.set(command, { status: "pending", promise });
    return promise;
  }

  /**
   * 从 sd 的版本号字符串提取次版本号（第二段），用于信任标志兼容性判断。
   * 格式通常为 "0.79.4"，返回 79。
   */
  private parseMinorVersion(version: string): number {
    const match = version.match(/^(\d+)\.(\d+)/);
    if (match) return parseInt(match[2], 10);
    // fallback：如果只有主版本号或裸数字
    const major = parseInt(version, 10);
    return Number.isFinite(major) ? major : 0;
  }
}
