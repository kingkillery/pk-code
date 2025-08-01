/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@pk-code/core';
import OpenAI from 'openai';

const DEFAULT_MODEL = 'qwen/qwen3-coder:free';

export class OpenRouterProvider implements AIProvider {
  private client!: OpenAI;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new OpenAI({
      apiKey: credentials.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generateCode(
    prompt: string,
    options?: { model?: string; provider?: string },
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Provider not initialized. Please call initialize first.',
      );
    }

    const model = options?.model || DEFAULT_MODEL;
    const provider = options?.provider || process.env.OPENROUTER_PROVIDER || '';

    const response = await this.client.chat.completions.create({
      model,
      ...(provider && { provider }),
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content || '';
  }
}
