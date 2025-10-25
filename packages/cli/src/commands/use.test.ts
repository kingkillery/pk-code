/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleUseCommand, parseUseCommandSyntax } from './use.js';
import type {
  Config,
  Subagent,
  SubagentExecutionOptions,
  SubagentExecutionResult,
} from '@pk-code/core';
import { AuthType } from '@pk-code/core';

const loadAllMock = vi.fn();
const getMock = vi.fn();
const getAllMock = vi.fn();
const findMock = vi.fn();
const executorExecuteMock = vi.fn();
const createCodeAssistContentGeneratorMock = vi.fn();

let lastFactory:
  | ((subagent: Subagent) => Promise<unknown>)
  | null = null;

vi.mock('@pk-code/core', async (importOriginal) => {
  const actual = await importOriginal();

  class MockSubagentManager {
    loadAll = loadAllMock;
    get = getMock;
    getAll = getAllMock;
    find = findMock;
  }

  class MockSubagentExecutor {
    constructor(factory: (subagent: Subagent) => Promise<unknown>) {
      lastFactory = factory;
    }

    execute = executorExecuteMock;
  }

  return {
    ...actual,
    SubagentManager: vi
      .fn()
      .mockImplementation(() => new MockSubagentManager()),
    SubagentExecutor: vi
      .fn()
      .mockImplementation((factory, _config) => new MockSubagentExecutor(factory)),
    createCodeAssistContentGenerator: createCodeAssistContentGeneratorMock,
  };
});

const mockSubagent: Subagent = {
  config: {
    name: 'test-agent',
    description: 'A test agent for unit testing',
    keywords: ['test', 'unit', 'testing'],
    tools: [{ name: 'read' }],
    model: 'gemini-1.5-pro',
    provider: 'gemini',
    examples: [],
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt: 'You are a helpful test agent.',
  },
  filePath: '/test/agents/test-agent.md',
  source: 'project',
  lastModified: new Date(),
};

const defaultDiscovery = {
  subagents: [mockSubagent],
  errors: [],
  filesProcessed: 1,
};

