import { DatabaseSync } from 'node:sqlite';
import { join } from 'path';
import { app } from 'electron';
import type {
  TaskInput,
  TaskStatus,
  TaskStatusInfo,
  SkillCard,
  MemoryEntry,
  LoRAMetadata,
  TrainingJob,
  TaskCardUsage,
} from './types';

type Row = Record<string, unknown>;

export class ALGSDatabase {
  private db: DatabaseSync | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = join(userDataPath, 'algs.db');
  }

  async init(): Promise<void> {
    this.db = new DatabaseSync(this.dbPath);
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const sql = `
      -- 任务表
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        error TEXT,
        priority TEXT DEFAULT 'medium',
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 技能卡表
      CREATE TABLE IF NOT EXISTS skill_cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        task_type TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        few_shot TEXT,
        lora_path TEXT,
        parameters TEXT,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 记忆表
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- LoRA 元数据表
      CREATE TABLE IF NOT EXISTS lora_metadata (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        base_model TEXT NOT NULL,
        size_mb REAL,
        description TEXT,
        tags TEXT,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 训练任务表
      CREATE TABLE IF NOT EXISTS training_jobs (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        lora_output_path TEXT,
        log_path TEXT,
        dataset_path TEXT,
        base_model TEXT,
        epochs INTEGER,
        batch_size INTEGER,
        learning_rate REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 任务-卡片关联表
      CREATE TABLE IF NOT EXISTS task_card_usage (
        task_id TEXT,
        card_id TEXT,
        score REAL,
        PRIMARY KEY (task_id, card_id)
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_skill_cards_task_type ON skill_cards(task_type);
      CREATE INDEX IF NOT EXISTS idx_memories_task_id ON memories(task_id);
      CREATE INDEX IF NOT EXISTS idx_lora_base_model ON lora_metadata(base_model);
      CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
    `;

    this.db.exec(sql);
  }

  // 任务相关操作
  async createTask(task: TaskInput): Promise<string> {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(
      `INSERT INTO tasks (id, type, description, status, priority, context) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, task.type, task.description, 'pending', task.priority || 'medium', JSON.stringify(task.context || {}));
    return id;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, result?: unknown, error?: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(
      `UPDATE tasks SET status = ?, result = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(status, result ? JSON.stringify(result) : null, error || null, taskId);
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusInfo | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const row = this.db.prepare(
      `SELECT id, status, result, error FROM tasks WHERE id = ?`
    ).get(taskId) as Row | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id as string,
      status: row.status as TaskStatus,
      result: row.result ? JSON.parse(row.result as string) : undefined,
      error: row.error as string | undefined,
    };
  }

  async getTasks(status?: TaskStatus): Promise<TaskStatusInfo[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const query = status
      ? `SELECT id, status, result, error FROM tasks WHERE status = ? ORDER BY created_at DESC`
      : `SELECT id, status, result, error FROM tasks ORDER BY created_at DESC`;

    const rows = status
      ? this.db.prepare(query).all(status) as Row[]
      : this.db.prepare(query).all() as Row[];
    return rows.map((row) => ({
      id: row.id as string,
      status: row.status as TaskStatus,
      result: row.result ? JSON.parse(row.result as string) : undefined,
      error: row.error as string | undefined,
    }));
  }

  // 技能卡相关操作
  async saveSkillCard(card: SkillCard): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(
      `INSERT OR REPLACE INTO skill_cards 
        (id, name, description, task_type, system_prompt, few_shot, lora_path, parameters, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      card.id,
      card.name,
      card.description,
      card.taskType,
      card.systemPrompt,
      card.fewShotExamples ? JSON.stringify(card.fewShotExamples) : null,
      card.loraPath || null,
      JSON.stringify(card.parameters),
      card.version,
      card.createdAt,
      card.updatedAt,
    );
  }

  async getSkillCards(taskType?: string): Promise<SkillCard[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const query = taskType
      ? `SELECT * FROM skill_cards WHERE task_type = ? ORDER BY name`
      : `SELECT * FROM skill_cards ORDER BY name`;

    const rows = taskType
      ? this.db.prepare(query).all(taskType) as Row[]
      : this.db.prepare(query).all() as Row[];
    return rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      taskType: row.task_type as SkillCard['taskType'],
      systemPrompt: row.system_prompt as string,
      fewShotExamples: row.few_shot ? JSON.parse(row.few_shot as string) : undefined,
      loraPath: row.lora_path ? row.lora_path as string : undefined,
      parameters: JSON.parse(row.parameters as string),
      version: row.version as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  async getSkillCard(id: string): Promise<SkillCard | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const row = this.db.prepare(
      `SELECT * FROM skill_cards WHERE id = ?`
    ).get(id) as Row | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      taskType: row.task_type as SkillCard['taskType'],
      systemPrompt: row.system_prompt as string,
      fewShotExamples: row.few_shot ? JSON.parse(row.few_shot as string) : undefined,
      loraPath: row.lora_path ? row.lora_path as string : undefined,
      parameters: JSON.parse(row.parameters as string),
      version: row.version as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async deleteSkillCard(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(`DELETE FROM skill_cards WHERE id = ?`).run(id);
  }

  // 记忆相关操作
  async storeMemory(entry: MemoryEntry): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const embeddingBuffer = entry.embedding 
      ? Buffer.from(new Float32Array(entry.embedding).buffer) 
      : null;

    this.db.prepare(
      `INSERT INTO memories (id, task_id, role, content, embedding, metadata) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      entry.id,
      entry.taskId,
      entry.role,
      entry.content,
      embeddingBuffer,
      JSON.stringify(entry.metadata),
    );
  }

  async getMemories(taskId: string): Promise<MemoryEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const rows = this.db.prepare(
      `SELECT * FROM memories WHERE task_id = ? ORDER BY created_at`
    ).all(taskId) as Row[];

    return rows.map((row) => ({
      id: row.id as string,
      taskId: row.task_id as string,
      role: row.role as MemoryEntry['role'],
      content: row.content as string,
      embedding: row.embedding 
        ? Array.from(new Float32Array(row.embedding as Buffer)) 
        : undefined,
      metadata: JSON.parse(row.metadata as string),
      createdAt: row.created_at as string,
    }));
  }

  // LoRA 相关操作
  async saveLoRAMetadata(metadata: LoRAMetadata): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(
      `INSERT OR REPLACE INTO lora_metadata 
        (id, file_name, file_path, base_model, size_mb, description, tags, downloaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      metadata.id,
      metadata.fileName,
      metadata.filePath,
      metadata.baseModel,
      metadata.sizeMB,
      metadata.description || null,
      metadata.tags ? JSON.stringify(metadata.tags) : null,
      metadata.downloadedAt,
    );
  }

  async getLoRAMetadata(baseModel?: string): Promise<LoRAMetadata[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const query = baseModel
      ? `SELECT * FROM lora_metadata WHERE base_model = ? ORDER BY downloaded_at DESC`
      : `SELECT * FROM lora_metadata ORDER BY downloaded_at DESC`;

    const rows = baseModel
      ? this.db.prepare(query).all(baseModel) as Row[]
      : this.db.prepare(query).all() as Row[];
    return rows.map((row) => ({
      id: row.id as string,
      fileName: row.file_name as string,
      filePath: row.file_path as string,
      name: (row.file_name as string).replace(/\.[^/.]+$/, ''),
      baseModel: row.base_model as LoRAMetadata['baseModel'],
      sizeMB: row.size_mb as number,
      fileSize: `${(row.size_mb as number).toFixed(2)} MB`,
      description: row.description ? row.description as string : undefined,
      tags: row.tags ? JSON.parse(row.tags as string) : undefined,
      downloadedAt: row.downloaded_at as string,
      createdAt: row.downloaded_at as string,
    }));
  }

  // 训练任务相关操作
  async createTrainingJob(job: Omit<TrainingJob, 'id' | 'createdAt' | 'updatedAt'> & {
    datasetPath: string;
    epochs: number;
    batchSize: number;
    learningRate: number;
    baseModel: string;
  }): Promise<string> {
    const id = `training-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(
      `INSERT INTO training_jobs 
        (id, task_type, status, lora_output_path, log_path, dataset_path, base_model, epochs, batch_size, learning_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      job.taskType,
      job.status,
      job.loraOutputPath || null,
      job.logPath || null,
      job.datasetPath,
      job.baseModel,
      job.epochs,
      job.batchSize,
      job.learningRate,
    );
    return id;
  }

  async updateTrainingJob(jobId: string, updates: Partial<TrainingJob>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const fields: string[] = [];
    const params: (string | null)[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.loraOutputPath !== undefined) {
      fields.push('lora_output_path = ?');
      params.push(updates.loraOutputPath || null);
    }
    if (updates.logPath !== undefined) {
      fields.push('log_path = ?');
      params.push(updates.logPath || null);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(jobId);

    const query = `UPDATE training_jobs SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...params);
  }

  async getTrainingJobs(status?: TrainingJob['status']): Promise<TrainingJob[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const query = status
      ? `SELECT * FROM training_jobs WHERE status = ? ORDER BY created_at DESC`
      : `SELECT * FROM training_jobs ORDER BY created_at DESC`;

    const rows = status
      ? this.db.prepare(query).all(status) as Row[]
      : this.db.prepare(query).all() as Row[];
    return rows.map((row) => ({
      id: row.id as string,
      taskType: row.task_type as TrainingJob['taskType'],
      status: row.status as TrainingJob['status'],
      loraOutputPath: row.lora_output_path ? row.lora_output_path as string : undefined,
      logPath: row.log_path ? row.log_path as string : undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  // 任务-卡片关联操作
  async saveTaskCardUsage(usage: TaskCardUsage): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.prepare(
      `INSERT OR REPLACE INTO task_card_usage (task_id, card_id, score) VALUES (?, ?, ?)`
    ).run(usage.taskId, usage.cardId, usage.score);
  }

  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    this.db.close();
    this.db = null;
  }
}
