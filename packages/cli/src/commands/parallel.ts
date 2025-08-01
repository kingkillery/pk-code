import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { CliArgs } from '../config/config.js';

export interface ParallelTaskConfig {
  id: string;
  prompt: string;
  workingDir: string;
  outputFile: string;
  errorFile: string;
}

export interface ParallelTaskResult {
  id: string;
  prompt: string;
  success: boolean;
  output: string;
  error: string;
  exitCode: number | null;
  duration: number;
}

export class ParallelTaskExecutor {
  private tasks: ParallelTaskConfig[] = [];
  private processes: Map<string, ChildProcess> = new Map();
  private results: Map<string, ParallelTaskResult> = new Map();
  private maxConcurrency: number;
  private tempDir: string;

  constructor(prompts: string[], maxConcurrency?: number, workingDir?: string) {
    this.maxConcurrency = maxConcurrency || prompts.length;
    this.tempDir = path.join(os.tmpdir(), 'pk-parallel-' + uuidv4());
    
    // Create task configurations
    this.tasks = prompts.map((prompt, index) => ({
      id: `task-${index + 1}`,
      prompt: prompt.trim(),
      workingDir: workingDir || process.cwd(),
      outputFile: path.join(this.tempDir, `task-${index + 1}-output.log`),
      errorFile: path.join(this.tempDir, `task-${index + 1}-error.log`),
    }));
  }

  async execute(): Promise<ParallelTaskResult[]> {
    console.log(`\n🚀 Starting ${this.tasks.length} parallel tasks...\n`);
    
    // Create temp directory
    await this.ensureTempDir();
    
    // Execute tasks with concurrency control
    const taskQueue = [...this.tasks];
    const runningTasks: Promise<void>[] = [];
    
    while (taskQueue.length > 0 || runningTasks.length > 0) {
      // Start new tasks up to concurrency limit
      while (runningTasks.length < this.maxConcurrency && taskQueue.length > 0) {
        const task = taskQueue.shift()!;
        const taskPromise = this.executeTask(task);
        runningTasks.push(taskPromise);
      }
      
      // Wait for at least one task to complete
      if (runningTasks.length > 0) {
        await Promise.race(runningTasks);
        // Remove completed tasks
        for (let i = runningTasks.length - 1; i >= 0; i--) {
          const task = runningTasks[i];
          if (await this.isPromiseResolved(task)) {
            runningTasks.splice(i, 1);
          }
        }
      }
    }
    
    // Wait for all remaining tasks to complete
    await Promise.all(runningTasks);
    
    // Collect and return results
    const results = Array.from(this.results.values());
    this.printSummary(results);
    
    return results;
  }

  private async executeTask(task: ParallelTaskConfig): Promise<void> {
    const startTime = Date.now();
    
    console.log(`📋 [${task.id}] Starting: "${task.prompt.substring(0, 50)}${task.prompt.length > 50 ? '...' : ''}"`);
    
    return new Promise((resolve) => {
      // Build pk command arguments
      const pkExecutable = process.execPath; // Node.js executable
      const pkScript = path.resolve(__dirname, '../../index.js'); // pk CLI script
      const args = [
        pkScript,
        '--prompt', task.prompt,
        '--yolo', // Skip confirmations for automated execution
      ];
      
      // Spawn pk process
      const child = spawn(pkExecutable, args, {
        cwd: task.workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PK_PARALLEL_TASK_ID: task.id,
          PK_PARALLEL_MODE: 'true',
        },
      });
      
      this.processes.set(task.id, child);
      
      let stdout = '';
      let stderr = '';
      
      // Capture output
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;
        
        const result: ParallelTaskResult = {
          id: task.id,
          prompt: task.prompt,
          success,
          output: stdout,
          error: stderr,
          exitCode: code,
          duration,
        };
        
        this.results.set(task.id, result);
        this.processes.delete(task.id);
        
        const status = success ? '✅' : '❌';
        const durationStr = `${(duration / 1000).toFixed(1)}s`;
        console.log(`${status} [${task.id}] Completed in ${durationStr}`);
        
        if (!success) {
          console.log(`   Error: ${stderr.split('\n')[0] || 'Unknown error'}`);
        }
        
        resolve();
      });
      
      // Handle process errors
      child.on('error', (error) => {
        const duration = Date.now() - startTime;
        
        const result: ParallelTaskResult = {
          id: task.id,
          prompt: task.prompt,
          success: false,
          output: stdout,
          error: error.message,
          exitCode: null,
          duration,
        };
        
        this.results.set(task.id, result);
        this.processes.delete(task.id);
        
        console.log(`❌ [${task.id}] Failed: ${error.message}`);
        resolve();
      });
    });
  }

  private async ensureTempDir(): Promise<void> {
    const fs = await import('fs/promises');
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async isPromiseResolved(promise: Promise<any>): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 0))
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private printSummary(results: ParallelTaskResult[]): void {
    console.log('\n📊 Parallel Execution Summary:');
    console.log('=' .repeat(50));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalDuration = Math.max(...results.map(r => r.duration));
    
    console.log(`Total Tasks: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Time: ${(totalDuration / 1000).toFixed(1)}s`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tasks:');
      results.filter(r => !r.success).forEach(result => {
        console.log(`   [${result.id}] ${result.prompt.substring(0, 40)}${result.prompt.length > 40 ? '...' : ''}`);
        console.log(`      Error: ${result.error.split('\n')[0] || 'Unknown error'}`);
      });
    }
    
    console.log('\n✨ Parallel execution completed!\n');
  }

  // Cleanup method to terminate all running processes
  async cleanup(): Promise<void> {
    console.log('\n🛑 Cleaning up parallel tasks...');
    
    for (const [taskId, process] of this.processes) {
      console.log(`   Terminating ${taskId}...`);
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    this.processes.clear();
  }
}

export async function handleParallelCommand(argv: CliArgs): Promise<void> {
  if (!argv.parallel) {
    throw new Error('No parallel prompts provided');
  }
  
  // Parse comma-separated prompts
  const prompts = argv.parallel
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  if (prompts.length === 0) {
    throw new Error('No valid prompts found in parallel argument');
  }
  
  if (prompts.length === 1) {
    console.log('⚠️  Only one prompt provided. Consider using regular -p flag instead.');
  }
  
  const maxConcurrency = argv.parallelTasks || prompts.length;
  const executor = new ParallelTaskExecutor(prompts, maxConcurrency);
  
  // Setup cleanup on process termination
  const cleanup = () => {
    executor.cleanup().then(() => process.exit(0));
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  try {
    const results = await executor.execute();
    
    // Exit with error code if any tasks failed
    const hasFailures = results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Parallel execution failed:', error);
    await executor.cleanup();
    process.exit(1);
  }
}