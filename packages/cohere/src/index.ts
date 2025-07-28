/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@pk-code/core';
import { CohereClient } from 'cohere-ai';

export class CohereProvider implements AIProvider {
  private client!: CohereClient;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new CohereClient({ token: credentials.apiKey });
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

    const model = options?.model || 'command-r';

    const response = await this.client.generate({
      model,
      prompt,
    });

    return response.generations[0].text;
  }
}
