/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Config } from '../packages/core/src/config/config.js';
export declare class EmbeddingIndex {
    private documents;
    private indexPath;
    private metadataPath;
    private dimension;
    private contentGenerator;
    private config;
    constructor(config: Config, indexDir?: string);
    private getContentGenerator;
    private loadMetadata;
    private saveMetadata;
    private getEmbedding;
    private generateHash;
    addOrUpdateDocument(filePath: string, content: string): Promise<void>;
    buildIndex(rootPath: string): Promise<void>;
    private buildFAISSIndex;
    search(query: string, topK?: number): Promise<{
        filePath: string;
        content: string;
        score: number;
    }[]>;
    getIndexStats(): {
        documentCount: number;
        lastUpdated: number;
    };
}
