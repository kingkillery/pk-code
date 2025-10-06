/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from 'readline';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

const AUTH_FILE = path.join(os.homedir(), '.pk', 'auth.json');
const PK_DIR = path.join(os.homedir(), '.pk');

interface AuthData {
  openai?: {
    apiKey: string;
    createdAt: string;
    lastUsed?: string;
  };
  anthropic?: {
    apiKey: string;
    createdAt: string;
    lastUsed?: string;
  };
  google?: {
    apiKey: string;
    createdAt: string;
    lastUsed?: string;
  };
}

/**
 * Validate OpenAI API key format
 * OpenAI keys typically start with 'sk-' or 'sk-proj-'
 */
function validateOpenAIApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const trimmedKey = apiKey.trim();

  // Check minimum length
  if (trimmedKey.length < 20) {
    return false;
  }

  // Check if it starts with known OpenAI prefixes
  const validPrefixes = ['sk-', 'sk-proj-'];
  const hasValidPrefix = validPrefixes.some(prefix => trimmedKey.startsWith(prefix));

  return hasValidPrefix;
}

/**
 * Validate Anthropic API key format
 * Anthropic keys typically start with 'sk-ant-'
 */
function validateAnthropicApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const trimmedKey = apiKey.trim();

  if (trimmedKey.length < 20) {
    return false;
  }

  return trimmedKey.startsWith('sk-ant-');
}

/**
 * Validate Google API key format
 * Google keys are typically 39 characters long
 */
function validateGoogleApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const trimmedKey = apiKey.trim();

  // Google API keys are typically 39 characters
  if (trimmedKey.length < 30) {
    return false;
  }

  // Google keys are alphanumeric with dashes and underscores
  return /^[A-Za-z0-9_-]+$/.test(trimmedKey);
}

/**
 * Read existing auth data from auth.json
 */
async function readAuthData(): Promise<AuthData> {
  try {
    const data = await fs.readFile(AUTH_FILE, 'utf-8');
    return JSON.parse(data) as AuthData;
  } catch (_error) {
    // If file doesn't exist or is invalid, return empty object
    return {};
  }
}

/**
 * Write auth data to auth.json with proper permissions
 */
async function writeAuthData(authData: AuthData): Promise<void> {
  // Ensure .pk directory exists
  await fs.mkdir(PK_DIR, { recursive: true });

  // Write with restrictive permissions
  const tmp = `${AUTH_FILE}.tmp-${process.pid}-${Date.now()}`;

  try {
    // Write to temp file first
    await fs.writeFile(tmp, JSON.stringify(authData, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });

    // Atomically replace
    await fs.rename(tmp, AUTH_FILE);

    // Ensure restrictive permissions (no-op on Windows)
    if (process.platform !== 'win32') {
      try {
        await fs.chmod(AUTH_FILE, 0o600);
      } catch {
        // Ignore chmod failures
      }
    }
  } catch (error) {
    // Clean up temp file
    try {
      await fs.unlink(tmp);
    } catch {
      // Ignore cleanup failures
    }
    throw error;
  }
}

/**
 * Handle login with API key from stdin
 */
