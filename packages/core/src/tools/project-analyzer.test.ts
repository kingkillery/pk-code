/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectAnalyzerTool } from './project-analyzer.js';
import { Config } from '../config/config.js';
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';

describe('ProjectAnalyzerTool', () => {
  let mockConfig: Config;
  let mockFileService: FileDiscoveryService;
  let tool: ProjectAnalyzerTool;
  const mockRoot = '/test/project';

  beforeEach(() => {
    // Mock file service
    mockFileService = {
      shouldGitIgnoreFile: vi.fn().mockReturnValue(false),
    } as unknown as FileDiscoveryService;

    // Mock config
    mockConfig = {
      getTargetDir: vi.fn().mockReturnValue(mockRoot),
      getFileService: vi.fn().mockReturnValue(mockFileService),
    } as unknown as Config;

    tool = new ProjectAnalyzerTool(mockConfig);
  });

  it('should have correct metadata', () => {
    expect(tool.name).toBe('project_analyzer');
    expect(tool.displayName).toBe('Project Analyzer');
    expect(tool.description).toContain('Analyzes the project');
    expect(tool.isOutputMarkdown).toBe(true);
    expect(tool.canUpdateOutput).toBe(false);
  });

  it('should validate empty params', () => {
    const result = tool.validateToolParams({});
    expect(result).toBeNull();
  });

  it('should validate absolute directory param', () => {
    const result = tool.validateToolParams({
      absolute_dir: '/some/absolute/path',
      max_items: 100,
      summarize_dependencies: true,
    });
    expect(result).toBeNull();
  });

  it('should reject relative directory param', () => {
    const result = tool.validateToolParams({
      absolute_dir: 'some/relative/path',
    });
    expect(result).toContain('absolute_dir must be absolute');
  });

  it('should reject non-positive max_items', () => {
    const result = tool.validateToolParams({
      max_items: 0,
    });
    expect(result).toContain('max_items must be a positive number');
  });

  it('should reject invalid regex', () => {
    const result = tool.validateToolParams({
      include_files_regex: '[unclosed',
    });
    expect(result).toContain('include_files_regex is not a valid regex');
  });

  it('should accept valid regex', () => {
    const result = tool.validateToolParams({
      include_files_regex: '.*\\.(ts|tsx)$',
    });
    expect(result).toBeNull();
  });

  it('should handle Windows path in getDescription', () => {
    vi.mocked(mockConfig.getTargetDir).mockReturnValue('C:\\Users\\test\\project');
    tool = new ProjectAnalyzerTool(mockConfig);
    const desc = tool.getDescription({});
    expect(desc).toContain('C:\\Users\\test\\project');
  });
});