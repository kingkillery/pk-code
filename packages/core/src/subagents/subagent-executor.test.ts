/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentExecutor, type ContentGeneratorFactory } from './subagent-executor.js';
import type { Subagent } from './types.js';
import type { ContentGenerator } from '../core/contentGenerator.js';
import type { GenerateContentResponse } from '@google/genai';

describe('SubagentExecutor', () => {
  let executor: SubagentExecutor;
  let mockSubagent: Subagent;
  let mockGeneratorFactory: ContentGeneratorFactory;
  let mockGenerator: ContentGenerator;

  beforeEach(() => {
    mockGenerator = {
      generateContent: vi.fn(),
    } as unknown as ContentGenerator;

    mockGeneratorFactory = vi.fn().mockResolvedValue(mockGenerator);
    executor = new SubagentExecutor(mockGeneratorFactory);

    mockSubagent = {
      config: {
        name: 'test-agent',
        description: 'Test agent',
        keywords: ['test'],
        tools: [{ name: 'Read' }, { name: 'Write' }],
        model: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        systemPrompt: 'You are a test agent.',
        temperature: 0.7,
        examples: [],
      },
      filePath: '/test/agent.md',
      source: 'project',
      lastModified: new Date(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should successfully execute a query', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Test response' }],
              role: 'model',
            },
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      } as GenerateContentResponse;

      vi.mocked(mockGenerator.generateContent).mockResolvedValue(
        mockResponse as never,
      );

      const result = await executor.execute(mockSubagent, 'Test query');

      expect(result.success).toBe(true);
      expect(result.response).toBe('Test response');
      expect(result.subagentName).toBe('test-agent');
      expect(result.query).toBe('Test query');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });
    });

    it('should handle execution timeout', async () => {
      vi.mocked(mockGenerator.generateContent).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      const result = await executor.execute(mockSubagent, 'Test query', {
        timeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle generator factory error', async () => {
      const failingFactory = vi
        .fn()
        .mockRejectedValue(new Error('Factory failed'));
      const failingExecutor = new SubagentExecutor(failingFactory);

      const result = await failingExecutor.execute(mockSubagent, 'Test query');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Factory failed');
    });

    it('should apply execution options', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Response with custom options' }],
              role: 'model',
            },
            index: 0,
          },
        ],
      } as GenerateContentResponse;

      vi.mocked(mockGenerator.generateContent).mockResolvedValue(
        mockResponse as never,
      );

      const options = {
        temperature: 0.5,
        maxTokens: 1000,
      };

      const result = await executor.execute(
        mockSubagent,
        'Test query',
        options,
      );

      expect(result.success).toBe(true);
      expect(mockGenerator.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            temperature: 0.5,
            maxOutputTokens: 1000,
          }),
        }),
      );
    });

    it('should extract response with multiple parts', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Part 1' }, { text: 'Part 2' }],
              role: 'model',
            },
            index: 0,
          },
        ],
      } as GenerateContentResponse;

      vi.mocked(mockGenerator.generateContent).mockResolvedValue(
        mockResponse as never,
      );

      const result = await executor.execute(mockSubagent, 'Test');
      expect(result.response).toBe('Part 1Part 2');
    });
  });
});
