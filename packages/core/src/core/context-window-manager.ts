/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content } from '@google/genai';

/**
 * Context window management system supporting 256K to 1M token windows
 */

export interface ContextWindowConfig {
  /** Current context window size in tokens */
  currentSize: number;
  /** Maximum context window size supported by the model */
  maxSize: number;
  /** Whether the model supports large context windows */
  modelSupportsLargeContext: boolean;
  /** Model name for context window detection */
  modelName?: string;
  /** Provider name for context window detection */
  providerName?: string;
}

export interface ContextWindowMetrics {
  /** Current token count in context */
  currentTokens: number;
  /** Maximum allowed tokens */
  maxTokens: number;
  /** Available tokens remaining */
  availableTokens: number;
  /** Usage percentage (0-1) */
  usagePercentage: number;
  /** Estimated tokens for next message */
  estimatedNextTokens: number;
}

export interface ContentChunk {
  /** The content chunk */
  content: Content;
  /** Token count for this chunk */
  tokenCount: number;
  /** Priority for retention (higher = more important) */
  priority: number;
  /** Timestamp when chunk was added */
  timestamp: Date;
  /** Metadata about the chunk */
  metadata?: Record<string, unknown>;
}

export interface ContextCompressionOptions {
  /** Target compression ratio (0-1) */
  targetRatio: number;
  /** Preserve high-priority content */
  preserveHighPriority: boolean;
  /** Maximum compression iterations */
  maxIterations: number;
  /** Compression strategy */
  strategy: 'summarize' | 'truncate' | 'selective' | 'hierarchical';
}

export class ContextWindowManager {
  private readonly baseContextWindow = 256000; // 256K tokens
  private readonly extendedContextWindow = 1000000; // 1M tokens
  private readonly tokenEstimationBuffer = 0.1; // 10% buffer for token estimation

  private contentChunks: ContentChunk[] = [];
  private contextConfig: ContextWindowConfig;
  private compressionHistory: Array<{
    timestamp: Date;
    originalTokens: number;
    compressedTokens: number;
    ratio: number;
    strategy: string;
  }> = [];

  constructor(config: ContextWindowConfig) {
    this.contextConfig = { ...config };
    this.validateConfig();
  }

  /**
   * Update context window configuration
   */
  updateConfig(config: Partial<ContextWindowConfig>): void {
    this.contextConfig = { ...this.contextConfig, ...config };
    this.validateConfig();

    // If max size changed, check if we need to compress
    const metrics = this.getMetrics();
    if (metrics.usagePercentage > 0.9) {
      this.compressContext({
        targetRatio: 0.7,
        preserveHighPriority: true,
        maxIterations: 3,
        strategy: 'selective',
      });
    }
  }

  /**
   * Add content to the context window
   */
  addContent(
    content: Content,
    priority: number = 1,
    metadata?: Record<string, unknown>,
  ): boolean {
    const estimatedTokens = this.estimateTokenCount(content);
    const metrics = this.getMetrics();

    // Check if we have space
    if (metrics.availableTokens < estimatedTokens) {
      // Try to compress existing content first
      const compressionSuccess = this.compressContext({
        targetRatio: 0.8,
        preserveHighPriority: true,
        maxIterations: 2,
        strategy: 'selective',
      });

      // Recheck metrics after compression
      const newMetrics = this.getMetrics();
      if (newMetrics.availableTokens < estimatedTokens) {
        // Try extending context window if supported
        if (this.canExtendContextWindow(estimatedTokens)) {
          this.extendContextWindow(estimatedTokens);
        } else {
          return false; // Cannot add content
        }
      }
    }

    // Add the content chunk
    const chunk: ContentChunk = {
      content,
      tokenCount: estimatedTokens,
      priority,
      timestamp: new Date(),
      metadata,
    };

    this.contentChunks.push(chunk);
    this.sortChunksByPriority();

    return true;
  }

  /**
   * Get current context window metrics
   */
  getMetrics(): ContextWindowMetrics {
    const currentTokens = this.contentChunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0,
    );

    const maxTokens = this.contextConfig.currentSize;
    const availableTokens = Math.max(0, maxTokens - currentTokens);
    const usagePercentage = currentTokens / maxTokens;

