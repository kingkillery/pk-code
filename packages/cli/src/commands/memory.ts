/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config } from '@pk-code/core';

export interface MemoryEntry {
  id: string;
  type:
    | 'context'
    | 'insight'
    | 'decision'
    | 'task'
    | 'conversation'
    | 'code-snippet';
  content: string;
  tags: string[];
  project?: string;
  timestamp: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  relatedEntries?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryStore {
  entries: MemoryEntry[];
  lastModified: Date;
  version: string;
}

export class MemoryManager {
  private readonly globalMemoryDir = path.join(os.homedir(), '.pk', 'memory');
  private readonly globalMemoryFile = path.join(
    this.globalMemoryDir,
    'global-memory.json',
  );

  constructor(private config: Config) {
    this.ensureMemoryDirectories();
  }

  /**
   * Add a memory entry to project-level memory
   */
  async addProjectMemory(
    type: MemoryEntry['type'],
    content: string,
    tags: string[] = [],
    metadata?: Record<string, unknown>,
    priority: MemoryEntry['priority'] = 'medium',
  ): Promise<MemoryEntry> {
    const projectRoot = process.cwd();
    const projectMemoryFile = this.getProjectMemoryFile(projectRoot);

    const entry: MemoryEntry = {
      id: this.generateId(),
      type,
      content,
      tags,
      project: projectRoot,
      timestamp: new Date(),
      metadata,
      priority,
    };

    await this.saveMemoryEntry(projectMemoryFile, entry);
    return entry;
  }

  /**
   * Add a memory entry to global memory
   */
  async addGlobalMemory(
    type: MemoryEntry['type'],
    content: string,
    tags: string[] = [],
    metadata?: Record<string, unknown>,
    priority: MemoryEntry['priority'] = 'medium',
    expiresAt?: Date,
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: this.generateId(),
      type,
      content,
      tags,
      timestamp: new Date(),
      expiresAt,
      metadata,
      priority,
    };

    await this.saveMemoryEntry(this.globalMemoryFile, entry);
    return entry;
  }

