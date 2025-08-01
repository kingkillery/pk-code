/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'buffer';
import * as https from 'https';
import {
  StartSessionEvent,
  EndSessionEvent,
  UserPromptEvent,
  ToolCallEvent,
  ApiRequestEvent,
  ApiResponseEvent,
  ApiErrorEvent,
  FlashFallbackEvent,
  LoopDetectedEvent,
} from '../types.js';
import { EventMetadataKey } from './event-metadata-key.js';
import { Config } from '../../config/config.js';
import { getInstallationId } from '../../utils/user_id.js';
import {
  getCachedGoogleAccount,
  getLifetimeGoogleAccounts,
} from '../../utils/user_account.js';
import { safeJsonStringify } from '../../utils/safeJsonStringify.js';

const start_session_event_name = 'start_session';
const new_prompt_event_name = 'new_prompt';
const tool_call_event_name = 'tool_call';
const api_request_event_name = 'api_request';
const api_response_event_name = 'api_response';
const api_error_event_name = 'api_error';
const end_session_event_name = 'end_session';
const flash_fallback_event_name = 'flash_fallback';
const loop_detected_event_name = 'loop_detected';

// Helper function to check if we're in a test environment
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.JEST_WORKER_ID !== undefined ||
    typeof (
      global as {
        it?: unknown;
        describe?: unknown;
        test?: unknown;
        expect?: unknown;
      }
    ).it === 'function' ||
    typeof (
      global as {
        it?: unknown;
        describe?: unknown;
        test?: unknown;
        expect?: unknown;
      }
    ).describe === 'function' ||
    typeof (
      global as {
        it?: unknown;
        describe?: unknown;
        test?: unknown;
        expect?: unknown;
      }
    ).test === 'function' ||
    typeof (
      global as {
        it?: unknown;
        describe?: unknown;
        test?: unknown;
        expect?: unknown;
      }
    ).expect === 'function' ||
    typeof (globalThis as { vi?: unknown }).vi !== 'undefined' ||
    process.argv.some(
      (arg) =>
        arg.includes('vitest') || arg.includes('jest') || arg.includes('test'),
    )
  );
}

export interface LogResponse {
  nextRequestWaitMs?: number;
}

// Singleton class for batch posting log events to Clearcut. When a new event comes in, the elapsed time
// is checked and events are flushed to Clearcut if at least a minute has passed since the last flush.
export class ClearcutLogger {
  private static instance: ClearcutLogger;
  private config?: Config;
  private readonly events: object[] = [];
  private last_flush_time: number = Date.now();
  private flush_interval_ms: number = 1000 * 60; // Wait at least a minute before flushing events.

  private constructor(config?: Config) {
    this.config = config;
  }

  static getInstance(config?: Config): ClearcutLogger | undefined {
    if (config === undefined || !config?.getUsageStatisticsEnabled())
      return undefined;
    if (!ClearcutLogger.instance) {
      ClearcutLogger.instance = new ClearcutLogger(config);
    }
    return ClearcutLogger.instance;
  }

  enqueueLogEvent(event: object): void {
    this.events.push([
      {
        event_time_ms: Date.now(),
        source_extension_json: safeJsonStringify(event),
      },
    ]);
  }

