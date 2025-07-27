/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleUseCommand, parseUseCommandSyntax } from './use.js';
import type {
  ParsedAgent,
  AgentRegistry,
  Config,
  ContentGenerator,
} from '@pk-code/core';

// Mock the core modules
vi.mock('@pk-code/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalAgentRegistry: vi.fn(),
    initializeGlobalAgentRegistry: vi.fn(),
    createCodeAssistContentGenerator: vi.fn(),
  };
});

const mockAgent: ParsedAgent = {
  config: {
    name: 'test-agent',
    description: 'A test agent for unit testing',
    keywords: ['test', 'unit', 'testing'],
    tools: [],
    model: 'gemini-1.5-pro',
    provider: 'gemini',
    examples: [],
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt: 'You are a helpful test agent.',
  },
  filePath: '/test/agents/test-agent.md',
  source: 'project',
  content: 'Test agent content',
  lastModified: new Date(),
};

const mockRegistry: Partial<AgentRegistry> = {
  getAgent: vi.fn(),
  getAgents: vi.fn(),
  searchAgents: vi.fn(),
};

const mockConfig: Partial<Config> = {
  getContentGeneratorConfig: vi.fn(),
};

const mockContentGenerator: Partial<ContentGenerator> = {
  generateContent: vi.fn(),
};

describe('parseUseCommandSyntax', () => {
  it('should parse colon syntax with double quotes', () => {
    const result = parseUseCommandSyntax('test-agent: "Fix the bug"');
    expect(result).toEqual({
      agent: 'test-agent',
      query: 'Fix the bug',
    });
  });

  it('should parse colon syntax with single quotes', () => {
    const result = parseUseCommandSyntax("test-agent: 'Fix the bug'");
    expect(result).toEqual({
      agent: 'test-agent',
      query: 'Fix the bug',
    });
  });

  it('should parse colon syntax without quotes', () => {
    const result = parseUseCommandSyntax('test-agent: Fix the bug');
    expect(result).toEqual({
      agent: 'test-agent',
      query: 'Fix the bug',
    });
  });

  it('should handle agent names with hyphens and spaces', () => {
    const result = parseUseCommandSyntax(
      'qwen-code-engineer: "Implement feature"',
    );
    expect(result).toEqual({
      agent: 'qwen-code-engineer',
      query: 'Implement feature',
    });
  });

  it('should handle complex queries with special characters', () => {
    const result = parseUseCommandSyntax(
      'debug-detective: "Investigate API issue: 500 errors"',
    );
    expect(result).toEqual({
      agent: 'debug-detective',
      query: 'Investigate API issue: 500 errors',
    });
  });

  it('should return null for invalid syntax', () => {
    expect(parseUseCommandSyntax('invalid syntax')).toBeNull();
    expect(parseUseCommandSyntax('no-colon')).toBeNull();
    expect(parseUseCommandSyntax(': no agent')).toBeNull();
    expect(parseUseCommandSyntax('agent:')).toBeNull();
  });

  it('should trim whitespace from agent and preserve query content', () => {
    const result = parseUseCommandSyntax(
      '  test-agent  :  "  Fix the bug  "  ',
    );
    expect(result).toEqual({
      agent: 'test-agent',
      query: '  Fix the bug  ', // Query content is preserved as-is inside quotes
    });
  });
});

