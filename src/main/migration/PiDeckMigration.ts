import { app } from "electron";
import { readdir, readFile, writeFile, mkdir, copyFile, rename } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { AppLogger } from "../logging/AppLogger";

/**
 * PiDeck → Snacode 数据迁移工具
 * 
 * 在首次启动时自动检测旧版 PiDeck 数据目录，将配置、会话、项目等数据迁移到新的 Snacode 目录。
 * 
 * 迁移内容：
 * - 用户数据目录重命名: ~/.pi-desktop → ~/.snacode
 * - 飞书配置: feishu.json
 * - 应用设置: settings.json
 * - 项目配置: projects.json
 * - 会话历史: chat-workspace 目录
 * - 扩展配置: extensions 相关配置
 * 
 * 迁移策略：
 * 1. 仅在检测到旧目录且新目录不存在时执行迁移
 * 2. 迁移完成后保留旧目录备份（添加 .backup 后缀）
 * 3. 记录迁移日志便于问题排查
 */

export interface MigrationResult {
	success: boolean;
	migratedFiles: string[];
	skippedFiles: string[];
	error?: string;
}

export class PiDeckMigration {
	private readonly oldDataDir: string;
	private readonly newDataDir: string;
	private readonly logger: AppLogger | undefined;

	constructor(logger?: AppLogger) {
		this.oldDataDir = join(app.getPath("userData"), "pi-desktop");
		this.newDataDir = join(app.getPath("userData"), "snacode");
		this.logger = logger;
	}

	/**
	 * 检查是否需要执行迁移
	 * @returns true 表示需要迁移（旧目录存在且新目录不存在）
	 */
	async needsMigration(): Promise<boolean> {
		const oldExists = existsSync(this.oldDataDir) && statSync(this.oldDataDir).isDirectory();
		const newExists = existsSync(this.newDataDir) && statSync(this.newDataDir).isDirectory();
		return oldExists && !newExists;
	}

	/**
	 * 执行完整迁移流程
	 */
	async migrate(): Promise<MigrationResult> {
		const result: MigrationResult = {
			success: false,
			migratedFiles: [],
			skippedFiles: [],
		};

		try {
			this.log("info", "Starting PiDeck → Snacode migration...");
			
			// 创建新数据目录
			await mkdir(this.newDataDir, { recursive: true });
			this.log("info", `Created new data directory: ${this.newDataDir}`);

			// 迁移文件和目录
			const items = await readdir(this.oldDataDir);
			for (const item of items) {
				const oldPath = join(this.oldDataDir, item);
				const newPath = join(this.newDataDir, item);
				const stat = statSync(oldPath);

				try {
					if (stat.isDirectory()) {
						await this.copyDirectory(oldPath, newPath);
					} else {
						await copyFile(oldPath, newPath);
					}
					result.migratedFiles.push(item);
					this.log("info", `Migrated: ${item}`);
				} catch (err) {
					result.skippedFiles.push(item);
					this.log("warn", `Failed to migrate ${item}: ${err}`);
				}
			}

			// 更新配置文件中的旧引用
			await this.updateConfigReferences();

			// 重命名旧目录为备份
			const backupDir = `${this.oldDataDir}.backup`;
			await rename(this.oldDataDir, backupDir);
			this.log("info", `Old data directory backed up to: ${backupDir}`);

			result.success = true;
			this.log("info", "Migration completed successfully");

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			result.error = errorMsg;
			this.log("error", `Migration failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * 递归复制目录
	 */
	private async copyDirectory(source: string, destination: string): Promise<void> {
		await mkdir(destination, { recursive: true });
		const items = await readdir(source);
		
		for (const item of items) {
			const sourcePath = join(source, item);
			const destPath = join(destination, item);
			const stat = statSync(sourcePath);

			if (stat.isDirectory()) {
				await this.copyDirectory(sourcePath, destPath);
			} else {
				await copyFile(sourcePath, destPath);
			}
		}
	}

	/**
	 * 更新配置文件中的旧引用（如 pi-deck → snacode）
	 */
	private async updateConfigReferences(): Promise<void> {
		const configFiles = [
			"settings.json",
			"projects.json",
			"feishu.json",
		];

		for (const fileName of configFiles) {
			const filePath = join(this.newDataDir, fileName);
			if (!existsSync(filePath)) continue;

			try {
				let content = await readFile(filePath, "utf-8");
				content = content.replace(/pi-deck/g, "snacode");
				content = content.replace(/PiDeck/g, "Snacode");
				await writeFile(filePath, content, "utf-8");
				this.log("info", `Updated references in: ${fileName}`);
			} catch (err) {
				this.log("warn", `Failed to update ${fileName}: ${err}`);
			}
		}
	}

	/**
	 * 记录日志
	 */
	private log(level: "info" | "warn" | "error", message: string): void {
		if (this.logger) {
			void this.logger[level]("migration", message);
		} else {
			console.log(`[Migration] [${level.toUpperCase()}] ${message}`);
		}
	}
}
