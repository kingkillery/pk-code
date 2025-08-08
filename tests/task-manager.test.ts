/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTaskManager } from '../packages/core/src/orchestrator/taskManager';

describe('Task Manager', () => {
  let taskManager;

  beforeEach(() => {
    taskManager = createTaskManager();
  });

  describe('Metadata Management', () => {
    it('should initialize metadata with provided task ID', () => {
      const taskId = 'test-task-123';
      const metadata = taskManager.initializeMetadata(taskId);

      expect(metadata.taskId).toBe(taskId);
      expect(metadata.startTimestamp).toBeDefined();
    });

    it('should initialize metadata with auto-generated task ID', () => {
      const metadata = taskManager.initializeMetadata();

      expect(metadata.taskId).toMatch(/task-\d+/);
      expect(metadata.startTimestamp).toBeDefined();
    });

    it('should retrieve current metadata', () => {
      const initialMetadata = taskManager.initializeMetadata('task-456');
      const retrievedMetadata = taskManager.getMetadata();

      expect(retrievedMetadata).toEqual(initialMetadata);
    });
  });

  describe('Completion Criteria', () => {
    beforeEach(() => {
      taskManager.setCompletionCriteria(['TASK COMPLETE', 'BLOCKED']);
    });

    it('should validate task as complete when criteria met', () => {
      const result = taskManager.validateCompletion({ testsPassed: true, todoItems: false });

      expect(result).toBe('TASK COMPLETE');
    });

    it('should validate task as blocked when criteria met', () => {
      const result = taskManager.validateCompletion({ blockers: true });

      expect(result).toBe('BLOCKED');
    });

    it('should return null when criteria not met', () => {
      const result = taskManager.validateCompletion({ testsPassed: false, todoItems: true });

      expect(result).toBeNull();
    });

    it('should throw error if completion criteria not set', () => {
      const newTaskManager = createTaskManager();

      expect(() => newTaskManager.validateCompletion({})).toThrow('Task completion criteria not set.');
    });
  });
});
