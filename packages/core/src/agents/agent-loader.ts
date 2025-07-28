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
  AgentConfig,
  AgentDiscoveryResult,
  AgentLoadError,
  AgentLoaderOptions,
  ParsedAgent,
} from './types.js';
import { fileURLToPath } from 'url';

// Load schema for validation
let agentConfigSchema: Record<string, unknown>;

// Load schema lazily to avoid path issues during test module loading
const loadSchema = async (): Promise<void> => {
  if (agentConfigSchema !== undefined) return;
  
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.join(__dirname, 'agent-config.schema.json');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    agentConfigSchema = JSON.parse(schemaContent);
  } catch {
    // Schema file not found, validation will be skipped
    agentConfigSchema = {};
  }
};

/**
 * Default agent directories
 */
const DEFAULT_PROJECT_AGENTS_DIR = '.pk/agents';

/**
 * Agent file discovery and parsing utilities
 */
export class AgentLoader {
  private readonly options: Required<AgentLoaderOptions>;

  constructor(options: AgentLoaderOptions) {
    // Ensure a valid projectRoot is always set; fallback to the user's home dir
    const projectRoot = options.projectRoot ?? os.homedir();

    this.options = {
      includeGlobal: true,
      validateSchema: true,
      customPaths: [],
      ...options,
      projectRoot,
    } as Required<AgentLoaderOptions>;
  }

  /**
   * Discover and load all agent files
   */
  async loadAgents(): Promise<AgentDiscoveryResult> {
    const result: AgentDiscoveryResult = {
      agents: [],
      errors: [],
      filesProcessed: 0,
    };

    const searchPaths = await this.getSearchPaths();

    for (const searchPath of searchPaths) {
      try {
        const pathResult = await this.loadAgentsFromPath(searchPath);
        result.agents.push(...pathResult.agents);
        result.errors.push(...pathResult.errors);
        result.filesProcessed += pathResult.filesProcessed;
      } catch (error) {
        result.errors.push({
          filePath: searchPath.path,
          message: `Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`,
          type: 'file-error',
          originalError: error instanceof Error ? error : undefined,
        });
      }
    }

    // Handle name collisions (project agents take priority over global agents)
    const finalAgents = this.resolveNameCollisions(result.agents);
    result.agents = finalAgents;

    return result;
  }

  /**
   * Load a single agent file
   */
  async loadAgentFile(filePath: string): Promise<ParsedAgent | AgentLoadError> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      const agent = await this.parseAgentContent(
        content,
        filePath,
        stats.mtime,
      );

      if (this.options.validateSchema) {
        const validationError = await this.validateAgentConfig(agent.config);
        if (validationError) {
          return {
            filePath,
            message: `Schema validation failed: ${validationError}`,
            type: 'validation-error',
          };
        }
      }