  createLogEvent(name: string, data: object[]): object {
    const email = getCachedGoogleAccount();
    const totalAccounts = getLifetimeGoogleAccounts();
    data.push({
      gemini_cli_key: EventMetadataKey.GEMINI_CLI_GOOGLE_ACCOUNTS_COUNT,
      value: totalAccounts.toString(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logEvent: any = {
      console_type: 'GEMINI_CLI',
      application: 102,
      event_name: name,
      event_metadata: [data] as object[],
    };

    // Should log either email or install ID, not both. See go/cloudmill-1p-oss-instrumentation#define-sessionable-id
    if (email) {
      logEvent.client_email = email;
    } else {
      logEvent.client_install_id = getInstallationId();
    }

    return logEvent;
  }

  flushIfNeeded(): void {
    if (Date.now() - this.last_flush_time < this.flush_interval_ms) {
      return;
    }

    this.flushToClearcut().catch((error) => {
      console.debug('Error flushing to Clearcut:', error);
    });
  }

  flushToClearcut(): Promise<LogResponse> {
    // Skip network requests in test environments
    if (isTestEnvironment()) {
      this.events.length = 0; // Clear events
      return Promise.resolve({ nextRequestWaitMs: 0 });
    }

    if (this.config?.getDebugMode()) {
      console.log('Flushing log events to Clearcut.');
    }
    const eventsToSend = [...this.events];
    this.events.length = 0;

    return new Promise<Buffer>((resolve, reject) => {
      const request = [
        {
          log_source_name: 'CONCORD',
          request_time_ms: Date.now(),
          log_event: eventsToSend,
        },
      ];
      const body = safeJsonStringify(request);
      const options = {
        hostname: 'play.googleapis.com',
        path: '/log',
        method: 'POST',
        headers: { 'Content-Length': Buffer.byteLength(body) },
      };
      const bufs: Buffer[] = [];
      const req = https.request(options, (res) => {
        res.on('data', (chunk) => {
          try {
            let buf: Buffer;
            if (Buffer.isBuffer(chunk)) {
              buf = chunk;
            } else if (chunk !== undefined && chunk !== null) {
              buf = Buffer.from(chunk);
            } else {
              // Skip undefined/null chunks
              return;
            }
            // Double-check that we have a valid Buffer before pushing
            if (Buffer.isBuffer(buf)) {
              bufs.push(buf);
            }
          } catch (error) {
            // Silently ignore invalid chunks in test environments
            console.debug('Clearcut logger: Invalid chunk received:', error);
          }
        });
        res.on('end', () => {
          try {
            // Debug logging to understand what's in the bufs array
            if (this.config?.getDebugMode()) {
              console.debug(
                'Clearcut logger: bufs array contents:',
                bufs.map((buf) => ({
                  isBuffer: Buffer.isBuffer(buf),
                  type: typeof buf,
                  constructor: buf?.constructor?.name,
                })),
              );
            }

            // Ensure all elements are Buffers before concatenating
            const validBuffers: Buffer[] = [];
            for (const buf of bufs) {
              if (Buffer.isBuffer(buf)) {
                validBuffers.push(buf);
              } else {
                console.debug('Clearcut logger: Skipping non-Buffer element:', {
                  type: typeof buf,
                  constructor: (buf as { constructor?: { name?: string } })
                    ?.constructor?.name,
                });
              }
            }

            if (validBuffers.length === 0) {
              resolve(Buffer.alloc(0));
            } else {
              // Final safety check before concatenation
              const allAreBuffers = validBuffers.every((buf) =>
                Buffer.isBuffer(buf),
              );
              if (allAreBuffers) {
                resolve(Buffer.concat(validBuffers));
              } else {
                console.debug(
                  'Clearcut logger: Found non-Buffer in validBuffers array',
                );
                resolve(Buffer.alloc(0));
              }
            }
          } catch (error) {
            console.debug(
              'Clearcut logger: Error concatenating buffers:',
              error,
            );
            resolve(Buffer.alloc(0));
          }
        });
      });
      req.on('error', (e) => {
        if (this.config?.getDebugMode()) {
          console.log('Clearcut POST request error: ', e);
        }
        // Add the events back to the front of the queue to be retried.
        this.events.unshift(...eventsToSend);
        reject(e);
      });
      req.end(body);
    })
      .then((buf: Buffer) => {
        try {
          this.last_flush_time = Date.now();
          return this.decodeLogResponse(buf) || {};
        } catch (error: unknown) {
          console.error('Error flushing log events:', error);
          return {};
        }
      })
      .catch((error: unknown) => {
        // Handle all errors to prevent unhandled promise rejections
        console.error('Error flushing log events:', error);
        // Return empty response to maintain the Promise<LogResponse> contract
        return {};
      });
  }

  // Visible for testing. Decodes protobuf-encoded response from Clearcut server.
  decodeLogResponse(buf: Buffer): LogResponse | undefined {
    // TODO(obrienowen): return specific errors to facilitate debugging.
    if (buf.length < 1) {
      return undefined;
    }

    // The first byte of the buffer is `field<<3 | type`. We're looking for field
    // 1, with type varint, represented by type=0. If the first byte isn't 8, that
    // means field 1 is missing or the message is corrupted. Either way, we return
    // undefined.
    if (buf.readUInt8(0) !== 8) {
      return undefined;
    }

    let ms = BigInt(0);
    let cont = true;

    // In each byte, the most significant bit is the continuation bit. If it's
    // set, we keep going. The lowest 7 bits, are data bits. They are concatenated
    // in reverse order to form the final number.
    for (let i = 1; cont && i < buf.length; i++) {
      const byte = buf.readUInt8(i);
      ms |= BigInt(byte & 0x7f) << BigInt(7 * (i - 1));
      cont = (byte & 0x80) !== 0;
    }

    if (cont) {
      // We have fallen off the buffer without seeing a terminating byte. The
      // message is corrupted.
      return undefined;
    }

    const returnVal = {
      nextRequestWaitMs: Number(ms),
    };
    return returnVal;
  }

  logStartSessionEvent(event: StartSessionEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_MODEL,
        value: event.model,
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_EMBEDDING_MODEL,
        value: event.embedding_model,
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_SANDBOX,
        value: event.sandbox_enabled.toString(),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_CORE_TOOLS,
        value: event.core_tools_enabled,
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_APPROVAL_MODE,
        value: event.approval_mode,
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_API_KEY_ENABLED,
        value: event.api_key_enabled.toString(),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_VERTEX_API_ENABLED,
        value: event.vertex_ai_enabled.toString(),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_DEBUG_MODE_ENABLED,
        value: event.debug_enabled.toString(),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_VERTEX_API_ENABLED,
        value: event.vertex_ai_enabled.toString(),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_START_SESSION_MCP_SERVERS,
        value: event.mcp_servers,
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_VERTEX_API_ENABLED,
        value: event.vertex_ai_enabled.toString(),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_TELEMETRY_ENABLED,
        value: event.telemetry_enabled.toString(),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_START_SESSION_TELEMETRY_LOG_USER_PROMPTS_ENABLED,
        value: event.telemetry_log_user_prompts_enabled.toString(),
      },
    ];
    // Flush start event immediately
    this.enqueueLogEvent(this.createLogEvent(start_session_event_name, data));
    this.flushToClearcut().catch((error) => {
      console.debug('Error flushing to Clearcut:', error);
    });
  }

  logNewPromptEvent(event: UserPromptEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_USER_PROMPT_LENGTH,
        value: JSON.stringify(event.prompt_length),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_PROMPT_ID,
        value: JSON.stringify(event.prompt_id),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_AUTH_TYPE,
        value: JSON.stringify(event.auth_type),
      },
    ];

