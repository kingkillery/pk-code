/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Type } from '@google/genai';
import { BaseTool, ToolResult } from './tools.js';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { Config } from '../config/config.js';
import { getFolderStructure } from '../utils/getFolderStructure.js';

export interface ProjectAnalyzerParams {
  /** Optional absolute directory to analyze; defaults to config.getTargetDir() */
  absolute_dir?: string;
  /** Maximum number of items (files + folders) to include in structure output */
  max_items?: number;
  /** Optional regex string to include only files that match (applied to file names) */
  include_files_regex?: string;
  /** Whether to summarize dependencies from known manifest files */
  summarize_dependencies?: boolean;
}

/**
 * A tool that analyzes the current project to provide a concise architectural overview:
 * - Project type detection (Node/TS, Python, Go, etc.)
 * - Key manifests discovered
 * - High-level directory tree (bounded)
 * - Optional dependency summary
 */
export class ProjectAnalyzerTool extends BaseTool<ProjectAnalyzerParams, ToolResult> {
  static readonly Name = 'project_analyzer';

  constructor(private readonly config: Config) {
    super(
      ProjectAnalyzerTool.Name,
      'Project Analyzer',
      'Analyzes the project to summarize structure, detected technologies, and manifests with a bounded tree view.',
      {
        type: Type.OBJECT,
        properties: {
          absolute_dir: {
            type: Type.STRING,
            description:
              'Optional absolute path to the project root to analyze. Defaults to the configured target dir.',
          },
          max_items: {
            type: Type.NUMBER,
            description:
              'Optional cap on items (files + folders) shown in tree output. Defaults to 200.',
          },
          include_files_regex: {
            type: Type.STRING,
            description:
              'Optional regex (as a string) to include only files whose names match. Example: ".*\\.(ts|tsx)$"',
          },
          summarize_dependencies: {
            type: Type.BOOLEAN,
            description:
              'When true, summarizes dependencies from manifest files (e.g., package.json). Defaults to true.',
          },
        },
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  validateToolParams(params: ProjectAnalyzerParams): string | null {
    const errors = SchemaValidator.validate(this.schema.parameters, params ?? {});
    if (errors) return errors;

    if (params?.absolute_dir && !path.isAbsolute(params.absolute_dir)) {
      return `absolute_dir must be absolute, got: ${params.absolute_dir}`;
    }

    if (params?.max_items !== undefined && params.max_items <= 0) {
      return 'max_items must be a positive number when provided';
    }

    // Validate regex compiles when provided
    if (params?.include_files_regex) {
      try {
        new RegExp(params.include_files_regex);
      } catch (e) {
        return `include_files_regex is not a valid regex: ${String(e)}`;
      }
    }
    return null;
  }

  getDescription(params: ProjectAnalyzerParams): string {
    const root = params?.absolute_dir ?? this.config.getTargetDir();
    return `Analyze project at ${root}`;
  }

  async execute(params: ProjectAnalyzerParams, _signal: AbortSignal): Promise<ToolResult> {
    const validation = this.validateToolParams(params ?? {});
    if (validation) {
      return { llmContent: `Error: ${validation}`, returnDisplay: validation };
    }

    const root = params?.absolute_dir ?? this.config.getTargetDir();

    // Build folder structure (bounded) with .gitignore respected
    const fileService = this.config.getFileService();
    const includeRegex = params?.include_files_regex
      ? new RegExp(params.include_files_regex)
      : undefined;
    const structure = await getFolderStructure(root, {
      maxItems: params?.max_items,
      fileIncludePattern: includeRegex,
      fileService,
      respectGitIgnore: true,
    });

    // Detect project type & manifests
    const manifests: string[] = [];
    const detected: string[] = [];

    async function exists(p: string) {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    }

    // Node/TypeScript
    const pkgJsonPath = path.join(root, 'package.json');
    if (await exists(pkgJsonPath)) {
      manifests.push('package.json');
      detected.push('node');
      if (await exists(path.join(root, 'tsconfig.json'))) {
        detected.push('typescript');
        manifests.push('tsconfig.json');
      }
    }

    // Python
    if (await exists(path.join(root, 'pyproject.toml'))) {
      manifests.push('pyproject.toml');
      detected.push('python');
    } else if (await exists(path.join(root, 'requirements.txt'))) {
      manifests.push('requirements.txt');
      detected.push('python');
    }

    // Go
    if (await exists(path.join(root, 'go.mod'))) {
      manifests.push('go.mod');
      detected.push('go');
    }

    // Rust
    if (await exists(path.join(root, 'Cargo.toml'))) {
      manifests.push('Cargo.toml');
      detected.push('rust');
    }

    // Java/Gradle/Maven
    if (await exists(path.join(root, 'pom.xml'))) {
      manifests.push('pom.xml');
      detected.push('java');
    } else if (await exists(path.join(root, 'build.gradle'))) {
      manifests.push('build.gradle');
      detected.push('java');
    } else if (await exists(path.join(root, 'build.gradle.kts'))) {
      manifests.push('build.gradle.kts');
      detected.push('java');
    }

    // Optional dependency summary (currently for package.json)
    let dependencySummary = '';
    const shouldSummarize = params?.summarize_dependencies ?? true;
    if (shouldSummarize && (await exists(pkgJsonPath))) {
      try {
        const raw = await fs.readFile(pkgJsonPath, 'utf8');
        const pkg = JSON.parse(raw);
        const deps = Object.keys(pkg.dependencies ?? {});
        const dev = Object.keys(pkg.devDependencies ?? {});
        const peer = Object.keys(pkg.peerDependencies ?? {});
        const topDeps = deps.slice(0, 15).join(', ');
        dependencySummary = [
          'Dependencies:',
          deps.length ? `- runtime (${deps.length}): ${topDeps}${deps.length > 15 ? ' …' : ''}` : '- runtime: (none)',
          dev.length ? `- dev (${dev.length})` : '- dev: (none)',
          peer.length ? `- peer (${peer.length})` : '- peer: (none)',
        ].join('\n');
      } catch (e) {
        dependencySummary = `Failed to read dependencies from package.json: ${String(e)}`;
      }
    }

    const tech = Array.from(new Set(detected));

    const lines: string[] = [];
    lines.push(`# Project Analysis`);
    lines.push('');
    lines.push(`Root: ${root.replace(/\\\\/g, '/')}`);
    lines.push(`Detected Tech: ${tech.length ? tech.join(', ') : '(unknown)'}`);
    lines.push(`Manifests: ${manifests.length ? manifests.join(', ') : '(none found)'}`);
    lines.push('');
    if (dependencySummary) {
      lines.push(dependencySummary);
      lines.push('');
    }
    lines.push('## Structure (bounded)');
    lines.push('');
    lines.push('```');
    lines.push(structure);
    lines.push('```');

    const markdown = lines.join('\n');

    return {
      summary: 'Analyzed project and generated structure overview',
      llmContent: markdown,
      returnDisplay: markdown,
    };
  }
}
