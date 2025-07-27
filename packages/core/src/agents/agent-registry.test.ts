/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentRegistry,
  getGlobalAgentRegistry,
  initializeGlobalAgentRegistry,
  disposeGlobalAgentRegistry,
} from './agent-registry.js';
import type { ParsedAgent, AgentConfig } from './types.js';

// Mock dependencies
vi.mock('fs');
vi.mock('fs/promises');
vi.mock('./agent-loader.js', () => ({
  AgentLoader: vi.fn(),
  loadAgents: vi.fn(),
}));

describe('AgentRegistry', () => {
  const mockProjectRoot = '/test/project';

  const createMockAgent = (
    name: string,
    keywords: string[] = [],
    description = 'Test agent',
  ): ParsedAgent => ({
    config: {
      name,
      description,
      keywords,
      tools: [],
      model: 'gpt-4',
      provider: 'openai',
      examples: [{ input: 'test', output: 'response' }],
    } as AgentConfig,
    filePath: `/test/agents/${name}.md`,
    source: 'project',
    content: `---\nname: ${name}\n---`,
    lastModified: new Date(),
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    disposeGlobalAgentRegistry();
  });

  describe('constructor', () => {
    it('should create registry with project root', () => {
      const registry = new AgentRegistry(mockProjectRoot);
      expect(registry).toBeDefined();
    });

    it('should create registry with options', () => {
      const registry = new AgentRegistry(mockProjectRoot, {
        includeGlobal: false,
      });
      expect(registry).toBeDefined();
    });
  });

  describe('agent management', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry(mockProjectRoot);
    });

    afterEach(() => {
      registry.dispose();
    });

    it('should register and retrieve agents', () => {
      const agent = createMockAgent('test-agent');

      registry.registerAgent(agent);

      expect(registry.size()).toBe(1);
      expect(registry.getAgent('test-agent')).toBe(agent);
      expect(registry.getAgents()).toEqual([agent]);
    });

    it('should unregister agents', () => {
      const agent = createMockAgent('test-agent');

      registry.registerAgent(agent);
      expect(registry.size()).toBe(1);

      const result = registry.unregisterAgent('test-agent');
      expect(result).toBe(true);
      expect(registry.size()).toBe(0);
      expect(registry.getAgent('test-agent')).toBeUndefined();
    });

    it('should return false when unregistering non-existent agent', () => {
      const result = registry.unregisterAgent('non-existent');
      expect(result).toBe(false);
    });

    it('should clear all agents', () => {
      registry.registerAgent(createMockAgent('agent1'));
      registry.registerAgent(createMockAgent('agent2'));

      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAgents()).toEqual([]);
    });
  });

  describe('agent searching', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry(mockProjectRoot);

      // Register test agents
      registry.registerAgent(
        createMockAgent(
          'code-agent',
          ['code', 'programming'],
          'Helps with coding tasks',
        ),
      );
      registry.registerAgent(
        createMockAgent('test-agent', ['test', 'qa'], 'Helps with testing'),
      );
      registry.registerAgent(
        createMockAgent(
          'docs-agent',
          ['documentation', 'writing'],
          'Helps with documentation',
        ),
      );
    });

    afterEach(() => {
      registry.dispose();
    });

    it('should find agents by keywords', () => {
      const result = registry.findAgents(['code']);
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('code-agent');
    });

    it('should find agents by partial keyword match', () => {
      const result = registry.findAgents(['prog']);
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('code-agent');
    });

    it('should find multiple agents matching keywords', () => {
      const result = registry.findAgents(['test', 'code']);
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.config.name).sort()).toEqual([
        'code-agent',
        'test-agent',
      ]);
    });

    it('should find agents by exact keywords', () => {
      const result = registry.findAgentsByExactKeywords(['test']);
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('test-agent');
    });

    it('should search agents by name', () => {
      const result = registry.searchAgents('code');
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('code-agent');
    });

    it('should search agents by description', () => {
      const result = registry.searchAgents('testing');
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('test-agent');
    });

    it('should search agents by keyword', () => {
      const result = registry.searchAgents('documentation');
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('docs-agent');
    });

    it('should return empty array for no matches', () => {
      const result = registry.findAgents(['nonexistent']);
      expect(result).toHaveLength(0);
    });

    it('should handle case insensitive searches', () => {
      const result = registry.searchAgents('CODE');
      expect(result).toHaveLength(1);
      expect(result[0].config.name).toBe('code-agent');
    });
  });

  describe('initialization', () => {
    it('should initialize with loaded agents', async () => {
      const { loadAgents } = await import('./agent-loader.js');
      const mockLoadAgents = vi.mocked(loadAgents);

      const mockAgents = [createMockAgent('agent1'), createMockAgent('agent2')];

      mockLoadAgents.mockResolvedValue({
        agents: mockAgents,
        errors: [],
        filesProcessed: 2,
      });

      const registry = new AgentRegistry(mockProjectRoot);
      const result = await registry.initialize();

      expect(result.agents).toHaveLength(2);
      expect(registry.size()).toBe(2);
      expect(mockLoadAgents).toHaveBeenCalledWith(mockProjectRoot, {});
    });

    it('should handle initialization errors', async () => {
      const { loadAgents } = await import('./agent-loader.js');
      const mockLoadAgents = vi.mocked(loadAgents);

      mockLoadAgents.mockResolvedValue({
        agents: [],
        errors: [
          {
            filePath: '/test/bad-agent.md',
            message: 'Parse error',
            type: 'parse-error',
          },
        ],
        filesProcessed: 1,
      });

      const registry = new AgentRegistry(mockProjectRoot);
      const result = await registry.initialize();

      expect(result.errors).toHaveLength(1);
      expect(result.agents).toHaveLength(0);
      expect(registry.size()).toBe(0);
    });
  });

  describe('reload functionality', () => {
    it('should reload all agents', async () => {
      const { loadAgents } = await import('./agent-loader.js');
      const mockLoadAgents = vi.mocked(loadAgents);

      // Initial load
      mockLoadAgents.mockResolvedValueOnce({
        agents: [createMockAgent('agent1')],
        errors: [],
        filesProcessed: 1,
      });

      const registry = new AgentRegistry(mockProjectRoot);
      await registry.initialize();
      expect(registry.size()).toBe(1);

      // Reload with different agents
      mockLoadAgents.mockResolvedValueOnce({
        agents: [createMockAgent('agent2')],
        errors: [],
        filesProcessed: 1,
      });

      await registry.reload();
      expect(registry.size()).toBe(1);
      expect(registry.getAgent('agent1')).toBeUndefined();
      expect(registry.getAgent('agent2')).toBeDefined();
    });
  });

  describe('global registry', () => {
    it('should create and get global registry', () => {
      const registry1 = getGlobalAgentRegistry(mockProjectRoot);
      const registry2 = getGlobalAgentRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should throw error when getting global registry without initialization', () => {
      expect(() => getGlobalAgentRegistry()).toThrow(
        'Global agent registry not initialized',
      );
    });

    it('should initialize global registry', async () => {
      const { loadAgents } = await import('./agent-loader.js');
      const mockLoadAgents = vi.mocked(loadAgents);

      mockLoadAgents.mockResolvedValue({
        agents: [createMockAgent('global-agent')],
        errors: [],
        filesProcessed: 1,
      });

      const result = await initializeGlobalAgentRegistry(mockProjectRoot);

      expect(result.agents).toHaveLength(1);

      const registry = getGlobalAgentRegistry();
      expect(registry.size()).toBe(1);
    });

    it('should dispose global registry', async () => {
      const { loadAgents } = await import('./agent-loader.js');
      const mockLoadAgents = vi.mocked(loadAgents);

      mockLoadAgents.mockResolvedValue({
        agents: [createMockAgent('global-agent')],
        errors: [],
        filesProcessed: 1,
      });

      await initializeGlobalAgentRegistry(mockProjectRoot);
      expect(getGlobalAgentRegistry().size()).toBe(1);

      disposeGlobalAgentRegistry();
      expect(() => getGlobalAgentRegistry()).toThrow(
        'Global agent registry not initialized',
      );
    });
  });
});
