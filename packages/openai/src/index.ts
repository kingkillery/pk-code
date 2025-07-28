/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@pk-code/core';
import OpenAI from 'openai';

export class OpenAIProvider implements AIProvider {
  private client!: OpenAI;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new OpenAI({ apiKey: credentials.apiKey });
  }

  async generateCode(
    prompt: string,
    options?: { model?: string },
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        'Provider not initialized. Please call initialize first.',
      );
    }

    const model = options?.model || 'gpt-3.5-turbo';

    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content || '';
  }
}
