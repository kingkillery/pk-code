/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { setCredential, getCredential, deleteCredential } from '@pk-code/core';
import * as readline from 'readline';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

const SETTINGS_FILE = path.join(os.homedir(), '.pk-code', 'settings.json');

async function getBrowserPath(): Promise<string> {
  const platform = os.platform();
  switch (platform) {
    case 'win32':
      return path.join(
        os.homedir(),
        'AppData',
        'Local',
        'Google',
        'Chrome',
        'User Data',
      );
    case 'darwin':
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Google',
        'Chrome',
      );
    case 'linux':
      return path.join(os.homedir(), '.config', 'google-chrome');
    default:
      return '';
  }
}

async function saveBrowserPath(browserPath: string) {
  let settings: Record<string, unknown> = {};
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    settings = JSON.parse(data);
  } catch (_error) {
    // File might not exist, which is fine
  }
  settings['browser-use'] = { userDataDir: browserPath };
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

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
    case 'browser': {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const defaultPath = await getBrowserPath();
      console.log(`We need to find your browser's user data directory.`);
      console.log(`The default path for your OS is: ${defaultPath}`);

      await new Promise<void>((resolve) => {
        rl.question(
          `Press Enter to accept the default, or enter a custom path: `,
          async (inputPath) => {
            const browserPath = inputPath || defaultPath;
            await saveBrowserPath(browserPath);
            console.log(`Browser path saved to ${SETTINGS_FILE}`);
            rl.close();
            resolve();
          },
        );
      });
      break;
    }
    default:
      console.error(`Unknown action: ${action}`);
  }
}
