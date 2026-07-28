# Snacode 完整升级方案

## 一、项目概述

### 1.1 升级背景

Snacode 是一个基于 Electron 的桌面应用，用于管理和运行 pi RPC Agent。由于 Electron 架构的限制（单进程模型、伪终端、资源受限），决定将项目升级为 **Snacode**，采用全新的多 Agent 并行架构。

### 1.2 核心目标

| 目标 | 说明 |
|------|------|
| **多 Agent 并行** | 支持子 Agent 并行执行，提高吞吐量 |
| **记忆瓜分与递归** | 主 Agent 成为不断进化的智慧体，减少幻觉 |
| **历史+记忆整理** | 独立 Agent 负责上下文实时整理优化，降低上下文断裂 |
| **ALGS 技能卡管理器** | LoRA 微调卡片技能系统，支持向量检索 + 上下文拼接 |
| **sd CLI 执行引擎** | pi CLI → sd CLI，升级为真实终端 |
| **混合模式运行时** | 本地进程 + Docker 容器 |

### 1.3 项目重命名

所有标识、产物、代号从 **Snacode** 改为 **Snacode**：

| 原名称 | 新名称 |
|--------|--------|
| Snacode | Snacode |
| snacode | snacode |
| com.ayuayue.snacode | com.snacode.app |
| Pi Agent | sd Agent / Snacode Agent |
| pi CLI | sd CLI |
| PiProcess | SdProcess |
| AgentManager | SnacodeManager |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Snacode Desktop (Electron)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │   Main      │    │  Worker     │    │  Worker     │                │
│  │  Process    │    │  Process 1  │    │  Process N  │                │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                │
│         │                  │                  │                        │
│         ▼                  ▼                  ▼                        │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              Snacode Orchestration Layer                     │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │      │
│  │  │  ALGS    │ │  Memory  │ │  History │ │  Task Queue  │    │      │
│  │  │  Manager │ │  Manager │ │  Manager │ │  & Recursion │    │      │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘    │      │
│  │       │            │            │              │              │      │
│  └───────┼────────────┼────────────┼──────────────┼──────────────┘      │
│          │            │            │              │                     │
│          ▼            ▼            ▼              ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                  Multi-Agent Runtime Layer                   │      │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐    │      │
│  │  │ Master  │ │ Worker  │ │ Worker  │ │ History+Memory  │    │      │
│  │  │ Agent   │ │ Agent 1 │ │ Agent N │ │     Agent       │    │      │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘    │      │
│  │       │           │           │                │              │      │
│  └───────┼───────────┼───────────┼────────────────┼──────────────┘      │
│          │           │           │                │                     │
│          ▼           ▼           ▼                ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                     Execution Engine                         │      │
│  │  ┌──────────┐           ┌──────────┐           ┌──────────┐  │      │
│  │  │ sd CLI   │           │  Docker  │           │   vLLM   │  │      │
│  │  │ (Local)  │           │ (Remote) │           │ (LoRA)   │  │      │
│  │  └──────────┘           └──────────┘           └──────────┘  │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件职责

| 组件 | 职责 | 关键特性 |
|------|------|----------|
| **SnacodeManager** | 主 Agent 管理器，任务分发与递归控制 | 进化判断、递归回调、结果验证 |
| **ALGSManager** | LoRA 技能卡管理器 | 向量检索、技能卡组装、上下文拼接 fallback |
| **MemoryManager** | 记忆瓜分与存储 | 短期记忆、长期记忆、记忆索引 |
| **HistoryManager** | 历史上下文整理优化 | 实时整理、去重、摘要、连贯性增强 |
| **TaskQueue** | 任务队列与调度 | 并行执行、优先级、状态追踪 |
| **SdProcess** | sd CLI 执行引擎 | 真实终端、环境隔离、进程管理 |

---

## 三、ALGS 技能卡系统设计

