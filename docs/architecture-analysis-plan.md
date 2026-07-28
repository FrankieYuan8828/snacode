# Snacode 架构分析计划

## 一、项目概览

**项目名称**: Snacode
**版本**: 0.6.6
**描述**: 面向本地开发工作的 Electron 桌面应用，用于管理和运行 pi RPC Agent
**技术栈**: Electron 38 + React 19 + TypeScript + Vite

---

## 二、完整架构分析

### 2.1 进程架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Snacode Desktop                             │
├──────────────┬──────────────┬──────────────────────────────────┤
│  Main Process│ Preload      │  Renderer Process                │
│  (Node.js)   │  (Bridge)    │  (Chromium React)               │
├──────────────┼──────────────┼──────────────────────────────────┤
│ AgentManager │ ipcRenderer  │ App.tsx (主窗口)                │
│ PiProcess    │ contextBridge│ PetOverlay.tsx (宠物窗)         │
│ PiRpcClient  │ → piDesktop  │ Components/ (UI组件)            │
│ ConfigManager│              │ Hooks/ (自定义钩子)             │
│ GitService   │              │ Config/ (配置弹窗)              │
│ SessionScanner│             │ utils/ (工具函数)               │
│ SettingsStore│              │ i18n.ts (国际化)               │
│ FeishuBridge │              │ styles.css (全局样式)           │
│ TerminalManager│            │                                 │
│ PetSystem    │              │                                 │
│ WebServiceManager│          │                                 │
└──────────────┴──────────────┴──────────────────────────────────┘
                           │
                           ▼ IPC Channels (shared/ipc.ts)
                           │
┌─────────────────────────────────────────────────────────────────┐
│                     Pi Agent Process (子进程)                   │
│  pi --mode rpc --session <path>                                │
│  通过 stdio JSON-RPC 协议与主进程通信                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
src/
├── main/              # Electron 主进程 (14个子模块)
│   ├── pi/            # pi RPC 进程管理、消息解析
│   ├── sessions/      # 会话扫描、导入、摘要缓存
│   ├── git/           # GitService（status/diff/commit/cherry-pick）
│   ├── prompts/       # PromptManager + XuePromptManager
│   ├── skills/        # SkillManager
│   ├── extensions/    # ExtensionManager
│   ├── settings/      # SettingsStore + DesktopProxy
│   ├── terminal/      # 终端会话管理
│   ├── pet/           # 桌面宠物系统
│   ├── feishu/        # 飞书集成
│   ├── web/           # Web 服务管理
│   ├── config/        # 配置文件管理
│   ├── projects/      # 项目资源管理
│   ├── editors/       # 外部编辑器检测
│   ├── fs/            # 文件系统服务
│   ├── logging/       # 日志服务
│   ├── telemetry/     # 遥测服务
│   └── wsl/           # WSL 环境支持
├── preload/           # preload 脚本，暴露 IPC API
├── renderer/          # React 渲染进程
│   └── src/
│       ├── components/ # UI 组件
│       ├── config/     # 配置弹窗各 tab
│       ├── hooks/      # 自定义 hooks
│       ├── pet/        # 宠物渲染
│       ├── utils/      # 工具函数
│       ├── vendor/     # 第三方资源
│       ├── App.tsx     # 主应用入口
│       ├── i18n.ts     # 国际化文案
│       └── styles.css  # 全局样式
└── shared/            # 主进程与渲染进程共享类型和 IPC 通道定义
```

### 2.3 核心模块职责

| 模块 | 文件 | 核心职责 |
|------|------|----------|
| **AgentManager** | `pi/AgentManager.ts` | Agent 生命周期管理、消息流式处理、工具调用状态追踪 |
| **PiProcess** | `pi/PiProcess.ts` | pi 子进程启动、环境变量配置、版本检测、诊断信息 |
| **PiRpcClient** | `pi/PiRpcClient.ts` | JSON-RPC 协议封装、请求发送与响应解析 |
| **ConfigManager** | `config/ConfigManager.ts` | pi 配置文件管理（models.json/auth.json/settings.json） |
| **GitService** | `git/GitService.ts` | Git 操作封装、分支管理、提交历史、差异对比 |
| **SessionScanner** | `sessions/SessionScanner.ts` | 历史会话扫描、摘要缓存、WSL 路径支持 |
| **SettingsStore** | `settings/SettingsStore.ts` | 应用设置持久化、默认值管理 |
| **FeishuBridge** | `feishu/FeishuBridge.ts` | 飞书机器人连接、消息双向转发、群绑定管理 |
| **PetSystem** | `pet/index.ts` | 桌面宠物系统、状态聚合、多窗口通信 |
| **TerminalSessionManager** | `terminal/TerminalSessionManager.ts` | 终端会话管理、shell 进程控制 |

---

## 三、标识与标识产物规格

### 3.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| **IPC Channels** | kebab-case | `agents:list`, `projects:add`, `git:status` |
| **API 方法名** | camelCase | `agents.list()`, `git.commit()` |
| **TypeScript 类型** | PascalCase | `AgentTab`, `ChatMessage`, `AppSettings` |
| **常量** | UPPER_CASE_SNAKE_CASE | `IPC_CHANNELS`, `RELEASES_URL` |
| **枚举** | PascalCase | `GitStatus`, `AgentStatus` |
| **文件名** | kebab-case | `agent-manager.ts`, `session-scanner.ts` |
| **目录名** | kebab-case | `project-resources`, `terminal-session-manager` |
| **组件名** | PascalCase | `Modal.tsx`, `Button.tsx`, `GitPanel.tsx` |
| **Hook 名** | `use` + PascalCase | `useFeishuBridge`, `useSessionLoader` |
| **CSS 变量** | `--kebab-case` | `--color-accent`, `--font-size-body` |

### 3.2 IPC 通道命名模式

IPC 通道采用 `domain:action` 的命名模式：

```typescript
// 项目管理
projects:list, projects:add, projects:remove, projects:reorder

