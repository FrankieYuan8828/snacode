import { execFile, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { delimiter, dirname, extname, join } from "node:path";
import { app } from "electron";
import type { AppSettings, AgentInstallStatus } from "../../shared/types";

type SdProxySettings = Pick<
  AppSettings,
  "sdProxyEnabled" | "sdProxyUrl" | "sdProxyBypass"
>;

export type SdCommandInvocation = {
  command: string;
  args: string[];
  shell: boolean;
  pathPrefix?: string;
  /**
   * Windows 下通过 cmd.exe /c 启动 .cmd shim 时，命令行里已经手动完成引号包装。
   * 必须禁止 Node 再次转义参数，否则路径中含空格会被 cmd 误解析为不存在的路径。
   */
  windowsVerbatimArguments?: boolean;
  /**
   * 当 agent CLI 位于 WSL 中时，command 固定为 wsl.exe，args 会携带 distro/user/sd 参数。
   * 下游 SdProcess 需要用此标志决定是否把 Windows cwd 转为 Linux 路径。
   */
  wsl?: {
    distro: string;
    user: string;
    sdCommand: string;
  };
};

/** Resolves the Agent CLI across packaged Electron environments where shell PATH is often incomplete. */
export class SdLocator {
  /**
   * 获取项目内置的 sd CLI 路径（从 node_modules 中）。
   * 优先级：项目内置 > 用户自定义 > 系统 PATH > WSL
   */
  private getBuiltinSdPath(): string | undefined {
    try {
      // 获取项目根目录（Electron 打包后 app.asar 内的路径）
      const appPath = app.getAppPath();
      // 在 node_modules 中查找 sd-coding-agent 的 CLI 入口
      const cliPath = join(appPath, "node_modules", "@snacode", "sd-coding-agent", "dist", "cli.js");
      if (existsSync(cliPath)) {
        console.log('[SdLocator] Found built-in sd CLI:', cliPath);
        return cliPath;
      }
      // 尝试从 require.resolve 获取
      try {
        const pkgPath = require.resolve("@snacode/sd-coding-agent");
        const distDir = dirname(pkgPath);
        const cliPath2 = join(distDir, "cli.js");
        if (existsSync(cliPath2)) {
          console.log('[SdLocator] Found built-in sd CLI via require:', cliPath2);
          return cliPath2;
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.warn('[SdLocator] Failed to find built-in sd CLI:', error);
    }
    return undefined;
  }

  /**
   * Resolves the sd CLI across packaged Electron environments where shell PATH is often incomplete.
   * 优先级：项目内置 CLI > 用户自定义路径 > WSL > 系统 PATH > 回退到 "sd"
   */
  resolveCommand(customPath?: string, wslEnabled?: boolean, wslDistro?: string, wslUser?: string) {
    // 优先使用项目内置的 CLI，无需用户单独安装
    const builtinPath = this.getBuiltinSdPath();
    if (builtinPath) {
      return builtinPath;
    }

    const normalizedCustomPath = this.normalizeCustomPath(customPath);
    // 用户手动指定路径优先，适用于 npm/pnpm/yarn 全局安装、nvm/volta/asdf/mise 等极端情况。
    // 旧版本可能已保存 sd.ps1；Windows 现在不再调用 PowerShell shim，遇到时忽略并回退自动检测。
    if (normalizedCustomPath && !this.isUnsupportedPowerShellShim(normalizedCustomPath)) {
      return normalizedCustomPath;
    }
    // 用户显式开启 WSL 时优先使用 WSL 中的 sd，不轮询本地 PATH 中的 Windows 版本
    if (wslEnabled && process.platform === "win32" && wslDistro && wslUser) {
      const wslCommand = this.resolveWslCommand(wslDistro, wslUser);
      if (wslCommand) return wslCommand;
    }

    const candidates = this.getCandidates();
    const found = candidates.find(candidate => existsSync(candidate));
    if (found) return found;
    return "sd";
  }

  getSearchDirs() {
    const home = app.getPath("home");
    const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    const dirs = [
      ...this.pathDirs(),
      join(appData, "npm"),
      join(localAppData, "pnpm"),
      join(localAppData, "Yarn", "bin"),
      join(localAppData, "Volta", "bin"),
      join(localAppData, "mise", "shims"),
      ...this.listChildDirs(join(localAppData, "mise", "installs", "node")),
      join(home, ".bun", "bin"),
      join(home, ".deno", "bin"),
      join(home, ".local", "bin"),
      join(home, ".npm-global", "bin"),
      join(home, ".nvm", "current", "bin"),
      ...this.listChildDirs(join(home, ".nvm", "versions", "node")).map(dir => join(dir, "bin")),
      join(home, ".asdf", "shims"),
      join(home, ".volta", "bin"),
    ];

    // These directories only locate an existing sd installation; sd itself is not bundled yet.
    return [...new Set(dirs.filter(Boolean))];
  }

  createProcessEnv(settings?: SdProxySettings, pathPrefix?: string, wsl?: SdCommandInvocation["wsl"]) {
    if (wsl) {
      // WSL 模式：保留原始 PATH 以便找到 wsl.exe（在 System32 中），
      // 同时注入代理环境变量（wsl.exe 子进程通过 Windows 网络栈访问外网）。
      const base = {
        ...process.env,
        PATH: pathPrefix || process.env.PATH || "",
      };
      return this.applySdProxyEnv(base, settings);
    }
    const searchDirs = pathPrefix
      ? [pathPrefix, ...this.getSearchDirs().filter(dir => dir !== pathPrefix)]
      : this.getSearchDirs();
    const env = {
      ...process.env,
      PATH: searchDirs.join(delimiter),
    };

    return this.applySdProxyEnv(env, settings);
  }

  createInvocation(command: string, args: string[], options: { wslCwd?: string } = {}): SdCommandInvocation {
    // WSL 模式：command 为 "wsl://<distro>/<user>/sd" 形式的标记
    if (command.startsWith("wsl://")) {
      const parsed = this.parseWslUrl(command);
      if (!parsed) return { command, args, shell: false };
      const { distro, user, sdCommand } = parsed;
      const wslExe = this.resolveWslExe();
      const wslArgs = [
        "-d", distro,
        "-u", user,
        ...(options.wslCwd ? ["--cd", options.wslCwd] : []),
        sdCommand,
        ...args,
      ];
      console.log('[SdLocator] WSL invocation:', wslExe.command, wslArgs.join(' '), 'shell:', wslExe.shell);
      return {
        command: wslExe.command,
        args: wslArgs,
        shell: wslExe.shell,
        wsl: { distro, user, sdCommand },
      };
    }

    // 内置 .js 文件模式：需要用 node 执行
    if (command.endsWith(".js")) {
      return {
        command: process.execPath, // 使用当前 Electron 的 Node 来执行
        args: [command, ...args],
        shell: false,
        pathPrefix: this.getCommandBinDir(command),
      };
    }

    if (process.platform !== "win32") {
      return { command, args, shell: false, pathPrefix: this.getCommandBinDir(command) };
    }

    // Windows 仅支持 .cmd/.exe/裸命令，不再走 PowerShell .ps1。
    // npm/yarn/pnpm 生成的 sd.ps1 与 sd.cmd 指向同一个包入口，但 PowerShell 的执行策略、编码和引号规则更复杂；
    // 对桌面端来说，统一使用 cmd shim 能减少检测与 agent 启动路径差异。
    // Windows npm 全局命令通常是 .cmd shim；当命令路径本身需要引号时，cmd /s /c
    // 需要额外一层外引号才能正确解析用户名含空格的路径；不需要引号的路径不能套外层引号，
    // 否则 cmd 会把 `C:\...\sd.cmd --version` 整段当作命令名。
    const innerCommand = [command, ...args]
      .map((part) => this.quoteCmdArgument(part))
      .join(" ");
    const commandLine = this.needsCmdQuote(command) ? `"${innerCommand}"` : innerCommand;
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", commandLine],
      shell: false,
      pathPrefix: this.getCommandBinDir(command),
      // 关键：cmd /c 的最后一个参数是完整命令行，里面的引号由 quoteCmdArgument/control 逻辑维护。
      // 若让 Node 再转义一次，`D:\\foo bar\\sd.cmd` 会变成 cmd 无法识别的路径。
      windowsVerbatimArguments: true,
    };
  }

  private applySdProxyEnv(
    env: NodeJS.ProcessEnv,
    settings?: SdProxySettings,
  ) {
    if (!settings?.sdProxyEnabled) return env;
    const proxyUrl = settings.sdProxyUrl.trim();
    if (!proxyUrl) return env;
    const bypass = settings.sdProxyBypass.trim();

    // 这里只给 sd agent 子进程注入标准代理环境变量，避免误影响 desktop 自身的更新、外链和配置管理请求。
    return {
      ...env,
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      ALL_PROXY: proxyUrl,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      all_proxy: proxyUrl,
      ...(bypass ? { NO_PROXY: bypass, no_proxy: bypass } : {}),
    };
  }

  /**
   * 验证用户手动输入的 sd 路径是否可用。
   * 直接对给定路径执行 --version，绕过 getCandidates 的目录扫描，
   * 适用于用户从终端复制完整路径（如 D:\nodejs\sd.cmd）后手动粘贴的场景。
   */
  async validateCustomPath(customPath: string): Promise<AgentInstallStatus> {
    const command = this.normalizeCustomPath(customPath);
    if (!command) {
      return { installed: false, searchedDirs: [], error: "请输入 sd.cmd 或 sd 路径。" };
    }
    if (this.isUnsupportedPowerShellShim(command)) return this.unsupportedPowerShellStatus(command);
    if (command.startsWith("wsl://")) {
      const parsed = this.parseWslUrl(command);
      if (!parsed) return { installed: false, searchedDirs: [], error: "Invalid wsl:// URL" };
      return this.checkWslCommand(parsed.distro, parsed.user, parsed.sdCommand);
    }
    return this.runCheck(command, []);
  }

  async check(customPath?: string, wslEnabled?: boolean, wslDistro?: string, wslUser?: string): Promise<AgentInstallStatus> {
    const normalizedCustomPath = this.normalizeCustomPath(customPath);
    if (normalizedCustomPath && this.isUnsupportedPowerShellShim(normalizedCustomPath)) {
      return this.unsupportedPowerShellStatus(normalizedCustomPath, this.getSearchDirs());
    }
    const command = normalizedCustomPath || this.resolveCommand(customPath, wslEnabled, wslDistro, wslUser);
    const searchedDirs = this.getSearchDirs();

    if (command.startsWith("wsl://")) {
      const parsed = this.parseWslUrl(command);
      if (!parsed) return { installed: false, command, searchedDirs: [], error: "Invalid wsl:// URL" };
      const wslStatus = await this.checkWslCommand(parsed.distro, parsed.user, parsed.sdCommand);
      return {
        ...wslStatus,
        command: `wsl -d ${parsed.distro} -u ${parsed.user} ${parsed.sdCommand}`,
        searchedDirs: [],
      };
    }

    return this.runCheck(command, searchedDirs);
  }

  /**
   * 归一化用户粘贴的路径：去除首尾引号，兼容 JSON 风格双反斜杠，并在 Windows 下优先补全同目录 sd.cmd。
   * 这样 UI 校验、settings 保存和 agent 启动都使用同一条路径规则，避免不同入口行为不一致。
   */
  normalizeCustomPath(rawPath?: string) {
    let value = rawPath?.trim() ?? "";
    if (!value) return "";

    const quotePairs: Array<[string, string]> = [["\"", "\""], ["'", "'"], ["“", "”"], ["‘", "’"]];
    let stripped = true;
    while (stripped && value.length >= 2) {
      stripped = false;
      for (const [left, right] of quotePairs) {
        if (value.startsWith(left) && value.endsWith(right)) {
          value = value.slice(left.length, -right.length).trim();
          stripped = true;
        }
      }
    }

    if (process.platform === "win32") {
      // 用户从 JSON/日志里复制时可能得到 D:\\foo\\sd.cmd；只在疑似 Windows 盘符/UNC 路径时折叠双反斜杠。
      if (/^(?:[a-zA-Z]:\\\\|\\\\\\\\)/.test(value)) {
        value = value.replace(/\\\\/g, "\\");
      }

      // npm 有时同时生成无扩展名脚本和 .cmd；Windows 启动 agent 时优先使用 .cmd shim，
      // 可避免裸 `sd` 被当作 shell 内部命令或文本文件处理。
      if (!extname(value)) {
        const cmdCandidate = `${value}.cmd`;
        if (existsSync(cmdCandidate)) return cmdCandidate;
        const exeCandidate = `${value}.exe`;
        if (existsSync(exeCandidate)) return exeCandidate;
      }
    }

    return value;
  }

  private isUnsupportedPowerShellShim(command: string) {
    return process.platform === "win32" && command.trim().toLowerCase().endsWith(".ps1");
  }

  private unsupportedPowerShellStatus(
    command: string,
    searchedDirs: string[] = [],
  ): AgentInstallStatus {
    return {
      installed: false,
      command,
      searchedDirs,
      error: "暂不支持 PowerShell 的 sd.ps1，请使用 CMD 的 where sd 查到的 sd.cmd 或 sd.exe 路径。",
    };
  }

  /**
   * 执行 --version 轻量健康检查：验证可执行文件发现和 Node shim 启动是否正常。
   * validateCustomPath 和 check 共用此方法，仅 searchedDirs 有差异：
   * - validateCustomPath: searchedDirs 为空（用户已手动指定路径）
   * - check: searchedDirs 为自动扫描的目录列表
   *
   * 使用 encoding: 'buffer' 避免 Windows 中文环境下 stderr 的 GBK 输出被 utf8 错误解码导致乱码。
   */
  private async runCheck(command: string, searchedDirs: string[]): Promise<AgentInstallStatus> {
    return new Promise(resolve => {
      const invocation = this.createInvocation(command, ["--version"]);
      execFile(invocation.command, invocation.args, {
        env: this.createProcessEnv(undefined, invocation.pathPrefix, invocation.wsl),
        shell: invocation.shell,
        windowsHide: true,
        timeout: 8_000,
        encoding: 'buffer',
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      }, (error, stdout, stderr) => {
        if (error) {
          // 优先使用 stderr 中的实际错误信息（如"系统找不到指定的文件"），
          // 并处理 Windows GBK 编码问题。兜底用 error.message 但去掉冗余的命令行前缀。
          const raw = this.decodeBuffer(stderr) || this.cleanExecError(error.message);
          resolve({ installed: false, command, searchedDirs, error: raw });
          return;
        }

        const version = this.decodeBuffer(stdout).trim();
        resolve({ installed: true, command, searchedDirs, version });
      });
    });
  }

  /**
   * 尝试在 WSL 中检测 sd 是否可用。
   * 返回 "wsl://<distro>/<user>/sd" 标记字符串，供 resolveCommand/createInvocation 识别。
   */
  /**
   * wsl.exe 完整路径。32 位进程在 64 位 Windows 上访问 System32 会被文件系统重定向到
   * SysWOW64，而 wsl.exe 仅存在于真实 System32 中。使用 Sysnative 别名绕过重定向。
   */
  /**
   * wsl.exe 完整路径（优先绝对路径，fopen 失败时回退到 PATH）。
   * 32 位进程在 64 位 Windows 上访问 System32 会被文件系统重定向，
   * Sysnative 别名可绕过；若均不可用则通过 shell PATH 查找。
   */
  private resolveWslExe(): { command: string; shell: boolean } {
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    // 尝试真实 System32（通过 Sysnative 处理 32-bit 重定向）
    const candidates = process.arch === "ia32"
      ? [join(systemRoot, "Sysnative", "wsl.exe"), join(systemRoot, "System32", "wsl.exe")]
      : [join(systemRoot, "System32", "wsl.exe")];
    for (const candidate of candidates) {
      const ok = existsSync(candidate);
      console.log('[SdLocator] resolveWslExe candidate:', candidate, 'exists:', ok);
      if (ok) return { command: candidate, shell: false };
    }
    // 绝对路径均不存在：通过 cmd.exe PATH 查找 wsl.exe
    console.log('[SdLocator] resolveWslExe fallback: shell mode with "wsl"');
    return { command: "wsl", shell: true };
  }
  /** @deprecated 使用 resolveWslExe() 代替，支持 PATH 回退 */
  private get wslExePath(): string {
    return this.resolveWslExe().command;
  }

  /**
   * 解析 "wsl://<distro>/<user>/<sdCommand>" 格式的 URL。
   * 使用正则代替 .split("/") 避免 wsl:// 的双斜杠产生空字符串元素导致解析错位。
   */
  private parseWslUrl(url: string): { distro: string; user: string; sdCommand: string } | null {
    const match = url.match(/^wsl:\/\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { distro: match[1], user: match[2], sdCommand: match[3] };
  }

  private resolveWslCommand(distro: string, user: string): string | undefined {
    try {
      const wslExe = this.resolveWslExe();
      const wslArgs = ["-d", distro, "-u", user, "which", "sd"];
      const result = execFileSync(wslExe.command, wslArgs, {
        encoding: "utf8",
        timeout: 8_000,
        windowsHide: true,
        shell: wslExe.shell,
      }).trim();
      if (result && result.length > 0 && !result.includes("not found")) {
        return `wsl://${distro}/${user}/sd`;
      }
    } catch {
      // WSL 不可用或未安装 sd，静默忽略，回退到普通 "sd"
    }
    return undefined;
  }

  private checkWslCommand(distro: string, user: string, sdCommand: string): Promise<AgentInstallStatus> {
    return new Promise(resolve => {
      const wslExe = this.resolveWslExe();
      const wslArgs = ["-d", distro, "-u", user, sdCommand, "--version"];
      execFile(wslExe.command, wslArgs, {
        env: this.createProcessEnv(undefined, undefined, { distro, user, sdCommand }),
        shell: wslExe.shell,
        windowsHide: true,
        timeout: 8_000,
        encoding: "utf8",
      }, (error, stdout, stderr) => {
        if (error) {
          const raw = stderr?.trim() || this.cleanExecError(error.message);
          resolve({ installed: false, searchedDirs: [], error: raw });
          return;
        }
        resolve({ installed: true, command: `wsl -d ${distro} -u ${user} ${sdCommand}`, version: stdout.trim(), searchedDirs: [] });
      });
    });
  }

  private decodeBuffer(buf: Buffer | null): string {
    if (!buf || buf.length === 0) return '';
    const utf8 = buf.toString('utf8');
    // UTF-8 解码后不含 Unicode 替换字符（\ufffd），说明解码正确
    if (!utf8.includes('\ufffd')) return utf8;
    // Windows 中文环境下，cmd/powershell 的错误输出通常是 GBK (codepage 936)
    try {
      return new TextDecoder('gbk', { fatal: false }).decode(buf);
    } catch {
      // 极少数环境不支持 gbk TextDecoder（如某些精简 Node.js），保留原始字节
      return buf.toString('latin1');
    }
  }

  /**
   * 清理 execFile 默认错误消息，去掉冗余的 "Command failed: ..." 命令行前缀，
   * 只保留有意义的错误描述。
   */
  private cleanExecError(message: string): string {
    // Node.js execFile 错误格式："Command failed: powershell.exe ..."
    // 去掉前缀，只保留后半段或返回简洁提示
    const cleaned = message.replace(/^Command failed:\s*/i, '').trim();
    // 如果去掉前缀后仍是完整命令行（太长），截断为友好提示
    if (cleaned.length > 120) {
      return cleaned.slice(0, 100) + '…';
    }
    return cleaned;
  }

  private quoteCmdArgument(value: string) {
    if (!this.needsCmdQuote(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  private needsCmdQuote(value: string) {
    return /[\s&()\[\]{}^=;!'+,`~|<>]/.test(value);
  }

  private getCommandBinDir(command: string) {
    if (!/[\\/]/.test(command) || !existsSync(command)) return undefined;
    const binDir = dirname(command);
    // npm/nvm/asdf/mise shims resolve Node through env/PATH. Prepending the shim's own
    // bin directory keeps that lookup on the Node version that installed sd, instead
    // of a different Node inherited from Finder/Explorer/Electron.
    const nodeName = process.platform === "win32" ? "node.exe" : "node";
    return existsSync(join(binDir, nodeName)) ? binDir : undefined;
  }

  private getCandidates() {
    // Windows 不再自动检测 sd.ps1：PowerShell shim 与 .cmd 指向同一入口，但执行策略/编码/引号规则更复杂。
		// 优先搜索 sd 相关入口。
		const names = process.platform === "win32" ? ["sd.cmd", "sd.exe", "sd"] : ["sd"];
    return this.getSearchDirs().flatMap(dir => names.map(name => join(dir, name)));
  }

  private pathDirs() {
    const fromEnv = process.env.PATH ?? process.env.Path ?? "";
    const fromShell = this.readLoginShellPath();
    return [...fromEnv.split(delimiter), ...fromShell.split(delimiter)].filter(Boolean);
  }

  private readLoginShellPath() {
    try {
      if (process.platform === "win32") {
        // Windows 检测链路不再依赖 PowerShell；Explorer 启动的 Electron 通常已经拿到系统合并 PATH，
        // 其他包管理器特殊路径由 getSearchDirs 和用户手动输入兜底。
        return "";
      }
      return execFileSync("/bin/sh", ["-lc", "printf %s \"$PATH\""], { encoding: "utf8", timeout: 3000 }).trim();
    } catch {
      return "";
    }
  }

  private listChildDirs(parent: string) {
    try {
      return readdirSync(parent, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(parent, entry.name));
    } catch {
      return [];
    }
  }
}