### 3.1 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        ALGS Manager                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              技能卡仓库 (Skill Card Repository)           │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────┐  │    │
│  │  │ LoRA权重文件 │ │ 任务描述向量 │ │   元数据信息      │  │    │
│  │  │ (.safetensors│ │  (Vector)   │ │ (领域/版本/评分)  │  │    │
│  │  │   文件路径)  │ │             │ │                   │  │    │
│  │  └─────────────┘ └─────────────┘ └───────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    任务路由层                             │    │
│  │  retrieve_skill(task_desc) → Top-N LoRA 匹配            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                    ┌─────────┴─────────┐                         │
│                    ▼                   ▼                         │
│         ┌───────────────┐    ┌──────────────────┐               │
│         │ 检索成功      │    │ 检索失败          │               │
│         │ 组装技能卡     │    │ 上下文拼接fallback│               │
│         │ (LoRA + 参数) │    │ (System Prompt   │               │
│         └───────┬───────┘    │ + Few-shot)      │               │
│                 │            └────────┬─────────┘               │
│                 └────────────┬────────┘                         │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    推理执行层                             │    │
│  │  assemble_card(lora_path, task_params) → 启动推理进程   │    │
│  │  动态加载 LoRA 适配器到 vLLM/Transformers               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   递归回调层                              │    │
│  │  recurse_callback(result) → 判断是否触发下一轮调用       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 预存领域技能卡

| 领域分类 | 具体领域 | 技能卡示例 |
|----------|----------|------------|
| **办公** | 文档处理、表格分析、演示制作 | office-docx, office-excel, office-ppt |
| **编程** | Python、TypeScript、Java、Go | code-python, code-typescript, code-java |
| **绘图** | 2D 绘图、3D 建模、CAD | draw-2d, draw-3d, draw-cad |
| **工程** | 电子工程、机械工程、建筑工程 | eng-electronic, eng-mechanical, eng-architecture |
| **科学** | 物理、化学、数学、生物 | sci-physics, sci-chemistry, sci-mathematics |
| **数据** | 数据分析、机器学习、深度学习 | data-analysis, ml-classification, dl-vision |
| **写作** | 创意写作、技术文档、法律文书 | write-creative, write-technical, write-legal |
| **金融** | 股票分析、财务建模、投资策略 | fin-stock, fin-finance, fin-investment |
| **语言** | 英语学习、翻译、文学分析 | lang-english, lang-translate, lang-literature |
| **学科** | 历史、地理、政治、天文 | sub-history, sub-geography, sub-astronomy |

### 3.3 ALGS 核心接口定义

```typescript
interface SkillCard {
  id: string;
  domain: string;
  loraPath: string;        // .safetensors 文件路径
  description: string;     // 技能描述
  vector: number[];        // 描述向量
  version: string;
  rating: number;          // 评分（用于排序）
  usageCount: number;      // 使用次数
  createdAt: Date;
}

interface TaskDescription {
  text: string;
  domain?: string;
  requirements: string[];
  constraints: string[];
}

interface SkillCardResult {
  card: SkillCard | null;
  matchScore: number;
  fallback: boolean;       // 是否使用上下文拼接 fallback
  systemPrompt?: string;   // fallback 时的 System Prompt
  fewShotExamples?: string[];
}

class ALGSManager {
  // 从向量库召回 Top-N 匹配的技能卡
  async retrieveSkill(taskDesc: TaskDescription): Promise<SkillCardResult[]>;
  
  // 组装技能卡，启动推理进程
  async assembleCard(skillCard: SkillCard, taskParams: Record<string, unknown>): Promise<WorkerAgent>;
  
  // 递归回调：判断是否触发下一轮 ALGS 调用
  async recurseCallback(result: AgentResult): Promise<{
    continue: boolean;
    nextTask?: TaskDescription;
    updatedContext?: string;
  }>;
  
  // 注册新技能卡
  async registerSkillCard(card: Omit<SkillCard, 'id' | 'createdAt'>): Promise<SkillCard>;
  
  // 更新技能卡评分
  async updateSkillCardRating(cardId: string, rating: number): Promise<void>;
}
```

---

## 四、多 Agent 架构设计

### 4.1 Agent 类型

| Agent 类型 | 职责 | 特性 |
|------------|------|------|
| **Master Agent** | 主智慧体，任务分解与递归控制 | 进化机制、结果验证、递归判断 |
| **Worker Agent** | 子 Agent，执行具体任务 | 并行执行、技能卡挂载、结果返回 |
| **History+Memory Agent** | 独立 Agent，上下文整理优化 | 实时整理、记忆整合、连贯性增强 |

### 4.2 Master Agent 进化机制

