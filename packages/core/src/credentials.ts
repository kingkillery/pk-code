/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'os';
import path from 'node:path';
import fs from 'fs/promises';
import { GEMINI_DIR } from './utils/paths.js';

const SERVICE_NAME = 'qwen-code';

type CredentialStore = {
  set(provider: string, apiKey: string): Promise<void>;
  get(provider: string): Promise<string | null>;
  delete(provider: string): Promise<boolean>;
};

let cachedStore: CredentialStore | null = null;

function shouldDisableSecureStore(): boolean {
  const v = String(process.env.PK_DISABLE_SECURE_STORE || process.env.NO_KEYTAR || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

async function getFileStore(): Promise<CredentialStore> {
  const credPath = path.join(os.homedir(), GEMINI_DIR, 'credentials.json');
  const ensureDir = async () => {
    try {
      await fs.mkdir(path.dirname(credPath), { recursive: true });
    } catch {
      // ignore
    }
  };
  const readAll = async (): Promise<Record<string, string>> => {
    try {
      const raw = await fs.readFile(credPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  };
  // Atomic write with restrictive permissions when possible
  const atomicWrite = async (file: string, contents: string): Promise<void> => {
    await ensureDir();
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    try {
      // Write temp file first with restrictive permissions
      await fs.writeFile(tmp, contents, { encoding: 'utf-8', mode: 0o600 });
      // Atomically replace
      await fs.rename(tmp, file);
      // Ensure permissions on final file (no-op on Windows)
      if (process.platform !== 'win32') {
        try {
          await fs.chmod(file, 0o600);
        } catch {
          // ignore chmod failures
        }
      }
    } catch (error) {
      // Clean up temp file if something went wrong
      try {
        await fs.unlink(tmp);
      } catch {
        // ignore cleanup failures
      }
      throw error;
    }
  };
  const writeAll = async (data: Record<string, string>): Promise<void> => {
    await atomicWrite(credPath, JSON.stringify(data, null, 2));
  };

  return {
    async set(provider: string, apiKey: string) {
      const all = await readAll();
      all[provider] = apiKey;
      await writeAll(all);
    },
    async get(provider: string) {
      const all = await readAll();
      return all[provider] ?? null;
    },
    async delete(provider: string) {
      const all = await readAll();
      const existed = provider in all;
      if (existed) {
        delete all[provider];
        await writeAll(all);
        return true;
      }
      return false;
    },
  };
}

async function resolveStore(): Promise<CredentialStore> {
  if (cachedStore) return cachedStore;
  if (shouldDisableSecureStore()) {
    cachedStore = await getFileStore();
    return cachedStore;
  }
  try {
    // Dynamically import keytar to avoid native dlopen at module load time
    const keytar = await import('keytar');
    cachedStore = {
      async set(provider: string, apiKey: string) {
        await keytar.setPassword(SERVICE_NAME, provider, apiKey);
      },
      async get(provider: string) {
        return await keytar.getPassword(SERVICE_NAME, provider);
      },
      async delete(provider: string) {
        return await keytar.deletePassword(SERVICE_NAME, provider);
      },
    } satisfies CredentialStore;
    return cachedStore;
  } catch {
    // Fallback to file-based storage if keytar isn't available
    cachedStore = await getFileStore();
    return cachedStore;
  }
}

export async function setCredential(
  provider: string,
  apiKey: string,
): Promise<void> {
  const store = await resolveStore();
  await store.set(provider, apiKey);
}

export async function getCredential(provider: string): Promise<string | null> {
  const store = await resolveStore();
  return await store.get(provider);
}

export async function deleteCredential(provider: string): Promise<boolean> {
  const store = await resolveStore();
  return await store.delete(provider);
}
