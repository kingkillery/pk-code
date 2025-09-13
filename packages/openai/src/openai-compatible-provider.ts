/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenAI } from 'openai';
import {
  Content,
  Part,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
} from '@google/genai';
import { ContentGenerator } from '@pk-code/core';

/**
 * OpenAI-compatible API provider supporting various OpenAI-compatible endpoints
 * including custom deployments, Azure OpenAI, and third-party services
 */
export interface OpenAICompatibleConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  project?: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export class OpenAICompatibleProvider implements ContentGenerator {
  private client: OpenAI;
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      project: config.project,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      defaultHeaders: config.headers,
    });
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const messages = this.convertContentsToMessages(contents as Content[]);

    const completion = await this.client.chat.completions.create({
      model: this.config.modelName,
      messages,
      max_tokens:
        (request.config as any)?.maxOutputTokens ||
        this.config.maxTokens ||
        4096,
      temperature:
        (request.config as any)?.temperature || this.config.temperature || 0.7,
      top_p: (request.config as any)?.topP || this.config.topP || 1,
      frequency_penalty: this.config.frequencyPenalty || 0,
      presence_penalty: this.config.presencePenalty || 0,
      stream: false,
    });

    return this.convertCompletionToResponse(completion);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const messages = this.convertContentsToMessages(contents as Content[]);

    const stream = await this.client.chat.completions.create({
      model: this.config.modelName,
      messages,
      max_tokens:
        (request.config as any)?.maxOutputTokens ||
        this.config.maxTokens ||
        4096,
      temperature:
        (request.config as any)?.temperature || this.config.temperature || 0.7,
      top_p: (request.config as any)?.topP || this.config.topP || 1,
      frequency_penalty: this.config.frequencyPenalty || 0,
      presence_penalty: this.config.presencePenalty || 0,
      stream: true,
    });

    return this.convertStreamToResponses(stream);
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const content = contents
      .map((c: any) => c.parts?.map((p: any) => p.text || '').join('') || '')
      .join('');
    const estimatedTokens = Math.ceil(content.length / 4);
    return { totalTokens: estimatedTokens };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    const content = contents
      .map((c: any) => c.parts?.map((p: any) => p.text || '').join('') || '')
      .join('');

    const response = await this.client.embeddings.create({
      model: this.config.modelName.replace('gpt', 'text-embedding'),
      input: content,
    });

    return { embeddings: response.data.map((d: any) => d.embedding) };
  }

  // Optional helpers (not required by ContentGenerator interface)
  getModelName(): string {
    return this.config.modelName;
  }

  getProviderName(): string {
    return 'openai-compatible';
  }

  validateConfig(): boolean {
    if (!this.config.apiKey) {
      throw new Error('API key is required for OpenAI-compatible provider');
    }
    if (!this.config.modelName) {
      throw new Error('Model name is required');
    }
    return true;
  }

  // Conversion helpers
  private convertContentsToMessages(
    contents: Content[],
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const content of contents) {
      const role =
        content.role === 'model'
          ? 'assistant'
          : (content.role as 'user' | 'assistant' | 'system');
      const parts = content.parts || [];

      if (role === 'system') {
        const textContent = parts
          .filter((p) => 'text' in p)
          .map((p: any) => p.text)
          .join('\n');
        if (textContent.trim()) {
          messages.push({ role: 'system', content: textContent });
        }
        continue;
      }

      const textParts = parts.filter((p) => 'text' in p);
      const functionParts = parts.filter((p) => 'functionCall' in p);
      const functionResponseParts = parts.filter(
        (p) => 'functionResponse' in p,
      );

      if (textParts.length > 0) {
        const textContent = (textParts as any[]).map((p) => p.text).join('\n');
        messages.push({ role, content: textContent });
      }

      for (const p of functionParts as any[]) {
        if (p.functionCall) {
          messages.push({
            role: 'assistant',
            content: null,
            function_call: {
              name: p.functionCall.name || '',
              arguments: JSON.stringify(p.functionCall.args || {}),
            },
          });
        }
      }

      for (const p of functionResponseParts as any[]) {
        if (p.functionResponse) {
          messages.push({
            role: 'function',
            name: p.functionResponse.name || '',
            content:
              typeof p.functionResponse.response === 'string'
                ? p.functionResponse.response
                : JSON.stringify(p.functionResponse.response),
          });
        }
      }
    }

    return messages;
  }

  private convertCompletionToResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
  ): GenerateContentResponse {
    const choice = completion.choices[0];
    if (!choice) throw new Error('No completion choices returned');

    const parts: Part[] = [];

    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }
    if (choice.message.function_call) {
      parts.push({
        functionCall: {
          name: choice.message.function_call.name || '',
          args: this.parseFunctionArgs(
            choice.message.function_call.arguments || '{}',
          ),
        },
      });
    }
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls as any[]) {
        if (toolCall.type === 'function') {
          parts.push({
            functionCall: {
              name: toolCall.function.name || '',
              args: this.parseFunctionArgs(toolCall.function.arguments || '{}'),
            },
          });
        }
      }
    }

    return {
      candidates: [
        {
          content: { role: 'model', parts },
          finishReason: this.convertFinishReason(choice.finish_reason) as any,
          index: 0,
        },
      ],
      usageMetadata: completion.usage
        ? {
            promptTokenCount: completion.usage.prompt_tokens,
            candidatesTokenCount: completion.usage.completion_tokens,
            totalTokenCount: completion.usage.total_tokens,
          }
        : undefined,
    } as GenerateContentResponse;
  }

  private async *convertStreamToResponses(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  ): AsyncGenerator<GenerateContentResponse> {
    let currentText = '';
    const parts: Part[] = [];

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.delta?.content) currentText += choice.delta.content;

      if (choice.delta?.function_call?.name) {
        parts.push({
          functionCall: {
            name: choice.delta.function_call.name,
            args: choice.delta.function_call.arguments
              ? this.parseFunctionArgs(choice.delta.function_call.arguments)
              : {},
          },
        });
      }

      if (currentText) {
        parts.unshift({ text: currentText });
      }

      if (parts.length > 0) {
        yield {
          candidates: [
            {
              content: { role: 'model', parts },
              index: 0,
              finishReason: choice.finish_reason
                ? (this.convertFinishReason(choice.finish_reason) as any)
                : undefined,
            },
          ],
        } as GenerateContentResponse;
      }
    }
  }

  private parseFunctionArgs(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }

  private convertFinishReason(reason: string | null): string {
    switch (reason) {
      case 'stop':
        return 'STOP';
      case 'length':
        return 'MAX_TOKENS';
      case 'function_call':
        return 'STOP';
      case 'content_filter':
        return 'SAFETY';
      default:
        return 'OTHER';
    }
  }
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleConfig,
): OpenAICompatibleProvider {
  const provider = new OpenAICompatibleProvider(config);
  provider.validateConfig();
  return provider;
}