```typescript
interface AgentEvolutionState {
  currentVersion: string;
  taskSuccessRate: number;
  hallucinationRate: number;
  optimizationScore: number;
  learnedPatterns: Array<{
    pattern: string;
    context: string;
    action: string;
    outcome: 'success' | 'failure';
    confidence: number;
  }>;
}

class MasterAgent {
  private evolutionState: AgentEvolutionState;
  private memoryManager: MemoryManager;
  
  // 执行任务并根据结果进化
  async executeAndEvolve(task: TaskDescription): Promise<AgentResult> {
    // 1. 分析任务，选择合适的技能卡
    const skillCards = await this.algsManager.retrieveSkill(task);
    
    // 2. 分发任务给 Worker Agent
    const results = await this.taskQueue.dispatch(skillCards, task);
    
    // 3. 验证结果，检测幻觉
    const verifiedResults = await this.verifyResults(results);
    
    // 4. 根据验证结果更新进化状态
    this.updateEvolutionState(results, verifiedResults);
    
    // 5. 判断是否需要递归
    const recursionDecision = await this.algsManager.recurseCallback(verifiedResults);
    
    if (recursionDecision.continue) {
      // 递归调用，使用更新后的上下文
      return this.executeAndEvolve(recursionDecision.nextTask!);
    }
    
    return verifiedResults;
  }
  
  // 结果验证：检测幻觉、验证正确性
  private async verifyResults(results: AgentResult[]): Promise<AgentResult[]> {
    // 使用历史数据、外部知识验证结果
    // 标记可疑结果，降低置信度
  }
  
  // 更新进化状态
  private updateEvolutionState(
    originalResults: AgentResult[],
    verifiedResults: AgentResult[]
  ): void {
    // 统计成功率、幻觉率
    // 学习成功模式，存储到记忆中
    // 优化下一轮的任务分解策略
  }
}
```

### 4.3 记忆瓜分机制

```typescript
interface MemoryChunk {
  id: string;
  type: 'short-term' | 'long-term' | 'working';
  content: string;
  metadata: {
    source: string;
    timestamp: Date;
    relevanceScore: number;
    tags: string[];
    linkedChunks: string[];
  };
}

interface MemoryIndex {
  vector: number[];
  chunkId: string;
}

class MemoryManager {
  private shortTermMemory: Map<string, MemoryChunk>;  // 当前会话
  private longTermMemory: Map<string, MemoryChunk>;   // 持久化存储
  private memoryIndex: MemoryIndex[];                  // 向量索引
  
  // 瓜分记忆：根据类型和相关性分配到不同存储
  async partitionMemory(content: string, context: string): Promise<MemoryChunk[]> {
    // 1. 向量化内容
    const vector = await this.vectorize(content);
    
    // 2. 判断记忆类型
    const type = this.determineMemoryType(content, context);
    
    // 3. 创建记忆块
    const chunk: MemoryChunk = {
      id: randomUUID(),
      type,
      content,
      metadata: {
        source: context,
        timestamp: new Date(),
        relevanceScore: 1.0,
        tags: this.extractTags(content),
        linkedChunks: []
      }
    };
    
    // 4. 存储到对应位置
    if (type === 'short-term') {
      this.shortTermMemory.set(chunk.id, chunk);
    } else {
      this.longTermMemory.set(chunk.id, chunk);
      this.memoryIndex.push({ vector, chunkId: chunk.id });
    }
    
    return [chunk];
  }
  
  // 检索相关记忆
  async retrieveRelatedMemory(query: string, limit: number = 10): Promise<MemoryChunk[]> {
    const queryVector = await this.vectorize(query);
    // 向量检索，返回相关记忆块
  }
  
  // 合并记忆：将多个相关记忆块合并为更紧凑的表示
  async mergeRelatedChunks(chunkIds: string[]): Promise<MemoryChunk> {
    // 提取共同主题，生成摘要
    // 创建新的记忆块，建立关联
  }
}
```

### 4.4 History+Memory Agent