export async function handleLoginWithApiKey(
  provider: 'openai' | 'anthropic' | 'google' = 'openai',
): Promise<void> {
  console.log(`\n🔐 PK Code - ${provider.toUpperCase()} API Key Authentication\n`);

  // Check if OPENAI_API_KEY environment variable is set
  const envApiKey = process.env[`${provider.toUpperCase()}_API_KEY`];

  if (envApiKey) {
    console.log(`✅ Detected ${provider.toUpperCase()}_API_KEY environment variable`);
    console.log(`   Using environment variable for authentication`);

    // Validate the environment variable key
    const isValid =
      provider === 'openai' ? validateOpenAIApiKey(envApiKey) :
      provider === 'anthropic' ? validateAnthropicApiKey(envApiKey) :
      validateGoogleApiKey(envApiKey);

    if (isValid) {
      console.log(`   ✅ API key format is valid\n`);

      // Optionally save to auth.json
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      await new Promise<void>((resolve) => {
        rl.question(
          `Would you like to save this key to ${AUTH_FILE}? (y/N): `,
          async (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
              const authData = await readAuthData();
              authData[provider] = {
                apiKey: envApiKey,
                createdAt: new Date().toISOString(),
              };
              await writeAuthData(authData);
              console.log(`\n✅ API key saved to ${AUTH_FILE}`);
            } else {
              console.log(`\n   Using environment variable only (not saved)`);
            }
            rl.close();
            resolve();
          },
        );
      });
    } else {
      console.log(`   ⚠️  API key format appears invalid`);
      console.log(`   Please check your environment variable\n`);
    }
    return;
  }

  // Read API key from stdin
  console.log(`Reading ${provider.toUpperCase()} API key from stdin...`);
  console.log(`(Paste your API key and press Enter)\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // Don't echo the key
  });

  let apiKey = '';

  for await (const line of rl) {
    apiKey = line.trim();
    break; // Only read first line
  }

  rl.close();

  // Validate the API key
  const isValid =
    provider === 'openai' ? validateOpenAIApiKey(apiKey) :
    provider === 'anthropic' ? validateAnthropicApiKey(apiKey) :
    validateGoogleApiKey(apiKey);

  if (!isValid) {
    console.error(`\n❌ Invalid ${provider.toUpperCase()} API key format`);

    if (provider === 'openai') {
      console.error(`   OpenAI API keys should start with 'sk-' or 'sk-proj-'`);
    } else if (provider === 'anthropic') {
      console.error(`   Anthropic API keys should start with 'sk-ant-'`);
    }

    console.error(`   Please check your API key and try again\n`);
    process.exit(1);
  }

  // Save to auth.json
  const authData = await readAuthData();
  authData[provider] = {
    apiKey,
    createdAt: new Date().toISOString(),
  };

  await writeAuthData(authData);

  console.log(`\n✅ ${provider.toUpperCase()} API key saved successfully!`);
  console.log(`   Credentials stored at: ${AUTH_FILE}`);
  console.log(`   File permissions: 0600 (read/write for owner only)\n`);

  // Provide usage instructions
  console.log(`🚀 Next steps:`);
  console.log(`   1. Start PK Code: pk`);
  console.log(`   2. Check auth status: pk auth status`);
  console.log(`   3. Use ${provider} models with --model flag\n`);
}

/**
 * Handle auth status check
 */
export async function handleAuthStatus(): Promise<void> {
  console.log(`\n🔐 PK Code - Authentication Status\n`);

  // Check auth.json
  let authData: AuthData = {};
  let authFileExists = false;

  try {
    authData = await readAuthData();
    authFileExists = Object.keys(authData).length > 0;
  } catch {
    authFileExists = false;
  }

  console.log(`📁 Auth file: ${AUTH_FILE}`);
  console.log(`   ${authFileExists ? '✅ Exists' : '❌ Not found'}\n`);

  // Check each provider
  const providers: Array<{
    name: string;
    key: keyof AuthData;
    envVar: string;
  }> = [
    { name: 'OpenAI', key: 'openai', envVar: 'OPENAI_API_KEY' },
    { name: 'Anthropic', key: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
    { name: 'Google', key: 'google', envVar: 'GOOGLE_API_KEY' },
  ];

  for (const provider of providers) {
    const hasAuthFile = !!authData[provider.key];
    const hasEnvVar = !!process.env[provider.envVar];
    const isConfigured = hasAuthFile || hasEnvVar;

    console.log(`${provider.name}:`);

    if (isConfigured) {
      console.log(`   ✅ Configured`);

      if (hasAuthFile && authData[provider.key]) {
        const created = new Date(authData[provider.key]!.createdAt);
        console.log(`   📝 Source: auth.json`);
        console.log(`   📅 Added: ${created.toLocaleDateString()}`);

        const lastUsedTimestamp = authData[provider.key]!.lastUsed;
        if (lastUsedTimestamp) {
          const lastUsed = new Date(lastUsedTimestamp);
          console.log(`   🕐 Last used: ${lastUsed.toLocaleDateString()}`);
        }
      }

      if (hasEnvVar) {
        console.log(`   📝 Source: ${provider.envVar} environment variable`);
      }
    } else {
      console.log(`   ❌ Not configured`);
      console.log(`   💡 Run: echo "your-api-key" | pk login --with-api-key --provider=${provider.key}`);
    }

    console.log('');
  }

  // Legacy credential check
  console.log(`📦 Legacy Credentials (keytar/credentials.json):\n`);

  const { getCredential } = await import('@pk-code/core');

  for (const provider of providers) {
    const legacyCred = await getCredential(provider.key);
    if (legacyCred) {
      console.log(`   ⚠️  ${provider.name}: Found in legacy storage`);
      console.log(`      Consider migrating to auth.json: pk login --with-api-key --provider=${provider.key}`);
    }
  }

  console.log('\n💡 Tip: API keys in auth.json take precedence over environment variables\n');
}

/**
 * Handle auth logout (remove credentials)
 */
export async function handleAuthLogout(
  provider?: 'openai' | 'anthropic' | 'google',
): Promise<void> {
  console.log(`\n🔐 PK Code - Logout\n`);

  const authData = await readAuthData();

  if (provider) {
    // Logout specific provider
    if (authData[provider]) {
      delete authData[provider];
      await writeAuthData(authData);
      console.log(`✅ Logged out from ${provider.toUpperCase()}`);
    } else {
      console.log(`⚠️  Not logged in to ${provider.toUpperCase()}`);
    }
  } else {
    // Logout all providers
    if (Object.keys(authData).length === 0) {
      console.log(`⚠️  No active sessions to logout`);
    } else {
      await writeAuthData({});
      console.log(`✅ Logged out from all providers`);
      console.log(`   Removed ${AUTH_FILE}\n`);
    }
  }
}
