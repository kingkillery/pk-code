/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SubagentExecutor, type ContentGeneratorFactory } from './subagent-executor.js';
import type { Subagent } from './types.js';
import type {
  ContentGenerator,
  MultimodalContentGenerator,
} from '../core/contentGenerator.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';

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

    it('should include attachments as inlineData parts', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-exec-'));
      const imagePath = path.join(tempDir, 'screenshot.png');
      const imageBuffer = Buffer.from('fake-image-data');
      await fs.writeFile(imagePath, imageBuffer);

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Looks good' }],
              role: 'model',
            },
            index: 0,
          },
        ],
      } as GenerateContentResponse;

      let capturedRequest: GenerateContentParameters | undefined;
      vi.mocked(mockGenerator.generateContent).mockImplementation(
        async (request) => {
          capturedRequest = request;
          return mockResponse as never;
        },
      );

      try {
        const result = await executor.execute(mockSubagent, 'Analyze image', {
          attachments: [
            {
              path: imagePath,
              description: 'Screenshot of failing UI',
              mimeType: 'image/png',
            },
          ],
        });

        expect(result.success).toBe(true);
        expect(capturedRequest).toBeDefined();

        const contents = capturedRequest?.contents;
        const firstContent =
          Array.isArray(contents) && contents.length > 0
            ? contents[0]
            : undefined;
        const parts =
          firstContent && typeof firstContent === 'object' && 'parts' in firstContent
            ? ((firstContent as { parts?: unknown }).parts as Part[] | undefined) ?? []
            : [];
        expect(parts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('Screenshot of failing UI'),
            }),
            expect.objectContaining({
              inlineData: expect.objectContaining({
                mimeType: 'image/png',
                data: imageBuffer.toString('base64'),
              }),
            }),
          ]),
        );
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should route to vision generator when available and attachments provided', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-exec-vision-'));
      const imagePath = path.join(tempDir, 'diagram.jpg');
      await fs.writeFile(imagePath, Buffer.from('vision-data'));

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Vision response' }],
              role: 'model',
            },
            index: 0,
          },
        ],
      } as GenerateContentResponse;

      const multimodalGenerator: MultimodalContentGenerator = {
        generateContent: vi.fn(),
        generateContentWithVision: vi
          .fn()
          .mockResolvedValue(mockResponse as never),
        generateContentStream: vi.fn(),
        countTokens: vi.fn(),
        embedContent: vi.fn(),
        isVisionCapable: vi.fn().mockReturnValue(true),
        getVisionModel: vi.fn(),
        getTextModel: vi.fn(),
      } as unknown as MultimodalContentGenerator;

      const multimodalFactory: ContentGeneratorFactory = vi
        .fn()
        .mockResolvedValue(multimodalGenerator as unknown as ContentGenerator);

      const visionExecutor = new SubagentExecutor(multimodalFactory);

      try {
        const result = await visionExecutor.execute(mockSubagent, 'Explain diagram', {
          attachments: [{ path: imagePath }],
        });

        expect(result.success).toBe(true);
        expect(multimodalGenerator.generateContentWithVision).toHaveBeenCalledTimes(1);
        expect(multimodalGenerator.generateContent).not.toHaveBeenCalled();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