    this.enqueueLogEvent(this.createLogEvent(new_prompt_event_name, data));
    this.flushIfNeeded();
  }

  logToolCallEvent(event: ToolCallEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_NAME,
        value: JSON.stringify(event.function_name),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_PROMPT_ID,
        value: JSON.stringify(event.prompt_id),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_DECISION,
        value: JSON.stringify(event.decision),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_SUCCESS,
        value: JSON.stringify(event.success),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_DURATION_MS,
        value: JSON.stringify(event.duration_ms),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_ERROR_MESSAGE,
        value: JSON.stringify(event.error),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_TOOL_CALL_ERROR_TYPE,
        value: JSON.stringify(event.error_type),
      },
    ];

    const logEvent = this.createLogEvent(tool_call_event_name, data);
    this.enqueueLogEvent(logEvent);
    this.flushIfNeeded();
  }

  logApiRequestEvent(event: ApiRequestEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_REQUEST_MODEL,
        value: JSON.stringify(event.model),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_PROMPT_ID,
        value: JSON.stringify(event.prompt_id),
      },
    ];

    this.enqueueLogEvent(this.createLogEvent(api_request_event_name, data));
    this.flushIfNeeded();
  }

  logApiResponseEvent(event: ApiResponseEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_MODEL,
        value: JSON.stringify(event.model),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_PROMPT_ID,
        value: JSON.stringify(event.prompt_id),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_STATUS_CODE,
        value: JSON.stringify(event.status_code),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_RESPONSE_DURATION_MS,
        value: JSON.stringify(event.duration_ms),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_MESSAGE,
        value: JSON.stringify(event.error),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_API_RESPONSE_INPUT_TOKEN_COUNT,
        value: JSON.stringify(event.input_token_count),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_API_RESPONSE_OUTPUT_TOKEN_COUNT,
        value: JSON.stringify(event.output_token_count),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_API_RESPONSE_CACHED_TOKEN_COUNT,
        value: JSON.stringify(event.cached_content_token_count),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_API_RESPONSE_THINKING_TOKEN_COUNT,
        value: JSON.stringify(event.thoughts_token_count),
      },
      {
        gemini_cli_key:
          EventMetadataKey.GEMINI_CLI_API_RESPONSE_TOOL_TOKEN_COUNT,
        value: JSON.stringify(event.tool_token_count),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_AUTH_TYPE,
        value: JSON.stringify(event.auth_type),
      },
    ];

    this.enqueueLogEvent(this.createLogEvent(api_response_event_name, data));
    this.flushIfNeeded();
  }

  logApiErrorEvent(event: ApiErrorEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_MODEL,
        value: JSON.stringify(event.model),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_PROMPT_ID,
        value: JSON.stringify(event.prompt_id),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_TYPE,
        value: JSON.stringify(event.error_type),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_STATUS_CODE,
        value: JSON.stringify(event.status_code),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_API_ERROR_DURATION_MS,
        value: JSON.stringify(event.duration_ms),
      },
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_AUTH_TYPE,
        value: JSON.stringify(event.auth_type),
      },
    ];

    this.enqueueLogEvent(this.createLogEvent(api_error_event_name, data));
    this.flushIfNeeded();
  }

  logFlashFallbackEvent(event: FlashFallbackEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_AUTH_TYPE,
        value: JSON.stringify(event.auth_type),
      },
    ];

    this.enqueueLogEvent(this.createLogEvent(flash_fallback_event_name, data));
    this.flushToClearcut().catch((error) => {
      console.debug('Error flushing to Clearcut:', error);
    });
  }

  logLoopDetectedEvent(event: LoopDetectedEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_LOOP_DETECTED_TYPE,
        value: JSON.stringify(event.loop_type),
      },
    ];

    this.enqueueLogEvent(this.createLogEvent(loop_detected_event_name, data));
    this.flushIfNeeded();
  }

  logEndSessionEvent(event: EndSessionEvent): void {
    // Skip logging in test environments
    if (isTestEnvironment()) {
      return;
    }

    const data = [
      {
        gemini_cli_key: EventMetadataKey.GEMINI_CLI_END_SESSION_ID,
        value: event?.session_id?.toString() ?? '',
      },
    ];

    // Flush immediately on session end.
    this.enqueueLogEvent(this.createLogEvent(end_session_event_name, data));
    this.flushToClearcut().catch((error) => {
      console.debug('Error flushing to Clearcut:', error);
    });
  }

  shutdown() {
    const event = new EndSessionEvent(this.config);
    this.logEndSessionEvent(event);
  }
}
