/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentManager } from './subagent-manager.js';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock fs and os modules
vi.mock('fs/promises');
vi.mock('os');

describe('SubagentManager', () => {
  const mockProjectRoot = '/mock/project';
  const mockHomeDir = '/mock/home';

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadAll', () => {
    it('should load subagents from project directory', async () => {
      const manager = new SubagentManager({
        projectRoot: mockProjectRoot,
        includeGlobal: false,
      });

      const mockMarkdown = `---
name: test-agent
description: Test subagent
keywords:
  - test
provider: anthropic
model: claude-3-5-sonnet-20241022
tools:
  - name: Read
examples:
  - input: "test"
    output: "test output"
---

# Test Agent
`;

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2025-01-01'),
      } as never);

      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'test-agent.md', isFile: () => true, isDirectory: () => false },
      ] as never);

      vi.mocked(fs.readFile).mockResolvedValue(mockMarkdown);

      const result = await manager.loadAll();

      expect(result.subagents).toHaveLength(1);
      expect(result.subagents[0].config.name).toBe('test-agent');
      expect(result.errors).toHaveLength(0);
      expect(result.filesProcessed).toBe(1);
    });

    it('should handle missing directories gracefully', async () => {
      const manager = new SubagentManager({
        projectRoot: mockProjectRoot,
        includeGlobal: false,
      });

      vi.mocked(fs.stat).mockRejectedValue(new Error('Directory not found'));

      const result = await manager.loadAll();

      expect(result.subagents).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.filesProcessed).toBe(0);
    });

    it('should prioritize project subagents over global ones', async () => {
      const manager = new SubagentManager({
        projectRoot: mockProjectRoot,
        includeGlobal: true,
      });

      const projectMarkdown = `---
name: duplicate
description: Project version
keywords: [test]
provider: anthropic
model: claude-3-5-sonnet-20241022
tools: []
examples: []
---

# Project Version
`;

      const globalMarkdown = `---
name: duplicate
description: Global version
keywords: [test]
provider: openai
model: gpt-4
tools: []
examples: []
---

# Global Version
`;

      // Mock fs.stat for both directories and files
      vi.mocked(fs.stat).mockImplementation(async (p) => ({
        isDirectory: () => !p.toString().endsWith('.md'),
        mtime: new Date('2025-01-01'),
      } as never));

      // Mock readdir to return files for both directories
      vi.mocked(fs.readdir).mockResolvedValue([
        {
          name: 'duplicate.md',
          isFile: () => true,
          isDirectory: () => false,
        },
      ] as never);

      // Mock readFile to return different content based on path
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        const pathStr = p.toString();
        if (pathStr.includes('.pk') || pathStr.includes(mockProjectRoot)) {
          return projectMarkdown;
        }
        return globalMarkdown;
      });

      const result = await manager.loadAll();

      // Both files are loaded and processed
      expect(result.filesProcessed).toBe(2);
      // But only one subagent in results (project wins over global for same name)
      expect(result.subagents).toHaveLength(1);
      expect(result.subagents[0].config.description).toBe('Project version');
      expect(result.subagents[0].source).toBe('project');
    });
  });

  describe('get and getAll', () => {
    it('should retrieve cached subagents', async () => {
      const manager = new SubagentManager({
        projectRoot: mockProjectRoot,
        includeGlobal: false,
      });

      const mockMarkdown = `---
name: cached-agent
description: Cached test agent
keywords: [cache]
provider: anthropic
model: claude-3-5-sonnet-20241022
tools: []
examples: []
---

# Cached Agent
`;

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2025-01-01'),
      } as never);

      vi.mocked(fs.readdir).mockResolvedValue([
        {
          name: 'cached-agent.md',
          isFile: () => true,
          isDirectory: () => false,
        },
      ] as never);

      vi.mocked(fs.readFile).mockResolvedValue(mockMarkdown);

      await manager.loadAll();

      const agent = manager.get('cached-agent');
      expect(agent).toBeDefined();
      expect(agent?.config.name).toBe('cached-agent');

      const allAgents = manager.getAll();
      expect(allAgents).toHaveLength(1);
    });
  });

  describe('find', () => {
    it('should find subagents by keywords', async () => {
      const manager = new SubagentManager({
        projectRoot: mockProjectRoot,
        includeGlobal: false,
      });

      const mockMarkdown1 = `---
name: code-agent
description: Code agent
keywords: [code, review]
provider: anthropic
model: claude-3-5-sonnet-20241022
tools: []
examples: []
---
`;

      const mockMarkdown2 = `---
name: test-agent
description: Test agent
keywords: [test, testing]
provider: anthropic
model: claude-3-5-sonnet-20241022
tools: []
examples: []
---
`;

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2025-01-01'),
      } as never);

      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'code-agent.md', isFile: () => true, isDirectory: () => false },
        { name: 'test-agent.md', isFile: () => true, isDirectory: () => false },
      ] as never);

      let callCount = 0;
      vi.mocked(fs.readFile).mockImplementation(async () =>
        callCount++ === 0 ? mockMarkdown1 : mockMarkdown2,
      );

      await manager.loadAll();

      const codeAgents = manager.find(['code']);
      expect(codeAgents).toHaveLength(1);
      expect(codeAgents[0].config.name).toBe('code-agent');

      const testAgents = manager.find(['test']);
      expect(testAgents).toHaveLength(1);
      expect(testAgents[0].config.name).toBe('test-agent');
    });
  });

  describe('validation', () => {
    it('should reject invalid configurations', async () => {
      const manager = new SubagentManager({
        projectRoot: mockProjectRoot,
        includeGlobal: false,
      });

      const invalidMarkdown = `---
name: invalid
---

# Invalid
`;

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2025-01-01'),
      } as never);

      vi.mocked(fs.readdir).mockResolvedValue([
        {
          name: 'invalid.md',
          isFile: () => true,
          isDirectory: () => false,
        },
      ] as never);

      vi.mocked(fs.readFile).mockResolvedValue(invalidMarkdown);

      const result = await manager.loadAll();

      expect(result.subagents).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('file-error');
    });
  });
});
