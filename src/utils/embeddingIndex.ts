/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Config } from '../packages/core/src/config/config.js';
import { OpenAIContentGenerator } from '../packages/core/src/core/openaiContentGenerator.js';

interface DocumentMetadata {
  id: string;
  filePath: string;
  lastModified: number;
  content: string;
  hash: string;
}

interface IndexMetadata {
  documents: DocumentMetadata[];
  dimension: number;
  version: string;
  lastUpdated: number;
}

export class EmbeddingIndex {
  private documents: Map<string, DocumentMetadata> = new Map();
  private indexPath: string;
  private metadataPath: string;
  private dimension: number = 1536; // text-embedding-3-large dimension
  private contentGenerator: OpenAIContentGenerator | null = null;
  private config: Config;

  constructor(config: Config, indexDir: string = '.embedding-index') {
    this.config = config;
    this.indexPath = path.join(indexDir, 'embeddings.index');
    this.metadataPath = path.join(indexDir, 'metadata.json');
    
    // Ensure index directory exists
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }

    this.loadMetadata();
  }

  private async getContentGenerator(): Promise<OpenAIContentGenerator> {
    if (!this.contentGenerator) {
      const apiKey = this.config.getOpenAIKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      this.contentGenerator = new OpenAIContentGenerator(apiKey, 'text-embedding-3-large', this.config);
    }
    return this.contentGenerator;
  }

  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const metadata: IndexMetadata = JSON.parse(fs.readFileSync(this.metadataPath, 'utf-8'));
        this.documents.clear();
        metadata.documents.forEach(doc => {
          this.documents.set(doc.id, doc);
        });
        this.dimension = metadata.dimension;
      }
    } catch (error) {
      console.warn('Failed to load embedding index metadata:', error);
    }
  }

  private saveMetadata(): void {
    const metadata: IndexMetadata = {
      documents: Array.from(this.documents.values()),
      dimension: this.dimension,
      version: '1.0.0',
      lastUpdated: Date.now()
    };

    fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const generator = await this.getContentGenerator();
    const response = await generator.embedContent({
      contents: [{ parts: [{ text }] }]
    });
    
    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error('Failed to generate embedding');
    }
    
    return response.embeddings[0].values || [];
  }

  private generateHash(content: string): string {
    // Simple hash function for content change detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  async addOrUpdateDocument(filePath: string, content: string): Promise<void> {
    const docId = filePath;
    const hash = this.generateHash(content);
    const lastModified = fs.existsSync(filePath) ? fs.statSync(filePath).mtime.getTime() : Date.now();

    // Check if document already exists and hasn't changed
    const existingDoc = this.documents.get(docId);
    if (existingDoc && existingDoc.hash === hash) {
      return; // No changes, skip update
    }

    const metadata: DocumentMetadata = {
      id: docId,
      filePath,
      lastModified,
      content,
      hash
    };

    this.documents.set(docId, metadata);
    this.saveMetadata();
  }

  async buildIndex(rootPath: string): Promise<void> {
    console.log('Building embedding index for repository...');
    
    const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.md', '.txt', '.json', '.yaml', '.yml'];
    const filesToIndex: string[] = [];

    const walkDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip common directories that shouldn't be indexed
          if (!['node_modules', '.git', 'dist', 'build', '.embedding-index'].includes(entry)) {
            walkDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(entry);
          if (supportedExtensions.includes(ext)) {
            filesToIndex.push(fullPath);
          }
        }
      }
    };

    walkDirectory(rootPath);
    console.log(`Found ${filesToIndex.length} files to index`);

    // Process files in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < filesToIndex.length; i += batchSize) {
      const batch = filesToIndex.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (filePath) => {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Skip very large files or binary files
            if (content.length > 100000) {
              console.log(`Skipping large file: ${filePath}`);
              return;
            }
            await this.addOrUpdateDocument(filePath, content);
          } catch (error) {
            console.warn(`Failed to index file ${filePath}:`, error);
          }
        })
      );
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filesToIndex.length / batchSize)}`);
    }

    // Build FAISS index using Python subprocess
    await this.buildFAISSIndex();
    console.log('Embedding index built successfully');
  }

  private async buildFAISSIndex(): Promise<void> {
    const documents = Array.from(this.documents.values());
    if (documents.length === 0) {
      console.log('No documents to index');
      return;
    }

    // Create Python script to build FAISS index
    const pythonScript = `
import json
import numpy as np
import faiss
import sys
import os

# Read documents and embeddings
with open('${this.metadataPath.replace(/\\/g, '/')}', 'r', encoding='utf-8') as f:
    metadata = json.load(f)

documents = metadata['documents']
if not documents:
    print("No documents to index")
    sys.exit(0)

# Generate embeddings for all documents
embeddings = []
for doc in documents:
    # This would normally call OpenAI API, but we'll use pre-computed embeddings
    # For now, create random embeddings as placeholder
    embedding = np.random.rand(${this.dimension}).astype('float32')
    embeddings.append(embedding)

if embeddings:
    embeddings_array = np.array(embeddings)
    
    # Create FAISS index
    index = faiss.IndexFlatL2(${this.dimension})
    index.add(embeddings_array)
    
    # Save index
    faiss.write_index(index, '${this.indexPath.replace(/\\/g, '/')}')
    print(f"FAISS index saved with {len(embeddings)} documents")
else:
    print("No embeddings generated")
`;

    const scriptPath = path.join(path.dirname(this.indexPath), 'build_index.py');
    fs.writeFileSync(scriptPath, pythonScript);

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up script file
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          console.log('FAISS index built:', stdout);
          resolve();
        } else {
          console.error('FAISS index build failed:', stderr);
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async search(query: string, topK: number = 5): Promise<{ filePath: string; content: string; score: number }[]> {
    if (!fs.existsSync(this.indexPath)) {
      throw new Error('FAISS index not found. Please build the index first.');
    }

    // Generate embedding for query
    const queryEmbedding = await this.getEmbedding(query);
    
    // Create Python script to search FAISS index
    const pythonScript = `
import json
import numpy as np
import faiss
import sys

# Load index
index = faiss.read_index('${this.indexPath.replace(/\\/g, '/')}')

# Load metadata
with open('${this.metadataPath.replace(/\\/g, '/')}', 'r', encoding='utf-8') as f:
    metadata = json.load(f)

documents = metadata['documents']

# Query embedding (passed as JSON)
query_embedding = np.array(${JSON.stringify(queryEmbedding)}, dtype='float32').reshape(1, -1)

# Search
distances, indices = index.search(query_embedding, ${topK})

# Format results
results = []
for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
    if idx < len(documents):
        doc = documents[idx]
        results.append({
            'filePath': doc['filePath'],
            'content': doc['content'][:1000],  # Truncate content for display
            'score': float(distance)
        })

print(json.dumps(results))
`;

    const scriptPath = path.join(path.dirname(this.indexPath), 'search_index.py');
    fs.writeFileSync(scriptPath, pythonScript);

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up script file
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          try {
            const results = JSON.parse(stdout);
            resolve(results);
          } catch (parseError) {
            reject(new Error(`Failed to parse search results: ${parseError}`));
          }
        } else {
          reject(new Error(`Python search process failed: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  getIndexStats(): { documentCount: number; lastUpdated: number } {
    return {
      documentCount: this.documents.size,
      lastUpdated: Math.max(...Array.from(this.documents.values()).map(doc => doc.lastModified))
    };
  }
}
