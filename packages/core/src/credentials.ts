/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as keytar from 'keytar';

const SERVICE_NAME = 'qwen-code';

export async function setCredential(
  provider: string,
  apiKey: string,
): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, provider, apiKey);
}

export async function getCredential(provider: string): Promise<string | null> {
  return await keytar.getPassword(SERVICE_NAME, provider);
}

export async function deleteCredential(provider: string): Promise<boolean> {
  return await keytar.deletePassword(SERVICE_NAME, provider);
}
