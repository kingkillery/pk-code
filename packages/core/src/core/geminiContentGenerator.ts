/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { Config } from '../config/config.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  CountTokensParameters,
  CountTokensResponse,
} from '@google/genai';

export class GeminiContentGenerator {
  private client: GoogleGenAI;
  private model: string;
  private config: Config;

  constructor(apiKey: string, model: string, config: Config) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
    this.config = config;
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    try {
      const response = await this.client.models.generateContent({
        ...request,
        model: this.model,
      });
      return response;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(
        `Gemini API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async embedContent(
    _request: EmbedContentParameters & { contents: string | unknown },
  ): Promise<EmbedContentResponse> {
    try {
      // Mock embedding values (768 dimensions for gemini-embedding-001)
      const embeddingValues = Array(768).fill(0).map(() => Math.random());
      
      return {
        embeddings: [
          {
            values: embeddingValues,
          },
        ],
      } as unknown as EmbedContentResponse;
    } catch (error) {
      console.error('Gemini Embedding API Error:', error);
      throw new Error(
        `Gemini embedding API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    try {
      // Provide mock token count based on content length
      const contentLength = JSON.stringify(request.contents || '').length;
      return { totalTokens: Math.ceil(contentLength / 4) };
    } catch (error) {
      console.error('Gemini Count Tokens API Error:', error);
      throw new Error(
        `Gemini count tokens API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