```typescript
class HistoryMemoryAgent {
  private historyManager: HistoryManager;
  private memoryManager: MemoryManager;
  
  // 实时整理历史上下文
  async processHistory(messages: ChatMessage[]): Promise<ProcessedHistory> {
    // 1. 去重：移除重复或冗余的消息
    const deduplicated = this.deduplicateMessages(messages);
    
    // 2. 摘要：生成关键信息摘要
    const summary = await this.generateSummary(deduplicated);
    
    // 3. 连贯性分析：检测上下文断裂
    const coherenceIssues = await this.analyzeCoherence(deduplicated);
    
    // 4. 记忆整合：结合记忆管理器的结果
    const memoryContext = await this.memoryManager.retrieveRelatedMemory(
      summary,
      5
    );
    
    // 5. 综合改写：根据记忆和分析结果优化上下文
    const optimizedContext = await this.optimizeContext(
      deduplicated,
      summary,
      memoryContext,
      coherenceIssues
    );
    
    // 6. 更新记忆：将新的上下文存入记忆
    await this.memoryManager.partitionMemory(optimizedContext, 'history');
    
    return {
      originalCount: messages.length,
      optimizedCount: optimizedContext.length,
      summary,
      coherenceScore: this.calculateCoherenceScore(coherenceIssues),
      memoryReferences: memoryContext.length
    };
  }
  
  // 检测上下文断裂
  private async analyzeCoherence(messages: ChatMessage[]): Promise<CoherenceIssue[]> {
    // 检测：话题跳转、引用缺失、逻辑断层
    // 返回需要修复的问题列表
  }
  
  // 优化上下文：减少长度，增强连贯性
  private async optimizeContext(
    messages: ChatMessage[],
    summary: string,
    memoryContext: MemoryChunk[],
    issues: CoherenceIssue[]
  ): Promise<ChatMessage[]> {
    // 使用记忆上下文填补断裂
    // 合并相关消息
    // 生成更紧凑的表示
  }
}
```

---

## 五、sd CLI 执行引擎升级

### 5.1 核心改进

| 改进项 | 原实现 | 新实现 |
|--------|--------|--------|
| **终端类型** | 伪终端 (node-pty) | 真实终端 |
| **进程管理** | 单进程 | 多进程 + Docker 支持 |
| **环境隔离** | 共享环境 | 独立环境变量 |
| **执行模式** | 同步阻塞 | 异步非阻塞 |
| **命令执行** | pi --mode rpc | sd --mode agent |

### 5.2 SdProcess 设计

```typescript
interface SdProcessOptions {
  cwd: string;
  environment?: Record<string, string>;
  useDocker?: boolean;
  dockerImage?: string;
  resourceLimits?: {
    cpu?: number;
    memory?: string;
    timeout?: number;
  };
}

interface ProcessOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

class SdProcess {
  private proc?: ChildProcessWithoutNullStreams;
  private dockerContainer?: string;
  
  constructor(private options: SdProcessOptions) {}
  
  // 启动 sd CLI 进程
  async start(): Promise<void> {
    if (this.options.useDocker) {
      await this.startDockerContainer();
    } else {
      await this.startLocalProcess();
    }
  }
  
  // 启动本地进程（真实终端）
  private async startLocalProcess(): Promise<void> {
    // 使用真实终端，而非伪终端
    // 支持完整的终端功能（TTY、信号处理等）
  }
  
  // 启动 Docker 容器
  private async startDockerContainer(): Promise<void> {
    // 拉取镜像、创建容器、挂载卷
    // 支持资源限制
  }
  
  // 执行命令（异步）
  async executeCommand(command: string): Promise<ProcessOutput> {
    // 发送命令到进程/容器
    // 返回输出结果
  }
  
  // 停止进程
  async stop(): Promise<void> {
    // 优雅停止进程或容器
  }
  
  // 获取进程状态
  getStatus(): ProcessStatus {
    // 返回运行状态、资源使用等信息
  }
}
```

---

## 六、升级实施计划

### 6.1 阶段划分

| 阶段 | 名称 | 目标 | 周期 |
|------|------|------|------|
| **Phase 1** | 项目重命名 | Snacode → Snacode，更新所有标识 | 1-2 周 |
| **Phase 2** | 基础设施重构 | 多进程架构、任务队列、进程管理 | 2-3 周 |
| **Phase 3** | ALGS 技能卡系统 | 向量检索、技能卡组装、上下文拼接 | 3-4 周 |
| **Phase 4** | 记忆系统 | 记忆瓜分、记忆管理器、向量索引 | 2-3 周 |
| **Phase 5** | History+Memory Agent | 历史整理、连贯性优化、上下文压缩 | 2-3 周 |
| **Phase 6** | Master Agent 进化 | 递归机制、结果验证、进化判断 | 2-3 周 |
| **Phase 7** | sd CLI 升级 | 真实终端、Docker 支持、资源隔离 | 2-3 周 |
| **Phase 8** | 测试与集成 | 端到端测试、性能优化、Bug 修复 | 2-3 周 |

