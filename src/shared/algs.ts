// ALGS 系统类型定义

// 任务类型
export type TaskType = 'code' | 'image' | '3d' | 'office' | 'ui' | 'custom' | 'code_generation' | 'code_review' | 'documentation' | 'test_generation' | 'refactoring' | 'analysis';

// 任务优先级
export type TaskPriority = 'high' | 'medium' | 'low';

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务输入
export interface TaskInput {
  type: TaskType;
  description: string;
  context?: Record<string, unknown>;
  priority?: TaskPriority;
}

// 任务状态信息
export interface TaskStatusInfo {
  id: string;
  status: TaskStatus;
  result?: unknown;
  error?: string;
}

// 任务
export interface Task {
  id: string;
  input: string;
  skillCardId: string;
  status: TaskStatus;
  output?: string;
  createdAt: string;
  updatedAt: string;
}

// 技能卡
export interface SkillCard {
  id: string;
  name: string;
  description: string;
  taskType: TaskType;
  systemPrompt: string;
  fewShotExamples?: string[];
  loraPath?: string;
  parameters: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// 记忆条目角色
export type MemoryRole = 'user' | 'agent' | 'system';

// 记忆条目
export interface MemoryEntry {
  id: string;
  taskId: string;
  role: MemoryRole;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

// 反馈信息
export interface Feedback {
  score: number;
  suggestion: string;
  suitableForTraining: boolean;
}

// LoRA 基础模型
export type LoraBaseModel = 'sd1.5' | 'sdxl' | 'flux' | 'llama' | 'qwen' | 'custom';

// LoRA 元数据
export interface LoRAMetadata {
  id: string;
  fileName: string;
  filePath: string;
  name: string;
  baseModel: LoraBaseModel;
  sizeMB: number;
  fileSize: string;
  description?: string;
  tags?: string[];
  downloadedAt: string;
  createdAt: string;
}

// 训练配置
export interface TrainingConfig {
  taskType: TaskType;
  datasetPath: string;
  baseModel: LoraBaseModel;
  outputPath: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
}

// 训练任务状态
export type TrainingJobStatus = 'pending' | 'running' | 'completed' | 'failed';

// 训练任务
export interface TrainingJob {
  id: string;
  taskType: TaskType;
  status: TrainingJobStatus;
  baseModel?: string;
  progress?: number;
  loraOutputPath?: string;
  logPath?: string;
  createdAt: string;
  updatedAt: string;
}

// 任务-卡片关联
export interface TaskCardUsage {
  taskId: string;
  cardId: string;
  score: number;
}