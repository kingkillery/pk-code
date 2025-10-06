/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getSandboxStatus } from '../../src/sandbox/status.js';

const originalEnv = { ...process.env };

type MutableOs = {
  platform: typeof os.platform;
  homedir: typeof os.homedir;
  tmpdir: typeof os.tmpdir;
};

type MutableFs = {
  existsSync: typeof fs.existsSync;
};

describe('getSandboxStatus', () => {
  const mutableOs = os as unknown as MutableOs;
  const mutableFs = fs as unknown as MutableFs;
  let platformSpy: ReturnType<typeof vi.spyOn>;
  let homedirSpy: ReturnType<typeof vi.spyOn>;
  let tmpdirSpy: ReturnType<typeof vi.spyOn>;
  let existsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    platformSpy = vi.spyOn(mutableOs, 'platform').mockReturnValue('linux');
    homedirSpy = vi
      .spyOn(mutableOs, 'homedir')
      .mockReturnValue('/home/test-user');
    tmpdirSpy = vi.spyOn(mutableOs, 'tmpdir').mockReturnValue('/tmp/test');
    existsSpy = vi
      .spyOn(mutableFs, 'existsSync')
      .mockImplementation(() => false);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    platformSpy.mockRestore();
    homedirSpy.mockRestore();
    tmpdirSpy.mockRestore();
    existsSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns disabled status when no sandbox configuration is present', () => {
    delete process.env.PK_SANDBOX;
    delete process.env.GEMINI_SANDBOX;

    const status = getSandboxStatus();

    expect(status.mode).toBe('disabled');
    expect(status.command).toBeUndefined();
    expect(status.network).toBe('open');
    expect(status.writableRoots).toContain(path.resolve(process.cwd()));
  });

  it('detects docker sandbox from PK_SANDBOX and surfaces writable mounts', () => {
    process.env.PK_SANDBOX = 'docker';
    process.env.SANDBOX_MOUNTS = '/var/data:/var/data:rw,/logs:/logs:ro';

    const status = getSandboxStatus();

    expect(status.mode).toBe('docker');
    expect(status.command).toBe('docker');
    expect(status.writableRoots).toContain(path.resolve('/var/data'));
    expect(
      status.notes.some((note) => note.includes('Container runtime detected')),
    ).toBe(true);
  });

  it('detects macOS seatbelt profile when running on darwin', () => {
    platformSpy.mockReturnValue('darwin');
    process.env.SEATBELT_PROFILE = 'restrictive-open';
    existsSpy.mockImplementation((targetPath: fs.PathLike | number) =>
      String(targetPath).endsWith('sandbox-macos-restrictive-open.sb'),
    );

    const status = getSandboxStatus();

    expect(status.mode).toBe('seatbelt');
    expect(status.command).toBe('sandbox-exec');
    expect(status.seatbeltProfile).toBe('restrictive-open');
    expect(status.notes).not.toContainEqual(
      expect.stringContaining('Seatbelt profile file not found'),
    );
  });
});
