/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { setCredential, getCredential, deleteCredential } from '@pk-code/core';

export async function handleConfigCommand(
  action: string,
  provider?: string,
  apiKey?: string,
) {
  switch (action) {
    case 'add':
      if (!provider || !apiKey) {
        console.error(
          'Provider and API key are required for the "add" action.',
        );
        return;
      }
      await setCredential(provider, apiKey);
      console.log(`Credential for ${provider} has been added.`);
      break;
    case 'remove':
      if (!provider) {
        console.error('Provider is required for the "remove" action.');
        return;
      }
      if (await deleteCredential(provider)) {
        console.log(`Credential for ${provider} has been removed.`);
      } else {
        console.error(`Failed to remove credential for ${provider}.`);
      }
      break;
    case 'list': {
      // This is a placeholder. In a real application, you would not list the API keys.
      // This is just for demonstration purposes.
      console.log('Listing configured providers:');
      // In a real app, you would list the providers, not the keys.
      // For now, we will just list the providers for which a credential exists.
      const providers = ['openai', 'gemini']; // This would be a dynamic list
      for (const p of providers) {
        const cred = await getCredential(p);
        if (cred) {
          console.log(`- ${p}`);
        }
      }
      break;
    }
    default:
      console.error(`Unknown action: ${action}`);
  }
}
