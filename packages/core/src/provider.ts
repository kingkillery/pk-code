/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AIProvider {
  /**
   * Initializes the provider with the necessary credentials.
   * @param credentials - An object containing the API key or other authentication tokens.
   */
  initialize(credentials: Record<string, string>): Promise<void>;

  /**
   * Generates code based on a given prompt.
   * @param prompt - The natural language prompt to generate code from.
   * @returns A promise that resolves with the generated code as a string.
   */
  generateCode(prompt: string, options?: { model?: string }): Promise<string>;
}
