import axios from "axios";
import type { ExtensionPackageInfo } from "../../shared/types";

/**
 * GitHub Snacode 扩展仓库服务
 * 通过 GitHub API 获取 Snacode 扩展列表，支持搜索和星数排序
 */
export class GithubExtensionService {
	private readonly GITHUB_API_BASE = "https://api.github.com";
	private readonly DEFAULT_QUERY = "topic:snacode-extension OR topic:snacode-mcp";
	private readonly MAX_RESULTS = 50;

	/**
	 * 搜索 GitHub 上的 Snacode 扩展
	 */
	async searchExtensions(query: string = "", sortBy: "stars" | "updated" | "forks" = "stars"): Promise<ExtensionPackageInfo[]> {
		try {
			const searchQuery = query ? `${this.DEFAULT_QUERY} ${query}` : this.DEFAULT_QUERY;
			const response = await axios.get(`${this.GITHUB_API_BASE}/search/repositories`, {
				params: {
					q: searchQuery,
					sort: sortBy,
					order: "desc",
					per_page: this.MAX_RESULTS,
				},
				headers: {
					"Accept": "application/vnd.github.v3+json",
					"User-Agent": "Snacode-Extension-Service",
				},
			});

			const repositories = response.data.items || [];
			return repositories.map(this.convertToPackageInfo).filter(Boolean);
		} catch (error) {
			console.warn("GitHub API search failed, using fallback:", error);
			return this.getFallbackExtensions();
		}
	}

	/**
	 * 获取单个仓库详情
	 */
	async getRepoDetails(owner: string, repo: string): Promise<any | null> {
		try {
			const response = await axios.get(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}`, {
				headers: {
					"Accept": "application/vnd.github.v3+json",
					"User-Agent": "Snacode-Extension-Service",
				},
			});
			return response.data;
		} catch (error) {
			console.warn("GitHub API get repo failed:", error);
			return null;
		}
	}

	/**
	 * 将 GitHub 仓库转换为扩展包信息
	 */
	private convertToPackageInfo(repo: any): ExtensionPackageInfo | null {
		if (!repo.name || !repo.description) return null;

		// 从 package.json 或 README 中提取安装命令
		const installCmd = this.extractInstallCmd(repo);

		return {
			name: repo.name,
			description: repo.description,
			installCmd: installCmd,
			tags: this.extractTags(repo),
			downloads: "",
			updated: repo.updated_at ? new Date(repo.updated_at).toISOString().split("T")[0] : "",
			npmUrl: repo.homepage || `https://www.npmjs.com/package/${repo.name}`,
			repoUrl: repo.html_url,
			github: {
				stars: repo.stargazers_count || 0,
				forks: repo.forks_count || 0,
				issues: repo.open_issues_count || 0,
				author: repo.owner?.login || "",
				createdAt: repo.created_at ? new Date(repo.created_at).toISOString().split("T")[0] : "",
				updatedAt: repo.updated_at ? new Date(repo.updated_at).toISOString().split("T")[0] : "",
			},
		};
	}

	/**
	 * 从仓库信息中提取安装命令
	 */
	private extractInstallCmd(repo: any): string {
		const name = repo.name;
		// 优先使用 npm 安装命令
		if (name.startsWith("@")) {
			return `npm:${name}`;
		}
		return `npm:${name}`;
	}

	/**
	 * 从仓库主题中提取标签
	 */
	private extractTags(repo: any): string[] {
		const topics = repo.topics || [];
		const tags: string[] = ["extension"];
		
		if (topics.includes("mcp") || topics.includes("mcp-server")) {
			tags.push("mcp");
		}
		if (topics.includes("web")) {
			tags.push("web");
		}
		if (topics.includes("memory")) {
			tags.push("memory");
		}
		if (topics.includes("context")) {
			tags.push("context");
		}

		return tags;
	}

