import { useState, useEffect, useMemo } from "react";
import { Copy, Download, ToggleLeft, ToggleRight, Trash2, Search, Sparkles, Clock } from "lucide-react";
import type { CliUpdateResult, ExtensionListResult, ExtensionSummary, ExtensionPackageInfo } from "../../../shared/types";
import { t } from "../i18n";
import { showNotice } from "../utils/notice";

type SortOption = "stars" | "updated" | "forks";

type GithubSearchApi = {
	search: (query: string, sortBy: SortOption) => Promise<ExtensionPackageInfo[]>;
};

function getGithubSearchApi(): GithubSearchApi | null {
	return (window as unknown as { piDesktop?: { githubSearch?: GithubSearchApi } })
		.piDesktop?.githubSearch || null;
}

type ExtensionsApi = {
	list: () => Promise<ExtensionListResult>;
	uninstall: (source: string, scope?: "user" | "project" | "unknown") => Promise<void>;
	install: (source: string) => Promise<string>;
	toggle: (source: string, enabled: boolean) => Promise<void>;
	update: () => Promise<CliUpdateResult>;
};

function getExtensionsApi(): ExtensionsApi {
	const api = (window as unknown as { piDesktop?: { extensions?: ExtensionsApi } })
		.piDesktop?.extensions;
	if (!api) throw new Error("Snacode extensions API is not available");
	return api;
}

/** 预设推荐扩展包 */
const RECOMMENDED_PACKAGES: ExtensionPackageInfo[] = [
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
		name: "pi-web-access",
		description: "网络搜索、URL 抓取、GitHub 仓库克隆、PDF 提取、YouTube 视频理解和本地视频分析。",
		installCmd: "npm:pi-web-access",
		tags: ["extension", "web", "search"],
		downloads: "99K/mo",
		updated: "2026-06-28",
		npmUrl: "https://www.npmjs.com/package/pi-web-access",
		repoUrl: "https://github.com/nicobailon/pi-web-access",
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
		name: "pi-mcp-adapter",
		description: "MCP（Model Context Protocol）适配器扩展，让 Snacode 可以连接任何 MCP 服务器。",
		installCmd: "npm:pi-mcp-adapter",
		tags: ["extension", "mcp"],
		downloads: "99K/mo",
		updated: "2026-06-15",
		npmUrl: "https://www.npmjs.com/package/pi-mcp-adapter",
		repoUrl: "https://github.com/nicobailon/pi-mcp-adapter",
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
		name: "@samfp/pi-memory",
		description: "长期记忆扩展，用于在 Snacode 会话之间保存和检索偏好、项目事实与经验教训。",
		installCmd: "npm:@samfp/pi-memory",
		tags: ["extension", "memory"],
		downloads: "45K/mo",
		updated: "2026-05-20",
		npmUrl: "https://pi.dev/packages/@samfp/pi-memory?name=%40samfp%2Fpi-memory",
		repoUrl: "https://github.com/samfp/pi-memory",
		github: {
			stars: 420,
			forks: 28,
			issues: 6,
			author: "samfp",
			createdAt: "2025-10-05",
			updatedAt: "2026-05-20",
		},
	},
	{
		name: "pi-subagents",
		description: "任务委派扩展，支持链式、并行执行和 TUI 澄清。可将复杂任务拆解给多个子 Agent。",
		installCmd: "npm:pi-subagents",
		tags: ["extension", "subagents", "parallel"],
		downloads: "92K/mo",
		updated: "2026-07-10",
		npmUrl: "https://www.npmjs.com/package/pi-subagents",
		repoUrl: "https://github.com/nicobailon/pi-subagents",
		github: {
			stars: 875,
			forks: 56,
			issues: 10,
			author: "nicobailon",
			createdAt: "2025-06-25",
			updatedAt: "2026-07-10",
		},
	},
].sort((a, b) => (b.github?.stars ?? 0) - (a.github?.stars ?? 0));

