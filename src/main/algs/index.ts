import { ALGSDatabase } from './database';
import { ALGSScheduler } from './scheduler';
import { LoRAManager } from './loraManager';
import type {
  TaskInput,
  TaskStatus,
  TaskStatusInfo,
  SkillCard,
  LoRAMetadata,
  TrainingConfig,
  TrainingJob,
} from './types';

export class ALGSSystem {
  private db: ALGSDatabase;
  private scheduler: ALGSScheduler;
  private loraManager: LoRAManager;
  private initialized = false;

  constructor() {
    this.db = new ALGSDatabase();
    this.scheduler = new ALGSScheduler(this.db);
    this.loraManager = new LoRAManager(this.db);
  }

  /**
   * 初始化 ALGS 系统
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    await this.db.init();
    await this.loraManager.init();
    this.initialized = true;
    
    console.log('[ALGS] ALGS 系统初始化完成');
  }

  /**
   * 获取调度器
   */
  getScheduler(): ALGSScheduler {
    return this.scheduler;
  }

  /**
   * 获取 LoRA 管理器
   */
  getLoraManager(): LoRAManager {
    return this.loraManager;
  }

  /**
   * 获取数据库
   */
  getDatabase(): ALGSDatabase {
    return this.db;
  }

  // 任务相关方法
  async submitTask(task: TaskInput): Promise<string> {
    return this.scheduler.submitTask(task);
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusInfo | null> {
    return this.scheduler.getTaskStatus(taskId);
  }

  async getTasks(status?: TaskStatus): Promise<TaskStatusInfo[]> {
    return this.scheduler.getTasks(status);
  }

  // 技能卡相关方法
  async saveSkillCard(card: SkillCard): Promise<void> {
    return this.scheduler.saveSkillCard(card);
  }

  async getSkillCards(taskType?: string): Promise<SkillCard[]> {
    return this.scheduler.getSkillCards(taskType as any);
  }

  async deleteSkillCard(id: string): Promise<void> {
    return this.scheduler.deleteSkillCard(id);
  }

  // LoRA 相关方法
  async downloadLora(url: string): Promise<string> {
    const path = await this.loraManager.downloadLora(url);
    await this.loraManager.indexLocalLora(path);
    return path;
  }

  async getLoraList(baseModel?: string): Promise<LoRAMetadata[]> {
    return this.loraManager.getLoraList(baseModel as any);
  }

  async triggerTraining(config: TrainingConfig): Promise<string> {
    return this.loraManager.triggerTraining(config);
  }

  async getTrainingJobs(status?: string): Promise<TrainingJob[]> {
    return this.loraManager.getTrainingJobs(status as any);
  }

  /**
   * 关闭系统
   */
  async close(): Promise<void> {
    await this.db.close();
    this.initialized = false;
  }
}

// 创建全局单例
let algsInstance: ALGSSystem | null = null;

export function getALGS(): ALGSSystem {
  if (!algsInstance) {
    algsInstance = new ALGSSystem();
  }
  return algsInstance;
}

// 导出类型
export type {
  TaskInput,
  TaskStatus,
  TaskStatusInfo,
  SkillCard,
  LoRAMetadata,
  TrainingConfig,
  TrainingJob,
};