const createMockConfig = (): Partial<Config> => ({
  getProjectRoot: vi.fn(() => '/workspace'),
  getDebugMode: vi.fn(() => false),
  getDefaultSubagentName: vi.fn(() => undefined),
  getSubagentExecutionOptions: vi.fn(() => undefined),
  getAuthType: vi.fn(() => AuthType.LOGIN_WITH_GOOGLE),
});

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

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    loadAllMock.mockResolvedValue(defaultDiscovery);
    getMock.mockImplementation((name: string) =>
      name === 'test-agent' ? mockSubagent : undefined,
    );
    getAllMock.mockReturnValue([mockSubagent]);
    findMock.mockReturnValue([]);
    createCodeAssistContentGeneratorMock.mockReset();
    createCodeAssistContentGeneratorMock.mockResolvedValue({});
    executorExecuteMock.mockReset();
    lastFactory = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully execute a subagent when found', async () => {
    const mockResult: SubagentExecutionResult = {
      query: 'Fix the bug',
      subagentName: 'test-agent',
      response: 'Agent response: I have fixed the bug!',
      duration: 1200,
      success: true,
    };

    executorExecuteMock.mockImplementation(async (subagent, _query, _options) => {
      if (lastFactory) {
        await lastFactory(subagent);
      }
      return mockResult;
    });

    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      createMockConfig() as Config,
    );

    expect(result).toBe(mockResult.response);
    expect(executorExecuteMock).toHaveBeenCalledWith(
      mockSubagent,
      'Fix the bug',
      undefined,
    );
    expect(createCodeAssistContentGeneratorMock).toHaveBeenCalled();
  });

  it('should fall back to default agent when requested agent is missing', async () => {
    getMock.mockImplementation((name: string) =>
      name === 'default' ? mockSubagent : undefined,
    );

    executorExecuteMock.mockImplementation(async (subagent, _query, _options) => {
      if (lastFactory) {
        await lastFactory(subagent);
      }
      return {
        query: 'Do something',
        subagentName: subagent.config.name,
        response: 'Default agent response',
        duration: 400,
        success: true,
      } satisfies SubagentExecutionResult;
    });

    const config = createMockConfig();
    config.getDefaultSubagentName = vi.fn(() => 'default');

    const result = await handleUseCommand(
      'missing-agent',
      'Do something',
      config as Config,
    );

    expect(result).toBe('Default agent response');
    expect(console.log).toHaveBeenCalledWith(
      'No specific agent requested. Using default agent...',
    );
  });

  it('should suggest similar subagents when multiple matches are found', async () => {
    const similarAgent1: Subagent = {
      ...mockSubagent,
      config: { ...mockSubagent.config, name: 'test-helper' },
    };
    const similarAgent2: Subagent = {
      ...mockSubagent,
      config: { ...mockSubagent.config, name: 'test-assistant' },
    };

    getMock.mockReturnValue(undefined);
    findMock.mockReturnValue([similarAgent1, similarAgent2]);

    const result = await handleUseCommand(
      'test',
      'Do something',
      createMockConfig() as Config,
    );

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Agent "test" not found. Did you mean one of these?',
    );
  });

  it('should use similar subagent when only one match is found', async () => {
    const similarAgent: Subagent = {
      ...mockSubagent,
      config: { ...mockSubagent.config, name: 'test-helper' },
    };

    getMock.mockReturnValue(undefined);
    findMock.mockReturnValue([similarAgent]);

    executorExecuteMock.mockImplementation(async (subagent, _query, _options) => {
      if (lastFactory) {
        await lastFactory(subagent);
      }
      return {
        query: 'Do something',
        subagentName: subagent.config.name,
        response: 'Helper response!',
        duration: 400,
        success: true,
      } satisfies SubagentExecutionResult;
    });

    const result = await handleUseCommand(
      'test',
      'Do something',
      createMockConfig() as Config,
    );

    expect(result).toBe('Helper response!');
    expect(console.log).toHaveBeenCalledWith(
      'Using similar agent "test-helper" instead of "test"',
    );
  });

  it('should report execution failures', async () => {
    executorExecuteMock.mockImplementation(async (subagent, _query, _options) => {
      if (lastFactory) {
        await lastFactory(subagent);
      }
      return {
        query: 'Fix the bug',
        subagentName: subagent.config.name,
        response: '',
        duration: 800,
        success: false,
        error: 'Execution failed',
      } satisfies SubagentExecutionResult;
    });

    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      createMockConfig() as Config,
    );

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Execution failed:',
      'Execution failed',
    );
  });

  it('should merge config preferences with override options', async () => {
    const baseOptions: SubagentExecutionOptions = {
      timeout: 120000,
      temperature: 0.2,
    };

    executorExecuteMock.mockImplementation(async (subagent, _query, _options) => {
      if (lastFactory) {
        await lastFactory(subagent);
      }
      return {
        query: 'Fix the bug',
        subagentName: subagent.config.name,
        response: 'Merged response',
        duration: 900,
        success: true,
      } satisfies SubagentExecutionResult;
    });

    const config = createMockConfig();
    config.getSubagentExecutionOptions = vi.fn(() => baseOptions);

    const overrides: SubagentExecutionOptions = {
      temperature: 0.9,
      maxTokens: 4096,
    };

    const result = await handleUseCommand(
      'test-agent',
      'Fix the bug',
      config as Config,
      overrides,
    );

    expect(result).toBe('Merged response');
    expect(executorExecuteMock).toHaveBeenCalledWith(
      mockSubagent,
      'Fix the bug',
      {
        timeout: 120000,
        temperature: 0.9,
        maxTokens: 4096,
      },
    );
  });

  it('should pass attachments and forceVision overrides to executor', async () => {
    executorExecuteMock.mockImplementation(async (subagent, _query, _options) => {
      if (lastFactory) {
        await lastFactory(subagent);
      }
      return {
        query: 'Analyze screenshot',
        subagentName: subagent.config.name,
        response: 'Detailed vision analysis',
        duration: 1500,
        success: true,
      } satisfies SubagentExecutionResult;
    });

    const overrides: SubagentExecutionOptions = {
      attachments: [
        {
          path: './artifacts/screenshot.png',
          description: 'UI screenshot',
        },
      ],
      forceVision: true,
    };

    const result = await handleUseCommand(
      'test-agent',
      'Analyze screenshot',
      createMockConfig() as Config,
      overrides,
    );

    expect(result).toBe('Detailed vision analysis');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Attachments included: UI screenshot'),
    );
    expect(executorExecuteMock).toHaveBeenCalledWith(
      mockSubagent,
      'Analyze screenshot',
      overrides,
    );
  });

  it('should short-circuit in dry-run mode without loading agents', async () => {
    process.env.PK_DRY_RUN = 'true';

    const result = await handleUseCommand(
      'test-agent',
      'Dry run query',
      createMockConfig() as Config,
    );

    expect(result).toContain('DRY-RUN for pk use');
    expect(loadAllMock).not.toHaveBeenCalled();
    expect(executorExecuteMock).not.toHaveBeenCalled();

    delete process.env.PK_DRY_RUN;
  });

  it('should handle missing agents gracefully', async () => {
    getMock.mockReturnValue(undefined);
    getAllMock.mockReturnValue([]);

    const result = await handleUseCommand(
      'nonexistent',
      'Do something',
      createMockConfig() as Config,
    );

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'No agents available. Please configure at least one agent.',
    );
  });
});