export function ExtensionsTab(props: {
	data: ExtensionListResult;
	loading: boolean;
	uninstallingSource: string | null;
	onRefresh: () => void;
	onUninstall: (extension: ExtensionSummary) => void;
}) {
	const [installingSources, setInstallingSources] = useState<Set<string>>(() => new Set());
	const [togglingSource, setTogglingSource] = useState<string | null>(null);
	const [updating, setUpdating] = useState<string | null>(null);
	const [updateResult, setUpdateResult] = useState<CliUpdateResult | null>(null);
	const [showUpdateDialog, setShowUpdateDialog] = useState(false);

	// GitHub 搜索相关状态
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortOption>("stars");
	const [githubLoading, setGithubLoading] = useState(false);
	const [githubPackages, setGithubPackages] = useState<ExtensionPackageInfo[]>([]);
	const [useGithubSearch, setUseGithubSearch] = useState(false);

	// 获取扩展列表（优先使用 GitHub 搜索，回退到预设列表）
	const packages = useMemo(() => {
		if (useGithubSearch && githubPackages.length > 0) {
			return githubPackages;
		}
		return RECOMMENDED_PACKAGES;
	}, [useGithubSearch, githubPackages]);

	// 执行 GitHub 搜索
	const handleGithubSearch = async () => {
		const api = getGithubSearchApi();
		if (!api) {
			showNotice(t("config.githubSearchNotAvailable"), 2000);
			return;
		}
		setGithubLoading(true);
		try {
			const results = await api.search(searchQuery, sortBy);
			setGithubPackages(results);
			setUseGithubSearch(true);
		} catch (e) {
			showNotice(t("config.githubSearchFailed", { error: e instanceof Error ? e.message : String(e) }), 2000);
			setUseGithubSearch(false);
		} finally {
			setGithubLoading(false);
		}
	};

	// 初始化时尝试获取热门扩展
	useEffect(() => {
		const loadPopularExtensions = async () => {
			const api = getGithubSearchApi();
			if (!api) return;
			setGithubLoading(true);
			try {
				const results = await api.search("", "stars");
				if (results.length > 0) {
					setGithubPackages(results);
					setUseGithubSearch(true);
				}
			} catch (e) {
				console.log("GitHub search init failed, using fallback");
			} finally {
				setGithubLoading(false);
			}
		};
		loadPopularExtensions();
	}, []);

	const handleToggle = async (extension: ExtensionSummary) => {
		if (togglingSource) return;
		setTogglingSource(extension.source);
		try {
			const nextEnabled = extension.enabled !== false ? false : true;
			await getExtensionsApi().toggle(extension.source, nextEnabled);
			props.onRefresh();
		} catch (e) {
			alert(t("config.installFailed") + ": " + (e instanceof Error ? e.message : String(e)));
		} finally {
			setTogglingSource(null);
		}
	};

	const handleInstall = async (pkg: ExtensionPackageInfo) => {
		setInstallingSources((current) => new Set(current).add(pkg.installCmd));
		try {
			await getExtensionsApi().install(pkg.installCmd);
			props.onRefresh();
		} catch (e) {
			alert(t("config.installFailed") + ": " + (e instanceof Error ? e.message : String(e)));
		} finally {
			setInstallingSources((current) => {
				const next = new Set(current);
				next.delete(pkg.installCmd);
				return next;
			});
		}
	};

	const handleUpdateExtensions = async () => {
		setUpdating("all");
		setUpdateResult(null);
		setShowUpdateDialog(true);
		try {
			const result = await getExtensionsApi().update();
			setUpdateResult(result);
		} catch (e) {
			alert(t("settings.extensionsUpdateFailed", { error: e instanceof Error ? e.message : String(e) }));
		} finally {
			setUpdating(null);
		}
	};

	return (
		<div className="extensions-tab">
			{showUpdateDialog && (
				<div className="config-update-dialog-backdrop" role="dialog" aria-modal="true">
					<div className="config-update-dialog">
						<div className="config-update-dialog-header">
							<strong>{t("settings.updateExtensionsAll")}</strong>
							<button
								className="config-icon-btn"
								onClick={() => {
									setShowUpdateDialog(false);
									props.onRefresh();
								}}
								disabled={Boolean(updating)}
							>
								×
							</button>
						</div>
						<p className="config-im-form-hint">
							{updating ? t("settings.extensionsUpdatingDesc") : t("settings.extensionsUpdateResultHint")}
						</p>
						<pre className="setting-update-output">
							{updateResult ? `${updateResult.command}\n${updateResult.output}` : t("settings.extensionsUpdating")}
						</pre>
						<div className="config-update-dialog-actions">
							<button
								className="config-btn primary"
								onClick={() => {
									setShowUpdateDialog(false);
									props.onRefresh();
								}}
								disabled={Boolean(updating)}
							>
								{t("common.close")}
							</button>
						</div>
					</div>
				</div>
			)}
			{/* 预设推荐扩展 — 大列表简洁显示 */}
			<div className="config-section" style={{ marginBottom: 20 }}>
				<div className="config-toolbar">
					<h3 className="extensions-installed-title">{t("config.recommendedPackages")}</h3>
					<div className="extensions-search-bar">
						<div className="extensions-search-input-wrapper">
							<Search size={14} strokeWidth={1.8} className="extensions-search-icon" />
							<input
								type="text"
								className="extensions-search-input"
								placeholder={t("config.searchExtensions")}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleGithubSearch()}
							/>
						</div>
						<div className="extensions-sort-buttons">
							<button
								className={`extensions-sort-btn ${sortBy === "stars" ? "active" : ""}`}
								onClick={() => { setSortBy("stars"); handleGithubSearch(); }}
								title={t("config.sortByStars")}
							>
								<Sparkles size={14} strokeWidth={1.8} />
								<span>{t("config.stars")}</span>
							</button>
							<button
								className={`extensions-sort-btn ${sortBy === "updated" ? "active" : ""}`}
								onClick={() => { setSortBy("updated"); handleGithubSearch(); }}
								title={t("config.sortByUpdated")}
							>
								<Clock size={14} strokeWidth={1.8} />
								<span>{t("config.updated")}</span>
							</button>
						</div>
					</div>
				</div>
				{packages.length > 0 && (
					<div className="extensions-source-badge">
						{useGithubSearch ? `GitHub ${t("config.searchResults")}` : t("config.recommended")}
					</div>
				)}
				<p className="config-im-form-hint" style={{ marginBottom: 12 }}>
					{t("config.recommendedPackagesHint")}
				</p>
				<div className="extensions-recommended-list">
					{githubLoading ? (
						<div className="config-loading">{t("config.loadingExtensions")}</div>
					) : packages.map((pkg) => {
						const alreadyInstalled = props.data.extensions.some((ext) => ext.source === pkg.installCmd);
						const installing = installingSources.has(pkg.installCmd);
						return (
						<div
							key={pkg.name}
							className="extensions-recommended-row"
							onClick={() => {
								// pi.dev 的详情路由使用 npm 包名,但查询参数可能是扩展内部展示名。
								const packageName = pkg.piPackageName ?? pkg.name;
								window.open(`https://pi.dev/packages/${pkg.name}?name=${packageName}`, '_blank');
							}}
							title={`${t("config.openPackageDetail")}: ${pkg.name}`}
						>
							<div className="extensions-recommended-info">
								<div className="extensions-recommended-name">
									<strong>{pkg.name}</strong>
									{alreadyInstalled && <span className="config-im-connected-badge" style={{ marginLeft: 8 }}>{t("config.installed")}</span>}
								</div>
								<div className="extensions-recommended-desc">
									{pkg.description}
								</div>
								<div className="extensions-recommended-meta">
									{pkg.github && (
										<>
											<span className="extensions-github-stars">
												★ {pkg.github.stars}
											</span>
											<span className="extensions-github-forks">
												↗ {pkg.github.forks}
											</span>
											<span className="extensions-github-author">
												@{pkg.github.author}
											</span>
											<span className="extensions-github-date">
												创建于 {pkg.github.createdAt}
											</span>
											<span className="extensions-github-updated">
												更新于 {pkg.github.updatedAt}
											</span>
										</>
									)}
									{pkg.downloads && <span className="extensions-downloads">{pkg.downloads}</span>}
								</div>
								<div className="extensions-recommended-tags">
									{pkg.tags.map((tag) => (
										<span key={tag} className="extensions-tag">{tag}</span>
									))}
								</div>
							</div>
							<div className="extensions-recommended-action" onClick={(e) => e.stopPropagation()}>
								{installing ? (
									<span className="config-btn" style={{ opacity: 0.6 }}>{t("config.installing")}</span>
								) : (
									<button
										className="config-icon-btn"
										title={alreadyInstalled ? t("config.installed") : t("config.install")}
										onClick={() => handleInstall(pkg)}
										disabled={alreadyInstalled}
									>
										<Download size={15} strokeWidth={1.8} />
									</button>
								)}
								<button
									className="config-icon-btn"
									title={t("common.copy")}
									onClick={(e) => {
										e.stopPropagation();
										const cmd = `pi install ${pkg.installCmd}`;
										navigator.clipboard.writeText(cmd);
										showNotice(t("app.codeCopied"), 1200);
									}}
								>
									<Copy size={14} strokeWidth={1.8} />
								</button>
							</div>
						</div>
					);
					})}
				</div>
			</div>

			<hr className="extensions-divider" />

			{/* 已安装扩展列表 */}
			<div className="config-section">
				<h3 className="extensions-installed-title">{t("config.installedExtensions")}</h3>
				<div className="config-toolbar" style={{ marginTop: 8 }}>
					<div>
						<span className="config-count">
							{t("config.count.extensions", { count: props.data.extensions.length })}
						</span>
						<small className="skills-restart-hint">
							{t("config.extensionRestartHint")}
						</small>
					</div>
					<div className="skills-toolbar-actions">
						<button className="config-btn" onClick={handleUpdateExtensions} disabled={props.loading || Boolean(updating)}>
							{updating ? t("settings.updating") : t("settings.updateExtensionsAll")}
						</button>
						<button className="config-btn" onClick={props.onRefresh} disabled={props.loading}>
							{t("common.refresh")}
						</button>
					</div>
				</div>
				<div className="skills-list">
					{props.loading ? (
						<div className="config-loading">{t("config.loadingExtensions")}</div>
					) : props.data.extensions.length === 0 ? (
						<div className="config-empty">{t("config.emptyExtensions")}</div>
					) : (
						props.data.extensions.map((extension) => (
							<ExtensionCard
								key={extension.id}
								extension={extension}
								uninstalling={props.uninstallingSource === extension.source}
								onUninstall={props.onUninstall}
								onToggle={handleToggle}
								toggling={togglingSource === extension.source}
							/>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function ExtensionCard(props: {
	extension: ExtensionSummary;
	uninstalling: boolean;
	toggling?: boolean;
	onUninstall: (extension: ExtensionSummary) => void;
	onToggle: (extension: ExtensionSummary) => void;
}) {
	const { extension } = props;
	const name = extension.source.replace(/^(?:npm|file|github|git):/i, "");
	return (
		<article className="session-card skill-card extension-card">
			<div className="session-card-display">
				<div className="session-card-inner skill-card-main">
					<div className="session-card-title skill-title-row">
						<strong>{name}</strong>
						<div className="skill-badges">
							{extension.builtIn && (
								<span className="skill-state enabled">{t("common.builtIn")}</span>
							)}
							<span className={`skill-state ${extension.enabled === false ? "disabled" : "enabled"}`}>
								{extension.enabled !== false ? t("common.enabled") : t("common.disabled")}
							</span>
							<span className="skill-state enabled">
								{extension.scope === "project"
									? t("common.project")
									: t("common.global")}
							</span>
						</div>
					</div>
					<small>{extension.source}</small>
					{!extension.builtIn && (
						<small>
							{t("config.extensionVersions", {
								current: extension.currentVersion ?? "-",
								latest: extension.latestVersion ?? "-",
							})}
							{extension.hasUpdate ? ` · ${t("config.extensionUpdateAvailable")}` : ""}
						</small>
					)}
					{extension.updateError && <small className="setting-status error">{extension.updateError}</small>}
					{extension.path && <small>{extension.path}</small>}
				</div>
				<div className="prompts-list-item-actions">
					<button
						className="config-icon-btn"
						disabled={props.toggling}
						onClick={() => props.onToggle(extension)}
						title={extension.enabled !== false ? t("common.disable") : t("common.enabled")}
						style={extension.enabled !== false ? { color: "var(--color-accent)" } : undefined}
					>
						{extension.enabled !== false ? <ToggleRight size={18} strokeWidth={1.8} /> : <ToggleLeft size={18} strokeWidth={1.8} />}
					</button>
					{!extension.builtIn && (
						<button
							className="config-icon-btn danger"
							disabled={props.uninstalling}
							onClick={() => props.onUninstall(extension)}
							title={props.uninstalling ? t("config.uninstalling") : t("config.uninstall")}
						>
							<Trash2 size={14} strokeWidth={1.8} />
						</button>
					)}
				</div>
			</div>
		</article>
	);
}
