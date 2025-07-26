/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider } from '@qwen-code/core';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  async initialize(credentials: { apiKey: string }): Promise<void> {
    this.client = new GoogleGenerativeAI(credentials.apiKey);
  }

  async generateCode(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Provider not initialized. Please call initialize first.');
    }

    const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}
