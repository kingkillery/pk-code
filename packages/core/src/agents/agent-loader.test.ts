/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import { Stats, PathLike } from 'fs';
import os from 'os';
import { AgentLoader, loadAgents, loadAgentFile } from './agent-loader.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('os');
vi.mock('../utils/paths.js', () => ({
  GEMINI_DIR: '.pk',
}));

vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    resolve: (...args: string[]) => args.join('/'),
    dirname: (path: string) => path.substring(0, path.lastIndexOf('/')),
  },
}));
vi.mock('../utils/fileUtils.js', () => ({
  isWithinRoot: vi.fn(),
}));
vi.mock('../utils/schemaValidator.js', () => ({
  SchemaValidator: {
    validate: vi.fn(),
  },
}));

const mockedFs = vi.mocked(fs);
const mockedOs = vi.mocked(os);

describe('AgentLoader', () => {
  const mockProjectRoot = '/test/project';
  const mockHomeDir = '/test/home';

  beforeEach(() => {
    vi.resetAllMocks();
    mockedOs.homedir.mockReturnValue(mockHomeDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create loader with default options', () => {
      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      expect(loader).toBeDefined();
    });

    it('should create loader with custom options', () => {
      const loader = new AgentLoader({
        projectRoot: mockProjectRoot,
        includeGlobal: false,
        validateSchema: false,
        customPaths: ['/custom/path'],
      });
      expect(loader).toBeDefined();
    });
  });

  describe('loadAgents', () => {
    it('should load agents from project directory', async () => {
      const mockAgentContent = `---
name: test-agent
description: A test agent for testing purposes
keywords: ["test", "example"]
tools: []
model: gpt-4
provider: openai
examples:
  - input: "hello"
    output: "Hi there!"
---

# Test Agent

This is a test agent.`;

      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date(),
      } as unknown as Stats);

      mockedFs.readdir.mockResolvedValue([
        { name: 'test-agent.md', isFile: () => true },
      ] as any);

      mockedFs.readFile.mockResolvedValue(mockAgentContent);

      const { SchemaValidator } = await import('../utils/schemaValidator.js');
      vi.mocked(SchemaValidator.validate).mockReturnValue(null);

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgents();

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].config.name).toBe('test-agent');
      expect(result.errors).toHaveLength(0);
      expect(result.filesProcessed).toBe(1);
    });

    it('should handle YAML parsing errors', async () => {
      const invalidYamlContent = `---
invalid: yaml: content
---`;

      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date(),
      } as unknown as Stats);

      mockedFs.readdir.mockResolvedValue([
        { name: 'invalid-agent.md', isFile: () => true },
      ] as any);

      mockedFs.readFile.mockResolvedValue(invalidYamlContent);

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgents();

      expect(result.agents).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('file-error');
    });

    it('should handle schema validation errors', async () => {
      const mockAgentContent = `---
name: invalid-agent
description: short
keywords: []
tools: []
model: gpt-4
provider: openai
examples: []
---`;

      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date(),
      } as unknown as Stats);

      mockedFs.readdir.mockResolvedValue([
        { name: 'invalid-agent.md', isFile: () => true },
      ] as any);

      mockedFs.readFile.mockResolvedValue(mockAgentContent);

      const { SchemaValidator } = await import('../utils/schemaValidator.js');
      vi.mocked(SchemaValidator.validate).mockReturnValue(
        'Validation error: description too short',
      );

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgents();

      expect(result.agents).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('validation-error');
    });

    it('should handle missing front-matter', async () => {
      const noFrontMatterContent = `# Agent without front-matter

This agent has no YAML front-matter.`;

      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date(),
      } as unknown as Stats);

      mockedFs.readdir.mockResolvedValue([
        { name: 'no-frontmatter.md', isFile: () => true },
      ] as any);

      mockedFs.readFile.mockResolvedValue(noFrontMatterContent);

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgents();

      expect(result.agents).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No YAML front-matter found');
    });

    it('should resolve name collisions with project priority', async () => {
      const projectAgentContent = `---
name: same-name
description: Project version of the agent
keywords: ["project"]
tools: []
model: gpt-4
provider: openai
examples:
  - input: "hello"
    output: "Project response"
---`;

      const globalAgentContent = `---
name: same-name
description: Global version of the agent
keywords: ["global"]
tools: []
model: gpt-3.5-turbo
provider: openai
examples:
  - input: "hello"
    output: "Global response"
---`;

      // Mock stats for directories
      mockedFs.stat.mockImplementation(async (path: PathLike) => {
        if (String(path).includes('.pk/agents')) {
          return {
            isDirectory: () => true,
            mtime: new Date(),
          } as unknown as Stats;
        }
        return {
          isDirectory: () => false,
          mtime: new Date(),
        } as unknown as Stats;
      });

      // Mock readdir to return agents for both directories
      mockedFs.readdir.mockImplementation(async (path: PathLike) => {
        if (String(path).includes('project/.pk/agents')) {
          return [
            { name: 'same-name.md', isFile: () => true },
          ] as any;
        }
        if (String(path).includes('home/.pk/agents')) {
          return [
            { name: 'same-name.md', isFile: () => true },
          ] as any;
        }
        return [] as any;
      });

      // Mock readFile to return different content based on path
      (mockedFs.readFile.mockImplementation as any)(async (path: PathLike) => {
        if (String(path).includes('project/.pk/agents')) {
          return projectAgentContent;
        }
        return globalAgentContent;
      });

      const { isWithinRoot } = await import('../utils/fileUtils.js');
      vi.mocked(isWithinRoot).mockImplementation((filePath: string) =>
        filePath.includes('project/.pk/agents'),
      );

      const { SchemaValidator } = await import('../utils/schemaValidator.js');
      vi.mocked(SchemaValidator.validate).mockReturnValue(null);

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgents();

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].config.description).toBe(
        'Project version of the agent',
      );
      expect(result.agents[0].source).toBe('project');
    });
  });

  describe('loadAgentFile', () => {
    it('should load a single agent file successfully', async () => {
      const mockAgentContent = `---
name: single-agent
description: A single agent for testing
keywords: ["single", "test"]
tools: []
model: gpt-4
provider: openai
examples:
  - input: "test"
    output: "response"
---`;

      mockedFs.stat.mockResolvedValue({
        mtime: new Date(),
      } as unknown as Stats);

      mockedFs.readFile.mockResolvedValue(mockAgentContent);

      const { SchemaValidator } = await import('../utils/schemaValidator.js');
      vi.mocked(SchemaValidator.validate).mockReturnValue(null);

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgentFile('/test/path/single-agent.md');

      expect('config' in result).toBe(true);
      if ('config' in result) {
        expect(result.config.name).toBe('single-agent');
      }
    });

    it('should return error for invalid file', async () => {
      mockedFs.stat.mockRejectedValue(new Error('File not found'));

      const loader = new AgentLoader({ projectRoot: mockProjectRoot });
      const result = await loader.loadAgentFile('/test/path/nonexistent.md');

      expect('message' in result).toBe(true);
      if ('message' in result) {
        expect(result.type).toBe('file-error');
      }
    });
  });

  describe('convenience functions', () => {
    it('should load agents with loadAgents function', async () => {
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => false,
        mtime: new Date(),
      } as unknown as Stats);

      mockedFs.readdir.mockResolvedValue([] as any);

      const result = await loadAgents(mockProjectRoot);
      expect(result).toBeDefined();
      expect(result.agents).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should load single agent with loadAgentFile function', async () => {
      mockedFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await loadAgentFile(
        '/test/path/agent.md',
        mockProjectRoot,
      );
      expect(result).toBeDefined();
      expect('message' in result).toBe(true);
    });
  });
});