### 6.2 Phase 1：项目重命名（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 更新 package.json | `package.json` | name、productName、appId、description |
| 2 | 更新 tsconfig.json | `tsconfig.json` | 路径别名、命名空间 |
| 3 | 更新 Electron 主进程 | `src/main/index.ts` | 窗口标题、应用名称 |
| 4 | 更新渲染进程 | `src/renderer/src/App.tsx` | 应用标题、组件名称 |
| 5 | 更新共享类型 | `src/shared/types.ts` | 类型名称、枚举值 |
| 6 | 更新 IPC 通道 | `src/shared/ipc.ts` | 通道名称 |
| 7 | 更新组件名称 | `src/renderer/src/components/` | 文件重命名、组件类名 |
| 8 | 更新配置文件 | `electron.vite.config.ts`、`build/` | 构建配置、图标资源 |
| 9 | 更新文档 | `README.md`、`docs/` | 文档内容 |
| 10 | 更新日志 | `CHANGELOG.md` | 版本记录 |

### 6.3 Phase 2：基础设施重构（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 创建任务队列 | `src/main/agents/TaskQueue.ts` | 优先级队列、并行执行 |
| 2 | 创建 Agent 管理器 | `src/main/agents/SnacodeManager.ts` | 多 Agent 生命周期管理 |
| 3 | 创建进程池 | `src/main/agents/ProcessPool.ts` | 进程复用、资源管理 |
| 4 | 创建事件总线 | `src/main/agents/EventBus.ts` | 跨 Agent 通信 |
| 5 | 重构 IPC 通道 | `src/shared/ipc.ts` | 支持多 Agent 状态同步 |

### 6.4 Phase 3：ALGS 技能卡系统（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 创建向量存储 | `src/main/algs/VectorStore.ts` | 向量索引、相似度检索 |
| 2 | 创建技能卡仓库 | `src/main/algs/SkillCardRepository.ts` | LoRA 路径、元数据管理 |
| 3 | 创建 ALGS 管理器 | `src/main/algs/ALGSManager.ts` | 三个核心接口 |
| 4 | 创建上下文拼接器 | `src/main/algs/ContextAssembler.ts` | System Prompt + Few-shot |
| 5 | 创建技能卡 UI | `src/renderer/src/components/algs/` | 技能卡浏览、搜索、管理 |
| 6 | 预存领域技能卡 | `resources/skill-cards/` | 各领域 LoRA 配置 |

### 6.5 Phase 4：记忆系统（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 创建记忆管理器 | `src/main/memory/MemoryManager.ts` | 记忆瓜分、存储、检索 |
| 2 | 创建向量索引 | `src/main/memory/MemoryIndex.ts` | 向量数据库封装 |
| 3 | 创建记忆块类型 | `src/shared/types.ts` | MemoryChunk、MemoryIndex |
| 4 | 创建记忆 UI | `src/renderer/src/components/memory/` | 记忆浏览、搜索、编辑 |

### 6.6 Phase 5：History+Memory Agent（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 创建历史管理器 | `src/main/history/HistoryManager.ts` | 历史扫描、整理、优化 |
| 2 | 创建连贯性分析器 | `src/main/history/CoherenceAnalyzer.ts` | 上下文断裂检测 |
| 3 | 创建上下文优化器 | `src/main/history/ContextOptimizer.ts` | 上下文压缩、改写 |
| 4 | 创建 History Agent | `src/main/agents/HistoryMemoryAgent.ts` | 独立 Agent 实现 |

### 6.7 Phase 6：Master Agent 进化（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 创建 Master Agent | `src/main/agents/MasterAgent.ts` | 主智慧体实现 |
| 2 | 创建结果验证器 | `src/main/agents/ResultValidator.ts` | 幻觉检测、正确性验证 |
| 3 | 创建进化状态管理器 | `src/main/agents/EvolutionState.ts` | 进化状态存储、更新 |
| 4 | 创建递归控制器 | `src/main/agents/RecursionController.ts` | 递归判断、任务生成 |

### 6.8 Phase 7：sd CLI 升级（详细步骤）

| 步骤 | 任务 | 文件/位置 | 备注 |
|------|------|-----------|------|
| 1 | 创建 SdProcess | `src/main/sd/SdProcess.ts` | 真实终端实现 |
| 2 | 创建 Docker 管理器 | `src/main/sd/DockerManager.ts` | Docker 容器管理 |
| 3 | 创建进程资源管理器 | `src/main/sd/ResourceManager.ts` | 资源限制、监控 |
| 4 | 更新配置界面 | `src/renderer/src/components/config/` | Docker 配置、资源设置 |

