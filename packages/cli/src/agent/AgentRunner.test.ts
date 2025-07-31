/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-20
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner, AgentStatus } from './AgentRunner.js';
import { AgentConfig } from '@pk-code/core';

describe('AgentRunner', () => {
  let agentRunner: AgentRunner;
  let mockAgentConfig: AgentConfig;

  beforeEach(() => {
    mockAgentConfig = {
      name: 'test-agent',
      command: 'test-command',
      args: [],
    };
    agentRunner = new AgentRunner(mockAgentConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct agent config', () => {
      expect(agentRunner.agent).toBe(mockAgentConfig);
    });

    it('should initialize with pending status', () => {
      expect(agentRunner.status).toBe('pending');
    });

    it('should initialize with empty latestOutput', () => {
      expect(agentRunner.latestOutput).toBe('');
    });
  });

  describe('run', () => {
    it('should update status to running when run is called', async () => {
      const runPromise = agentRunner.run();
      expect(agentRunner.status).toBe('running');
      await runPromise;
    });

    it('should update latestOutput when run is called', async () => {
      const runPromise = agentRunner.run();
      expect(agentRunner.latestOutput).toBe('Agent is running...');
      await runPromise;
    });

    it('should update status to success after run completes', async () => {
      await agentRunner.run();
      expect(agentRunner.status).toBe('success');
    });

    it('should update latestOutput after run completes', async () => {
      await agentRunner.run();
      expect(agentRunner.latestOutput).toBe('Agent finished successfully.');
    });

    it('should handle multiple concurrent runs', async () => {
      // Start first run
      const firstRun = agentRunner.run();
      
      // Check first run state
      expect(agentRunner.status).toBe('running');
      expect(agentRunner.latestOutput).toBe('Agent is running...');
      
      // Start second run while first is still running
      const secondRun = agentRunner.run();
      
      // Both should complete successfully
      await Promise.all([firstRun, secondRun]);
      expect(agentRunner.status).toBe('success');
      expect(agentRunner.latestOutput).toBe('Agent finished successfully.');
    });
  });

  describe('status transitions', () => {
    it('should transition from pending to running to success', async () => {
      // Initially pending
      expect(agentRunner.status).toBe('pending');
      
      // Run the agent
      const runPromise = agentRunner.run();
      
      // Should be running
      expect(agentRunner.status).toBe('running');
      
      // Wait for completion
      await runPromise;
      
      // Should be success
      expect(agentRunner.status).toBe('success');
    });
  });
});