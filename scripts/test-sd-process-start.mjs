import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadTsModule(filePath, replacements = {}) {
	let source = require("node:fs").readFileSync(filePath, "utf8");
	for (const [from, to] of Object.entries(replacements)) {
		source = source.replace(from, to);
	}
	const compiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
		},
	}).outputText;
	const out = join(tmpdir(), `Snacode-test-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
	writeFileSync(out, compiled);
	return import(pathToFileURL(out).href);
}

const rpcModule = await loadTsModule("src/main/agent/SdRpcClient.ts");
const wslPathsModule = await loadTsModule("src/main/wsl/WslPaths.ts");
globalThis.__SnacodeTestDeps = {
	SdRpcClient: rpcModule.SdRpcClient,
	toWindowsHostPath: wslPathsModule.toWindowsHostPath,
	toWslLinuxPath: wslPathsModule.toWslLinuxPath,
};
const sdProcessModule = await loadTsModule("src/main/agent/SdProcess.ts", {
	'import { SdRpcClient } from "./SdRpcClient";': "const { SdRpcClient } = globalThis.__SnacodeTestDeps;",
	'import { SdLocator } from "./SdLocator";': "class SdLocator {}",
	'import type { AppSettings } from "../../shared/types";': "",
	'import { toWindowsHostPath, toWslLinuxPath } from "../wsl/WslPaths";': "const { toWindowsHostPath, toWslLinuxPath } = globalThis.__SnacodeTestDeps;",
	"const AppSettings = undefined;": "",
});

const { SdProcess } = sdProcessModule;
const scriptPath = join(tmpdir(), `fake-sd-${Date.now()}.mjs`);
writeFileSync(scriptPath, `
const mode = process.argv[2];
if (mode === '--version') {
  setTimeout(() => { console.log('0.80.6'); }, 1500);
} else if (mode === '--mode') {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    for (const line of chunk.trim().split(/\\n+/)) {
      if (!line) continue;
      const req = JSON.parse(line);
      process.stdout.write(JSON.stringify({ id: req.id, type: 'response', command: req.type, success: true, data: { ok: true } }) + '\\n');
    }
  });
}
`);
chmodSync(scriptPath, 0o755);

class FakeLocator {
	resolveCommand() {
		return process.execPath;
	}
	createInvocation(_command, args) {
		return { command: process.execPath, args: [scriptPath, ...args], shell: false };
	}
	createProcessEnv() {
		return process.env;
	}
}

mkdirSync(join(tmpdir(), "Snacode-sd-process-test"), { recursive: true });
const proc = new SdProcess(join(tmpdir(), "Snacode-sd-process-test"), {}, new FakeLocator());
const startedAt = performance.now();
const clientPromise = proc.start(undefined, "no-approve");
const startElapsed = performance.now() - startedAt;
assert.ok(
	startElapsed < 500,
	`SdProcess.start should not wait for slow sd --version, took ${startElapsed.toFixed(0)}ms`,
);
const client = await clientPromise;
const response = await client.request({ type: "get_state" }, 2_000);
assert.equal(response.success, true);
proc.stop();
console.log("sd process start tests passed");
