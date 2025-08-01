/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../packages/core/dist/config/config.js';
import { EmbeddingIndex } from '../packages/core/dist/utils/embeddingIndex.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildEmbeddingIndex() {
  try {
    console.log('Starting embedding index build...');
    
    // Initialize config with required parameters
    const config = new Config({
      sessionId: 'embedding-index-build-' + Date.now(),
      targetDir: process.cwd(),
      debugMode: false,
      cwd: process.cwd(),
      model: 'text-embedding-3-large'
    });
    
    // Check if Gemini API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Error: Gemini API key not configured. Please set your Gemini API key using:');
      console.error('export GEMINI_API_KEY=your_api_key_here');
      console.error('or configure it through the CLI configuration.');
      process.exit(1);
    }
    
    // Initialize embedding index
    const indexDir = path.join(process.cwd(), '.embedding-index');
    const embeddingIndex = new EmbeddingIndex(config, indexDir);
    
    // Build index for the current repository
    const rootPath = process.cwd();
    console.log(`Building index for repository: ${rootPath}`);
    
    await embeddingIndex.buildIndex(rootPath);
    
    // Show index statistics
    const stats = embeddingIndex.getIndexStats();
    console.log('\n=== Index Build Complete ===');
    console.log(`Documents indexed: ${stats.documentCount}`);
    console.log(`Index directory: ${indexDir}`);
    console.log(`Last updated: ${new Date(stats.lastUpdated).toISOString()}`);
    
    console.log('\nYou can now use the search_index tool to search your repository!');
    console.log('Example: search_index("authentication logic")');
    
  } catch (error) {
    console.error('Error building embedding index:', error);
    process.exit(1);
  }
}

// Run the build process
buildEmbeddingIndex();
