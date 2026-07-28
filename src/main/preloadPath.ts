import { app } from "electron";
import { copyFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { is } from "@electron-toolkit/utils";

export async function preparePreloadPath(sourcePath: string, name: string) {
	if (!is.dev || app.isPackaged) return sourcePath;

	// 开发模式下直接使用 sourcePath，确保每次使用最新编译的 preload 文件
	// 避免缓存的旧文件导致 API 注入不一致
	console.log(`[preload] Using source path directly (dev mode): ${sourcePath}`);
	return sourcePath;
}
