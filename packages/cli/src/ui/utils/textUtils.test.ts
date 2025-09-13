/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  getAsciiArtWidth,
  isBinary,
  toCodePoints,
  cpLen,
  cpSlice,
} from './textUtils.js';

describe('textUtils', () => {
  describe('getAsciiArtWidth', () => {
    it('should return 0 for empty string', () => {
      expect(getAsciiArtWidth('')).toBe(0);
    });

    it('should return 0 for null or undefined input', () => {
      // @ts-expect-error Testing invalid input
      expect(getAsciiArtWidth(null)).toBe(0);
      // @ts-expect-error Testing invalid input
      expect(getAsciiArtWidth(undefined)).toBe(0);
    });

    it('should return correct width for single line ASCII art', () => {
      const asciiArt = 'Hello World';
      expect(getAsciiArtWidth(asciiArt)).toBe(11);
    });

    it('should return correct width for multi-line ASCII art', () => {
      const asciiArt = 'Hello\nWorld!\nTest';
      expect(getAsciiArtWidth(asciiArt)).toBe(6); // "World!" is the longest line
    });

    it('should handle ASCII art with empty lines', () => {
      const asciiArt = 'Hello\n\nWorld';
      expect(getAsciiArtWidth(asciiArt)).toBe(5); // Both "Hello" and "World" are 5 chars
    });

    it('should handle ASCII art with trailing newlines', () => {
      const asciiArt = 'Hello\nWorld\n';
      expect(getAsciiArtWidth(asciiArt)).toBe(5); // Both lines are 5 chars
    });
  });

  describe('isBinary', () => {
    it('should return false for null or undefined input', () => {
      expect(isBinary(null)).toBe(false);
      expect(isBinary(undefined)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      expect(isBinary(Buffer.from([]))).toBe(false);
    });

    it('should return false for text buffer', () => {
      const textBuffer = Buffer.from('Hello World!');
      expect(isBinary(textBuffer)).toBe(false);
    });

    it('should return true for buffer with NULL byte', () => {
      const binaryBuffer = Buffer.from([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64,
      ]);
      expect(isBinary(binaryBuffer)).toBe(true);
    });

    it('should return false for buffer without NULL byte within sample size', () => {
      const textBuffer = Buffer.from('A'.repeat(1000));
      expect(isBinary(textBuffer, 512)).toBe(false);
    });

    it('should return true for buffer with NULL byte within sample size', () => {
      const buffer = Buffer.alloc(1000, 0x41); // Fill with 'A'
      buffer[500] = 0x00; // Add NULL byte at position 500
      expect(isBinary(buffer, 512)).toBe(true);
    });

    it('should return false for buffer with NULL byte outside sample size', () => {
      const buffer = Buffer.alloc(1000, 0x41); // Fill with 'A'
      buffer[600] = 0x00; // Add NULL byte at position 600, outside default sample size of 512
      expect(isBinary(buffer)).toBe(false);
    });

    it('should respect custom sample size', () => {
      const buffer = Buffer.alloc(1000, 0x41); // Fill with 'A'
      buffer[600] = 0x00; // Add NULL byte at position 600
      expect(isBinary(buffer, 700)).toBe(true); // With sample size 700, should detect the NULL byte
    });
  });

  describe('Unicode-aware helpers', () => {
    describe('toCodePoints', () => {
      it('should convert empty string to empty array', () => {
        expect(toCodePoints('')).toEqual([]);
      });

      it('should convert ASCII string to array of characters', () => {
        expect(toCodePoints('hello')).toEqual(['h', 'e', 'l', 'l', 'o']);
      });

      it('should handle Unicode characters correctly', () => {
        expect(toCodePoints('café')).toEqual(['c', 'a', 'f', 'é']);
      });

      it('should handle emoji characters correctly', () => {
        expect(toCodePoints('😀😃😄😁')).toEqual(['😀', '😃', '😄', '😁']);
      });

      it('should handle mixed ASCII and Unicode characters', () => {
        expect(toCodePoints('Hello 世界 🌍')).toEqual([
          'H',
          'e',
          'l',
          'l',
          'o',
          ' ',
          '世',
          '界',
          ' ',
          '🌍',
        ]);
      });
    });

    describe('cpLen', () => {
      it('should return 0 for empty string', () => {
        expect(cpLen('')).toBe(0);
      });

      it('should return correct length for ASCII string', () => {
        expect(cpLen('hello')).toBe(5);
      });

      it('should return correct length for Unicode string', () => {
        expect(cpLen('café')).toBe(4);
      });

      it('should return correct length for emoji string', () => {
        expect(cpLen('😀😃😄😁')).toBe(4);
      });

      it('should return correct length for mixed string', () => {
        expect(cpLen('Hello 世界 🌍')).toBe(10);
      });
    });

    describe('cpSlice', () => {
      it('should return empty string for empty input', () => {
        expect(cpSlice('', 0)).toBe('');
      });

      it('should slice ASCII string correctly', () => {
        expect(cpSlice('hello world', 0, 5)).toBe('hello');
        expect(cpSlice('hello world', 6)).toBe('world');
      });

      it('should slice Unicode string correctly', () => {
        expect(cpSlice('café restaurant', 0, 4)).toBe('café');
        expect(cpSlice('café restaurant', 5)).toBe('restaurant');
      });

      it('should slice emoji string correctly', () => {
        expect(cpSlice('😀😃😄😁', 0, 2)).toBe('😀😃');
        expect(cpSlice('😀😃😄😁', 2)).toBe('😄😁');
      });

      it('should handle negative indices', () => {
        expect(cpSlice('hello world', -5)).toBe('world');
        expect(cpSlice('café restaurant', -5)).toBe('aurant'); // Last 5 code points of 'café restaurant'
      });

      it('should handle out of bounds indices', () => {
        expect(cpSlice('hello', 0, 10)).toBe('hello');
        expect(cpSlice('hello', 10, 20)).toBe('');
      });
    });
  });
});
