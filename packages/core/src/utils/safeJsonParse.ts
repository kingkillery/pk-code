/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Result type for safe JSON parsing operations
 */
export interface SafeJsonParseResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Options for safe JSON parsing
 */
export interface SafeJsonParseOptions {
  /**
   * Whether to validate Content-Type header before parsing
   */
  validateContentType?: boolean;
  /**
   * Expected Content-Type header value (defaults to 'application/json')
   */
  expectedContentType?: string;
  /**
   * Maximum size in bytes before considering response truncated
   */
  maxSize?: number;
  /**
   * Context information for error reporting
   */
  context?: string;
}

/**
 * Safely parses JSON string, returning a result object instead of throwing
 *
 * @param jsonString - The JSON string to parse
 * @param options - Optional parsing configuration
 * @returns SafeJsonParseResult with success status and data or error
 */
export function safeJsonParse<T = unknown>(
  jsonString: string,
  options: SafeJsonParseOptions = {},
): SafeJsonParseResult<T> {
  const { maxSize, context } = options;
  
  try {
    // Check for empty or whitespace-only input
    if (!jsonString || typeof jsonString !== 'string') {
      return {
        success: false,
        error: `Invalid input: expected non-empty string${context ? ` (${context})` : ''}`,
      };
    }

    const trimmed = jsonString.trim();
    if (!trimmed) {
      return {
        success: false,
        error: `Empty JSON string${context ? ` (${context})` : ''}`,
      };
    }

    // Check for potential truncation
    if (maxSize && jsonString.length >= maxSize) {
      return {
        success: false,
        error: `JSON string may be truncated (${jsonString.length} >= ${maxSize} bytes)${context ? ` (${context})` : ''}`,
      };
    }

    // Validate basic JSON structure before parsing
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return {
        success: false,
        error: `Invalid JSON format: must start with '{' or '['${context ? ` (${context})` : ''}`,
      };
    }

    const data = JSON.parse(trimmed) as T;
    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `JSON parse error: ${errorMessage}${context ? ` (${context})` : ''}`,
    };
  }
}

/**
 * Safely parses JSON from a Response object, with Content-Type validation
 *
 * @param response - The fetch Response object
 * @param options - Optional parsing configuration
 * @returns SafeJsonParseResult with success status and data or error
 */
export async function safeJsonParseResponse<T = unknown>(
  response: Response,
  options: SafeJsonParseOptions = {},
): Promise<SafeJsonParseResult<T>> {
  const {
    validateContentType = true,
    expectedContentType = 'application/json',
    context,
  } = options;

  try {
    // Validate response status
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}${context ? ` (${context})` : ''}`,
      };
    }

    // Validate Content-Type if requested
    if (validateContentType) {
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes(expectedContentType)) {
        return {
          success: false,
          error: `Invalid content type: expected '${expectedContentType}', got '${contentType || 'none'}'${context ? ` (${context})` : ''}`,
        };
      }
    }

    // Get response text
    const text = await response.text();
    
    // Use the string parsing function
    return safeJsonParse<T>(text, {
      ...options,
      context: context || `HTTP ${response.status} response`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Response parsing error: ${errorMessage}${context ? ` (${context})` : ''}`,
    };
  }
}

/**
 * Safely parses JSON with fallback behavior
 *
 * @param jsonString - The JSON string to parse
 * @param fallbackValue - Value to return if parsing fails
 * @param options - Optional parsing configuration
 * @returns Parsed data or fallback value
 */
export function safeJsonParseWithFallback<T>(
  jsonString: string,
  fallbackValue: T,
  options: SafeJsonParseOptions = {},
): T {
  const result = safeJsonParse<T>(jsonString, options);
  return result.success ? result.data! : fallbackValue;
}