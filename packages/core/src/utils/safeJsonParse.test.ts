/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  safeJsonParse,
  safeJsonParseResponse,
  safeJsonParseWithFallback,
} from './safeJsonParse.js';

describe('safeJsonParse', () => {
  describe('basic functionality', () => {
    it('should parse valid JSON successfully', () => {
      const result = safeJsonParse('{"name": "test", "value": 42}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 42 });
      expect(result.error).toBeUndefined();
    });

    it('should parse valid JSON array successfully', () => {
      const result = safeJsonParse('[1, 2, 3]');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should handle empty object', () => {
      const result = safeJsonParse('{}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should handle empty array', () => {
      const result = safeJsonParse('[]');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON gracefully', () => {
      const result = safeJsonParse('{"invalid": json}');
      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parse error');
      expect(result.data).toBeUndefined();
    });

    it('should handle empty string', () => {
      const result = safeJsonParse('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('should handle null input', () => {
      const result = safeJsonParse(null as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('should handle undefined input', () => {
      const result = safeJsonParse(undefined as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('should handle whitespace-only string', () => {
      const result = safeJsonParse('   \t\n  ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty JSON string');
    });

    it('should handle non-JSON string', () => {
      const result = safeJsonParse('not json at all');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON format');
    });

    it('should detect potentially truncated responses', () => {
      const longString = 'a'.repeat(1000);
      const result = safeJsonParse(`{"data": "${longString}"}`, { maxSize: 500 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('may be truncated');
    });
  });

  describe('context information', () => {
    it('should include context in error messages', () => {
      const result = safeJsonParse('invalid', { context: 'OpenRouter API' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenRouter API');
    });
  });

  describe('whitespace handling', () => {
    it('should handle leading/trailing whitespace', () => {
      const result = safeJsonParse('  {"test": true}  ');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ test: true });
    });
  });
});

describe('safeJsonParseResponse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should parse successful response with correct content type', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      text: vi.fn().mockResolvedValue('{"success": true}'),
    } as any;

    mockResponse.headers.get = vi.fn((key: string) => mockResponse.headers.get(key));

    const result = await safeJsonParseResponse(mockResponse);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ success: true });
  });

  it('should handle HTTP error status', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Map(),
    } as any;

    mockResponse.headers.get = vi.fn();

    const result = await safeJsonParseResponse(mockResponse);
    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 404: Not Found');
  });

  it('should validate content type', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'text/html']]),
    } as any;

    mockResponse.headers.get = vi.fn((key: string) => mockResponse.headers.get(key));

    const result = await safeJsonParseResponse(mockResponse);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid content type');
  });

  it('should skip content type validation when disabled', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'text/html']]),
      text: vi.fn().mockResolvedValue('{"data": "test"}'),
    } as any;

    mockResponse.headers.get = vi.fn((key: string) => mockResponse.headers.get(key));

    const result = await safeJsonParseResponse(mockResponse, {
      validateContentType: false,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ data: 'test' });
  });

  it('should handle response.text() errors', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      text: vi.fn().mockRejectedValue(new Error('Network error')),
    } as any;

    mockResponse.headers.get = vi.fn((key: string) => mockResponse.headers.get(key));

    const result = await safeJsonParseResponse(mockResponse);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });
});

describe('safeJsonParseWithFallback', () => {
  it('should return parsed data on success', () => {
    const result = safeJsonParseWithFallback('{"value": 42}', { value: 0 });
    expect(result).toEqual({ value: 42 });
  });

  it('should return fallback on parse error', () => {
    const fallback = { error: true };
    const result = safeJsonParseWithFallback('invalid json', fallback);
    expect(result).toBe(fallback);
  });

  it('should handle null fallback', () => {
    const result = safeJsonParseWithFallback('invalid json', null);
    expect(result).toBeNull();
  });
});