/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@pk-code/core';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements AIProvider {
  private client!: Anthropic;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new Anthropic({ apiKey: credentials.apiKey });
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

    const model = options?.model || 'claude-3-opus-20240229';

    const response = await this.client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  }
}
