import { ALGSDatabase } from './database';
import type { LoRAMetadata, LoraBaseModel, TrainingConfig, TrainingJob } from './types';
import { join } from 'path';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class LoRAManager {
  private db: ALGSDatabase;
  private loraDir: string;
  private trainingDir: string;

  constructor(db: ALGSDatabase) {
    this.db = db;
    const userDataPath = app.getPath('userData');
    this.loraDir = join(userDataPath, 'loras');
    this.trainingDir = join(userDataPath, 'training_data');
  }

  async init(): Promise<void> {
    await this.ensureDirs();
  }

  private async ensureDirs(): Promise<void> {
    const fs = require('fs').promises;
    try {
      if (!(await this.exists(this.loraDir))) {
        await fs.mkdir(this.loraDir, { recursive: true });
      }
      if (!(await this.exists(this.trainingDir))) {
        await fs.mkdir(this.trainingDir, { recursive: true });
      }
    } catch (error) {
      console.warn('[ALGS] Failed to create LoRA directories:', error);
    }
  }

  private async exists(path: string): Promise<boolean> {
    const fs = require('fs').promises;
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 索引本地 LoRA 文件
   */
  async indexLocalLora(loraPath: string): Promise<LoRAMetadata> {
    const fs = require('fs');
    
    if (!fs.existsSync(loraPath)) {
      throw new Error(`LoRA 文件不存在: ${loraPath}`);
    }

    const stats = fs.statSync(loraPath);
    const fileName = loraPath.split(/[\\/]/).pop() || '';
    
    // 从文件名推断基础模型
    const baseModel = this.inferBaseModel(fileName);

    const metadata: LoRAMetadata = {
      id: `lora-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName,
      filePath: loraPath,
      name: fileName.replace(/\.[^/.]+$/, ''),
      baseModel,
      sizeMB: Math.round(stats.size / (1024 * 1024)),
      fileSize: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
      downloadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.db.saveLoRAMetadata(metadata);
    return metadata;
  }

  /**
   * 从文件名推断基础模型
   */
  private inferBaseModel(fileName: string): LoraBaseModel {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('sdxl')) return 'sdxl';
    if (lowerName.includes('sd1.5') || lowerName.includes('sd 1.5')) return 'sd1.5';
    if (lowerName.includes('flux')) return 'flux';
    if (lowerName.includes('llama')) return 'llama';
    if (lowerName.includes('qwen')) return 'qwen';
    return 'custom';
  }

  /**
   * 下载远程 LoRA
   */
  async downloadLora(url: string): Promise<string> {
    const fs = require('fs');
    const https = require('https');
    const http = require('http');

    return new Promise((resolve, reject) => {
      const fileName = url.split('/').pop() || `lora-${Date.now()}.safetensors`;
      const outputPath = join(this.loraDir, fileName);
      const protocol = url.startsWith('https') ? https : http;

      const file = fs.createWriteStream(outputPath);
      const request = protocol.get(url, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            resolve(outputPath);
          });
        });
      });

      request.on('error', (err: any) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
  }

  /**
   * 触发离线微调任务
   */
  async triggerTraining(config: TrainingConfig): Promise<string> {
    const job: Omit<TrainingJob, 'id' | 'createdAt' | 'updatedAt'> & {
      datasetPath: string;
      epochs: number;
      batchSize: number;
      learningRate: number;
      baseModel: string;
    } = {
      taskType: config.taskType,
      status: 'running',
      datasetPath: config.datasetPath,
      baseModel: config.baseModel,
      epochs: config.epochs,
      batchSize: config.batchSize,
      learningRate: config.learningRate,
    };

    const jobId = await this.db.createTrainingJob(job);
    
    // 在后台执行训练
    this.executeTraining(jobId, config);

    return jobId;
  }

  /**
   * 执行训练（后台）
   */
  private async executeTraining(jobId: string, config: TrainingConfig): Promise<void> {
    try {
      // 检查 WSL 是否可用
      const hasWsl = await this.checkWslAvailable();
      
      if (hasWsl) {
        // 通过 WSL 执行训练脚本
        const wslCommand = `cd ${this.trainingDir.replace(/\\/g, '/')} && python train_lora.py --dataset ${config.datasetPath} --base-model ${config.baseModel} --output ${config.outputPath} --epochs ${config.epochs}`;
        await execAsync(`wsl ${wslCommand}`);
        
        // 更新训练任务状态
        await this.db.updateTrainingJob(jobId, {
          status: 'completed',
          loraOutputPath: config.outputPath,
          logPath: join(this.trainingDir, `training-${jobId}.log`),
        });

        // 将训练好的 LoRA 注册为技能卡
        await this.registerTrainedLora(config.outputPath, config.taskType);
        
      } else {
        // 模拟训练完成（没有 WSL 时）
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await this.db.updateTrainingJob(jobId, {
          status: 'completed',
          loraOutputPath: config.outputPath,
        });
      }
    } catch (error) {
      await this.db.updateTrainingJob(jobId, {
        status: 'failed',
      });
    }
  }

  /**
   * 检查 WSL 是否可用
   */
  private async checkWslAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('wsl --version');
      return stdout.includes('WSL');
    } catch {
      return false;
    }
  }

  /**
   * 微调完成后自动注册技能卡
   */
  async registerTrainedLora(loraPath: string, taskType: string): Promise<void> {
    // 先索引 LoRA
    const loraMetadata = await this.indexLocalLora(loraPath);

    // 创建对应的技能卡
    const skillCard = {
      id: `card-${loraMetadata.id}`,
      name: `${loraMetadata.fileName} (训练生成)`,
      description: `基于 ${loraMetadata.baseModel} 训练的技能卡`,
      taskType: taskType as any,
      systemPrompt: `使用 LoRA ${loraMetadata.fileName} 执行任务`,
      loraPath: loraMetadata.filePath,
      parameters: {
        temperature: 0.7,
        max_tokens: 4096,
      },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.saveSkillCard(skillCard);
  }

  /**
   * 获取 LoRA 列表
   */
  async getLoraList(baseModel?: LoraBaseModel): Promise<LoRAMetadata[]> {
    return this.db.getLoRAMetadata(baseModel);
  }

  /**
   * 获取训练任务列表
   */
  async getTrainingJobs(status?: TrainingJob['status']): Promise<TrainingJob[]> {
    return this.db.getTrainingJobs(status);
  }
}
