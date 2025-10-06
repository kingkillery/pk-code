/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { diagnosticsCommand } from './diagnosticsCommand.js';
import type { CommandContext } from './types.js';

describe('diagnosticsCommand', () => {
  it('should have the correct name and description', () => {
    expect(diagnosticsCommand.name).toBe('diagnostics');
    expect(diagnosticsCommand.altName).toBe('diag');
    expect(diagnosticsCommand.description).toBe(
      'Show system diagnostics and configuration status',
    );
  });

  it('should return a dialog action to open diagnostics', () => {
    const mockContext = {} as CommandContext;
    const result = diagnosticsCommand.action?.(mockContext, '');

    expect(result).toEqual({
      type: 'dialog',
      dialog: 'diagnostics',
    });
  });
});