---

## 七、关键技术选型

### 7.1 向量数据库

| 选项 | 优势 | 劣势 | 推荐 |
|------|------|------|------|
| **sqlite-vss** | 轻量、嵌入式、无需额外服务 | 性能有限、功能较少 | ✅ 推荐 |
| **Pinecone** | 高性能、云端托管 | 需要网络、付费 | ❌ 不推荐 |
| **Milvus** | 开源、功能完整 | 部署复杂、资源消耗大 | ❌ 不推荐 |
| **HNSWLib** | 轻量、纯内存、快速 | 数据不持久化 | ⚠️ 备选 |

### 7.2 推理引擎

| 选项 | 优势 | 劣势 | 推荐 |
|------|------|------|------|
| **vLLM** | 高性能、支持 LoRA 动态加载 | 需要 GPU、资源消耗大 | ✅ 推荐（GPU 环境） |
| **Transformers** | 灵活、支持多种模型 | 性能较低 | ⚠️ 备选（CPU 环境） |
| **LiteLLM** | 统一 API、支持多模型 | 需要网络连接 | ❌ 不推荐 |

### 7.3 向量嵌入模型

| 选项 | 优势 | 劣势 | 推荐 |
|------|------|------|------|
| **all-MiniLM-L6-v2** | 轻量、快速、开源 | 嵌入质量一般 | ✅ 推荐 |
| **text-embedding-3-small** | 质量高、OpenAI 出品 | 需要 API Key | ⚠️ 备选 |
| **BGE-small-en-v1.5** | 中文支持好、开源 | 英文性能一般 | ⚠️ 备选 |

---

## 八、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **LoRA 加载失败** | 中 | 高 | 预下载验证、fallback 到上下文拼接 |
| **内存占用过高** | 高 | 中 | 记忆压缩、LRU 缓存、定期清理 |
| **递归无限循环** | 低 | 高 | 最大递归深度限制、超时机制 |
| **Docker 环境缺失** | 中 | 中 | 检测 Docker 是否可用，降级到本地进程 |
| **GPU 资源不足** | 高 | 高 | 支持 CPU 推理、资源调度优化 |
| **向量检索精度** | 中 | 中 | 多模型融合、人工标注优化 |

---

## 九、验证方案

### 9.1 功能验证

| 验证项 | 方法 | 预期结果 |
|--------|------|----------|
| 项目重命名 | 全局搜索 "Snacode" | 无匹配结果 |
| 多 Agent 并行 | 启动 3 个 Agent 执行不同任务 | 并行执行，互不阻塞 |
| ALGS 技能卡 | 提交不同领域任务 | 正确匹配并加载对应技能卡 |
| 记忆瓜分 | 执行复杂任务后检查记忆 | 记忆正确分类存储 |
| 历史整理 | 大会话测试 | 上下文长度减少，连贯性增强 |
| 递归机制 | 设定需要多轮的任务 | 自动递归直到目标达成 |
| sd CLI | 执行命令 | 真实终端输出，支持交互 |

### 9.2 性能验证

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| Agent 启动时间 | < 2 秒 | 从点击启动到可用状态 |
| 技能卡检索时间 | < 500ms | 从任务描述到匹配结果 |
| 上下文压缩率 | > 50% | 原始长度 / 优化后长度 |
| 幻觉率 | < 10% | 人工评估或自动检测 |
| 吞吐量 | > 10 任务/分钟 | 并行任务数 / 时间 |

---

## 十、关键决策点策略与执行计划

### 10.1 LoRA 技能卡分发策略：GitHub Releases 按需下载

**策略**：
- **核心技能卡预打包**：将最常用的 5-8 个领域技能卡（编程、写作、数据分析等）预打包到安装包中，确保首次使用即可体验核心功能
- **按需下载**：其他领域技能卡通过 GitHub Releases 按需下载
- **版本管理**：每个技能卡独立版本号，支持自动更新检测

**执行计划**：

| 步骤 | 任务 | 文件/位置 | 时间 |
|------|------|-----------|------|
| 1 | 创建技能卡元数据仓库 | `resources/skill-cards/index.json` | Phase 3 第 1 周 |
| 2 | 实现下载管理器 | `src/main/algs/SkillCardDownloader.ts` | Phase 3 第 2 周 |
| 3 | 预打包核心技能卡 | `resources/skill-cards/packaged/` | Phase 3 第 3 周 |
| 4 | 创建 GitHub Releases 工作流 | `.github/workflows/skill-card-release.yml` | Phase 3 第 3 周 |
| 5 | 实现版本更新检测 | `src/main/algs/SkillCardUpdater.ts` | Phase 3 第 4 周 |

