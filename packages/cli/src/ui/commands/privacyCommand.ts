/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenDialogActionReturn, Command } from './types.js';

export const privacyCommand: Command = {
  name: 'privacy',
  description: 'display the privacy notice',
  action: (): OpenDialogActionReturn => ({
    type: 'dialog',
    dialog: 'privacy',
  }),
};
