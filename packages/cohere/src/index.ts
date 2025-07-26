/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@qwen-code/core';
import { CohereClient } from 'cohere-ai';

export class CohereProvider implements AIProvider {
  private client: CohereClient;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new CohereClient({ token: credentials.apiKey });
  }

  async generateCode(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Provider not initialized. Please call initialize first.');
    }

    const response = await this.client.generate({
      model: 'command-r',
      prompt,
    });

    return response.generations[0].text;
  }
}
