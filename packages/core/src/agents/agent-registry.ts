/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import path from 'path';
import os from 'os';
import type {
  AgentRegistry as IAgentRegistry,
  ParsedAgent,
  AgentLoaderOptions,
  AgentDiscoveryResult,
} from './types.js';
import { AgentLoader, loadAgents } from './agent-loader.js';

/**
 * Agent registry for managing loaded agents with hot-reloading support
 */
export class AgentRegistry implements IAgentRegistry {
  private agents = new Map<string, ParsedAgent>();
  private watchers = new Map<string, FSWatcher>();
  private rescanDebounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly projectRoot: string;
  private readonly options: Partial<AgentLoaderOptions>;

  constructor(projectRoot: string, options?: Partial<AgentLoaderOptions>) {
    this.projectRoot = projectRoot;
    this.options = options ?? {};
  }

  /**
   * Initialize the registry by loading all agents
   */
  async initialize(): Promise<AgentDiscoveryResult> {
    const result = await loadAgents(this.projectRoot, this.options);

    // Register all successfully loaded agents
    for (const agent of result.agents) {
      this.registerAgent(agent);
    }

    // Set up file watchers for hot-reloading
    await this.setupFileWatchers();

    return result;
  }

  /**
   * Get all registered agents
   */
  getAgents(): ParsedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): ParsedAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Find agents matching keywords
   */
  findAgents(keywords: string[]): ParsedAgent[] {
    const normalizedKeywords = keywords.map((k) => k.toLowerCase());

    return this.getAgents().filter((agent) => {
      const agentKeywords = agent.config.keywords.map((k) => k.toLowerCase());
      return normalizedKeywords.some((keyword) =>
        agentKeywords.some(
          (agentKeyword) =>
            agentKeyword.includes(keyword) || keyword.includes(agentKeyword),
        ),
      );
    });
  }

  /**
   * Find agents by exact keyword match
   */
  findAgentsByExactKeywords(keywords: string[]): ParsedAgent[] {
    const normalizedKeywords = keywords.map((k) => k.toLowerCase());

    return this.getAgents().filter((agent) => {
      const agentKeywords = agent.config.keywords.map((k) => k.toLowerCase());
      return normalizedKeywords.some((keyword) =>
        agentKeywords.includes(keyword),
      );
    });
  }

  /**
   * Find agent by file path
   */
  findAgentByFilePath(filePath: string): ParsedAgent | undefined {
    return this.getAgents().find((agent) => agent.filePath === filePath);
  }

  /**
   * Search agents by name or description
   */
  searchAgents(query: string): ParsedAgent[] {
    const normalizedQuery = query.toLowerCase();

    return this.getAgents().filter((agent) => {
      const nameMatch = agent.config.name
        .toLowerCase()
        .includes(normalizedQuery);
      const descriptionMatch = agent.config.description
        .toLowerCase()
        .includes(normalizedQuery);
      const keywordMatch = agent.config.keywords.some((k) =>
        k.toLowerCase().includes(normalizedQuery),
      );

      return nameMatch || descriptionMatch || keywordMatch;
    });
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: ParsedAgent): void {
    this.agents.set(agent.config.name, agent);
  }

  /**
   * Unregister an agent by name
   */
  unregisterAgent(name: string): boolean {
    return this.agents.delete(name);
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
    this.stopWatching();
  }

  /**
   * Get number of registered agents
   */
  size(): number {
    return this.agents.size;
  }

  /**
   * Reload all agents from disk
   */
  async reload(): Promise<AgentDiscoveryResult> {
    this.clear();
    return this.initialize();
  }

  /**
   * Reload a specific agent file
   */
  async reloadAgent(filePath: string): Promise<void> {
    const loader = new AgentLoader({
      projectRoot: this.projectRoot,
      ...this.options,
    });

    try {
      const result = await loader.loadAgentFile(filePath);

      if ('config' in result) {
        this.registerAgent(result);
      } else {
        console.warn(
          `Failed to reload agent from ${filePath}:`,
          result.message,
        );
        // Remove the agent if it was previously loaded but now has errors
        const existingAgent = this.getAgents().find(
          (a) => a.filePath === filePath,
        );
        if (existingAgent) {
          this.unregisterAgent(existingAgent.config.name);
        }
      }
    } catch (error) {
      console.warn(`Error reloading agent from ${filePath}:`, error);
    }
  }

  /**
   * Set up file watchers for hot-reloading
   */
  private async setupFileWatchers(): Promise<void> {
    const agentDirs = await this.getWatchDirectories();

    for (const dir of agentDirs) {
      try {
        await fs.access(dir);

        const watcher = watch(dir, { recursive: false }, () => {
          // Debounce to avoid rapid events. We rescan the whole directory
          // because file events are unreliable across platforms.
          const existingTimeout = this.rescanDebounceTimers.get(dir);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }

          const newTimeout = setTimeout(() => {
            this.rescanDirectory(dir);
            this.rescanDebounceTimers.delete(dir);
          }, 100);

          this.rescanDebounceTimers.set(dir, newTimeout);
        });

        this.watchers.set(dir, watcher);
      } catch {
        // Directory doesn't exist or can't be accessed, skip watching
      }
    }
  }

  /**
   * Rescan a directory to detect changes and update the registry accordingly.
   * This is more reliable than handling individual file events.
   */
  private async rescanDirectory(dirPath: string): Promise<void> {
    try {
      // 1. Get current agent files on disk
      const filesOnDisk = (await fs.readdir(dirPath)).map((f) =>
        path.join(dirPath, f),
      );
      const agentFilesOnDisk = new Set(
        filesOnDisk.filter((f) => this.isAgentFile(f)),
      );

      // 2. Get currently registered agents from this directory
      const agentsFromDir = this.getAgents().filter(
        (agent) => path.dirname(agent.filePath) === dirPath,
      );

      // 3. Unregister agents whose files were deleted
      for (const agent of agentsFromDir) {
        if (!agentFilesOnDisk.has(agent.filePath)) {
          this.unregisterAgent(agent.config.name);
        }
      }

      // 4. Load/reload all agent files currently on disk
      for (const filePath of agentFilesOnDisk) {
        // reloadAgent will either update an existing agent or register a new one.
        await this.reloadAgent(filePath);
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        // The directory itself was deleted. Unregister all agents from it.
        const agentsFromDir = this.getAgents().filter(
          (agent) => path.dirname(agent.filePath) === dirPath,
        );
        for (const agent of agentsFromDir) {
          this.unregisterAgent(agent.config.name);
        }
      } else {
        console.error(`Error rescanning directory ${dirPath}:`, error);
      }
    }
  }

  /**
   * Stop all file watchers
   */
  private stopWatching(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    for (const timeout of this.rescanDebounceTimers.values()) {
      clearTimeout(timeout);
    }
    this.rescanDebounceTimers.clear();
  }

  /**
   * Get directories to watch for agent files
   */
  private async getWatchDirectories(): Promise<string[]> {
    const dirs = [path.join(this.projectRoot, '.pk/agents')];

    if (this.options.includeGlobal !== false) {
      dirs.push(path.join(os.homedir(), '.pk/agents'));
    }

    if (this.options.customPaths) {
      dirs.push(...this.options.customPaths);
    }

    return dirs;
  }

  /**
   * Check if a file is an agent file based on extension
   */
  private isAgentFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopWatching();
    this.clear();
  }
}

/**
 * Global agent registry instance
 */
let globalRegistry: AgentRegistry | undefined;

/**
 * Get or create the global agent registry
 */
export function getGlobalAgentRegistry(
  projectRoot?: string,
  options?: Partial<AgentLoaderOptions>,
): AgentRegistry {
  if (!globalRegistry && projectRoot) {
    globalRegistry = new AgentRegistry(projectRoot, options);
  }

  if (!globalRegistry) {
    throw new Error(
      'Global agent registry not initialized. Call with projectRoot first.',
    );
  }

  return globalRegistry;
}

/**
 * Initialize the global agent registry
 */
export async function initializeGlobalAgentRegistry(
  projectRoot: string,
  options?: Partial<AgentLoaderOptions>,
): Promise<AgentDiscoveryResult> {
  globalRegistry = new AgentRegistry(projectRoot, options);
  return globalRegistry.initialize();
}

/**
 * Dispose the global agent registry
 */
export function disposeGlobalAgentRegistry(): void {
  if (globalRegistry) {
    globalRegistry.dispose();
    globalRegistry = undefined;
  }
}