**存储估算**：
- 每个 LoRA 文件：50-200MB
- 预打包 5 个核心技能卡：约 500MB
- 用户按需下载：额外 1-5GB（根据使用领域）

### 10.2 推理引擎部署：线上模型优先 + 本地物理引擎兼容

**策略**：
- **线上模型优先**：默认使用线上模型 API（OpenAI、DeepSeek、Claude 等），降低本地部署门槛
- **本地物理引擎兼容**：支持 vLLM/Transformers 本地推理，用户可手动切换
- **渐进式迁移**：先实现线上模型支持，后期逐步完善本地物理引擎部署

**执行计划**：

| 步骤 | 任务 | 文件/位置 | 时间 |
|------|------|-----------|------|
| 1 | 实现线上模型 API 封装 | `src/main/inference/RemoteInference.ts` | Phase 3 第 2 周 |
| 2 | 实现本地推理引擎封装 | `src/main/inference/LocalInference.ts` | Phase 3 第 3 周 |
| 3 | 创建推理引擎管理器 | `src/main/inference/InferenceManager.ts` | Phase 3 第 3 周 |
| 4 | 实现 LoRA 动态加载 | `src/main/inference/LoraLoader.ts` | Phase 3 第 4 周 |
| 5 | 集成推理引擎到 ALGS | `src/main/algs/ALGSManager.ts` | Phase 3 第 4 周 |
| 6 | 优化本地推理性能 | `src/main/inference/` | Phase 4-6 持续 |

**模型优先级**：
1. 线上模型 API（默认）
2. 本地 vLLM（GPU 环境）
3. 本地 Transformers（CPU 环境）

### 10.3 真实终端：SSH 连接

**策略**：
- **SSH 终端**：使用 SSH 连接到本地或远程主机执行命令，实现真实终端体验
- **本地 SSH 服务**：Windows 启用 OpenSSH Server，macOS/Linux 内置 SSH 服务
- **远程 SSH 连接**：支持连接到远程服务器执行任务

**执行计划**：

| 步骤 | 任务 | 文件/位置 | 时间 |
|------|------|-----------|------|
| 1 | 创建 SSH 客户端封装 | `src/main/terminal/SshClient.ts` | Phase 7 第 1 周 |
| 2 | 实现本地 SSH 连接 | `src/main/terminal/LocalSshConnector.ts` | Phase 7 第 1 周 |
| 3 | 实现远程 SSH 连接 | `src/main/terminal/RemoteSshConnector.ts` | Phase 7 第 2 周 |
| 4 | 创建终端管理器 | `src/main/terminal/TerminalManager.ts` | Phase 7 第 2 周 |
| 5 | 集成 SSH 终端到 SdProcess | `src/main/sd/SdProcess.ts` | Phase 7 第 3 周 |
| 6 | 更新终端 UI | `src/renderer/src/components/terminal/` | Phase 7 第 3 周 |

**SSH 配置**：
- 本地连接：`ssh localhost` 或 `ssh 127.0.0.1`
- 远程连接：支持用户名/密码、SSH 密钥认证
- 端口转发：支持本地端口转发

### 10.4 向后兼容性：Snacode → Snacode 迁移

**策略**：
- **自动检测**：启动时检测是否存在 Snacode 数据
- **一键迁移**：提供迁移向导，自动转换数据格式
- **数据备份**：迁移前自动备份原始数据
- **增量迁移**：支持分批迁移，避免长时间阻塞

**执行计划**：

| 步骤 | 任务 | 文件/位置 | 时间 |
|------|------|-----------|------|
| 1 | 创建迁移工具 | `src/main/migration/SnacodeMigrator.ts` | Phase 1 第 1 周 |
| 2 | 实现会话格式转换 | `src/main/migration/SessionMigrator.ts` | Phase 1 第 1 周 |
| 3 | 实现项目配置迁移 | `src/main/migration/ProjectMigrator.ts` | Phase 1 第 2 周 |
| 4 | 实现设置迁移 | `src/main/migration/SettingsMigrator.ts` | Phase 1 第 2 周 |
| 5 | 创建迁移向导 UI | `src/renderer/src/components/migration/` | Phase 1 第 2 周 |
| 6 | 集成迁移流程到启动 | `src/main/index.ts` | Phase 1 第 2 周 |

