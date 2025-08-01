#!/usr/bin/env node --no-deprecation

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Suppress deprecation warnings early in the process
// Note: Use --no-deprecation flag when starting Node.js for full suppression

import { main } from './gemini.js';

// Export command functions for use by other packages
export {
  handleGenerateCommand,
  handleConfigCommand,
} from './commands/index.js';

export { handleCreateAgentCommandCLI } from './commands/create-agent-cli.js';

// --- Global Entry Point ---
main().catch((error) => {
  console.error('An unexpected critical error occurred:');
  if (error instanceof Error) {
    console.error(error.stack);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
