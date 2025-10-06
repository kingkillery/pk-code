/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export interface SandboxStatusSummary {
  readonly mode: 'disabled' | 'seatbelt' | 'docker' | 'podman' | 'custom';
  readonly command?: string;
  readonly seatbeltProfile?: string;
  readonly writableRoots: string[];
  readonly network: 'open' | 'proxied' | 'restricted';
  readonly notes: string[];
}

function resolveEnv(name: string): string | undefined {
  const value = process.env[name] ?? process.env[name.toLowerCase()];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function detectSandboxCommand(): {
  command?: string;
  source: 'PK_SANDBOX' | 'GEMINI_SANDBOX' | 'auto' | 'none';
} {
  const pkSandbox = resolveEnv('PK_SANDBOX');
  if (pkSandbox) {
    if (['false', 'none', '0'].includes(pkSandbox.toLowerCase())) {
      return { source: 'PK_SANDBOX' };
    }
    return { command: pkSandbox, source: 'PK_SANDBOX' };
  }

  const geminiSandbox = resolveEnv('GEMINI_SANDBOX');
  if (geminiSandbox) {
    if (['false', 'none', '0'].includes(geminiSandbox.toLowerCase())) {
      return { source: 'GEMINI_SANDBOX' };
    }
    return { command: geminiSandbox, source: 'GEMINI_SANDBOX' };
  }

  const seatbeltProfile = resolveEnv('SEATBELT_PROFILE');
  if (os.platform() === 'darwin' && seatbeltProfile !== 'none') {
    return { command: 'sandbox-exec', source: 'auto' };
  }

  return { source: 'none' };
}

function detectWritableRoots(): string[] {
  const roots = new Set<string>();

  const workdir = process.cwd();
  roots.add(path.resolve(workdir));

  const mountEnv = resolveEnv('SANDBOX_MOUNTS');
  if (mountEnv) {
    for (const entry of mountEnv.split(',')) {
      const [hostPath, _containerPath, mode] = entry
        .split(':')
        .map((v) => v?.trim());
      if (!hostPath) continue;
      if ((mode ?? '').toLowerCase() === 'rw') {
        roots.add(path.resolve(hostPath));
      }
    }
  }

  const userSettingsDir = path.join(os.homedir(), '.pk');
  if (fs.existsSync(userSettingsDir)) {
    roots.add(path.resolve(userSettingsDir));
  }

  const tmpDir = os.tmpdir();
  if (tmpDir) {
    roots.add(path.resolve(tmpDir));
  }

  return Array.from(roots).sort();
}

function detectNetworkState(): {
  network: SandboxStatusSummary['network'];
  notes: string[];
} {
  const notes: string[] = [];
  const proxyCommand = resolveEnv('GEMINI_SANDBOX_PROXY_COMMAND');
  const hasProxyEnv =
    resolveEnv('HTTPS_PROXY') ||
    resolveEnv('https_proxy') ||
    resolveEnv('HTTP_PROXY') ||
    resolveEnv('http_proxy');

  if (proxyCommand) {
    notes.push(`Proxy command configured: ${proxyCommand}`);
    return { network: 'proxied', notes };
  }

  if (hasProxyEnv) {
    notes.push('Proxy environment variables detected.');
    return { network: 'proxied', notes };
  }

  const sandboxNetwork = resolveEnv('SANDBOX_NETWORK');
  if (sandboxNetwork) {
    notes.push(`Custom sandbox network: ${sandboxNetwork}`);
    return { network: 'restricted', notes };
  }

  return { network: 'open', notes };
}

export function getSandboxStatus(): SandboxStatusSummary {
  const { command } = detectSandboxCommand();
  const writableRoots = detectWritableRoots();
  const { network, notes: networkNotes } = detectNetworkState();
  const notes = [...networkNotes];

  if (!command || command === 'false' || command === 'none') {
    return {
      mode: 'disabled',
      writableRoots,
      network,
      notes,
    };
  }

  if (command === 'sandbox-exec') {
    const seatbeltProfile = resolveEnv('SEATBELT_PROFILE') ?? 'default';
    if (seatbeltProfile === 'none') {
      notes.push(
        'Seatbelt profile set to "none"; macOS restrictions disabled.',
      );
      return {
        mode: 'seatbelt',
        command,
        seatbeltProfile,
        writableRoots,
        network,
        notes,
      };
    }

    const profilePath = path.join(
      os.homedir(),
      '.pk',
      `sandbox-macos-${seatbeltProfile}.sb`,
    );
    if (!fs.existsSync(profilePath)) {
      notes.push(`Seatbelt profile file not found at ${profilePath}`);
    }

    return {
      mode: 'seatbelt',
      command,
      seatbeltProfile,
      writableRoots,
      network,
      notes,
    };
  }

  if (command === 'docker' || command === 'podman') {
    const runtimeState = resolveEnv('BUILD_SANDBOX') ? 'build' : 'run';
    notes.push(`Container runtime detected (${runtimeState} mode).`);

    return {
      mode: command,
      command,
      writableRoots,
      network,
      notes,
    };
  }

  notes.push('Custom sandbox command detected.');
  return {
    mode: 'custom',
    command,
    writableRoots,
    network,
    notes,
  };
}
