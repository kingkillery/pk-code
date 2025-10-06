/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSandboxStatus } from '@pk-code/core';

function formatMode(mode: string): string {
  switch (mode) {
    case 'disabled':
      return 'Disabled';
    case 'seatbelt':
      return 'macOS seatbelt';
    case 'docker':
      return 'Docker container';
    case 'podman':
      return 'Podman container';
    case 'custom':
      return 'Custom command';
    default:
      return mode;
  }
}

export async function handleSandboxCommand(action?: string): Promise<void> {
  const subcommand = action ?? 'status';

  if (subcommand !== 'status') {
    console.error(`Unknown sandbox action: ${subcommand}`);
    console.error('Supported actions: status');
    process.exitCode = 1;
    return;
  }

  const status = getSandboxStatus();

  console.log('Sandbox Status');
  console.log('--------------');
  console.log(`Mode: ${formatMode(status.mode)}`);
  if (status.command) {
    console.log(`Command: ${status.command}`);
  }
  if (status.seatbeltProfile) {
    console.log(`Seatbelt profile: ${status.seatbeltProfile}`);
  }

  console.log('\nWritable roots:');
  if (status.writableRoots.length === 0) {
    console.log('  (none detected)');
  } else {
    for (const root of status.writableRoots) {
      console.log(`  - ${root}`);
    }
  }

  console.log(`\nNetwork: ${status.network}`);

  if (status.notes.length > 0) {
    console.log('\nNotes:');
    for (const note of status.notes) {
      console.log(`  - ${note}`);
    }
  }
}