      return agent;
    } catch (error) {
      return {
        filePath,
        message: `Failed to load agent file: ${error instanceof Error ? error.message : String(error)}`,
        type: 'file-error',
        originalError: error instanceof Error ? error : undefined,
      };
    }
  }

  /**
   * Parse agent content from a markdown file with YAML front-matter
   */
  private async parseAgentContent(
    content: string,
    filePath: string,
    lastModified: Date,
  ): Promise<ParsedAgent> {
    // Handle different line endings (Windows/Mac/Linux) in front-matter
    const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!frontMatterMatch) {
      throw new Error('No YAML front-matter found in agent file');
    }

    const yamlContent = frontMatterMatch[1].replace(/\r\n/g, '\n');
    let config: AgentConfig;

    try {
      const parsed = yamlLoad(yamlContent);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('YAML front-matter must be an object');
      }
      config = parsed as AgentConfig;
    } catch (error) {
      throw new Error(
        `Failed to parse YAML front-matter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const source = this.determineAgentSource(filePath);

    return {
      config,
      filePath,
      source,
      content,
      lastModified,
    };
  }

  /**
   * Validate agent configuration against schema
   */
  private async validateAgentConfig(config: AgentConfig): Promise<string | null> {
    await loadSchema();
    if (!agentConfigSchema || Object.keys(agentConfigSchema).length === 0) {
      return null; // Skip validation if schema not available
    }

    // Basic validation for required fields
    if (
      !config.name ||
      typeof config.name !== 'string' ||
      config.name.length === 0
    ) {
      return 'Agent name is required and must be a non-empty string';
    }

    if (
      !config.description ||
      typeof config.description !== 'string' ||
      config.description.length < 10
    ) {
      return 'Agent description is required and must be at least 10 characters';
    }

    if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
      return 'Agent keywords is required and must be a non-empty array';
    }

    if (!Array.isArray(config.tools)) {
      return 'Agent tools must be an array';
    }

    if (!config.model || typeof config.model !== 'string') {
      return 'Agent model is required and must be a string';
    }

    if (!config.provider || typeof config.provider !== 'string') {
      return 'Agent provider is required and must be a string';
    }

    if (!Array.isArray(config.examples) || config.examples.length === 0) {
      return 'Agent examples is required and must be a non-empty array';
    }

    // Validate examples
    for (const example of config.examples) {
      if (!example.input || !example.output) {
        return 'Each example must have both input and output properties';
      }
    }

    return null;
  }

  /**
   * Get all search paths for agent discovery
   */
  private async getSearchPaths(): Promise<
    Array<{ path: string; source: 'project' | 'global' | 'custom' }>
  > {
    const paths: Array<{
      path: string;
      source: 'project' | 'global' | 'custom';
    }> = [];

    // Project-specific agents directory
    const projectAgentsPath = path.join(
      this.options.projectRoot,
      DEFAULT_PROJECT_AGENTS_DIR,
    );
    if (await this.directoryExists(projectAgentsPath)) {
      paths.push({ path: projectAgentsPath, source: 'project' });
    }

// Global agents directory – compute lazily so that test suites can mock os.homedir() before this executes.
    if (this.options.includeGlobal) {
      const globalAgentsDir = path.join(os.homedir(), GEMINI_DIR, 'agents');
      if (await this.directoryExists(globalAgentsDir)) {
        paths.push({ path: globalAgentsDir, source: 'global' });
      }
    }

    // Custom paths
    for (const customPath of this.options.customPaths) {
      if (await this.directoryExists(customPath)) {
        paths.push({ path: customPath, source: 'custom' });
      }
    }

    return paths;
  }

  /**
   * Load agents from a specific directory path
   */
  private async loadAgentsFromPath(searchPath: {
    path: string;
    source: 'project' | 'global' | 'custom';
  }): Promise<AgentDiscoveryResult> {
    const result: AgentDiscoveryResult = {
      agents: [],
      errors: [],
      filesProcessed: 0,
    };

    try {
      const files = await fs.readdir(searchPath.path, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile() && this.isAgentFile(file.name)) {
          const filePath = path.join(searchPath.path, file.name);
          result.filesProcessed++;

          const loadResult = await this.loadAgentFile(filePath);

          if ('config' in loadResult) {
            // Ensure source matches the search path
            loadResult.source =
              searchPath.source === 'custom' ? 'project' : searchPath.source;
            result.agents.push(loadResult);
          } else {
            result.errors.push(loadResult);
          }
        }
      }
    } catch (error) {
      result.errors.push({
        filePath: searchPath.path,
        message: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
        type: 'file-error',
        originalError: error instanceof Error ? error : undefined,
      });
    }

    return result;
  }

  /**
   * Check if a file is an agent file based on extension
   */
  private isAgentFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }

  /**
   * Determine if an agent file is from project or global source
   */
  private determineAgentSource(filePath: string): 'project' | 'global' {
    const projectAgentsPath = path.join(
      this.options.projectRoot ?? os.homedir(),
      DEFAULT_PROJECT_AGENTS_DIR,
    );

    if (isWithinRoot(filePath, projectAgentsPath)) {
      return 'project';
    }

    return 'global';
  }

  /**
   * Resolve name collisions between agents (project takes priority over global)
   */
  private resolveNameCollisions(agents: ParsedAgent[]): ParsedAgent[] {
    const agentMap = new Map<string, ParsedAgent>();

    // Process in order of priority: project first, then global
    const sortedAgents = agents.sort((a, b) => {
      if (a.source === 'project' && b.source !== 'project') return -1;
      if (a.source !== 'project' && b.source === 'project') return 1;
      return 0;
    });

    for (const agent of sortedAgents) {
      const existing = agentMap.get(agent.config.name);
      if (!existing || agent.source === 'project') {
        agentMap.set(agent.config.name, agent);
      }
    }

    return Array.from(agentMap.values());
  }

  /**
   * Check if a directory exists
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

/**
 * Convenience function to load agents with default options
 */
export async function loadAgents(
  projectRoot?: string,
  options?: Partial<AgentLoaderOptions>,
): Promise<AgentDiscoveryResult> {
  const loader = new AgentLoader({
    projectRoot,
    ...options,
  });

  return loader.loadAgents();
}

/**
 * Convenience function to load a single agent file
 */
export async function loadAgentFile(
  filePath: string,
  projectRoot?: string,
): Promise<ParsedAgent | AgentLoadError> {
  const loader = new AgentLoader({ projectRoot });
  return loader.loadAgentFile(filePath);
}
