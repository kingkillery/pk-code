/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@pk-code/core';
import OpenAI from 'openai';

export class OpenRouterProvider implements AIProvider {
  private client!: OpenAI;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new OpenAI({
      apiKey: credentials.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generateCode(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Provider not initialized. Please call initialize first.',
      );
    }

    const response = await this.client.chat.completions.create({
      model: 'google/gemini-flash-1.5', // Using a default model for OpenRouter
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content || '';
  }
}
