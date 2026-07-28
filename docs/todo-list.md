# Snacode 架构分析 Todo 列表

## 一、主进程核心模块

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| M1 | AgentManager 完整生命周期管理（创建/停止/重启/自动重连） | pending | high | - |
| M2 | PiProcess 进程启动与环境变量配置 | pending | high | - |
| M3 | PiRpcClient JSON-RPC 协议封装 | pending | high | M2 |
| M4 | ConfigManager pi 配置文件读写与验证 | pending | medium | - |
| M5 | GitService Git 操作封装与缓存策略 | pending | medium | - |
| M6 | SessionScanner 历史会话扫描与摘要缓存 | pending | medium | - |
| M7 | SettingsStore 应用设置持久化 | pending | medium | - |
| M8 | FeishuBridge 飞书机器人连接与消息转发 | pending | medium | M1 |
| M9 | PetSystem 桌面宠物状态聚合与多窗口通信 | pending | low | M1 |
| M10 | TerminalSessionManager 终端会话管理 | pending | medium | - |
| M11 | WebServiceManager Web 服务启动与管理 | pending | low | M1 |

## 二、Preload Bridge

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| P1 | IPC 通道常量定义与维护 (`shared/ipc.ts`) | pending | high | - |
| P2 | ContextBridge API 暴露 (`preload/index.ts`) | pending | high | P1 |
| P3 | 类型定义导出 (`PiDesktopApi`) | pending | high | P1 |
| P4 | 订阅模式封装 (subscribe 函数) | pending | medium | P2 |

## 三、渲染进程组件

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| R1 | 共享 UI 组件（Button/IconButton/SelectField/TextField/Modal） | pending | high | - |
| R2 | 项目列表与 Agent 管理界面 | pending | high | P2 |
| R3 | 聊天会话界面（消息展示/流式渲染/工具调用） | pending | high | R2 |
| R4 | Git 面板（状态/提交/历史/分支对比） | pending | medium | M5, R2 |
| R5 | 文件抽屉（文件树/文件编辑） | pending | medium | P2 |
| R6 | 终端 Dock | pending | medium | M10, R2 |
| R7 | 配置弹窗（模型/认证/设置/Skills/Prompts/扩展） | pending | medium | M4, P2 |
| R8 | 飞书面板与连接状态 | pending | low | M8, R2 |
| R9 | 桌面宠物悬浮窗 | pending | low | M9 |
| R10 | 内置浏览器面板 | pending | low | P2 |

## 四、共享类型与工具

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| S1 | 共享类型定义 (`shared/types.ts`) | pending | high | - |
| S2 | IPC 通道定义 (`shared/ipc.ts`) | pending | high | - |
| S3 | 工具运行时状态管理 (`shared/toolRuntimeState.ts`) | pending | high | S1 |
| S4 | Codex 会话元数据解析 (`shared/codexSessionMeta.ts`) | pending | medium | S1 |
| S5 | 国际化文案管理 (`renderer/src/i18n.ts`) | pending | medium | - |
| S6 | 全局样式与语义 token (`renderer/src/styles.css`) | pending | medium | - |

## 五、WSL 环境支持

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| W1 | WSL 环境解析 (`wsl/WslEnvironment.ts`) | pending | medium | - |
| W2 | 路径转换工具 (`wsl/WslPaths.ts`) | pending | medium | W1 |
| W3 | 各 Manager 的 WSL 配置传播 | pending | medium | W1 |
| W4 | WSL 会话扫描与文件操作 | pending | medium | W2 |

## 六、构建与打包

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| B1 | Electron Vite 配置 (`electron.vite.config.ts`) | pending | high | - |
| B2 | TypeScript 配置 (`tsconfig.json`) | pending | high | - |
| B3 | 打包配置 (`package.json build 字段`) | pending | medium | - |
| B4 | 图标资源管理 (`build/icons/`) | pending | medium | - |
| B5 | 额外资源打包（扩展、提示词、宠物） | pending | medium | B3 |

## 七、跨模块关注点

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| C1 | 日志系统（AppLogger/RpcLogger） | pending | medium | - |
| C2 | 遥测服务（TelemetryService） | pending | low | - |
| C3 | 版本更新检测与下载 | pending | medium | - |
| C4 | 错误边界与异常处理 | pending | medium | - |
| C5 | 性能优化（消息节流、缓存策略） | pending | medium | M1, M5 |

## 八、标识链路追踪

| 序号 | 任务 | 状态 | 优先级 | 依赖 |
|------|------|------|--------|------|
| I1 | Agent 创建标识链路追踪 | pending | high | M1, P1, R2 |
| I2 | 消息发送标识链路追踪 | pending | high | M1, P1, R3 |
| I3 | 状态推送标识链路追踪 | pending | high | M1, P1 |
| I4 | WSL 环境标识链路追踪 | pending | medium | W1-W4 |
| I5 | 飞书消息标识链路追踪 | pending | medium | M8 |

## 九、优先级排序总览

### High Priority（高优先级）
1. M1 - AgentManager 生命周期管理
2. M2 - PiProcess 进程启动
3. M3 - PiRpcClient 协议封装
4. P1 - IPC 通道定义
5. P2 - ContextBridge API 暴露
6. P3 - 类型定义导出
7. S1 - 共享类型定义
8. S2 - IPC 通道定义
9. S3 - 工具运行时状态
10. R1 - 共享 UI 组件
11. R2 - 项目列表与 Agent 管理
12. R3 - 聊天会话界面
13. B1 - Electron Vite 配置
14. B2 - TypeScript 配置
15. I1 - Agent 创建标识链路
16. I2 - 消息发送标识链路
17. I3 - 状态推送标识链路

### Medium Priority（中优先级）
18. M4 - ConfigManager 配置管理
19. M5 - GitService Git 操作
20. M6 - SessionScanner 会话扫描
21. M7 - SettingsStore 设置持久化
22. M8 - FeishuBridge 飞书集成
23. M10 - TerminalSessionManager 终端管理
24. P4 - 订阅模式封装
25. R4 - Git 面板
26. R5 - 文件抽屉
27. R6 - 终端 Dock
28. R7 - 配置弹窗
29. S4 - Codex 会话元数据
30. S5 - 国际化文案
31. S6 - 全局样式
32. W1-W4 - WSL 环境支持
33. B3-B5 - 构建打包配置
34. C1, C3-C5 - 跨模块关注点
35. I4-I5 - 标识链路追踪

### Low Priority（低优先级）
36. M9 - PetSystem 桌面宠物
37. M11 - WebServiceManager
38. R8 - 飞书面板
39. R9 - 桌面宠物悬浮窗
40. R10 - 内置浏览器面板
41. C2 - 遥测服务

## 十、进度统计

| 状态 | 数量 | 占比 |
|------|------|------|
| pending | 41 | 100% |
| in_progress | 0 | 0% |
| completed | 0 | 0% |

---

*更新时间: 2026-07-25*
*项目版本: v0.6.6*