// Agent 管理
agents:list, agents:create, agents:stop, agents:prompt, agents:abort

// Git 操作
git:branches, git:checkout, git:commit, git:status, git:stage

// 设置管理
settings:get, settings:update

// 飞书桥接
feishu:connect, feishu:disconnect, feishu:messages

// 桌面宠物
pet:state, pet:list, pet:notify

// 终端管理
terminal:list, terminal:create, terminal:input
```

### 3.3 标识链路

#### 3.3.1 IPC 标识链路

```
shared/ipc.ts (通道常量定义)
       ↓
main/index.ts (ipcMain.handle 注册)
       ↓
preload/index.ts (contextBridge.exposeInMainWorld)
       ↓
renderer/src/App.tsx (window.piDesktop.api.xxx 调用)
```

**链路示例：创建 Agent**

```
ipcChannels.agentsCreate = "agents:create"
       ↓
ipcMain.handle(ipcChannels.agentsCreate, async (_event, input) => {
  return agentManager.create(input);
})
       ↓
api.agents.create = (input) => ipcRenderer.invoke(ipcChannels.agentsCreate, input)
       ↓
const tab = await window.piDesktop.agents.create({ projectId: "xxx" });
```

#### 3.3.2 状态标识链路

```
Pi Agent 进程 (JSON-RPC)
       ↓
PiRpcClient (解析 RPC 响应)
       ↓
AgentManager (更新 internal state)
       ↓
emit → ipcMain.send(ipcChannels.agentsState, tabs)
       ↓
preload/index.ts (api.agents.onState callback)
       ↓
renderer (React 状态更新)
```

#### 3.3.3 WSL 环境标识链路

```
SettingsStore.wslEnabled / wslDistro / wslUser
       ↓
syncWslEnvironment(settings) → resolveWslEnvironment()
       ↓
activeWslEnvironment (主进程全局共享)
       ↓
各 Manager.configureWsl(environment)
  ├── agentManager.configureWsl()
  ├── sessionScanner.configureWsl()
  ├── skillManager.configureWsl()
  ├── promptManager.configureWsl()
  ├── extensionManager.configureWsl()
  ├── configManager.configureWsl()
  └── xuePromptManager.configureWsl()
```

---

## 四、数据模型规格

### 4.1 核心数据类型

| 类型 | 关键字段 | 用途 |
|------|----------|------|
| **Project** | id, name, path, pinned, environment | 项目目录信息 |
| **AgentTab** | id, projectId, cwd, title, status, sessionId | Agent 标签页状态 |
| **ChatMessage** | id, agentId, role, text, timestamp, thinking | 聊天消息 |
| **SessionSummary** | id, filePath, preview, updatedAt, messageCount | 会话摘要 |
| **AgentRuntimeState** | modelName, provider, thinkingLevel, isStreaming, contextTokens | Agent 运行时状态 |
| **AppSettings** | theme, language, sendShortcut, petEnabled, wslEnabled | 应用设置 |
| **FeishuBotConfig** | id, name, appId, appSecret, enabled | 飞书机器人配置 |
| **PetAggregateState** | mode, runningCount, errorCount, activeAgentId | 宠物聚合状态 |

### 4.2 状态枚举

```typescript
// Agent 状态
type AgentStatus = "starting" | "idle" | "running" | "error" | "closed";

