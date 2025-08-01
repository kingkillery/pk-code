/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@pk-code/core';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider implements AIProvider {
  private client!: GoogleGenAI;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new GoogleGenAI({ apiKey: credentials.apiKey });
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

    const model = options?.model || 'gemini-2.0-flash-001';

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text || '';
  }
}