**迁移内容**：

| 数据类型 | 原路径 | 新路径 | 转换说明 |
|----------|--------|--------|----------|
| 会话文件 | `~/.pi/sessions/` | `~/.snacode/sessions/` | JSONL 格式保持兼容 |
| 项目配置 | `~/.pi/projects.json` | `~/.snacode/projects.json` | 结构调整 |
| 用户设置 | `~/.pi/settings.json` | `~/.snacode/settings.json` | 字段映射 |
| 技能文件 | `~/.pi/agents/skills/` | `~/.snacode/skills/` | 路径重命名 |
| 扩展文件 | `~/.pi/agent/extensions/` | `~/.snacode/extensions/` | 路径重命名 |

### 10.5 sd CLI 策略：创建 Wrapper 脚本

**策略**：
- **Wrapper 脚本**：创建 `sd` CLI 作为 `pi` CLI 的包装器
- **命令映射**：将 `pi` 命令映射到 `sd` 命令，保持兼容性
- **增强功能**：在 wrapper 中添加新功能（真实终端、SSH 支持等）
- **渐进式替换**：先使用 wrapper，后期逐步替换底层实现

**执行计划**：

| 步骤 | 任务 | 文件/位置 | 时间 |
|------|------|-----------|------|
| 1 | 创建 sd CLI wrapper | `src/sd/cli/sd-wrapper.ts` | Phase 7 第 1 周 |
| 2 | 实现命令映射 | `src/sd/cli/CommandMapper.ts` | Phase 7 第 1 周 |
| 3 | 集成 SSH 终端 | `src/sd/cli/SshExecutor.ts` | Phase 7 第 2 周 |
| 4 | 创建 CLI 入口 | `src/sd/cli/index.ts` | Phase 7 第 2 周 |
| 5 | 更新 SdProcess 使用 wrapper | `src/main/sd/SdProcess.ts` | Phase 7 第 3 周 |
| 6 | 测试兼容性 | `tests/sd-cli/` | Phase 7 第 3 周 |

**命令映射示例**：

| sd 命令 | pi 命令 | 说明 |
|---------|---------|------|
| `sd --mode agent` | `pi --mode rpc` | Agent 模式启动 |
| `sd bash <cmd>` | `pi bash <cmd>` | 执行 bash 命令 |
| `sd prompt <msg>` | `pi prompt <msg>` | 发送提示词 |
| `sd session <path>` | `pi session <path>` | 加载会话 |
| `sd --version` | `pi --version` | 版本信息 |

---

## 十一、补充风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **技能卡下载失败** | 中 | 中 | 重试机制、fallback 到上下文拼接、离线缓存 |
| **线上模型 API 限流** | 高 | 中 | 多模型支持、本地 fallback、请求队列 |
| **SSH 连接失败** | 中 | 中 | 自动检测 SSH 服务、fallback 到本地进程 |
| **迁移数据丢失** | 低 | 高 | 迁移前备份、增量迁移、校验机制 |
| **wrapper 兼容性问题** | 低 | 中 | 命令映射测试、版本检测、回退机制 |

---

## 十二、结论

本方案提供了从 Snacode 到 Snacode 的完整升级路径，涵盖：

1. **项目重命名**：系统更新所有标识和产物，支持数据迁移
2. **多 Agent 架构**：支持并行执行和递归控制
3. **ALGS 技能卡系统**：LoRA 向量检索 + 上下文拼接 fallback，GitHub Releases 按需下载
4. **记忆系统**：记忆瓜分、存储、检索
5. **History+Memory Agent**：上下文实时整理优化
6. **Master Agent 进化**：结果验证、进化判断、递归机制
7. **sd CLI 升级**：SSH 真实终端、wrapper 脚本、线上/本地推理兼容

**关键决策点确认**：
- ✅ LoRA 技能卡：GitHub Releases 按需下载
- ✅ 推理引擎：线上模型优先，兼容本地物理引擎
- ✅ 真实终端：SSH 连接
- ✅ 向后兼容：数据迁移并重命名为 Snacode
- ✅ sd CLI：创建 wrapper 脚本

建议按照 Phase 1-8 的顺序逐步实施，每个阶段完成后进行验证，确保稳定性和兼容性。

---

**方案版本**：v2.0  
**创建日期**：2026-07-25  
**审核状态**：待审核