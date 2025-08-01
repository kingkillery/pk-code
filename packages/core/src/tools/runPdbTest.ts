/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import { BaseTool, ToolResult } from './tools.js';
import { Type } from '@google/genai';
import path from 'path';
import { Config } from '../config/config.js';

export interface RunPdbTestParams {
  testPath: string;
}

export class RunPdbTestTool extends BaseTool<RunPdbTestParams, ToolResult> {
  static Name: string = 'run_pdb_test';

  constructor(private readonly config: Config) {
    super(
      RunPdbTestTool.Name,
      'Run PDB Test',
      `Runs Python's PDB on a given test path and captures stack trace and local variables.\n\nThis tool executes a test file using Python's PDB debugger to capture detailed debugging information including:\n- Stack trace showing the call hierarchy\n- Local variables at each frame\n- Error context and location\n\nUse this tool when you need to investigate test failures or understand runtime behavior.`,
      {
        type: Type.OBJECT,
        properties: {
          testPath: {
            type: Type.STRING,
            description: 'Path to the test file to run with PDB (relative to project root)',
          },
        },
        required: ['testPath'],
      },
      false, // output is not markdown
      false, // output cannot be updated
    );
  }

  async execute({ testPath }: RunPdbTestParams): Promise<ToolResult> {
    const fullPath = path.resolve(testPath);
    
    return new Promise<ToolResult>((resolve) => {
      // Use pytest with PDB for better test debugging
      const child = spawn('python', ['-m', 'pytest', '--pdb', '-s', fullPath], {
        cwd: process.cwd(),
        stdio: 'pipe',
        timeout: 30000, // 30 second timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        // Extract stack and locals from output
        const debugInfo = this.parsePdbOutput(stdout, stderr);

        const result = {
          llmContent: `Test Path: ${testPath}\nExit Code: ${code}\n\n${debugInfo.summary}\n\nStack Trace:\n${debugInfo.stackTrace}\n\nLocal Variables:\n${debugInfo.locals}`,
          returnDisplay: `PDB Test Results for ${testPath}:\n${debugInfo.summary}`,
        };

        resolve(result);
      });

      child.on('error', (error) => {
        resolve({
          llmContent: `Failed to run PDB test on ${testPath}: ${error.message}`,
          returnDisplay: `PDB test failed: ${error.message}`,
        });
      });

      // Send some basic PDB commands to get stack and locals
      child.stdin?.write('l\n'); // list current line
      child.stdin?.write('w\n'); // where (stack trace)
      child.stdin?.write('ll\n'); // long list
      child.stdin?.write('pp locals()\n'); // pretty print locals
      child.stdin?.write('c\n'); // continue
      child.stdin?.end();
    });
  }

  private parsePdbOutput(stdout: string, stderr: string): {
    summary: string;
    stackTrace: string;
    locals: string;
  } {
    // Parse PDB output to extract meaningful debugging information
    const lines = (stdout + stderr).split('\n');
    let stackTrace = '';
    let locals = '';
    let summary = 'PDB session completed';

    let inStackTrace = false;
    let inLocals = false;

    for (const line of lines) {
      // Look for test failures or errors
      if (line.includes('FAILED') || line.includes('ERROR') || line.includes('AssertionError')) {
        summary = `Test failure detected: ${line.trim()}`;
      }
      
      // Extract stack traces (lines starting with '>' or containing file paths)
      if (line.includes('->') || line.match(/^\s*File "/)) {
        stackTrace += line + '\n';
        inStackTrace = true;
      } else if (inStackTrace && line.trim() === '') {
        inStackTrace = false;
      } else if (inStackTrace) {
        stackTrace += line + '\n';
      }

      // Extract local variables (lines after 'locals()' command)
      if (line.includes('(Pdb) pp locals()') || inLocals) {
        if (line.includes('(Pdb) pp locals()')) {
          inLocals = true;
          continue;
        }
        if (line.startsWith('(Pdb)') && inLocals) {
          inLocals = false;
        } else if (inLocals) {
          locals += line + '\n';
        }
      }
    }

    return {
      summary: summary || 'No specific issues detected',
      stackTrace: stackTrace || 'No stack trace captured',
      locals: locals || 'No local variables captured',
    };
  }
}