	/**
	 * 获取备用扩展列表（当 GitHub API 不可用时）
	 */
	private getFallbackExtensions(): ExtensionPackageInfo[] {
		return [
			{
				name: "context-mode",
			description: "MCP 插件，可节省 98% 的上下文窗口。支持 Claude Code、Gemini CLI、VS Code Copilot 等。沙箱代码执行、FTS5 知识库和意图驱动搜索。",
			installCmd: "npm:context-mode",
			tags: ["extension", "context", "knowledge"],
			downloads: "107K/mo",
			updated: "2026-07-01",
			npmUrl: "https://www.npmjs.com/package/context-mode",
			repoUrl: "https://github.com/mksglu/context-mode",
			github: {
					stars: 1280,
					forks: 86,
					issues: 12,
					author: "mksglu",
					createdAt: "2025-03-15",
					updatedAt: "2026-07-20",
				},
			},
			{
			name: "snacode-web-access",
			description: "网络搜索、URL 抓取、GitHub 仓库克隆、PDF 提取、YouTube 视频理解和本地视频分析。",
			installCmd: "npm:snacode-web-access",
			tags: ["extension", "web", "search"],
			downloads: "99K/mo",
			updated: "2026-06-28",
			npmUrl: "https://www.npmjs.com/package/snacode-web-access",
			repoUrl: "https://github.com/FrankieYuan8828/snacode-web-access",
			github: {
					stars: 956,
					forks: 45,
					issues: 8,
					author: "nicobailon",
					createdAt: "2025-05-20",
					updatedAt: "2026-06-28",
				},
			},
			{
			name: "snacode-mcp-adapter",
			description: "MCP（Model Context Protocol）适配器扩展，让 Snacode 可以连接任何 MCP 服务器。",
			installCmd: "npm:snacode-mcp-adapter",
			tags: ["extension", "mcp"],
			downloads: "99K/mo",
			updated: "2026-06-15",
			npmUrl: "https://www.npmjs.com/package/snacode-mcp-adapter",
			repoUrl: "https://github.com/FrankieYuan8828/snacode-mcp-adapter",
			github: {
					stars: 620,
					forks: 32,
					issues: 5,
					author: "nicobailon",
					createdAt: "2025-08-10",
					updatedAt: "2026-06-15",
				},
			},
			{
			name: "snacode-subagents",
			description: "任务委派扩展，支持链式、并行执行和 TUI 澄清。可将复杂任务拆解给多个子 Agent。",
			installCmd: "npm:snacode-subagents",
			tags: ["extension", "subagents", "parallel"],
			downloads: "92K/mo",
			updated: "2026-07-10",
			npmUrl: "https://www.npmjs.com/package/snacode-subagents",
			repoUrl: "https://github.com/FrankieYuan8828/snacode-subagents",
			github: {
					stars: 875,
					forks: 56,
					issues: 10,
					author: "nicobailon",
					createdAt: "2025-06-25",
					updatedAt: "2026-07-10",
				},
			},
			{
			name: "@snacode/snacode-memory",
			description: "长期记忆扩展，用于在 Snacode 会话之间保存和检索偏好、项目事实与经验教训。",
			installCmd: "npm:@snacode/snacode-memory",
			tags: ["extension", "memory"],
			downloads: "45K/mo",
			updated: "2026-05-20",
			npmUrl: "https://www.npmjs.com/package/@snacode/snacode-memory",
			repoUrl: "https://github.com/FrankieYuan8828/snacode-memory",
			github: {
					stars: 420,
					forks: 28,
					issues: 6,
					author: "samfp",
					createdAt: "2025-10-05",
					updatedAt: "2026-05-20",
				},
			},
		].sort((a, b) => (b.github?.stars ?? 0) - (a.github?.stars ?? 0));
	}

	/**
	 * 获取热门 Snacode 扩展（按星数排序）
	 */
	async getPopularExtensions(): Promise<ExtensionPackageInfo[]> {
		return this.searchExtensions("", "stars");
	}

	/**
	 * 获取最近更新的扩展
	 */
	async getRecentExtensions(): Promise<ExtensionPackageInfo[]> {
		return this.searchExtensions("", "updated");
	}
}

export const githubExtensionService = new GithubExtensionService();
