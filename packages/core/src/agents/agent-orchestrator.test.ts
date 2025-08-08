/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { ReActFramework } from './react-framework.js';
import { GenerateContentResponse } from '@google/genai';

function mockResponseWithFunctionCall(name: string, args: Record<string, unknown>) {
  const response = new GenerateContentResponse();
  response.candidates = [
    {
      index: 0,
      content: {
        role: 'model',
        parts: [
          { text: 'Using a tool...' },
          { functionCall: { name, args } },
        ],
      },
      finishReason: 1 as any,
      safetyRatings: [],
    },
  ];
  response.promptFeedback = { safetyRatings: [] };
  return response;
}

function mockResponseWithMultipleFunctionCalls() {
  const response = new GenerateContentResponse();
  response.candidates = [
    {
      index: 0,
      content: {
        role: 'model',
        parts: [
          { text: 'Attempting a tool sequence' },
          { functionCall: { name: 'first_tool', args: { step: 1 } } },
          { functionCall: { name: 'second_tool', args: { step: 2 } } },
        ],
      },
      finishReason: 1 as any,
      safetyRatings: [],
    },
  ];
  response.promptFeedback = { safetyRatings: [] };
  return response;
}

function mockResponseWithJson(text: string) {
  const response = new GenerateContentResponse();
  response.candidates = [
    {
      index: 0,
      content: { role: 'model', parts: [{ text }] },
      finishReason: 1 as any,
      safetyRatings: [],
    },
  ];
  response.promptFeedback = { safetyRatings: [] };
  return response;
}

function mockResponseWithText(text: string) {
  const response = new GenerateContentResponse();
  response.candidates = [
    {
      index: 0,
      content: { role: 'model', parts: [{ text }] },
      finishReason: 1 as any,
      safetyRatings: [],
    },
  ];
  response.promptFeedback = { safetyRatings: [] };
  return response;
}

describe('ReActFramework.parseResponse (model-aware)', () => {
  it('prefers functionCall parts when present (GPT-5/OpenAI style tool calls)', () => {
    const framework = new ReActFramework();
    const resp = mockResponseWithFunctionCall('run_tool', { a: 1 });
    const parsed = framework.parseResponse(resp);
    expect(parsed.action.type).toBe('tool');
    expect(parsed.action).toMatchObject({ name: 'run_tool', parameters: { a: 1 } });
    expect(parsed.thought).toContain('Using a tool');
  });

  it('parses JSON when no function calls exist (Qwen-Code JSON output)', () => {
    const framework = new ReActFramework();
    const text = JSON.stringify({ thought: 'ok', action: { type: 'response', content: 'hi' } });
    const resp = mockResponseWithJson(text);
    const parsed = framework.parseResponse(resp);
    expect(parsed.thought).toBe('ok');
    expect(parsed.action).toEqual({ type: 'response', content: 'hi' });
  });

  it('uses first functionCall when multiple are present', () => {
    const framework = new ReActFramework();
    const resp = mockResponseWithMultipleFunctionCalls();
    const parsed = framework.parseResponse(resp);
    expect(parsed.action.type).toBe('tool');
    expect(parsed.action).toMatchObject({ name: 'first_tool', parameters: { step: 1 } });
  });

  it('falls back to unstructured extraction on invalid JSON (missing fields)', () => {
    const framework = new ReActFramework();
    // Valid JSON but missing required fields: should fallback
    const resp = mockResponseWithJson('{}');
    const parsed = framework.parseResponse(resp);
    expect(parsed.action.type).toBe('response');
    expect((parsed.action as any).content).toBe('{}');
  });

  it('returns response content when plain text (no JSON, no tool calls)', () => {
    const framework = new ReActFramework();
    const msg = 'just some explanation without JSON';
    const resp = mockResponseWithText(msg);
    const parsed = framework.parseResponse(resp);
    expect(parsed.action.type).toBe('response');
    expect((parsed.action as any).content).toBe(msg);
  });
});