// 宠物模式
type PetMode = "idle" | "running" | "failed" | "waiting" | "waving" | "hidden" | "jumping" | "running-right" | "running-left" | "review";

// Git 文件状态（VS Code 风格）
enum GitStatus {
  INDEX_MODIFIED, INDEX_ADDED, INDEX_DELETED, INDEX_RENAMED, INDEX_COPIED,
  MODIFIED, DELETED, UNTRACKED, IGNORED, INTENT_TO_ADD, INTENT_TO_RENAME,
  TYPE_CHANGED, ADDED_BY_US, ADDED_BY_THEM, DELETED_BY_US, DELETED_BY_THEM,
  BOTH_ADDED, BOTH_DELETED, BOTH_MODIFIED, INDEX_TYPE_CHANGED,
}
```

---

## 五、构建与打包规格

### 5.1 构建配置

| 配置项 | 值 |
|--------|-----|
| 构建工具 | electron-vite |
| TypeScript 目标 | ES2022 |
| 模块系统 | ESNext |
| 代码分割 | React/Monaco/图标/Markdown 独立 chunk |
| KaTeX 优化 | 仅保留 woff2 字体格式 |

### 5.2 打包配置

| 平台 | 产物类型 |
|------|----------|
| Windows | NSIS Installer, Portable, Zip |
| macOS | DMG, Zip |
| Linux | AppImage, DEB, tar.gz |

### 5.3 应用标识

- **appId**: `com.ayuayue.snacode`
- **productName**: `Snacode`
- **图标**: `build/icon.ico` (Windows), `build/icon.icns` (macOS), `build/icons/` (Linux)

---

## 六、详细 Todo 列表

### 6.1 主进程核心模块

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| M1 | AgentManager 完整生命周期管理（创建/停止/重启/自动重连） | pending | high |
| M2 | PiProcess 进程启动与环境变量配置 | pending | high |
| M3 | PiRpcClient JSON-RPC 协议封装 | pending | high |
| M4 | ConfigManager pi 配置文件读写与验证 | pending | medium |
| M5 | GitService Git 操作封装与缓存策略 | pending | medium |
| M6 | SessionScanner 历史会话扫描与摘要缓存 | pending | medium |
| M7 | SettingsStore 应用设置持久化 | pending | medium |
| M8 | FeishuBridge 飞书机器人连接与消息转发 | pending | medium |
| M9 | PetSystem 桌面宠物状态聚合与多窗口通信 | pending | low |
| M10 | TerminalSessionManager 终端会话管理 | pending | medium |
| M11 | WebServiceManager Web 服务启动与管理 | pending | low |

### 6.2 Preload Bridge

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| P1 | IPC 通道常量定义与维护 (`shared/ipc.ts`) | pending | high |
| P2 | ContextBridge API 暴露 (`preload/index.ts`) | pending | high |
| P3 | 类型定义导出 (`PiDesktopApi`) | pending | high |
| P4 | 订阅模式封装 (subscribe 函数) | pending | medium |

### 6.3 渲染进程组件

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| R1 | 共享 UI 组件（Button/IconButton/SelectField/TextField/Modal） | pending | high |
| R2 | 项目列表与 Agent 管理界面 | pending | high |
| R3 | 聊天会话界面（消息展示/流式渲染/工具调用） | pending | high |
| R4 | Git 面板（状态/提交/历史/分支对比） | pending | medium |
| R5 | 文件抽屉（文件树/文件编辑） | pending | medium |
| R6 | 终端 Dock | pending | medium |
| R7 | 配置弹窗（模型/认证/设置/Skills/Prompts/扩展） | pending | medium |
| R8 | 飞书面板与连接状态 | pending | low |
| R9 | 桌面宠物悬浮窗 | pending | low |
| R10 | 内置浏览器面板 | pending | low |

### 6.4 共享类型与工具

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| S1 | 共享类型定义 (`shared/types.ts`) | pending | high |
| S2 | IPC 通道定义 (`shared/ipc.ts`) | pending | high |
| S3 | 工具运行时状态管理 (`shared/toolRuntimeState.ts`) | pending | high |
| S4 | Codex 会话元数据解析 (`shared/codexSessionMeta.ts`) | pending | medium |
| S5 | 国际化文案管理 (`renderer/src/i18n.ts`) | pending | medium |
| S6 | 全局样式与语义 token (`renderer/src/styles.css`) | pending | medium |

### 6.5 WSL 环境支持

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| W1 | WSL 环境解析 (`wsl/WslEnvironment.ts`) | pending | medium |
| W2 | 路径转换工具 (`wsl/WslPaths.ts`) | pending | medium |
| W3 | 各 Manager 的 WSL 配置传播 | pending | medium |
| W4 | WSL 会话扫描与文件操作 | pending | medium |

### 6.6 构建与打包

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| B1 | Electron Vite 配置 (`electron.vite.config.ts`) | pending | high |
| B2 | TypeScript 配置 (`tsconfig.json`) | pending | high |
| B3 | 打包配置 (`package.json build 字段`) | pending | medium |
| B4 | 图标资源管理 (`build/icons/`) | pending | medium |
| B5 | 额外资源打包（扩展、提示词、宠物） | pending | medium |

### 6.7 跨模块关注点

| 序号 | 任务 | 状态 | 优先级 |
|------|------|------|--------|
| C1 | 日志系统（AppLogger/RpcLogger） | pending | medium |
| C2 | 遥测服务（TelemetryService） | pending | low |
| C3 | 版本更新检测与下载 | pending | medium |
| C4 | 错误边界与异常处理 | pending | medium |
| C5 | 性能优化（消息节流、缓存策略） | pending | medium |

---

## 七、标识链路追踪示例

### 7.1 Agent 创建流程

```
1. 用户点击"启动 Agent"按钮
2. renderer/App.tsx → window.piDesktop.agents.create(input)
3. preload/index.ts → ipcRenderer.invoke("agents:create", input)
4. main/index.ts → ipcMain.handle("agents:create", ...) → agentManager.create(input)
5. AgentManager → PiProcess.start(sessionPath, trustOverride)
6. PiProcess → spawn("pi", ["--mode", "rpc", "--session", path])
7. PiRpcClient 建立连接
8. AgentManager.emit("agents:state", tabs)
9. renderer 收到状态更新，渲染新 Agent 标签页
```

### 7.2 消息发送流程

```
1. 用户在输入框输入消息并发送
2. renderer/App.tsx → window.piDesktop.agents.prompt(input)
3. preload/index.ts → ipcRenderer.invoke("agents:prompt", input)
4. main/index.ts → agentManager.sendPrompt(input)
5. AgentManager → piRpcClient.request("send_prompt", params)
6. Pi Agent 处理并流式返回 text_delta
7. AgentManager.emit("agents:message", { agentId, messages })
8. renderer 实时更新消息展示
```

---

## 八、关键设计决策

### 8.1 进程间通信

- **IPC 通道**: 使用字符串常量定义，避免硬编码
- **通信模式**: 主进程使用 `ipcMain.handle`（请求-响应）和 `ipcMain.send`（推送）
- **安全**: `contextBridge` 暴露 API，`contextIsolation: true` 防止 XSS

### 8.2 状态管理

- **主进程**: 各 Manager 维护内部状态，通过 IPC 推送更新
- **渲染进程**: React 组件内部状态 + useState/useReducer
- **跨窗口**: 宠物窗与主窗口通过 IPC 通信

### 8.3 缓存策略

- **会话摘要**: `SessionSummaryCache` 持久化到磁盘
- **Commit 详情**: LRU 缓存，限制 16 条/2MB
- **模型列表**: 启动时缓存，可手动刷新

### 8.4 错误处理

- **全局异常**: `process.on("uncaughtException")` 和 `process.on("unhandledRejection")`
- **渲染进程**: `window.addEventListener("error")` 和 Error Boundary
- **IPC 错误**: 每个 invoke 都有 try-catch

---

## 九、技术栈详情

| 类别 | 依赖 | 版本 |
|------|------|------|
| Electron | electron | ^38.8.6 |
| React | react / react-dom | ^19.0.0 |
| TypeScript | typescript | ^5.9.0 |
| Vite | vite / electron-vite | ^7.3.5 / ^4.0.0 |
| UI 库 | lucide-react | ^1.17.0 |
| 图标 | lucide-react | ^1.17.0 |
| 编辑器 | monaco-editor | ^0.55.1 |
| 终端 | xterm / xterm-addon-fit | ^6.0.0 / ^0.11.0 |
| 日志 | sonner | ^2.0.7 |
| 数据库 | sql.js | ^1.14.1 |
| 飞书 | @larksuiteoapi/node-sdk | ^1.67.0 |
| 打包 | electron-builder | ^26.8.1 |

---

## 十、后续工作建议

1. **深入分析每个核心模块**的具体实现细节
2. **梳理完整的 IPC 通道清单**并建立文档
3. **分析消息流式处理机制**（text_delta/thinking_delta）
4. **研究 WSL 环境下的路径转换**和进程启动流程
5. **分析桌面宠物系统**的多窗口通信和状态聚合
6. **审查飞书集成**的安全性和消息处理逻辑
7. **验证构建和打包流程**的完整性