/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TaskMetadata {
  taskId: string;
  startTimestamp: string;
}

export type TaskCompletionCriteria = 'TASK COMPLETE' | 'BLOCKED';

export interface TaskCompletion {
  criteria: TaskCompletionCriteria[];
  validate(output: any): TaskCompletionCriteria | null;
}

export class TaskManager {
  private metadata: TaskMetadata | null = null;
  private completion: TaskCompletion | null = null;

  /**
   * Initialize task metadata
   */
  initializeMetadata(taskId?: string): TaskMetadata {
    this.metadata = {
      taskId: taskId || `task-${Date.now()}`,
      startTimestamp: new Date().toISOString(),
    };

    return this.metadata;
  }

  /**
   * Get current task metadata
   */
  getMetadata(): TaskMetadata | null {
    return this.metadata;
  }

  /**
   * Set task completion criteria
   */
  setCompletionCriteria(criteria: TaskCompletionCriteria[]): void {
    this.completion = {
      criteria,
      validate(output: any): TaskCompletionCriteria | null {
        if (output?.testsPassed && !output?.todoItems) {
          return 'TASK COMPLETE';
        }

        if (output?.blockers) {
          return 'BLOCKED';
        }

        return null;
      },
    };
  }

  /**
   * Validate task completion based on criteria
   */
  validateCompletion(output: any): TaskCompletionCriteria | null {
    if (!this.completion) {
      throw new Error('Task completion criteria not set.');
    }

    return this.completion.validate(output);
  }
}

/**
 * Factory function to creat TaskManager
 */
export function createTaskManager(): TaskManager {
  return new TaskManager();
}

