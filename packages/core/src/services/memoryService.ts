/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryClient } from 'mem0ai';
import type { Memory as Mem0Memory } from 'mem0ai';
import { Config } from '../config/config.js';

export interface MemoryEntry {
  id?: string;
  memory: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  memory: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryServiceConfig {
  enabled: boolean;
  userId: string;
  sessionId: string;
  // Optional: custom mem0 configuration
  mem0Config?: Record<string, unknown>;
}

interface Mem0ClientOptions {
  apiKey: string;
  host?: string;
  organizationName?: string;
  projectName?: string;
  organizationId?: string;
  projectId?: string;
}

/**
 * MemoryService provides long-term memory capabilities for pk-code agents
 * using mem0ai for persistent context across sessions.
 */
export class MemoryService {
  private memory: MemoryClient | null = null;
  private config: MemoryServiceConfig;
  private initialized = false;

  constructor(private pkConfig: Config, memoryConfig: Partial<MemoryServiceConfig> = {}) {
    // Prepare mem0 configuration with API key from environment
    const defaultMem0Config = process.env.MEM0_API_KEY ? {
      apiKey: process.env.MEM0_API_KEY,
    } : {
      apiKey: 'dummy-key', // Required by MemoryClient but will fail gracefully
    };

    this.config = {
      enabled: process.env.MEM0_ENABLED === 'true' || false,
      userId: memoryConfig.userId || 'default-user',
      sessionId: memoryConfig.sessionId || pkConfig.getSessionId(),
      mem0Config: { ...defaultMem0Config, ...memoryConfig.mem0Config },
    };
  }

  /**
   * Initialize the memory service. Called lazily on first use.
   */
  private async initialize(): Promise<void> {
    if (this.initialized || !this.config.enabled) {
      return;
    }

    try {
      // Initialize mem0 with configuration
      const options = this.config.mem0Config as unknown as Mem0ClientOptions;
      this.memory = new MemoryClient(options);
      this.initialized = true;
      
      if (this.pkConfig.getDebugMode()) {
        console.debug('[MemoryService] Initialized with config:', {
          enabled: this.config.enabled,
          userId: this.config.userId,
          sessionId: this.config.sessionId,
        });
      }
    } catch (error) {
      console.warn('[MemoryService] Failed to initialize mem0:', error);
      this.config.enabled = false;
    }
  }

  /**
   * Store a memory entry for later retrieval
   */
  async addMemory(content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.initialize();
    if (!this.memory) return;

    try {
      const enrichedMetadata = {
        ...metadata,
        sessionId: this.config.sessionId,
        timestamp: Date.now(),
        source: 'pk-code-agent',
      };

      // Convert content to Messages format required by mem0ai
      const messages = [{
        role: 'user' as const,
        content,
      }];

      await this.memory.add(messages, {
        user_id: this.config.userId,
        metadata: enrichedMetadata,
      });

      if (this.pkConfig.getDebugMode()) {
        console.debug('[MemoryService] Added memory:', { content, metadata: enrichedMetadata });
      }
    } catch (error) {
      console.warn('[MemoryService] Failed to add memory:', error);
    }
  }

  /**
   * Search for relevant memories based on a query
   */
  async searchMemories(query: string, limit = 5): Promise<SearchResult[]> {
    if (!this.config.enabled) return [];
    
    await this.initialize();
    if (!this.memory) return [];

    try {
      const results = await this.memory.search(query, {
        user_id: this.config.userId,
        limit,
      });

      // Search returns Array<Memory> directly, not wrapped in results
      const searchResults: SearchResult[] = results.map((result: {
        id?: string;
        memory?: string;
        score?: number;
        metadata?: Record<string, unknown>;
      }) => ({
        id: result.id || '',
        memory: result.memory || '',
        score: result.score || 0,
        metadata: result.metadata || {},
      }));

      if (this.pkConfig.getDebugMode()) {
        console.debug('[MemoryService] Search results:', { query, count: searchResults.length });
      }

      return searchResults;
    } catch (error) {
      console.warn('[MemoryService] Failed to search memories:', error);
      return [];
    }
  }

  /**
   * Store task-specific context for long-term persistence
   */
  async addTaskContext(taskId: string, context: {
    description?: string;
    approach?: string;
    challenges?: string;
    solutions?: string;
    filesPaths?: string[];
    status?: string;
  }): Promise<void> {
    const contextString = [
      context.description && `Task: ${context.description}`,
      context.approach && `Approach: ${context.approach}`,
      context.challenges && `Challenges: ${context.challenges}`,
      context.solutions && `Solutions: ${context.solutions}`,
      context.filesPaths?.length && `Files: ${context.filesPaths.join(', ')}`,
      context.status && `Status: ${context.status}`,
    ].filter(Boolean).join('\n');

    await this.addMemory(contextString, {
      type: 'task_context',
      taskId,
      ...context,
    });
  }

  /**
   * Cache embedding queries to reduce API calls
   */
  async cacheEmbeddingQuery(query: string, results: Array<Record<string, unknown>>): Promise<void> {
    const cacheEntry = `Embedding search for "${query}" returned ${results.length} results: ${
      results.slice(0, 3).map(r => r.filePath).join(', ')
    }`;

    await this.addMemory(cacheEntry, {
      type: 'embedding_cache',
      query,
      resultCount: results.length,
    });
  }

  /**
   * Store user preferences and patterns
   */
  async addUserPreference(preference: string, value: string): Promise<void> {
    await this.addMemory(`User prefers ${preference}: ${value}`, {
      type: 'user_preference',
      preference,
      value,
    });
  }

  /**
   * Get relevant context for a new task
   */
  async getTaskContext(description: string): Promise<SearchResult[]> {
    return await this.searchMemories(`task context: ${description}`, 3);
  }

  /**
   * Get cached information about similar queries
   */
  async getCachedEmbeddingInfo(query: string): Promise<SearchResult[]> {
    return await this.searchMemories(`embedding search: ${query}`, 2);
  }

  /**
   * Get all memories for the current user (for debugging/export)
   */
  async getAllMemories(): Promise<MemoryEntry[]> {
    if (!this.config.enabled) return [];
    
    await this.initialize();
    if (!this.memory) return [];

    try {
      const results = await this.memory.getAll({
        user_id: this.config.userId,
      });

      return results.map((result: Mem0Memory) => {
        const rawMetadata = (result as { metadata?: unknown }).metadata;
        const metadata =
          rawMetadata && typeof rawMetadata === 'object'
            ? (rawMetadata as Record<string, unknown>)
            : undefined;
        let timestamp: number | undefined;
        if (
          metadata &&
          Object.prototype.hasOwnProperty.call(metadata, 'timestamp') &&
          typeof (metadata as { timestamp?: unknown }).timestamp === 'number'
        ) {
          timestamp = (metadata as { timestamp?: number }).timestamp;
        }
        return {
          id: result.id,
          memory: result.memory ?? '',
          timestamp,
          metadata,
        };
      });
    } catch (error) {
      console.warn('[MemoryService] Failed to get all memories:', error);
      return [];
    }
  }

  /**
   * Clear all memories for the current user (use with caution)
   */
  async clearAllMemories(): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.initialize();
    if (!this.memory) return;

    try {
      await this.memory.deleteAll({
        user_id: this.config.userId,
      });

      if (this.pkConfig.getDebugMode()) {
        console.debug('[MemoryService] Cleared all memories for user:', this.config.userId);
      }
    } catch (error) {
      console.warn('[MemoryService] Failed to clear memories:', error);
    }
  }

  /**
   * Check if memory service is enabled and functional
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryServiceConfig {
    return { ...this.config };
  }
}
