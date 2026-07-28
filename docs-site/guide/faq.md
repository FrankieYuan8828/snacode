# 常见问题

这里整理了一些与 **Snacode**、**sd Agent 桌面工作台**、**本地 AI 编码助手** 相关的常见问题，帮助搜索引擎和用户更快找到答案。

## Snacode 是什么？

**Snacode** 是一个开源的桌面工作台，用于在本地项目目录中统一管理 sd Agent 会话，并支持导入 Codex、Claude 本地会话以便统一浏览和恢复。它基于 Electron + TypeScript 构建，提供多项目工作区、AI 会话管理、Git 集成、内置终端、模型配置和插件扩展能力。

## Snacode 和 sd 是什么关系？

Snacode **不是** sd 的分支。它是一个轻量 Electron 外壳，通过启动多个 `sd --mode rpc` 进程，把项目管理、会话管理、对话界面、配置管理和工具编排整合到原生桌面应用中；所有 Agent 能力仍由 sd 原生提供。

## 支持哪些 AI 编码助手？

Snacode 原生支持 **sd** Agent。通过会话导入功能，你也可以将本地的 **Codex** 和 **Claude** 会话导入为 Snacode 历史会话，方便统一浏览和恢复。

## 支持哪些平台？

Snacode 提供 **Windows**、**macOS**、**Linux** 的预构建安装包，通过 [GitHub Releases](https://github.com/FrankieYuan8828/snacode/releases) 发布。源码开发环境要求 Node.js 20+ 和 npm。

## 如何下载安装 Snacode？

前往 [GitHub Releases](https://github.com/FrankieYuan8828/snacode/releases) 下载对应平台的安装包。安装后首次启动时，Snacode 会尝试自动检测 `sd` 路径；如果检测失败，可以在设置里手动填写 sd 可执行文件路径。

## 从源码运行需要什么环境？

- Node.js 20+
- npm
- 系统 `PATH` 中可访问 `sd` 命令
- 已完成 sd 的 Provider、登录或 API Key 配置

验证 sd 是否可用：

```bash
sd --version
sd --mode rpc
```

## Snacode 的主要功能有哪些？

- **多项目工作区**：同时管理多个本地项目，每个项目独立运行 sd Agent
- **会话历史与恢复**：浏览、恢复、导出历史对话
- **Git 集成**：实时分支显示、文件状态、本地和远程分支管理
- **内置终端 Dock**：Agent 绑定独立终端 tab，支持多标签、主题切换
- **可视化配置管理**：图形化编辑 Models、Auth、Settings
- **插件与 Skill 管理**：全局和项目级 Skills 与 Extension 管理
- **上下文感知输入**：`@` 文件引用、`!` Shell 执行、`/` 斜线命令
- **内置浏览器预览**：右侧抽屉浏览网页，支持多标签和视口预设

## Snacode 是免费的吗？

是的，Snacode 基于 **MIT License** 开源，完全免费使用。

## 如何从源码开发 Snacode？

```bash
git clone https://github.com/FrankieYuan8828/snacode.git
cd snacode
npm install
npm run make-icon
npm run dev
```

常用开发命令：

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发模式 |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run build` | 构建 Renderer + Main 产物 |
| `npm run dist` | 为当前平台打包 |

## Snacode 会收集我的数据吗？

Snacode 默认发送匿名、低频的 `app_heartbeat` 使用统计，用于了解版本分布、平台兼容性和活跃安装数量，可在设置中关闭。它**不会**收集项目路径、代码、消息内容、会话内容或文件名，也不会上传文件。

## 如何参与贡献？

欢迎提交 Issue 和 Pull Request。详细贡献说明请查看 [CONTRIBUTORS.md](/guide/contributors)。

## 遇到问题怎么办？

- 查看 [GitHub Issues](https://github.com/FrankieYuan8828/snacode/issues)
- 加入 **QQ 群：1026218644** 进行交流
