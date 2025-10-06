/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { getCredential } from '../credentials.js';

const PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'ANTHROPIC_API_KEY',
  'QWEN_API_KEY',
  'OPENROUTER_API_KEY',
  'COHERE_API_KEY',
  'TOGETHER_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'PK_API_KEY',
];

const KNOWN_PROVIDERS = [
  'openai',
  'google',
  'anthropic',
  'qwen',
  'openrouter',
  'cohere',
  'together',
  'azure',
  'pk',
];

const USER_SETTINGS_PATH = path.join(os.homedir(), '.pk', 'settings.json');

type ConfigDoctorStatus = 'ok' | 'warning' | 'error';

export interface ConfigDoctorResult {
  readonly id: string;
  readonly title: string;
  readonly status: ConfigDoctorStatus;
  readonly message?: string;
  readonly suggestion?: string;
}

export interface ConfigDoctorCheck {
  readonly id: string;
  readonly title: string;
  readonly run: () => Promise<ConfigDoctorResult>;
}

export function getDoctorChecks(): ConfigDoctorCheck[] {
  return [
    {
      id: 'provider-credentials',
      title: 'Provider credentials',
      run: checkProviderCredentials,
    },
    {
      id: 'settings-file',
      title: 'User settings file',
      run: checkSettingsFile,
    },
    {
      id: 'sandbox-environment',
      title: 'Sandbox environment configuration',
      run: checkSandboxEnvironment,
    },
    {
      id: 'env-files',
      title: 'Environment file precedence',
      run: checkEnvironmentFiles,
    },
  ];
}

export async function runDoctorChecks(
  checks: ConfigDoctorCheck[],
): Promise<ConfigDoctorResult[]> {
  const results: ConfigDoctorResult[] = [];
  for (const check of checks) {
    try {
      const result = await check.run();
      results.push({ ...result, id: check.id, title: check.title });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        id: check.id,
        title: check.title,
        status: 'error',
        message,
      });
    }
  }
  return results;
}

async function checkProviderCredentials(): Promise<ConfigDoctorResult> {
  const envKeysPresent = PROVIDER_ENV_KEYS.filter((key) =>
    Boolean(process.env[key]),
  );

  if (envKeysPresent.length > 0) {
    return {
      id: 'provider-credentials',
      title: 'Provider credentials',
      status: 'ok',
      message: `Detected credentials via environment variable(s): ${envKeysPresent.join(', ')}`,
    };
  }

  for (const provider of KNOWN_PROVIDERS) {
    const credential = await getCredential(provider);
    if (credential) {
      return {
        id: 'provider-credentials',
        title: 'Provider credentials',
        status: 'ok',
        message: `Detected stored credential for provider "${provider}"`,
      };
    }
  }

  return {
    id: 'provider-credentials',
    title: 'Provider credentials',
    status: 'error',
    message:
      'No provider credentials were detected in the environment or credential store.',
    suggestion:
      'Set an API key via environment variable (e.g. OPENAI_API_KEY) or run "pk config add <provider> <api-key>".',
  };
}

async function checkSettingsFile(): Promise<ConfigDoctorResult> {
  try {
    const content = await fs.readFile(USER_SETTINGS_PATH, 'utf-8');
    JSON.parse(content);
    return {
      id: 'settings-file',
      title: 'User settings file',
      status: 'ok',
      message: `Loaded settings from ${USER_SETTINGS_PATH}`,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        id: 'settings-file',
        title: 'User settings file',
        status: 'warning',
        message: `No settings file found at ${USER_SETTINGS_PATH}.`,
        suggestion:
          'Run pk once to generate a baseline settings file or create ~/.pk/settings.json manually.',
      };
    }
    return {
      id: 'settings-file',
      title: 'User settings file',
      status: 'error',
      message: `Unable to parse settings file at ${USER_SETTINGS_PATH}: ${(error as Error).message}`,
      suggestion:
        'Fix the JSON syntax or delete the file to regenerate defaults.',
    };
  }
}

async function checkSandboxEnvironment(): Promise<ConfigDoctorResult> {
  const sandboxValue = process.env.PK_SANDBOX;

  if (!sandboxValue || sandboxValue.trim().length === 0) {
    return {
      id: 'sandbox-environment',
      title: 'Sandbox environment configuration',
      status: 'ok',
      message:
        'PK_SANDBOX is not set; default sandboxing behaviour will apply.',
    };
  }

  const normalized = sandboxValue.trim().toLowerCase();
  const allowedValues = ['false', 'none', 'docker', 'podman'];

  if (allowedValues.includes(normalized)) {
    return {
      id: 'sandbox-environment',
      title: 'Sandbox environment configuration',
      status: 'ok',
      message: `PK_SANDBOX is set to "${sandboxValue}"`,
    };
  }

  return {
    id: 'sandbox-environment',
    title: 'Sandbox environment configuration',
    status: 'warning',
    message: `PK_SANDBOX has unexpected value "${sandboxValue}"`,
    suggestion:
      'Use one of: false, none, docker, podman. Clear the variable to use the default behaviour.',
  };
}

async function checkEnvironmentFiles(): Promise<ConfigDoctorResult> {
  const workspaceEnv = path.join(process.cwd(), '.env');
  const userEnv = path.join(os.homedir(), '.pk', '.env');

  const workspaceExists = await pathExists(workspaceEnv);
  const userExists = await pathExists(userEnv);

  if (workspaceExists && userExists) {
    return {
      id: 'env-files',
      title: 'Environment file precedence',
      status: 'warning',
      message:
        'Both workspace .env and ~/.pk/.env exist. Workspace .env takes precedence when running within this directory.',
      suggestion:
        'Ensure the env files are kept in sync or remove one of them to avoid confusion.',
    };
  }

  if (workspaceExists || userExists) {
    const location = workspaceExists ? workspaceEnv : userEnv;
    return {
      id: 'env-files',
      title: 'Environment file precedence',
      status: 'ok',
      message: `Detected environment file at ${location}`,
    };
  }

  return {
    id: 'env-files',
    title: 'Environment file precedence',
    status: 'warning',
    message: 'No .env files detected for this workspace or user profile.',
    suggestion:
      'Create an .env file to record provider keys or rely on pk config add to store credentials securely.',
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
