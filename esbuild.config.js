/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

esbuild
  .build({
    entryPoints: ['packages/cli/index.ts'],
    bundle: true,
    outfile: 'bundle/pk.js',
    platform: 'node',
    format: 'esm',
    define: {
      'process.env.CLI_VERSION': JSON.stringify(pkg.version),
    },
    banner: {
      js: `import { createRequire as _gcliCreateRequire } from 'module'; const require = _gcliCreateRequire(import.meta.url); globalThis.__filename = require('url').fileURLToPath(import.meta.url); globalThis.__dirname = require('path').dirname(globalThis.__filename);`,
    },
    external: [
      'fast-uri',
      'highlight.js',
      'lowlight',
      'hast',
      '@types/hast',
      'keytar'
    ],
    plugins: [
      {
        name: 'exclude-highlight-languages',
        setup(build) {
          // Exclude all highlight.js language files
          build.onResolve({ filter: /^highlight\.js\/lib\/languages\// }, args => {
            return { path: args.path, external: true };
          });
          // Exclude highlight.js core
          build.onResolve({ filter: /^highlight\.js\/lib\/core$/ }, args => {
            return { path: args.path, external: true };
          });
        }
      }
    ],
  })
  .catch(() => process.exit(1));