describe('handleUseCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully execute an agent when found', async () => {
    // Arrange
    const { getGlobalAgentRegistry, createCodeAssistContentGenerator } =
      await import('@pk-code/core');

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);
    (createCodeAssistContentGenerator as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockContentGenerator,
    );
    (mockConfig.getContentGeneratorConfig as ReturnType<typeof vi.fn>).mockReturnValue({});
    (mockContentGenerator.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: 'Agent response: I have fixed the bug!' }],
          },
        },
      ],
    });

    // Act
    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBe('Agent response: I have fixed the bug!');
    expect(mockRegistry.getAgent).toHaveBeenCalledWith('test-agent');
    expect(console.log).toHaveBeenCalledWith(
      'Executing agent "test-agent": A test agent for unit testing',
    );
    expect(console.log).toHaveBeenCalledWith(
      '\nAgent response: I have fixed the bug!',
    );
  });

  it('should handle agent not found', async () => {
    // Arrange
    const { getGlobalAgentRegistry } = await import('@pk-code/core');

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (mockRegistry.searchAgents as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (mockRegistry.getAgents as ReturnType<typeof vi.fn>).mockReturnValue([]);

    // Act
    const result = await handleUseCommand(
      'nonexistent-agent',
      'Do something',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Agent "nonexistent-agent" not found.',
    );
    expect(console.error).toHaveBeenCalledWith('Available agents:');
    expect(console.error).toHaveBeenCalledWith(
      '  No agents available. Check your .pk/agents directory.',
    );
  });

  it('should suggest similar agents when agent not found', async () => {
    // Arrange
    const { getGlobalAgentRegistry } = await import('@pk-code/core');

    const similarAgent1 = {
      ...mockAgent,
      config: { ...mockAgent.config, name: 'test-helper' },
    };
    const similarAgent2 = {
      ...mockAgent,
      config: { ...mockAgent.config, name: 'test-assistant' },
    };

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (mockRegistry.searchAgents as ReturnType<typeof vi.fn>).mockReturnValue([
      similarAgent1,
      similarAgent2,
    ]); // Multiple matches to trigger suggestions

    // Act
    const result = await handleUseCommand(
      'test',
      'Do something',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Agent "test" not found. Did you mean one of these?',
    );
    expect(console.error).toHaveBeenCalledWith(
      '  - test-helper: A test agent for unit testing',
    );
  });

  it('should use similar agent when only one match found', async () => {
    // Arrange
    const { getGlobalAgentRegistry, createCodeAssistContentGenerator } =
      await import('@pk-code/core');

    const similarAgent = {
      ...mockAgent,
      config: { ...mockAgent.config, name: 'test-helper' },
    };

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (mockRegistry.searchAgents as ReturnType<typeof vi.fn>).mockReturnValue([similarAgent]);
    (createCodeAssistContentGenerator as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockContentGenerator,
    );
    (mockConfig.getContentGeneratorConfig as ReturnType<typeof vi.fn>).mockReturnValue({});
    (mockContentGenerator.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: 'Helper response!' }],
          },
        },
      ],
    });

    // Act
    const result = await handleUseCommand(
      'test',
      'Do something',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBe('Helper response!');
    expect(console.log).toHaveBeenCalledWith(
      'Using similar agent "test-helper" instead of "test"',
    );
  });

  it('should handle content generation errors', async () => {
    // Arrange
    const { getGlobalAgentRegistry, createCodeAssistContentGenerator } =
      await import('@pk-code/core');

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);
    (createCodeAssistContentGenerator as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockContentGenerator,
    );
    (mockConfig.getContentGeneratorConfig as ReturnType<typeof vi.fn>).mockReturnValue({});
    (mockContentGenerator.generateContent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Generation failed'),
    );

    // Act
    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Error during agent execution:',
      'Generation failed',
    );
  });

  it('should handle empty response content', async () => {
    // Arrange
    const { getGlobalAgentRegistry, createCodeAssistContentGenerator } =
      await import('@pk-code/core');

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);
    (createCodeAssistContentGenerator as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockContentGenerator,
    );
    (mockConfig.getContentGeneratorConfig as ReturnType<typeof vi.fn>).mockReturnValue({});
    (mockContentGenerator.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: '' }],
          },
        },
      ],
    });

    // Act
    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'No response content received from agent',
    );
  });

  it('should handle registry initialization if not already initialized', async () => {
    // Arrange
    const {
      getGlobalAgentRegistry,
      initializeGlobalAgentRegistry,
      createCodeAssistContentGenerator,
    } = await import('@pk-code/core');

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => {
        throw new Error('Registry not initialized');
      })
      .mockReturnValue(mockRegistry);
    (initializeGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockResolvedValue({
      agents: [],
      errors: [],
      filesProcessed: 0,
    });
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);
    (createCodeAssistContentGenerator as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockContentGenerator,
    );
    (mockConfig.getContentGeneratorConfig as ReturnType<typeof vi.fn>).mockReturnValue({});
    (mockContentGenerator.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: 'Response after initialization' }],
          },
        },
      ],
    });

    // Act
    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      mockConfig as Config,
    );

    // Assert
    expect(result).toBe('Response after initialization');
    expect(initializeGlobalAgentRegistry).toHaveBeenCalledWith(process.cwd(), {
      includeGlobal: true,
      validateSchema: true,
    });
  });

  it('should handle missing config parameter', async () => {
    // Arrange
    const { getGlobalAgentRegistry } = await import('@pk-code/core');

    (getGlobalAgentRegistry as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    (mockRegistry.getAgent as ReturnType<typeof vi.fn>).mockReturnValue(mockAgent);

    // Act
    const result = await handleUseCommand('test-agent', 'Fix the bug');

    // Assert
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Error during agent execution:',
      'Config required for content generation',
    );
  });
});
