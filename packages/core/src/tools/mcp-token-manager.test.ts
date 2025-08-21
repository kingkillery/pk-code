/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPTokenManager } from './mcp-token-manager.js';

vi.mock('../credentials.js', async () => ({
  // Default mocks; individual tests will override behavior
  getCredential: vi.fn(async () => null),
  setCredential: vi.fn(async () => {}),
  deleteCredential: vi.fn(async () => true),
}));

describe('MCPTokenManager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('migrates legacy token key to stable key', async () => {
    const { getCredential, setCredential, deleteCredential } = await import(
      '../credentials.js'
    );

    // First call (stable key) returns null; second call (legacy key) returns token
    const legacyToken = JSON.stringify({ access_token: 'legacy' });

    const calls: string[] = [];
    vi.mocked(getCredential).mockImplementation(async (key: string) => {
      calls.push(key);
      // Stable key contains provider marker; legacy uses server name suffix
      if (key.startsWith('mcp_oauth|')) return null;
      if (key === 'mcp_oauth_testServer') return legacyToken;
      return null;
    });

    vi.mocked(setCredential).mockResolvedValue();
    vi.mocked(deleteCredential).mockResolvedValue(true);

    // Construct manager (debug to get console messages in CI if failing)
    const mgr = new MCPTokenManager(
      'testServer',
      { provider: 'notion', clientId: 'abc' },
      true,
    );

    // Force code path up to reading cached token; it shouldn't try network
    // Call private method via any-cast to avoid starting browser flow
    const cached = await (mgr as any).getCachedToken();
    expect(cached).not.toBeNull();

    // Should have checked stable first then legacy
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]!.startsWith('mcp_oauth|notion')).toBe(true);
    expect(calls).toContain('mcp_oauth_testServer');

    // Should have migrated token to stable key and removed legacy
    expect(vi.mocked(setCredential)).toHaveBeenCalledTimes(1);
    const setArgs = vi.mocked(setCredential).mock.calls[0];
    expect(setArgs[0]!.startsWith('mcp_oauth|notion')).toBe(true);
    expect(setArgs[1]).toBe(legacyToken);

    expect(vi.mocked(deleteCredential)).toHaveBeenCalledWith(
      'mcp_oauth_testServer',
    );
  });
});

