/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SubagentAttachment,
  SubagentExecutionOptions,
} from './types.js';

/**
 * User preferences for subagent execution.
 */
export interface SubagentPreferences {
  /** Preferred default subagent name */
  defaultAgent?: string;
  /** Execution defaults applied to every subagent invocation */
  defaultOptions?: SubagentExecutionOptions;
  /** Per-subagent execution overrides */
  agentOverrides?: Record<string, SubagentExecutionOptions>;
}

/**
 * Resolve effective execution options for a given subagent name.
 * Default options are merged with any per-agent overrides.
 */
export function resolveSubagentOptions(
  preferences: SubagentPreferences | undefined,
  agentName?: string,
): SubagentExecutionOptions | undefined {
  if (!preferences) {
    return undefined;
  }

  const merged: SubagentExecutionOptions = {};
  let hasValues = false;

  const applyOptions = (options: SubagentExecutionOptions | undefined) => {
    if (!options) {
      return;
    }

    const entries = Object.entries(options) as Array<[
      keyof SubagentExecutionOptions,
      SubagentExecutionOptions[keyof SubagentExecutionOptions],
    ]>;

    for (const [key, value] of entries) {
      if (value === undefined) {
        continue;
      }

      switch (key) {
        case 'tools':
          if (Array.isArray(value)) {
            const tools = value.filter(
              (tool): tool is string => typeof tool === 'string',
            );
            if (tools.length > 0) {
              merged.tools = [...tools];
              hasValues = true;
            }
          }
          break;
        case 'attachments':
          if (Array.isArray(value)) {
            const attachments = value.filter(
              (attachment): attachment is SubagentAttachment =>
                typeof attachment === 'object' &&
                attachment !== null &&
                'path' in attachment &&
                typeof (attachment as { path?: unknown }).path === 'string',
            );
            if (attachments.length > 0) {
              merged.attachments = attachments.map((attachment) => ({
                ...attachment,
              }));
              hasValues = true;
            }
          }
          break;
        default:
          (merged as Record<string, unknown>)[key] = value;
          hasValues = true;
      }
    }
  };

  applyOptions(preferences.defaultOptions);

  if (agentName && preferences.agentOverrides?.[agentName]) {
    applyOptions(preferences.agentOverrides[agentName]);
  }

  return hasValues ? merged : undefined;
}
