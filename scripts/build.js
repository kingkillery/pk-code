/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// npm install if node_modules was removed (e.g. via npm run clean or scripts/clean.js)
if (!existsSync(join(root, 'node_modules'))) {
  execSync('npm install', { stdio: 'inherit', cwd: root });
}

// build all workspaces/packages, excluding vscode-ide-companion by default
execSync('npm run generate', { stdio: 'inherit', cwd: root });
const workspaceEnv = {
  ...process.env,
  npm_config_include_workspace_root: 'false',
};

if (process.env.BUILD_ALL === '1') {
  execSync('npm run build --workspaces --if-present', {
    stdio: 'inherit',
    cwd: root,
    env: workspaceEnv,
  });
} else {
  const workspaces = [
    '@pk-code/core',
    '@pk-code/pk-code',
    '@pk-code/tool-registry-api',
    '@pk-code/openrouter',
    '@pk-code/openai',
    '@pk-code/gemini',
    '@pk-code/anthropic',
    '@pk-code/cohere',
  ];

  for (const workspace of workspaces) {
    execSync(`npm run --workspace=${workspace} --if-present build`, {
      stdio: 'inherit',
      cwd: root,
      env: workspaceEnv,
    });
  }
}

// also build container image if sandboxing is enabled
// skip (-s) npm install + build since we did that above
try {
  execSync('node scripts/sandbox_command.js -q', {
    stdio: 'inherit',
    cwd: root,
  });
  if (
    process.env.BUILD_SANDBOX === '1' ||
    process.env.BUILD_SANDBOX === 'true'
  ) {
    execSync('node scripts/build_sandbox.js -s', {
      stdio: 'inherit',
      cwd: root,
    });
  }
} catch {
  // ignore
}
