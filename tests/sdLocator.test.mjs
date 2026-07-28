import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);

function loadSdLocatorModule(platform = process.platform) {
	const source = readFileSync("src/main/agent/SdLocator.ts", "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const sandbox = {
		Buffer,
		TextDecoder,
		exports: {},
		process: {
			...process,
			env: { ...process.env },
			platform,
		},
		require: (id) => {
			if (id === "electron") {
				return { app: { getPath: () => tmpdir() } };
			}
			return require(id);
		},
	};
	sandbox.global = sandbox;
	vm.runInNewContext(outputText, sandbox, {
		filename: "SdLocator.ts",
	});
	return sandbox.exports;
}

test("uses the sd shim bin directory as PATH prefix on macOS when node is beside the shim", () => {
	const root = join(tmpdir(), `snacode-locator-${process.pid}-${Date.now()}`);
	const binDir = join(root, ".nvm", "versions", "node", "v22.22.1", "bin");
	mkdirSync(binDir, { recursive: true });
	const sdPath = join(binDir, "sd");
	writeFileSync(sdPath, "#!/usr/bin/env node\n", "utf8");
	writeFileSync(join(binDir, "node"), "", "utf8");

	try {
		const { SdLocator } = loadSdLocatorModule("darwin");
		const invocation = new SdLocator().createInvocation(sdPath, ["--version"]);

		assert.equal(invocation.command, sdPath);
		assert.deepEqual(invocation.args, ["--version"]);
		assert.equal(invocation.shell, false);
		assert.equal(invocation.pathPrefix, binDir);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("uses the sd cmd shim bin directory as PATH prefix on Windows when node.exe is beside the shim", () => {
	const root = join(tmpdir(), `snacode-locator-win-${process.pid}-${Date.now()}`);
	const binDir = join(root, "nvm", "v22.22.1");
	mkdirSync(binDir, { recursive: true });
	const sdPath = join(binDir, "sd.cmd");
	writeFileSync(sdPath, "@echo off\r\nnode \"%~dp0\\node_modules\\sd\\bin.js\" %*\r\n", "utf8");
	writeFileSync(join(binDir, "node.exe"), "", "utf8");

	try {
		const { SdLocator } = loadSdLocatorModule("win32");
		const invocation = new SdLocator().createInvocation(sdPath, ["--version"]);

		assert.match(invocation.command.toLowerCase(), /cmd\.exe$/);
		assert.equal(JSON.stringify(invocation.args.slice(0, 3)), JSON.stringify(["/d", "/s", "/c"]));
		assert.equal(invocation.shell, false);
		assert.equal(invocation.pathPrefix, binDir);
		assert.equal(invocation.windowsVerbatimArguments, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("places an explicit WSL cwd before the sd command", () => {
	const { SdLocator } = loadSdLocatorModule("win32");
	const invocation = new SdLocator().createInvocation(
		"wsl://Ubuntu-24.04/root/sd",
		["--mode", "rpc"],
		{ wslCwd: "/root/ba cli" },
	);

	assert.deepEqual(
		Array.from(invocation.args),
		["-d", "Ubuntu-24.04", "-u", "root", "--cd", "/root/ba cli", "sd", "--mode", "rpc"],
	);
	assert.equal(invocation.wsl.distro, "Ubuntu-24.04");
});
