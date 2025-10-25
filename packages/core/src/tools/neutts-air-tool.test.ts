/**
 * @license
 * Copyright 2025 PK Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeuttsAirTool } from './neutts-air-tool.js';

describe('NeuttsAirTool', () => {
  let tool: NeuttsAirTool;
  let abortSignal: AbortSignal;

  beforeEach(() => {
    vi.restoreAllMocks();
    tool = new NeuttsAirTool();
    abortSignal = new AbortController().signal;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should require non-empty text input', async () => {
    const result = await tool.execute({ text: '' }, abortSignal);
    expect(result.llmContent).toContain('Error: Provide non-empty text to synthesize.');
    expect(result.returnDisplay).toContain('Text is required');
  });

  it('should return synthesized audio data on success', async () => {
    const mockFetch = global.fetch as unknown as vi.Mock;

    const audioResponse = {
      ok: true,
      headers: { get: vi.fn(() => 'audio/wav') },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
      text: async () => '',
    };

    const synthResponse = {
      ok: true,
      json: async () => ({
        data: [
          24000,
          {
            name: 'output.wav',
            data: 'data:audio/wav;base64,ZmFrZS1hdWRpby1kYXRh',
          },
        ],
      }),
    };

    mockFetch.mockResolvedValueOnce(audioResponse as unknown as Response);
    mockFetch.mockResolvedValueOnce(synthResponse as unknown as Response);

    const updateOutput = vi.fn();
    const result = await tool.execute(
      {
        text: 'Hello world',
        referenceText: 'Sample reference transcript',
        referenceAudioUrl: 'https://example.com/reference.wav',
      },
      abortSignal,
      updateOutput,
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://example.com/reference.wav',
      expect.objectContaining({ signal: abortSignal }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('https://huggingface.co/spaces/'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.llmContent).toContain('data:audio/wav;base64,ZmFrZS1hdWRpby1kYXRh');
    expect(result.returnDisplay).toContain('Hello world');
    expect(updateOutput).toHaveBeenCalledWith('Downloading reference audio sample…');
  });

  it('should surface Hugging Face errors clearly', async () => {
    const mockFetch = global.fetch as unknown as vi.Mock;

    const audioResponse = {
      ok: true,
      headers: { get: vi.fn(() => 'audio/wav') },
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => '',
    };

    const errorResponse = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'Upstream unavailable',
    };

    mockFetch.mockResolvedValueOnce(audioResponse as unknown as Response);
    mockFetch.mockResolvedValueOnce(errorResponse as unknown as Response);

    const result = await tool.execute({ text: 'Failure case' }, abortSignal);

    expect(result.llmContent).toContain('NeuTTS Air request failed (502 Bad Gateway). Upstream unavailable');
    expect(result.returnDisplay).toContain('Failed to generate speech');
  });
});