  /**
   * Search memory entries
   */
  async searchMemory(
    query?: string,
    tags?: string[],
    type?: MemoryEntry['type'],
    projectOnly: boolean = false,
    limit: number = 20,
  ): Promise<MemoryEntry[]> {
    const allEntries = await this.getAllMemoryEntries(projectOnly);

    let filtered = allEntries;

    // Filter by query
    if (query) {
      const queryLower = query.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.content.toLowerCase().includes(queryLower) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(queryLower)),
      );
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      filtered = filtered.filter((entry) =>
        tags.some((tag) => entry.tags.includes(tag)),
      );
    }

    // Filter by type
    if (type) {
      filtered = filtered.filter((entry) => entry.type === type);
    }

    // Sort by recency and priority
    filtered.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return filtered.slice(0, limit);
  }

  /**
   * Get memory entries by type
   */
  async getMemoryByType(
    type: MemoryEntry['type'],
    projectOnly: boolean = false,
    limit: number = 50,
  ): Promise<MemoryEntry[]> {
    return this.searchMemory(undefined, undefined, type, projectOnly, limit);
  }

  /**
   * Get recent memory entries
   */
  async getRecentMemory(
    hours: number = 24,
    projectOnly: boolean = false,
    limit: number = 20,
  ): Promise<MemoryEntry[]> {
    const allEntries = await this.getAllMemoryEntries(projectOnly);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    return allEntries
      .filter((entry) => entry.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Delete memory entries
   */
  async deleteMemory(
    ids: string[],
    projectOnly: boolean = false,
  ): Promise<number> {
    let deletedCount = 0;

    if (!projectOnly) {
      deletedCount += await this.deleteFromStore(this.globalMemoryFile, ids);
    }

    const projectRoot = process.cwd();
    const projectMemoryFile = this.getProjectMemoryFile(projectRoot);
    deletedCount += await this.deleteFromStore(projectMemoryFile, ids);

    return deletedCount;
  }

  /**
   * Clean expired memory entries
   */
  async cleanExpiredMemory(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    // Clean global memory
    cleanedCount += await this.cleanExpiredFromStore(
      this.globalMemoryFile,
      now,
    );

    // Clean project memory
    const projectRoot = process.cwd();
    const projectMemoryFile = this.getProjectMemoryFile(projectRoot);
    cleanedCount += await this.cleanExpiredFromStore(projectMemoryFile, now);

    return cleanedCount;
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(projectOnly: boolean = false): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    expiredEntries: number;
  }> {
    const allEntries = await this.getAllMemoryEntries(projectOnly);
    const now = new Date();

    const entriesByType: Record<string, number> = {};
    let totalSize = 0;
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;
    let expiredEntries = 0;

    for (const entry of allEntries) {
      // Count by type
      entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;

      // Calculate size
      totalSize += JSON.stringify(entry).length;

      // Track timestamps
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }

      // Count expired entries
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredEntries++;
      }
    }

    return {
      totalEntries: allEntries.length,
      entriesByType,
      totalSize,
      oldestEntry,
      newestEntry,
      expiredEntries,
    };
  }

  /**
   * Export memory entries
   */
  async exportMemory(
    outputPath: string,
    query?: string,
    tags?: string[],
    type?: MemoryEntry['type'],
    projectOnly: boolean = false,
  ): Promise<void> {
    const entries = await this.searchMemory(query, tags, type, projectOnly);

    const exportData = {
      exportedAt: new Date().toISOString(),
      entries,
      metadata: {
        totalEntries: entries.length,
        filters: {
          query,
          tags,
          type,
          projectOnly,
        },
      },
    };

    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(exportData, null, 2),
      'utf8',
    );
  }

  /**
   * Import memory entries
   */
  async importMemory(
    inputPath: string,
    merge: boolean = false,
  ): Promise<number> {
    const data = await fs.promises.readFile(inputPath, 'utf8');
    const importData = JSON.parse(data);

    if (!importData.entries || !Array.isArray(importData.entries)) {
      throw new Error('Invalid import file format');
    }

    const entries = importData.entries as MemoryEntry[];
    let importedCount = 0;

    for (const entry of entries) {
      try {
        if (entry.project) {
          // Import to project memory
          const projectMemoryFile = this.getProjectMemoryFile(entry.project);
          await this.saveMemoryEntry(projectMemoryFile, entry, merge);
        } else {
          // Import to global memory
          await this.saveMemoryEntry(this.globalMemoryFile, entry, merge);
        }
        importedCount++;
      } catch (error) {
        console.warn(`Failed to import entry ${entry.id}:`, error);
      }
    }

    return importedCount;
  }

  // Private helper methods

  private ensureMemoryDirectories(): void {
    if (!fs.existsSync(this.globalMemoryDir)) {
      fs.mkdirSync(this.globalMemoryDir, { recursive: true });
    }
  }

  private getProjectMemoryFile(projectRoot: string): string {
    const projectMemoryDir = path.join(projectRoot, '.pk', 'memory');
    if (!fs.existsSync(projectMemoryDir)) {
      fs.mkdirSync(projectMemoryDir, { recursive: true });
    }
    return path.join(projectMemoryDir, 'project-memory.json');
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getAllMemoryEntries(
    projectOnly: boolean,
  ): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];

    // Get project memory entries
    const projectRoot = process.cwd();
    const projectMemoryFile = this.getProjectMemoryFile(projectRoot);
    const projectEntries = await this.loadMemoryStore(projectMemoryFile);
    entries.push(...projectEntries.entries);

    // Get global memory entries if requested
    if (!projectOnly) {
      const globalEntries = await this.loadMemoryStore(this.globalMemoryFile);
      entries.push(...globalEntries.entries);
    }

    return entries;
  }

  private async loadMemoryStore(filePath: string): Promise<MemoryStore> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          entries: [],
          lastModified: new Date(),
          version: '1.0',
        };
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      const store = JSON.parse(data);

      // Convert timestamp strings back to Date objects
      store.entries = store.entries.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
        expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : undefined,
      }));

      return store;
    } catch (error) {
      console.warn(`Failed to load memory store ${filePath}:`, error);
      return {
        entries: [],
        lastModified: new Date(),
        version: '1.0',
      };
    }
  }

  private async saveMemoryEntry(
    filePath: string,
    entry: MemoryEntry,
    merge: boolean = false,
  ): Promise<void> {
    const store = await this.loadMemoryStore(filePath);

    if (merge) {
      // Check if entry already exists
      const existingIndex = store.entries.findIndex((e) => e.id === entry.id);
      if (existingIndex >= 0) {
        store.entries[existingIndex] = entry;
      } else {
        store.entries.push(entry);
      }
    } else {
      store.entries.push(entry);
    }

    store.lastModified = new Date();

    await fs.promises.writeFile(
      filePath,
      JSON.stringify(store, null, 2),
      'utf8',
    );
  }

  private async deleteFromStore(
    filePath: string,
    ids: string[],
  ): Promise<number> {
    try {
      const store = await this.loadMemoryStore(filePath);
      const initialCount = store.entries.length;

      store.entries = store.entries.filter((entry) => !ids.includes(entry.id));
      store.lastModified = new Date();

      await fs.promises.writeFile(
        filePath,
        JSON.stringify(store, null, 2),
        'utf8',
      );

      return initialCount - store.entries.length;
    } catch (error) {
      console.warn(`Failed to delete from store ${filePath}:`, error);
      return 0;
    }
  }

  private async cleanExpiredFromStore(
    filePath: string,
    now: Date,
  ): Promise<number> {
    try {
      const store = await this.loadMemoryStore(filePath);
      const initialCount = store.entries.length;

      store.entries = store.entries.filter(
        (entry) => !entry.expiresAt || entry.expiresAt >= now,
      );
      store.lastModified = new Date();

      await fs.promises.writeFile(
        filePath,
        JSON.stringify(store, null, 2),
        'utf8',
      );

      return initialCount - store.entries.length;
    } catch (error) {
      console.warn(
        `Failed to clean expired entries from store ${filePath}:`,
        error,
      );
      return 0;
    }
  }
}

