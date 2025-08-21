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
  validate(output: unknown): TaskCompletionCriteria | null;
}

interface ValidationShape {
  testsPassed?: boolean;
  todoItems?: unknown;
  blockers?: unknown;
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
      validate(output: unknown): TaskCompletionCriteria | null {
        const o = output as ValidationShape;
        if (o?.testsPassed && !o?.todoItems) {
          return 'TASK COMPLETE';
        }

        if (o?.blockers) {
          return 'BLOCKED';
        }

        return null;
      },
    };
  }

  /**
   * Validate task completion based on criteria
   */
  validateCompletion(output: unknown): TaskCompletionCriteria | null {
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