    return {
      currentTokens,
      maxTokens,
      availableTokens,
      usagePercentage,
      estimatedNextTokens: 0, // Would be calculated based on next message
    };
  }

  /**
   * Compress context to fit within available space
   */
  compressContext(options: ContextCompressionOptions): boolean {
    const { targetRatio, preserveHighPriority, maxIterations, strategy } =
      options;

    const originalTokens = this.contentChunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0,
    );

    let compressedChunks = [...this.contentChunks];
    let iteration = 0;
    let compressionRatio = 1.0;

    while (iteration < maxIterations && compressionRatio > targetRatio) {
      switch (strategy) {
        case 'truncate':
          compressedChunks = this.compressByTruncation(
            compressedChunks,
            preserveHighPriority,
          );
          break;
        case 'selective':
          compressedChunks = this.compressBySelection(
            compressedChunks,
            targetRatio,
          );
          break;
        case 'summarize':
          compressedChunks = this.compressBySummarization(
            compressedChunks,
            targetRatio,
          );
          break;
        case 'hierarchical':
          compressedChunks = this.compressHierarchically(
            compressedChunks,
            targetRatio,
          );
          break;
      }

      const newTotalTokens = compressedChunks.reduce(
        (sum, chunk) => sum + chunk.tokenCount,
        0,
      );
      compressionRatio = newTotalTokens / originalTokens;
      iteration++;
    }

    this.contentChunks = compressedChunks;

    // Record compression history
    this.compressionHistory.push({
      timestamp: new Date(),
      originalTokens,
      compressedTokens: compressedChunks.reduce(
        (sum, chunk) => sum + chunk.tokenCount,
        0,
      ),
      ratio: compressionRatio,
      strategy,
    });

    return compressionRatio <= targetRatio;
  }

  /**
   * Extend context window if supported
   */
  extendContextWindow(requiredTokens: number): boolean {
    if (!this.contextConfig.modelSupportsLargeContext) {
      return false;
    }

    const currentMax = this.contextConfig.maxSize;
    const targetSize = Math.min(
      Math.max(requiredTokens * 1.5, this.contextConfig.currentSize * 1.2),
      this.extendedContextWindow,
    );

    if (targetSize <= currentMax) {
      return false; // Already at max
    }

    // Update configuration
    this.contextConfig.currentSize = targetSize;

    console.log(`Extended context window to ${targetSize} tokens`);
    return true;
  }

  /**
   * Get optimized content for API request
   */
  getOptimizedContent(maxTokens?: number): Content[] {
    const targetMaxTokens = maxTokens || this.contextConfig.currentSize;
    let selectedChunks = [...this.contentChunks];
    let totalTokens = selectedChunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0,
    );

    // If over limit, compress
    if (totalTokens > targetMaxTokens) {
      this.compressContext({
        targetRatio: targetMaxTokens / totalTokens,
        preserveHighPriority: true,
        maxIterations: 3,
        strategy: 'selective',
      });
      selectedChunks = this.contentChunks;
    }

    return selectedChunks.map((chunk) => chunk.content);
  }

  /**
   * Clear context window
   */
  clearContext(): void {
    this.contentChunks = [];
    this.compressionHistory = [];
  }

  /**
   * Get context window statistics
   */
  getStatistics(): {
    totalChunks: number;
    totalTokens: number;
    averageChunkSize: number;
    compressionEvents: number;
    averageCompressionRatio: number;
    oldestChunk: Date | null;
    newestChunk: Date | null;
  } {
    const totalTokens = this.contentChunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0,
    );
    const totalChunks = this.contentChunks.length;

    const timestamps = this.contentChunks.map((chunk) => chunk.timestamp);
    const oldestChunk =
      timestamps.length > 0
        ? new Date(Math.min(...timestamps.map((t) => t.getTime())))
        : null;
    const newestChunk =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((t) => t.getTime())))
        : null;

    const averageCompressionRatio =
      this.compressionHistory.length > 0
        ? this.compressionHistory.reduce((sum, event) => sum + event.ratio, 0) /
          this.compressionHistory.length
        : 1.0;

    return {
      totalChunks,
      totalTokens,
      averageChunkSize: totalChunks > 0 ? totalTokens / totalChunks : 0,
      compressionEvents: this.compressionHistory.length,
      averageCompressionRatio,
      oldestChunk,
      newestChunk,
    };
  }

  // Private helper methods

  private validateConfig(): void {
    if (this.contextConfig.currentSize < 1000) {
      throw new Error('Context window size must be at least 1000 tokens');
    }

    if (this.contextConfig.currentSize > this.extendedContextWindow) {
      throw new Error(
        `Context window size cannot exceed ${this.extendedContextWindow} tokens`,
      );
    }

    if (this.contextConfig.maxSize < this.contextConfig.currentSize) {
      throw new Error('Maximum size cannot be less than current size');
    }
  }

  private estimateTokenCount(content: Content): number {
    // Rough estimation: ~4 characters per token
    let totalChars = 0;

    for (const part of content.parts || []) {
      if (part.text) {
        totalChars += part.text.length;
      } else if (part.functionCall) {
        // Estimate function call tokens
        totalChars += JSON.stringify(part.functionCall).length;
      }
    }

    const estimatedTokens = Math.ceil(totalChars / 4);

    // Add buffer for tokenization differences
    return Math.ceil(estimatedTokens * (1 + this.tokenEstimationBuffer));
  }

  private canExtendContextWindow(requiredTokens: number): boolean {
    if (!this.contextConfig.modelSupportsLargeContext) {
      return false;
    }

    const potentialSize = Math.min(
      requiredTokens * 1.5,
      this.extendedContextWindow,
    );

    return potentialSize > this.contextConfig.currentSize;
  }

  private sortChunksByPriority(): void {
    this.contentChunks.sort((a, b) => {
      // Higher priority first, then newer first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }

  private compressByTruncation(
    chunks: ContentChunk[],
    preserveHighPriority: boolean,
  ): ContentChunk[] {
    if (preserveHighPriority) {
      // Remove lowest priority chunks first
      const sortedByPriority = [...chunks].sort(
        (a, b) => a.priority - b.priority,
      );
      const lowPriorityChunks = sortedByPriority.slice(
        0,
        Math.floor(chunks.length * 0.3),
      );
      return chunks.filter((chunk) => !lowPriorityChunks.includes(chunk));
    } else {
      // Remove oldest chunks
      const sortedByTime = [...chunks].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      const chunksToRemove = sortedByTime.slice(
        0,
        Math.floor(chunks.length * 0.3),
      );
      return chunks.filter((chunk) => !chunksToRemove.includes(chunk));
    }
  }

  private compressBySelection(
    chunks: ContentChunk[],
    targetRatio: number,
  ): ContentChunk[] {
    const targetTokens =
      chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) * targetRatio;
    let selectedChunks: ContentChunk[] = [];
    let currentTokens = 0;

    // Sort by priority and recency
    const sortedChunks = [...chunks].sort((a, b) => {
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Select chunks until we reach target
    for (const chunk of sortedChunks) {
      if (currentTokens + chunk.tokenCount <= targetTokens) {
        selectedChunks.push(chunk);
        currentTokens += chunk.tokenCount;
      }
    }

    return selectedChunks;
  }

  private compressBySummarization(
    chunks: ContentChunk[],
    targetRatio: number,
  ): ContentChunk[] {
    // This would require AI summarization - for now, fall back to selection
    console.warn(
      'Summarization compression not yet implemented, using selection instead',
    );
    return this.compressBySelection(chunks, targetRatio);
  }

  private compressHierarchically(
    chunks: ContentChunk[],
    targetRatio: number,
  ): ContentChunk[] {
    // Group chunks by priority levels
    const priorityGroups = new Map<number, ContentChunk[]>();

    for (const chunk of chunks) {
      if (!priorityGroups.has(chunk.priority)) {
        priorityGroups.set(chunk.priority, []);
      }
      priorityGroups.get(chunk.priority)!.push(chunk);
    }

    const result: ContentChunk[] = [];

    // Keep all high-priority chunks
    const highPriority = priorityGroups.get(3) || [];
    result.push(...highPriority);

    // Compress medium-priority chunks
    const mediumPriority = priorityGroups.get(2) || [];
    if (mediumPriority.length > 0) {
      const mediumTarget = Math.floor(mediumPriority.length * targetRatio);
      result.push(...mediumPriority.slice(0, mediumTarget));
    }

    // Keep only essential low-priority chunks
    const lowPriority = priorityGroups.get(1) || [];
    if (lowPriority.length > 0) {
      const lowTarget = Math.floor(lowPriority.length * targetRatio * 0.5);
      result.push(...lowPriority.slice(0, lowTarget));
    }

    return result;
  }

  /**
   * Detect model capabilities and set appropriate context window
   */
  static detectModelCapabilities(
    modelName: string,
    providerName: string,
  ): ContextWindowConfig {
    const model = modelName.toLowerCase();
    const provider = providerName.toLowerCase();

    // Qwen models support large context
    if (model.includes('qwen') || provider.includes('qwen')) {
      if (model.includes('coder') || model.includes('3')) {
        return {
          currentSize: 256000,
          maxSize: 1000000,
          modelSupportsLargeContext: true,
          modelName,
          providerName,
        };
      }
    }

    // OpenAI GPT-4 models
    if (provider.includes('openai') || model.includes('gpt')) {
      if (model.includes('gpt-4') && model.includes('turbo')) {
        return {
          currentSize: 128000,
          maxSize: 128000,
          modelSupportsLargeContext: false,
          modelName,
          providerName,
        };
      }
    }

    // Gemini models
    if (provider.includes('gemini') || model.includes('gemini')) {
      if (model.includes('1.5') || model.includes('pro')) {
        return {
          currentSize: 1000000,
          maxSize: 2000000,
          modelSupportsLargeContext: true,
          modelName,
          providerName,
        };
      }
    }

    // Default configuration
    return {
      currentSize: 8000,
      maxSize: 32000,
      modelSupportsLargeContext: false,
      modelName,
      providerName,
    };
  }
}

export const createContextWindowManager = (
  modelName: string,
  providerName: string,
): ContextWindowManager => {
  const config = ContextWindowManager.detectModelCapabilities(
    modelName,
    providerName,
  );
  return new ContextWindowManager(config);
};
