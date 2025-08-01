/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';
import { Type } from '@google/genai';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { getErrorMessage } from '../utils/errors.js';
import { Config } from '../config/config.js';
import { EmbeddingIndex } from '../utils/embeddingIndex.js';

/**
 * Parameters for the SearchIndexTool.
 */
export interface SearchIndexToolParams {
  /**
   * The search query to find relevant documents.
   */
  query: string;
  
  /**
   * Number of top results to return (default: 5).
   */
  top_k?: number;
}

/**
 * A tool to search the repository embedding index for relevant documents.
 */
export class SearchIndexTool extends BaseTool<
  SearchIndexToolParams,
  ToolResult
> {
  static readonly Name: string = 'search_index';
  private embeddingIndex: EmbeddingIndex;

  constructor(private readonly config: Config, indexDir?: string) {
    super(
      SearchIndexTool.Name,
      'SearchIndex',
      'Searches the repository embedding index to find the most relevant documents/files based on semantic similarity to the query. Useful for finding code files, documentation, or any repository content related to a specific topic or functionality.',
      {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'The search query describing what you are looking for in the repository (e.g., "authentication logic", "database connection", "error handling").',
          },
          top_k: {
            type: Type.INTEGER,
            description: 'Number of most relevant results to return (default: 5, max: 20).',
          },
        },
        required: ['query'],
      },
    );
    
    this.embeddingIndex = new EmbeddingIndex(config, indexDir);
  }

  /**
   * Validates the parameters for the SearchIndexTool.
   * @param params The parameters to validate
   * @returns An error message string if validation fails, null if valid
   */
  validateParams(params: SearchIndexToolParams): string | null {
    const errors = SchemaValidator.validate(this.schema.parameters, params);
    if (errors) {
      return errors;
    }

    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }

    if (params.top_k !== undefined) {
      if (params.top_k < 1 || params.top_k > 20) {
        return "The 'top_k' parameter must be between 1 and 20.";
      }
    }

    return null;
  }

  getDescription(params: SearchIndexToolParams): string {
    const topK = params.top_k || 5;
    return `Searching repository index for: "${params.query}" (top ${topK} results)`;
  }

  async execute(
    params: SearchIndexToolParams,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Error: Invalid parameters provided. Reason: ${validationError}`,
        returnDisplay: validationError,
      };
    }

    const topK = params.top_k || 5;

    try {
      // Check if index exists
      const stats = this.embeddingIndex.getIndexStats();
      if (stats.documentCount === 0) {
        return {
          llmContent: 'No embedding index found or index is empty. The repository needs to be indexed first before searching.',
          returnDisplay: 'Repository index not available. Please build the index first.',
        };
      }

      // Perform the search
      const results = await this.embeddingIndex.search(params.query, topK);

      if (results.length === 0) {
        return {
          llmContent: `No relevant documents found for query: "${params.query}". The search returned no matches.`,
          returnDisplay: 'No relevant documents found.',
        };
      }

      // Format results for display
      const formattedResults = results.map((result, index) => {
        const relativePath = result.filePath;
        const truncatedContent = result.content.length > 500 
          ? result.content.substring(0, 500) + '...' 
          : result.content;
        
        return `${index + 1}. **${relativePath}** (similarity score: ${result.score.toFixed(4)})
\`\`\`
${truncatedContent}
\`\`\``;
      }).join('\n\n');

      const llmContent = `Found ${results.length} relevant documents for query "${params.query}":

${formattedResults}

**Search Summary:**
- Query: "${params.query}"
- Results: ${results.length}/${topK}
- Index contains: ${stats.documentCount} documents
- Last updated: ${new Date(stats.lastUpdated).toISOString()}`;

      return {
        llmContent,
        returnDisplay: `Found ${results.length} relevant documents for "${params.query}".`,
      };
    } catch (error: unknown) {
      const errorMessage = `Error searching repository index for query "${params.query}": ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: 'Error occurred while searching the repository index.',
      };
    }
  }
}
