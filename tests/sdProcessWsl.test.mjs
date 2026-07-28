import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function transpile(filePath) {
	return ts.transpileModule(readFileSync(filePath, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
}

function loadWslPaths() {
	const sandbox = { exports: {}, require };
	vm.runInNewContext(transpile("src/main/wsl/WslPaths.ts"), sandbox, { filename: "WslPaths.ts" });
	return sandbox.exports;
}

function createChildProcess() {
	const child = new EventEmitter();
	child.stdin = new PassThrough();
	child.stdout = new PassThrough();
	child.stderr = new PassThrough();
	child.kill = () => true;
	return child;
}

function loadSdProcess(spawnCalls) {
	const paths = loadWslPaths();
	class FakeRpcClient extends EventEmitter {
		close() {}
	}
	class FakeSdLocator {}
	const sandbox = {
		Buffer,
		console: { log() {}, warn() {}, error() {} },
		exports: {},
		process,
		require: (id) => {
			if (id === "node:child_process") {
				return {
					execFile: (_command, _args, _options, callback) => {
						callback(null, "0.81.1\n", "");
						return new EventEmitter();
					},
					spawn: (command, args, options) => {
						const child = createChildProcess();
						spawnCalls.push({ command, args, options, child });
						return child;
					},
				};
			}
			if (id === "./SdRpcClient") return { SdRpcClient: FakeRpcClient };
			if (id === "./SdLocator") return { SdLocator: FakeSdLocator };
			if (id === "../wsl/WslPaths") return paths;
			return require(id);
		},
	};
	vm.runInNewContext(transpile("src/main/agent/SdProcess.ts"), sandbox, { filename: "SdProcess.ts" });
	return sandbox.exports;
}

function createLocator(invocationCalls) {
	return {
		resolveCommand: () => "wsl://Ubuntu-24.04/root/sd",
		createInvocation: (_command, args, options = {}) => {
			invocationCalls.push({ args: [...args], options: { ...options } });
			return {
				command: "wsl.exe",
				args: [
					"-d", "Ubuntu-24.04",
					"-u", "root",
					...(options.wslCwd ? ["--cd", options.wslCwd] : []),
					"sd",
					...args,
				],
				shell: false,
				wsl: { distro: "Ubuntu-24.04", user: "root", sdCommand: "sd" },
			};
		},
		createProcessEnv: () => ({}),
	};
}

const settings = {
	wslEnabled: true,
	wslDistro: "Ubuntu-24.04",
	wslUser: "root",
	sdProxyEnabled: false,
	sdProxyUrl: "",
	sdProxyBypass: "",
};

test("starts WSL sd with Linux cwd/session while keeping a Windows-accessible spawn cwd", async () => {
	const spawnCalls = [];
	const invocationCalls = [];
	const { SdProcess } = loadSdProcess(spawnCalls);
	const process = new SdProcess(
		"//wsl.localhost/Ubuntu-24.04/root/ba_cli",
		settings,
		createLocator(invocationCalls),
	);

	await process.start("\\\\wsl$\\Ubuntu-24.04\\root\\.sd\\agent\\sessions\\session.jsonl");

	assert.equal(invocationCalls[0].options.wslCwd, "/root/ba_cli");
	assert.deepEqual(
		invocationCalls[0].args,
		["--mode", "rpc", "--session", "/root/.sd/agent/sessions/session.jsonl"],
	);
	assert.equal(spawnCalls[0].options.cwd, "\\\\wsl.localhost\\Ubuntu-24.04\\root\\ba_cli");
	assert.deepEqual(
		spawnCalls[0].args,
		[
			"-d", "Ubuntu-24.04",
			"-u", "root",
			"--cd", "/root/ba_cli",
			"sd", "--mode", "rpc",
			"--session", "/root/.sd/agent/sessions/session.jsonl",
		],
	);
	assert.equal(process.getDiagnostics().cwd, "/root/ba_cli");
});

test("rejects a project UNC from another distro before spawning sd", async () => {
	const spawnCalls = [];
	const { SdProcess } = loadSdProcess(spawnCalls);
	const process = new SdProcess(
		"\\\\wsl.localhost\\Debian\\root\\ba_cli",
		settings,
		createLocator([]),
	);

	await assert.rejects(
		process.start(),
		(error) => error.code === "WSL_DISTRO_MISMATCH",
	);
	assert.equal(spawnCalls.length, 0);
});
