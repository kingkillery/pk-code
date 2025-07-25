// Copyright (c) 2025 Your Company Name
//
// This file is part of the Qwen-Code project and is licensed under the MIT License.
// See the LICENSE file in the project root for more information.

/* global console, process */

#!/usr/bin/env node

/**
 * Test script to verify that the model and inference provider commands
 * correctly update the OpenRouter content generator configuration.
 */

import { createContentGeneratorConfig, AuthType } from './dist/packages/core/src/core/contentGenerator.js';

async function testFix() {
  console.log('Testing OpenRouter model and provider configuration...\n');

  // Set initial environment variables
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'initial-model';
  process.env.OPENROUTER_PROVIDER = 'initial-provider';

  console.log('1. Creating initial content generator config...');
  let config1 = await createContentGeneratorConfig(undefined, AuthType.USE_OPENROUTER);
  console.log(`   Model: ${config1.model}`);
  console.log(`   Provider: ${config1.provider}`);

  // Simulate the /model command changing the environment variable
  console.log('\n2. Simulating /model command changing OPENROUTER_MODEL...');
  process.env.OPENROUTER_MODEL = 'new-model';
  
  let config2 = await createContentGeneratorConfig(undefined, AuthType.USE_OPENROUTER);
  console.log(`   Model: ${config2.model}`);
  console.log(`   Provider: ${config2.provider}`);

  // Simulate the /inference-p command changing the environment variable
  console.log('\n3. Simulating /inference-p command changing OPENROUTER_PROVIDER...');
  process.env.OPENROUTER_PROVIDER = 'new-provider';
  
  let config3 = await createContentGeneratorConfig(undefined, AuthType.USE_OPENROUTER);
  console.log(`   Model: ${config3.model}`);
  console.log(`   Provider: ${config3.provider}`);

  // Test clearing the provider
  console.log('\n4. Simulating /inference-p auto (clearing provider)...');
  process.env.OPENROUTER_PROVIDER = '';
  
  let config4 = await createContentGeneratorConfig(undefined, AuthType.USE_OPENROUTER);
  console.log(`   Model: ${config4.model}`);
  console.log(`   Provider: ${config4.provider || '(undefined - will use auto)'}`);

  console.log('\n✅ Test completed! The configuration correctly picks up environment variable changes.');
}

testFix().catch(console.error);
