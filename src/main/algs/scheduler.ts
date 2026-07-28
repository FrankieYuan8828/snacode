import { ALGSDatabase } from './database';
import type {
  TaskInput,
  TaskStatus,
  TaskStatusInfo,
  SkillCard,
  MemoryEntry,
  Feedback,
  TaskType,
} from './types';

export class ALGSScheduler {
  private db: ALGSDatabase;
  private taskQueue: Array<{ taskId: string; task: TaskInput }> = [];
  private isProcessing = false;

  constructor(db: ALGSDatabase) {
    this.db = db;
  }

  /**
   * 提交一个任务，返回任务ID
   */
  async submitTask(task: TaskInput): Promise<string> {
    const taskId = await this.db.createTask(task);
    
    // 将任务加入队列
    this.taskQueue.push({ taskId, task });
    
    // 如果没有正在处理的任务，立即开始处理
    if (!this.isProcessing) {
      void this.processQueue();
    }

    return taskId;
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusInfo | null> {
    return this.db.getTaskStatus(taskId);
  }

  /**
   * 获取所有任务
   */
  async getTasks(status?: TaskStatus): Promise<TaskStatusInfo[]> {
    return this.db.getTasks(status);
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      while (this.taskQueue.length > 0) {
        const { taskId, task } = this.taskQueue.shift()!;
        
        try {
          // 更新任务状态为运行中
          await this.db.updateTaskStatus(taskId, 'running');

          // 执行任务
          const result = await this.executeTask(taskId, task);

          // 更新任务状态为完成
          await this.db.updateTaskStatus(taskId, 'completed', result);

          // 生成反馈
          await this.generateFeedback(taskId);

        } catch (error) {
          // 更新任务状态为失败
          await this.db.updateTaskStatus(taskId, 'failed', undefined, error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(taskId: string, task: TaskInput): Promise<unknown> {
    // 1. 检索匹配的技能卡
    const matchingCards = await this.retrieveSkillCards(task);
    
    // 2. 存储用户输入记忆
    await this.storeTaskMemory(taskId, 'user', task.description, {
      taskType: task.type,
      priority: task.priority,
    });

    // 3. 如果有匹配的卡片，使用卡片执行
    if (matchingCards.length > 0) {
      const bestCard = matchingCards[0];
      
      // 记录卡片使用
      await this.db.saveTaskCardUsage({
        taskId,
        cardId: bestCard.id,
        score: 0, // 初始评分，后续可根据结果调整
      });

      // 构建执行结果（模拟执行）
      const result = {
        taskId,
        usedCard: bestCard.id,
        cardName: bestCard.name,
        output: `任务执行完成: ${task.description}`,
        timestamp: Date.now(),
      };

      // 存储执行结果记忆
      await this.storeTaskMemory(taskId, 'agent', JSON.stringify(result), {
        cardId: bestCard.id,
        cardName: bestCard.name,
      });

      return result;
    }

    // 4. 没有匹配的卡片，返回默认结果
    const result = {
      taskId,
      message: '没有找到匹配的技能卡，任务已记录',
      timestamp: Date.now(),
    };

    // 存储系统记忆
    await this.storeTaskMemory(taskId, 'system', '没有找到匹配的技能卡', {
      action: 'no_card_found',
    });

    return result;
  }

  /**
   * 检索匹配的技能卡
   */
  private async retrieveSkillCards(task: TaskInput): Promise<SkillCard[]> {
    // 获取该类型的所有技能卡
    const cards = await this.db.getSkillCards(task.type);
    
    // 简单的匹配逻辑：基于关键词匹配
    // 实际应用中可以使用向量检索
    const queryKeywords = task.description.toLowerCase().split(' ');
    
    return cards.filter(card => {
      const cardKeywords = card.description.toLowerCase().split(' ');
      const matchCount = queryKeywords.filter(k => cardKeywords.includes(k)).length;
      return matchCount > 0;
    }).sort((a, b) => {
      // 简单的排序：基于匹配关键词数量
      const aMatchCount = queryKeywords.filter(k => a.description.toLowerCase().includes(k)).length;
      const bMatchCount = queryKeywords.filter(k => b.description.toLowerCase().includes(k)).length;
      return bMatchCount - aMatchCount;
    });
  }

  /**
   * 存储任务记忆
   */
  private async storeTaskMemory(taskId: string, role: MemoryEntry['role'], content: string, metadata: Record<string, unknown>): Promise<void> {
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      taskId,
      role,
      content,
      metadata,
      createdAt: new Date().toISOString(),
    };

    await this.db.storeMemory(entry);
  }

  /**
   * 生成反馈
   */
  private async generateFeedback(taskId: string): Promise<Feedback> {
    // 获取任务记忆
    const memories = await this.db.getMemories(taskId);
    
    // 简单的反馈生成逻辑
    const feedback: Feedback = {
      score: 7, // 默认评分
      suggestion: '任务执行成功，可考虑添加更多示例以提高匹配精度',
      suitableForTraining: memories.length >= 5, // 记忆足够多时适合训练
    };

    return feedback;
  }

  /**
   * 获取技能卡列表
   */
  async getSkillCards(taskType?: TaskType): Promise<SkillCard[]> {
    return this.db.getSkillCards(taskType);
  }

  /**
   * 保存技能卡
   */
  async saveSkillCard(card: SkillCard): Promise<void> {
    await this.db.saveSkillCard(card);
  }

  /**
   * 删除技能卡
   */
  async deleteSkillCard(id: string): Promise<void> {
    await this.db.deleteSkillCard(id);
  }
}