// Command handlers

function showMemoryHelp(errorMessage?: string) {
  if (errorMessage) {
    console.error(`Error: ${errorMessage}\n`);
  }
  console.error('Usage: pk memory <command> [options]');
  console.error('Commands:');
  console.error('  add <type> <content>     # Add memory entry');
  console.error('  search <query>           # Search memory entries');
  console.error('  list [type]              # List memory entries');
  console.error('  recent [hours]           # Show recent memory entries');
  console.error('  delete <ids...>          # Delete memory entries');
  console.error('  clean                    # Clean expired entries');
  console.error('  stats                    # Show memory statistics');
  console.error('  export <file>            # Export memory to file');
  console.error('  import <file>            # Import memory from file');
  console.error('  help                     # Show this help message');
  console.error('');
  console.error(
    'Types: context, insight, decision, task, conversation, code-snippet',
  );
  console.error('Options:');
  console.error('  --global                 # Operate on global memory only');
  console.error('  --project                # Operate on project memory only');
  console.error('  --tags <tag1,tag2>       # Filter by tags');
  console.error('  --type <type>            # Filter by type');
  console.error('  --limit <number>         # Limit results');
  console.error('  --merge                  # Merge on import');
}

export async function handleMemoryCommand(
  config: Config,
  command: string,
  args: string[],
): Promise<void> {
  const memoryManager = new MemoryManager(config);

  switch (command) {
    case 'add':
      await handleAddMemory(memoryManager, args);
      break;
    case 'search':
      await handleSearchMemory(memoryManager, args);
      break;
    case 'list':
      await handleListMemory(memoryManager, args);
      break;
    case 'recent':
      await handleRecentMemory(memoryManager, args);
      break;
    case 'delete':
      await handleDeleteMemory(memoryManager, args);
      break;
    case 'clean':
      await handleCleanMemory(memoryManager);
      break;
    case 'stats':
      await handleMemoryStats(memoryManager, args);
      break;
    case 'export':
      await handleExportMemory(memoryManager, args);
      break;
    case 'import':
      await handleImportMemory(memoryManager, args);
      break;
    case 'help':
    case '--help':
    case '-h':
      showMemoryHelp();
      break;
    default:
      showMemoryHelp(`Unknown command: ${command}`);
  }
}

