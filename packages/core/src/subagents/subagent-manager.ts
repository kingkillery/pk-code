/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { load as yamlLoad } from 'js-yaml';
import { GEMINI_DIR } from '../utils/paths.js';
import { isWithinRoot } from '../utils/fileUtils.js';
import type {
  Subagent,
  SubagentConfig,
  SubagentDiscoveryResult,
  SubagentLoadError,
} from './types.js';

/**
 * Default subagent directory paths
 */
const DEFAULT_PROJECT_SUBAGENTS_DIR = '.pk/agents';

/**
 * Simplified subagent manager for loading and managing file-based subagents
 * 
 * This replaces the complex AgentLoader, AgentRegistry, and orchestration system
 * with a simple file-based configuration approach.
 */
export class SubagentManager {
  private readonly projectRoot: string;
  private readonly includeGlobal: boolean;
  private subagentsCache = new Map<string, Subagent>();

  constructor(options: { projectRoot?: string; includeGlobal?: boolean } = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.includeGlobal = options.includeGlobal ?? true;
  }

  /**
   * Load all subagents from project and global directories
   */
  async loadAll(): Promise<SubagentDiscoveryResult> {
    const result: SubagentDiscoveryResult = {
      subagents: [],
      errors: [],
      filesProcessed: 0,
    };

    const searchPaths = await this.getSearchPaths();

    for (const searchPath of searchPaths) {
      const pathResult = await this.loadFromDirectory(
        searchPath.path,
        searchPath.source,
      );
      result.subagents.push(...pathResult.subagents);
      result.errors.push(...pathResult.errors);
      result.filesProcessed += pathResult.filesProcessed;
    }

    // Update cache (project subagents override global ones)
    this.updateCache(result.subagents);

    // Return deduplicated subagents from cache
    result.subagents = this.getAll();

    return result;
  }

  /**
   * Get a subagent by name from cache
   */
  get(name: string): Subagent | undefined {
    return this.subagentsCache.get(name);
  }

  /**
   * Get all cached subagents
   */
  getAll(): Subagent[] {
    return Array.from(this.subagentsCache.values());
  }

  /**
   * Find subagents matching keywords
   */
  find(keywords: string[]): Subagent[] {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    return this.getAll().filter((subagent) =>
      subagent.config.keywords.some((k) =>
        lowerKeywords.some((lk) => k.toLowerCase().includes(lk)),
      ),
    );
  }

  /**
   * Load a single subagent file
   */
  async loadFile(filePath: string): Promise<Subagent | SubagentLoadError> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = this.parseMarkdown(content);
      const source = this.determineSource(filePath);

      return {
        config,
        filePath,
        source,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return {
        filePath,
        message: `Failed to load: ${error instanceof Error ? error.message : String(error)}`,
        type: 'file-error',
        originalError: error instanceof Error ? error : undefined,
      };
    }
  }

  /**
   * Parse Markdown file with YAML frontmatter
   */
  private parseMarkdown(content: string): SubagentConfig {
    const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!frontMatterMatch) {
      throw new Error('No YAML frontmatter found');
    }

    const yamlContent = frontMatterMatch[1].replace(/\r\n/g, '\n');
    const parsed = yamlLoad(yamlContent);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('YAML frontmatter must be an object');
    }

    const config = parsed as SubagentConfig;

    // Basic validation
    this.validateConfig(config);

    return config;
  }

  /**
   * Validate subagent configuration
   */
  private validateConfig(config: SubagentConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Subagent name is required');
    }
    if (!config.description || typeof config.description !== 'string') {
      throw new Error('Subagent description is required');
    }
    if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
      throw new Error('Subagent keywords array is required');
    }
    if (!Array.isArray(config.tools)) {
      throw new Error('Subagent tools must be an array');
    }
    if (!config.model || typeof config.model !== 'string') {
      throw new Error('Subagent model is required');
    }
    if (!config.provider || typeof config.provider !== 'string') {
      throw new Error('Subagent provider is required');
    }
    if (!Array.isArray(config.examples)) {
      throw new Error('Subagent examples must be an array');
    }
  }

  /**
   * Get search paths for subagent directories
   */
  private async getSearchPaths(): Promise<
    Array<{ path: string; source: 'project' | 'global' }>
  > {
    const paths: Array<{ path: string; source: 'project' | 'global' }> = [];

    // Project directory
    const projectPath = path.join(
      this.projectRoot,
      DEFAULT_PROJECT_SUBAGENTS_DIR,
    );
    if (await this.directoryExists(projectPath)) {
      paths.push({ path: projectPath, source: 'project' });
    }

    // Global directory
    if (this.includeGlobal) {
      const globalPath = path.join(os.homedir(), GEMINI_DIR, 'agents');
      if (await this.directoryExists(globalPath)) {
        paths.push({ path: globalPath, source: 'global' });
      }
    }

    return paths;
  }

  /**
   * Load subagents from a directory
   */
  private async loadFromDirectory(
    dirPath: string,
    source: 'project' | 'global',
  ): Promise<SubagentDiscoveryResult> {
    const result: SubagentDiscoveryResult = {
      subagents: [],
      errors: [],
      filesProcessed: 0,
    };

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile() && this.isMarkdownFile(file.name)) {
          const filePath = path.join(dirPath, file.name);
          result.filesProcessed++;

          const loadResult = await this.loadFile(filePath);

          if ('config' in loadResult) {
            loadResult.source = source;
            result.subagents.push(loadResult);
          } else {
            result.errors.push(loadResult);
          }
        }
      }
    } catch (error) {
      result.errors.push({
        filePath: dirPath,
        message: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
        type: 'file-error',
        originalError: error instanceof Error ? error : undefined,
      });
    }

    return result;
  }

  /**
   * Check if file is a Markdown file
   */
  private isMarkdownFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }

  /**
   * Determine if subagent is from project or global source
   */
  private determineSource(filePath: string): 'project' | 'global' {
    const projectPath = path.join(
      this.projectRoot,
      DEFAULT_PROJECT_SUBAGENTS_DIR,
    );
    return isWithinRoot(filePath, projectPath) ? 'project' : 'global';
  }

  /**
   * Update cache with loaded subagents (project overrides global)
   */
  private updateCache(subagents: Subagent[]): void {
    // Sort so project subagents come first
    const sorted = subagents.sort((a, b) => {
      if (a.source === 'project' && b.source !== 'project') return -1;
      if (a.source !== 'project' && b.source === 'project') return 1;
      return 0;
    });

    this.subagentsCache.clear();
    for (const subagent of sorted) {
      // Project subagents override global ones with same name
      if (!this.subagentsCache.has(subagent.config.name)) {
        this.subagentsCache.set(subagent.config.name, subagent);
      }
    }
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
