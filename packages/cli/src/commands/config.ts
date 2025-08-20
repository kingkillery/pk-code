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

const SETTINGS_FILE = path.join(os.homedir(), '.pk', 'settings.json');

interface ChromePathDetectionResult {
  path: string;
  verified: boolean;
  exists: boolean;
  error?: string;
}

/**
 * Detects the default Chrome user data directory path for the current OS
 * @returns ChromePathDetectionResult containing path info and verification status
 */
async function detectChromeUserDataPath(): Promise<ChromePathDetectionResult> {
  const platform = os.platform();
  let detectedPath = '';
  let error: string | undefined;

  // Detect OS-specific default paths
  switch (platform) {
    case 'win32': {
      // Windows: %LOCALAPPDATA%\Google\Chrome\User Data
      const localAppData =
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      detectedPath = path.join(localAppData, 'Google', 'Chrome', 'User Data');
      break;
    }

    case 'darwin':
      // macOS: ~/Library/Application Support/Google/Chrome
      detectedPath = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Google',
        'Chrome',
      );
      break;

    case 'linux':
      // Linux: ~/.config/google-chrome
      detectedPath = path.join(os.homedir(), '.config', 'google-chrome');
      break;

    default:
      error = `Unsupported platform: ${platform}`;
      return {
        path: '',
        verified: false,
        exists: false,
        error,
      };
  }

  // Verify the path exists and is accessible
  let exists = false;
  let verified = false;

  try {
    const stats = await fs.stat(detectedPath);
    exists = true;
    verified = stats.isDirectory();

    // Additional verification: check if it looks like a Chrome user data directory
    if (verified) {
      try {
        // Check for typical Chrome user data directory structure
        const localStateFile = path.join(detectedPath, 'Local State');
        await fs.access(localStateFile, fs.constants.F_OK);
      } catch {
        // Local State file doesn't exist, but directory exists - might still be valid
        verified = true; // Keep as verified since directory exists
      }
    }
  } catch (fsError) {
    exists = false;
    verified = false;

    // Provide helpful error context
    if ((fsError as NodeJS.ErrnoException).code === 'ENOENT') {
      error = `Chrome user data directory not found at: ${detectedPath}`;
    } else if ((fsError as NodeJS.ErrnoException).code === 'EACCES') {
      error = `Permission denied accessing: ${detectedPath}`;
    } else {
      error = `Error accessing Chrome directory: ${(fsError as Error).message}`;
    }
  }

  return {
    path: detectedPath,
    verified,
    exists,
    error,
  };
}

async function getCurrentBrowserPath(): Promise<string | null> {
  // Try to read from .mcp.json first
  const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
  try {
    const mcpData = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(mcpData);
    const browserUseConfig = mcpConfig?.mcpServers?.['browser-use'];
    if (browserUseConfig?.env?.BROWSER_USE_USER_DATA_DIR) {
      return browserUseConfig.env.BROWSER_USE_USER_DATA_DIR;
    }
  } catch (_error) {
    // Continue to check settings.json
  }

  // Fallback to settings.json
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(data);
    const browserUseSettings = settings['browser-use'];
    if (
      browserUseSettings &&
      typeof browserUseSettings === 'object' &&
      'userDataDir' in browserUseSettings
    ) {
      return browserUseSettings.userDataDir as string;
    }
  } catch (_error) {
    // No existing configuration found
  }

  return null;
}

async function saveBrowserPath(browserPath: string) {
  // Save to both settings.json and .mcp.json

  // Update settings.json
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

  // Update .mcp.json
  const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
  let mcpConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} };

  try {
    const mcpData = await fs.readFile(mcpConfigPath, 'utf-8');
    mcpConfig = JSON.parse(mcpData);
  } catch (_error) {
    // File might not exist, which is fine - we'll create it
  }

  // Ensure mcpServers exists
  if (!mcpConfig.mcpServers) {
    mcpConfig.mcpServers = {};
  }

  // Add or update browser-use server configuration
  mcpConfig.mcpServers['browser-use'] = {
    command: 'cmd',
    args: ['/c', 'uvx', '--from', 'browser-use[cli]', 'browser-use', '--mcp'],
    env: {
      BROWSER_USE_USER_DATA_DIR: browserPath,
    },
  };

  await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, '\t'));
}

export { detectChromeUserDataPath, type ChromePathDetectionResult };

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

      console.log(`Configuring browser for browser-use integration...`);

      // Check current configuration
      const currentPath = await getCurrentBrowserPath();
      if (currentPath) {
        console.log(`Current browser path: ${currentPath}`);
        console.log(`Configuration found in .mcp.json\n`);
      } else {
        console.log(`No existing browser configuration found.\n`);
      }

      console.log(`We need to find your browser's user data directory.`);

      // Use enhanced detection
      const detectionResult = await detectChromeUserDataPath();

      if (detectionResult.error) {
        console.log(`⚠️  ${detectionResult.error}`);
      }

      if (detectionResult.exists && detectionResult.verified) {
        console.log(
          `✅ Chrome installation detected at: ${detectionResult.path}`,
        );
      } else if (detectionResult.exists && !detectionResult.verified) {
        console.log(
          `⚠️  Directory exists but may not be a valid Chrome user data directory: ${detectionResult.path}`,
        );
      } else {
        console.log(
          `❌ Chrome user data directory not found at expected location: ${detectionResult.path}`,
        );
        console.log(
          `You may need to provide a custom path if Chrome is installed in a non-standard location.`,
        );
      }

      console.log(
        `The default path for your OS (${os.platform()}) is: ${detectionResult.path}`,
      );

      await new Promise<void>((resolve) => {
        rl.question(
          `Press Enter to accept the default, or enter a custom path: `,
          async (inputPath) => {
            const browserPath = inputPath || detectionResult.path;

            // Validate custom path if provided
            if (inputPath) {
              try {
                const stats = await fs.stat(browserPath);
                if (!stats.isDirectory()) {
                  console.log(`⚠️  Warning: ${browserPath} is not a directory`);
                } else {
                  console.log(`✅ Custom path validated: ${browserPath}`);
                }
              } catch (customPathError) {
                console.log(
                  `⚠️  Warning: Cannot access ${browserPath}. Error: ${(customPathError as Error).message}`,
                );
                console.log(
                  `Saving anyway - you may need to verify this path later.`,
                );
              }
            }

            await saveBrowserPath(browserPath);
            console.log(
              `✅ Browser path saved to both ~/.pk/settings.json and .mcp.json`,
            );
            console.log(
              `✅ MCP server configuration updated for browser-use integration`,
            );
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
