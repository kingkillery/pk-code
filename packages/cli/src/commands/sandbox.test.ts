/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { handleSandboxCommand } from './sandbox.js';

const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

const mockGetSandboxStatus = vi.fn(() => ({
  mode: 'docker' as const,
  command: 'docker',
  seatbeltProfile: undefined,
  writableRoots: ['/workspace', '/tmp'],
  network: 'proxied' as const,
  notes: ['Proxy command configured: docker-proxy'],
}));

vi.mock('@pk-code/core', () => ({
  getSandboxStatus: mockGetSandboxStatus,
}));

describe('handleSandboxCommand', () => {
  beforeEach(() => {
    logSpy.mockClear();
    errorSpy.mockClear();
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prints sandbox status table by default', async () => {
    await handleSandboxCommand();

    expect(mockGetSandboxStatus).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Sandbox Status');
    expect(logSpy).toHaveBeenCalledWith('--------------');
    expect(logSpy).toHaveBeenCalledWith('Mode: Docker container');
    expect(logSpy).toHaveBeenCalledWith('Command: docker');
    expect(logSpy).toHaveBeenCalledWith('\nWritable roots:');
    expect(logSpy).toHaveBeenCalledWith('  - /workspace');
    expect(logSpy).toHaveBeenCalledWith('\nNetwork: proxied');
    expect(logSpy).toHaveBeenCalledWith('\nNotes:');
    expect(logSpy).toHaveBeenCalledWith(
      '  - Proxy command configured: docker-proxy',
    );
  });

  it('supports explicit status subcommand', async () => {
    await handleSandboxCommand('status');

    expect(mockGetSandboxStatus).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Mode: Docker container');
  });

  it('sets exitCode for unknown subcommands', async () => {
    await handleSandboxCommand('unknown');

    expect(errorSpy).toHaveBeenCalledWith('Unknown sandbox action: unknown');
    expect(process.exitCode).toBe(1);
  });
});