async function handleAddMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  if (args.length < 2) {
    console.error(
      'Usage: pk memory add <type> <content> [--global] [--tags tag1,tag2]',
    );
    return;
  }

  const [type, ...contentParts] = args;
  const content = contentParts.join(' ');

  // Parse options
  const global = args.includes('--global');
  const tagsIndex = args.indexOf('--tags');
  const tags =
    tagsIndex >= 0 && args[tagsIndex + 1]
      ? args[tagsIndex + 1].split(',').map((t) => t.trim())
      : [];

  try {
    let entry: MemoryEntry;

    if (global) {
      entry = await memoryManager.addGlobalMemory(
        type as MemoryEntry['type'],
        content,
        tags,
      );
      console.log(`✅ Added global memory entry: ${entry.id}`);
    } else {
      entry = await memoryManager.addProjectMemory(
        type as MemoryEntry['type'],
        content,
        tags,
      );
      console.log(`✅ Added project memory entry: ${entry.id}`);
    }

    console.log(`Type: ${entry.type}`);
    console.log(
      `Content: ${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}`,
    );
    if (entry.tags.length > 0) {
      console.log(`Tags: ${entry.tags.join(', ')}`);
    }
  } catch (error) {
    console.error(
      `Failed to add memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleSearchMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  const query = args[0] || '';
  const global = args.includes('--global');
  const projectOnly = args.includes('--project');

  const tagsIndex = args.indexOf('--tags');
  const tags =
    tagsIndex >= 0 && args[tagsIndex + 1]
      ? args[tagsIndex + 1].split(',').map((t) => t.trim())
      : undefined;

  const typeIndex = args.indexOf('--type');
  const type =
    typeIndex >= 0 ? (args[typeIndex + 1] as MemoryEntry['type']) : undefined;

  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) || 20 : 20;

  try {
    const entries = await memoryManager.searchMemory(
      query,
      tags,
      type,
      projectOnly,
      limit,
    );

    if (entries.length === 0) {
      console.log('No memory entries found.');
      return;
    }

    console.log(`\n📚 Found ${entries.length} memory entries:\n`);
    for (const entry of entries) {
      console.log(`ID: ${entry.id}`);
      console.log(`Type: ${entry.type} | Priority: ${entry.priority}`);
      console.log(`Time: ${entry.timestamp.toLocaleString()}`);
      console.log(`Content: ${entry.content}`);
      if (entry.tags.length > 0) {
        console.log(`Tags: ${entry.tags.join(', ')}`);
      }
      if (entry.project) {
        console.log(`Project: ${path.basename(entry.project)}`);
      } else {
        console.log(`Scope: Global`);
      }
      console.log('─'.repeat(50));
    }
  } catch (error) {
    console.error(
      `Failed to search memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleListMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  const type = args[0] as MemoryEntry['type'];
  const projectOnly = args.includes('--project');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) || 50 : 50;

  try {
    const entries = type
      ? await memoryManager.getMemoryByType(type, projectOnly, limit)
      : await memoryManager.searchMemory(
          undefined,
          undefined,
          undefined,
          projectOnly,
          limit,
        );

    if (entries.length === 0) {
      console.log('No memory entries found.');
      return;
    }

    console.log(`\n📋 Memory entries (${entries.length}):\n`);
    for (const entry of entries) {
      const scope = entry.project
        ? `Project: ${path.basename(entry.project)}`
        : 'Global';
      console.log(
        `• [${entry.type}] ${entry.content.substring(0, 60)}${entry.content.length > 60 ? '...' : ''} (${scope})`,
      );
    }
  } catch (error) {
    console.error(
      `Failed to list memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleRecentMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  const hours = args[0] ? parseInt(args[0]) : 24;
  const projectOnly = args.includes('--project');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) || 20 : 20;

  try {
    const entries = await memoryManager.getRecentMemory(
      hours,
      projectOnly,
      limit,
    );

    if (entries.length === 0) {
      console.log(`No memory entries found in the last ${hours} hours.`);
      return;
    }

    console.log(`\n🕐 Recent memory entries (last ${hours} hours):\n`);
    for (const entry of entries) {
      console.log(
        `• [${entry.timestamp.toLocaleString()}] ${entry.type}: ${entry.content.substring(0, 80)}${entry.content.length > 80 ? '...' : ''}`,
      );
    }
  } catch (error) {
    console.error(
      `Failed to get recent memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleDeleteMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: pk memory delete <id1> <id2> ... [--project]');
    return;
  }

  const ids = args.filter((arg) => !arg.startsWith('--'));
  const projectOnly = args.includes('--project');

  try {
    const deletedCount = await memoryManager.deleteMemory(ids, projectOnly);
    console.log(`✅ Deleted ${deletedCount} memory entries.`);
  } catch (error) {
    console.error(
      `Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleCleanMemory(memoryManager: MemoryManager): Promise<void> {
  try {
    const cleanedCount = await memoryManager.cleanExpiredMemory();
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired memory entries.`);
    } else {
      console.log('No expired memory entries to clean.');
    }
  } catch (error) {
    console.error(
      `Failed to clean memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleMemoryStats(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  const projectOnly = args.includes('--project');

  try {
    const stats = await memoryManager.getMemoryStats(projectOnly);

    console.log('\n📊 Memory Statistics:\n');
    console.log(`Total entries: ${stats.totalEntries}`);
    console.log(`Total size: ${Math.round(stats.totalSize / 1024)} KB`);
    console.log(`Expired entries: ${stats.expiredEntries}`);

    if (stats.oldestEntry) {
      console.log(`Oldest entry: ${stats.oldestEntry.toLocaleString()}`);
    }
    if (stats.newestEntry) {
      console.log(`Newest entry: ${stats.newestEntry.toLocaleString()}`);
    }

    console.log('\nEntries by type:');
    for (const [type, count] of Object.entries(stats.entriesByType)) {
      console.log(`  ${type}: ${count}`);
    }
  } catch (error) {
    console.error(
      `Failed to get memory stats: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleExportMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    console.error(
      'Usage: pk memory export <output-file> [--project] [--query "search"] [--tags tag1,tag2] [--type context]',
    );
    return;
  }

  const outputPath = args[0];
  const projectOnly = args.includes('--project');

  const queryIndex = args.indexOf('--query');
  const query = queryIndex >= 0 ? args[queryIndex + 1] : undefined;

  const tagsIndex = args.indexOf('--tags');
  const tags =
    tagsIndex >= 0 && args[tagsIndex + 1]
      ? args[tagsIndex + 1].split(',').map((t) => t.trim())
      : undefined;

  const typeIndex = args.indexOf('--type');
  const type =
    typeIndex >= 0 ? (args[typeIndex + 1] as MemoryEntry['type']) : undefined;

  try {
    await memoryManager.exportMemory(
      outputPath,
      query,
      tags,
      type,
      projectOnly,
    );
    console.log(`✅ Memory exported to: ${outputPath}`);
  } catch (error) {
    console.error(
      `Failed to export memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleImportMemory(
  memoryManager: MemoryManager,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: pk memory import <input-file> [--merge]');
    return;
  }

  const inputPath = args[0];
  const merge = args.includes('--merge');

  try {
    const importedCount = await memoryManager.importMemory(inputPath, merge);
    console.log(
      `✅ Imported ${importedCount} memory entries from: ${inputPath}`,
    );
  } catch (error) {
    console.error(
      `Failed to import memory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
