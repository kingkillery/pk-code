/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { AgentRegistry } from '../../src/agents/agent-registry';
import path from 'path';
import fs from 'fs/promises';

const TEST_PROJECT_ROOT = './test-project';
const AGENTS_DIR = path.join(TEST_PROJECT_ROOT, '.pk/agents');

describe('AgentRegistry Hot-Reloading', () => {
  let registry: AgentRegistry;

  beforeAll(async () => {
    // Create test project directory
    await fs.mkdir(AGENTS_DIR, { recursive: true });

    // Initial agent file
    const agent1Content = `
---
name: 'Agent 1'
description: 'Initial version'
keywords: ['test']
tools: ['test-tool']
model: 'test-model'
provider: 'test-provider'
examples: []
---

# Agent 1 Body
`;
    await fs.writeFile(path.join(AGENTS_DIR, 'agent1.md'), agent1Content);

    registry = new AgentRegistry(TEST_PROJECT_ROOT);
    await registry.initialize();
  });

  afterAll(async () => {
    registry.dispose();
    await fs.rm(TEST_PROJECT_ROOT, { recursive: true, force: true });
  });

  test('should load initial agents', () => {
    expect(registry.size()).toBe(1);
    expect(registry.getAgent('Agent 1')).toBeDefined();
  });

  test('should detect new agent files', async () => {
    const agent2Content = `
---
name: 'Agent 2'
description: 'A new agent'
keywords: ['new']
tools: ['test-tool']
model: 'test-model'
provider: 'test-provider'
examples: []
---

# Agent 2 Body
`;
    await fs.writeFile(path.join(AGENTS_DIR, 'agent2.md'), agent2Content);

    // Wait for watcher to trigger
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(registry.size()).toBe(2);
    expect(registry.getAgent('Agent 2')).toBeDefined();
  });

  test('should detect modified agent files', async () => {
    const updatedAgent1Content = `
---
name: 'Agent 1'
description: 'Updated version'
keywords: ['test', 'updated']
tools: ['test-tool']
model: 'test-model'
provider: 'test-provider'
examples: []
---

# Agent 1 Body Updated
`;
    await fs.writeFile(
      path.join(AGENTS_DIR, 'agent1.md'),
      updatedAgent1Content,
    );

    // Wait for watcher to trigger
    await new Promise((resolve) => setTimeout(resolve, 500));

    const agent1 = registry.getAgent('Agent 1');
    expect(agent1?.config.description).toBe('Updated version');
    expect(agent1?.config.keywords).toContain('updated');
  });

  test('should detect deleted agent files', async () => {
    await fs.unlink(path.join(AGENTS_DIR, 'agent2.md'));

    // Wait for watcher to trigger
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(registry.size()).toBe(1);
    expect(registry.getAgent('Agent 2')).toBeUndefined();
  });
});