export class OpenAICompatibleProviders {
  static createOpenAIProvider(
    apiKey: string,
    modelName: string = 'gpt-4',
  ): OpenAICompatibleProvider {
    return createOpenAICompatibleProvider({
      apiKey,
      baseURL: 'https://api.openai.com/v1',
      modelName,
    });
  }

  static createAzureOpenAIProvider(
    apiKey: string,
    resourceName: string,
    deploymentName: string,
    apiVersion: string = '2023-12-01-preview',
  ): OpenAICompatibleProvider {
    return createOpenAICompatibleProvider({
      apiKey,
      baseURL: `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentName}`,
      modelName: deploymentName,
      headers: { 'api-version': apiVersion },
    });
  }

  static createCustomProvider(
    apiKey: string,
    baseURL: string,
    modelName: string,
    headers?: Record<string, string>,
  ): OpenAICompatibleProvider {
    return createOpenAICompatibleProvider({
      apiKey,
      baseURL,
      modelName,
      headers,
    });
  }

  static createQwenProvider(
    apiKey: string,
    modelName: string = 'qwen2-72b-instruct',
  ): OpenAICompatibleProvider {
    return createOpenAICompatibleProvider({
      apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelName,
      headers: { 'X-DashScope-SSE': 'enable' },
    });
  }

  static createTogetherAIProvider(
    apiKey: string,
    modelName: string = 'codellama/CodeLlama-34b-Instruct-hf',
  ): OpenAICompatibleProvider {
    return createOpenAICompatibleProvider({
      apiKey,
      baseURL: 'https://api.together.xyz/v1',
      modelName,
    });
  }

  static createReplicateProvider(
    apiKey: string,
    modelName: string,
  ): OpenAICompatibleProvider {
    return createOpenAICompatibleProvider({
      apiKey,
      baseURL: 'https://openai-proxy.replicate.com/v1',
      modelName,
      headers: {
        'HTTP-Referer': 'https://replicate.com',
        'X-Title': 'PK Code CLI',
      },
    });
  }
}
