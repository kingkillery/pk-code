/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunPdbTestTool } from './runPdbTest.js';
import { Config } from '../config/config.js';

describe('RunPdbTestTool', () => {
  let tool: RunPdbTestTool;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {} as Config;
    tool = new RunPdbTestTool(mockConfig);
  });

  describe('constructor', () => {
    it('should create tool with correct name and description', () => {
      expect(tool.name).toBe('run_pdb_test');
      expect(tool.description).toContain('PDB');
      expect(tool.description).toContain('stack trace');
      expect(tool.description).toContain('local variables');
    });

    it('should have correct schema', () => {
      const schema = tool.schema;
      expect(schema.name).toBe('run_pdb_test');
      expect(schema.parameters?.properties).toHaveProperty('testPath');
      expect(schema.parameters?.required).toContain('testPath');
    });
  });

  describe('parsePdbOutput', () => {
    it('should parse stack trace from PDB output', () => {
      const stdout = `
> /path/to/test.py(10)test_function()
-> assert False
(Pdb) w
  /path/to/test.py(5)<module>()
-> test_function()
  /path/to/test.py(10)test_function()
-> assert False
(Pdb) pp locals()
{'x': 42, 'y': 'test'}
(Pdb) c
      `;

      const result = (tool as any).parsePdbOutput(stdout, '');
      
      expect(result.stackTrace).toContain('/path/to/test.py');
      expect(result.stackTrace).toContain('assert False');
      expect(result.locals).toContain('x');
      expect(result.locals).toContain('42');
    });

    it('should detect test failures', () => {
      const stderr = 'FAILED test_something.py::test_function - AssertionError';
      
      const result = (tool as any).parsePdbOutput('', stderr);
      
      expect(result.summary).toContain('Test failure detected');
      expect(result.summary).toContain('AssertionError');
    });

    it('should handle empty output gracefully', () => {
      const result = (tool as any).parsePdbOutput('', '');
      
      expect(result.summary).toBe('No specific issues detected');
      expect(result.stackTrace).toBe('No stack trace captured');
      expect(result.locals).toBe('No local variables captured');
    });
  });

  describe('execute', () => {
    it('should handle execution errors gracefully', async () => {
      const result = await tool.execute({ testPath: 'nonexistent.py' });
      
      expect(result.llmContent).toBeDefined();
      expect(result.returnDisplay).toBeDefined();
    });
  });
});
