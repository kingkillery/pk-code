/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompletion } from './useCompletion.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import { CommandContext } from '../commands/types.js';
import { Config, FileDiscoveryService } from '@pk-code/core';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('glob');
vi.mock('@pk-code/core', async () => {
  const actual = await vi.importActual('@pk-code/core');
  return {
    ...actual,
    FileDiscoveryService: vi.fn(),
    isNodeError: vi.fn((error) => error.code === 'ENOENT'),
    escapePath: vi.fn((path) => path),
    unescapePath: vi.fn((path) => path),
    getErrorMessage: vi.fn((error) => error.message),
  };
});

describe('useCompletion - Additional Tests', () => {
  let mockFileDiscoveryService: FileDiscoveryService;
  let mockConfig: Config;
  let mockCommandContext: CommandContext;

  const testCwd = '/test/project';

  beforeEach(() => {
    mockFileDiscoveryService = {
      shouldGitIgnoreFile: vi.fn(),
      shouldGeminiIgnoreFile: vi.fn(),
      shouldIgnoreFile: vi.fn(),
      filterFiles: vi.fn(),
      getGeminiIgnorePatterns: vi.fn(),
      projectRoot: '',
      gitIgnoreFilter: null,
      geminiIgnoreFilter: null,
    } as unknown as FileDiscoveryService;

    mockConfig = {
      getFileFilteringRespectGitIgnore: vi.fn(() => true),
      getFileService: vi.fn().mockReturnValue(mockFileDiscoveryService),
      getEnableRecursiveFileSearch: vi.fn(() => true),
    } as unknown as Config;

    mockCommandContext = {} as CommandContext;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty command list gracefully', () => {
      const { result } = renderHook(() =>
        useCompletion(
          '/',
          testCwd,
          true,
          [],
          mockCommandContext,
          mockConfig,
        ),
      );

      expect(result.current.suggestions).toHaveLength(0);
      expect(result.current.showSuggestions).toBe(false);
    });

    it('should handle command with no subcommands', () => {
      const commands = [
        {
          name: 'simple',
          description: 'Simple command',
          action: vi.fn(),
        },
      ];

      const { result } = renderHook(() =>
        useCompletion(
          '/simple',
          testCwd,
          true,
          commands,
          mockCommandContext,
          mockConfig,
        ),
      );

      expect(result.current.suggestions).toHaveLength(0);
      expect(result.current.showSuggestions).toBe(false);
    });

    it('should handle command with empty subcommands array', () => {
      const commands = [
        {
          name: 'parent',
          description: 'Parent command',
          subCommands: [],
          action: vi.fn(),
        },
      ];

      const { result } = renderHook(() =>
        useCompletion(
          '/parent',
          testCwd,
          true,
          commands,
          mockCommandContext,
          mockConfig,
        ),
      );

      expect(result.current.suggestions).toHaveLength(0);
      expect(result.current.showSuggestions).toBe(false);
    });

    it('should handle deeply nested command structures', () => {
      const commands = [
        {
          name: 'level1',
          description: 'Level 1 command',
          subCommands: [
            {
              name: 'level2',
              description: 'Level 2 command',
              subCommands: [
                {
                  name: 'level3',
                  description: 'Level 3 command',
                  action: vi.fn(),
                },
              ],
              action: vi.fn(),
            },
          ],
          action: vi.fn(),
        },
      ];

      const { result } = renderHook(() =>
        useCompletion(
          '/level1 level2',
          testCwd,
          true,
          commands,
          mockCommandContext,
          mockConfig,
        ),
      );

      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].label).toBe('level3');
    });
  });

  describe('File path completion edge cases', () => {
    beforeEach(() => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'file2.js', isDirectory: () => false },
        { name: 'folder1', isDirectory: () => true },
        { name: '.hidden', isDirectory: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
    });

    it('should handle file paths with special characters', async () => {
      vi.mocked(glob).mockResolvedValue([
        `${testCwd}/file with spaces.txt`,
        `${testCwd}/file-with-dashes.js`,
        `${testCwd}/file_with_underscores.ts`,
      ]);

      const { result } = renderHook(() =>
        useCompletion(
          '@file',
          testCwd,
          true,
          [],
          mockCommandContext,
          mockConfig,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toHaveLength(3);
      const labels = result.current.suggestions.map((s) => s.label);
      expect(labels).toContain('file with spaces.txt');
      expect(labels).toContain('file-with-dashes.js');
      expect(labels).toContain('file_with_underscores.ts');
    });

    it('should handle file paths with unicode characters', async () => {
      vi.mocked(glob).mockResolvedValue([
        `${testCwd}/你好.txt`,
        `${testCwd}/café.js`,
        `${testCwd}/naïve.ts`,
      ]);

      const { result } = renderHook(() =>
        useCompletion(
          '@',
          testCwd,
          true,
          [],
          mockCommandContext,
          mockConfig,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toHaveLength(3);
      const labels = result.current.suggestions.map((s) => s.label);
      expect(labels).toContain('你好.txt');
      expect(labels).toContain('café.js');
      expect(labels).toContain('naïve.ts');
    });

    it('should handle very long file names', async () => {
      const longFileName = 'a'.repeat(100) + '.txt';
      vi.mocked(glob).mockResolvedValue([`${testCwd}/${longFileName}`]);

      const { result } = renderHook(() =>
        useCompletion(
          '@a',
          testCwd,
          true,
          [],
          mockCommandContext,
          mockConfig,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].label).toBe(longFileName);
    });
  });

  describe('Performance and debouncing', () => {
    it('should properly debounce rapid file completion requests', async () => {
      vi.mocked(glob).mockResolvedValue([`${testCwd}/file1.txt`]);

      const { rerender } = renderHook(
        ({ query }) =>
          useCompletion(
            query,
            testCwd,
            true,
            [],
            mockCommandContext,
            mockConfig,
          ),
        { initialProps: { query: '@f' } },
      );

      // Rapidly change the query
      rerender({ query: '@fi' });
      rerender({ query: '@fil' });
      rerender({ query: '@file' });
      rerender({ query: '@file1' });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should only have made one call to glob
      expect(glob).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous requests when query changes', async () => {
      // Mock glob to take some time to resolve
      vi.mocked(glob).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([`${testCwd}/file1.txt`]), 100),
          ),
      );

      const { rerender, result } = renderHook(
        ({ query }) =>
          useCompletion(
            query,
            testCwd,
            true,
            [],
            mockCommandContext,
            mockConfig,
          ),
        { initialProps: { query: '@f' } },
      );

      // Change query before first request completes
      rerender({ query: '@file' });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Should have suggestions from the second query
      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].label).toBe('file1.txt');
    });
  });

  describe('Configuration handling', () => {
    it('should work correctly when config is undefined', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const { result } = renderHook(() =>
        useCompletion('@', testCwd, true, [], mockCommandContext, undefined),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].label).toBe('file1.txt');
    });

    it('should respect disabled recursive file search', async () => {
      // Create a mock config with recursive search disabled
      const nonRecursiveConfig = {
        ...mockConfig,
        getEnableRecursiveFileSearch: vi.fn(() => false),
      } as unknown as Config;

      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const { result } = renderHook(() =>
        useCompletion(
          '@',
          testCwd,
          true,
          [],
          mockCommandContext,
          nonRecursiveConfig,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Should use fs.readdir instead of glob
      expect(fs.readdir).toHaveBeenCalledWith(testCwd, { withFileTypes: true });
      expect(glob).not.toHaveBeenCalled();
      expect(result.current.suggestions).toHaveLength(1);
    });
  });
});