/**
 * @license
 * Copyright 2025 PK Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';
import { Type } from '@google/genai';

export interface NeuttsAirParams {
  /**
   * Text to synthesize into speech.
   */
  text: string;
  /**
   * Optional transcript describing the reference voice sample.
   * If omitted, a built-in sample transcript will be used.
   */
  referenceText?: string;
  /**
   * Optional URL pointing to a WAV/MP3 file to clone from.
   * Defaults to the public Dave sample bundled with the Space.
   */
  referenceAudioUrl?: string;
  /**
   * Optional override for the Hugging Face Space identifier (owner/space-name).
   * Defaults to `neuphonic/neutts-air`.
   */
  spaceId?: string;
}

interface GradioFileLike {
  name?: string;
  data?: unknown;
  is_file?: boolean;
  audio?: unknown;
  mime_type?: string;
}

interface GradioResponse {
  data?: unknown[];
  error?: string;
  is_generating?: boolean;
  duration?: number;
}

interface ExtractedAudioPayload {
  audioDataUri: string;
  sampleRate?: number;
}

const DEFAULT_REFERENCE_AUDIO_URL =
  'https://huggingface.co/neuphonic/neutts-air/resolve/main/samples/dave.wav';

const DEFAULT_REFERENCE_TEXT =
  "So I'm live on radio. And I say, well, my dear friend James here clearly, and the whole room just froze. Turns out I'd completely misspoken and mentioned our other friend.";

const DEFAULT_SPACE_ID = 'neuphonic/neutts-air';

const SPACE_API_RELATIVE_PATH = 'api/predict';

function isGradioFileLike(value: unknown): value is GradioFileLike {
  return !!value && typeof value === 'object' && 'data' in (value as object);
}

function extractAudioPayload(data: unknown[] | undefined): ExtractedAudioPayload | undefined {
  if (!data) return undefined;

  for (const entry of data) {
    if (!entry) continue;

    if (isGradioFileLike(entry) && typeof entry.data === 'string') {
      return { audioDataUri: entry.data };
    }

    if (Array.isArray(entry)) {
      const [first, second] = entry;
      if (typeof first === 'number' && isGradioFileLike(second) && typeof second.data === 'string') {
        return { sampleRate: first, audioDataUri: second.data };
      }

      if (isGradioFileLike(first) && typeof first.data === 'string') {
        return { audioDataUri: first.data };
      }
    }
  }

  return undefined;
}

function buildDataUri(buffer: Buffer, mimeType: string, sampleRate?: number): string {
  const params: string[] = [];
  if (sampleRate) {
    params.push(`rate=${sampleRate}`);
  }
  const paramSuffix = params.length > 0 ? `;${params.join(';')}` : '';
  return `data:${mimeType}${paramSuffix};base64,${buffer.toString('base64')}`;
}

export class NeuttsAirTool extends BaseTool<NeuttsAirParams, ToolResult> {
  constructor() {
    super(
      'neutts_air',
      'NeuTTS Air',
      'Generate ultra-realistic speech with Neuphonic\'s NeuTTS Air model hosted on Hugging Face Spaces. Provide text plus an optional reference clip to clone its style.',
      {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: 'Text to convert into speech using the NeuTTS Air model.',
          },
          referenceText: {
            type: Type.STRING,
            description:
              'Transcript describing the reference voice sample. Defaults to a built-in sample transcript if omitted.',
          },
          referenceAudioUrl: {
            type: Type.STRING,
            description:
              'HTTP(S) URL of the reference voice sample (wav/mp3). Defaults to the public Dave sample.',
          },
          spaceId: {
            type: Type.STRING,
            description:
              'Optional Hugging Face Space identifier to target (owner/space). Defaults to neuphonic/neutts-air.',
          },
        },
        required: ['text'],
      },
      true,
      true,
    );
  }

  async execute(
    params: NeuttsAirParams,
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    if (!params.text || !params.text.trim()) {
      return {
        llmContent: 'Error: Provide non-empty text to synthesize.',
        returnDisplay: 'Text is required to synthesize speech with NeuTTS Air.',
      };
    }

    const text = params.text.trim();
    const referenceText = params.referenceText?.trim() || DEFAULT_REFERENCE_TEXT;
    const referenceAudioUrl = params.referenceAudioUrl?.trim() || DEFAULT_REFERENCE_AUDIO_URL;
    const spaceId = params.spaceId?.trim() || DEFAULT_SPACE_ID;

    try {
      updateOutput?.('Downloading reference audio sample…');
      const audioResponse = await fetch(referenceAudioUrl, { signal });
      if (!audioResponse.ok) {
        const body = await audioResponse.text().catch(() => '');
        throw new Error(
          `Failed to download reference audio (${audioResponse.status} ${audioResponse.statusText}). ${body}`,
        );
      }

      const mimeType = audioResponse.headers.get('content-type') || 'audio/wav';
      const sampleRateHeader = audioResponse.headers.get('x-audio-sample-rate');
      const sampleRate = sampleRateHeader ? Number.parseInt(sampleRateHeader, 10) : undefined;
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      const referenceAudioPayload = buildDataUri(audioBuffer, mimeType, sampleRate);

      const payload = {
        data: [
          referenceText,
          {
            name: 'reference-audio',
            data: referenceAudioPayload,
            is_file: true,
            mime_type: mimeType,
          },
          text,
        ],
      };

      const apiToken = process.env.HUGGINGFACE_TOKEN || process.env.HUGGINGFACE_API_KEY;
      const apiUrl = new URL(
        `${spaceId}/${SPACE_API_RELATIVE_PATH}`,
        'https://huggingface.co/spaces/',
      ).toString();

      updateOutput?.('Requesting synthesis from Hugging Face Space…');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          `NeuTTS Air request failed (${response.status} ${response.statusText}). ${errText}`,
        );
      }

      const result = (await response.json()) as GradioResponse;
      if (result.error) {
        throw new Error(`NeuTTS Air service error: ${result.error}`);
      }

      const audio = extractAudioPayload(Array.isArray(result.data) ? result.data : undefined);
      if (!audio?.audioDataUri) {
        throw new Error('NeuTTS Air did not return an audio clip.');
      }

      const summaryLines = [
        'NeuTTS Air synthesis complete.',
        `Space: ${spaceId}`,
        `Input text: "${text}"`,
        `Reference audio: ${referenceAudioUrl}`,
      ];
      if (audio.sampleRate) {
        summaryLines.push(`Sample rate: ${audio.sampleRate} Hz`);
      }

      const markdown = `${summaryLines.join('\n')}\n\nUse the data URI below to save or play the audio.\n\n\`\`\`text
${audio.audioDataUri}
\`\`\``;

      return {
        summary: 'Generated speech using NeuTTS Air.',
        llmContent: `NeuTTS Air generated audio for "${text}". Data URI: ${audio.audioDataUri}`,
        returnDisplay: markdown,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error: ${message}`,
        returnDisplay: `Failed to generate speech with NeuTTS Air. ${message}`,
      };
    }
  }
}
