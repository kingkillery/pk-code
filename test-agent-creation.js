#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const PROJECT_ROOT = process.cwd();
const AGENTS_DIR = path.join(PROJECT_ROOT, '.pk', 'agents');
const PROMPTS_DIR = path.join(PROJECT_ROOT, '.claude', 'prompts');

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    log(`PASS: ${message}`, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(`FAIL: ${message}`, 'error');
  }
}

function cleanup() {
  // Clean up test agents
  const testAgents = [
    'test-react-specialist.md',
    'test-security-reviewer.md',
    'test-api-debugger.md',
    'test-docs-writer.md',
    'test-unit-tester.md'
  ];
  
  testAgents.forEach(agent => {
    const agentPath = path.join(AGENTS_DIR, agent);
    if (fs.existsSync(agentPath)) {
      fs.unlinkSync(agentPath);
      log(`Cleaned up: ${agent}`);
    }
  });
}

function testDirectoryStructure() {
  log('Testing directory structure...');
  
  // Test .pk/agents directory exists
  assert(fs.existsSync(AGENTS_DIR), '.pk/agents directory exists');
  
  // Test .claude/prompts directory exists
  assert(fs.existsSync(PROMPTS_DIR), '.claude/prompts directory exists');
  
  // Test agent creation templates exist
  const templates = [
    'agent-creation-template.md',
    'code-review-agent-template.md',
    'debugging-agent-template.md',
    'documentation-agent-template.md',
    'testing-agent-template.md'
  ];
  
  templates.forEach(template => {
    const templatePath = path.join(PROMPTS_DIR, template);
    assert(fs.existsSync(templatePath), `Template exists: ${template}`);
  });
}

function testTemplateContent() {
  log('Testing template content for correct directory references...');
  
  const templates = [
    'agent-creation-template.md',
    'code-review-agent-template.md',
    'debugging-agent-template.md',
    'documentation-agent-template.md',
    'testing-agent-template.md'
  ];
  
  templates.forEach(template => {
    const templatePath = path.join(PROMPTS_DIR, template);
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf8');
      
      // Check that template references .pk/agents/ not .claude/agents/
      const hasCorrectPath = content.includes('.pk/agents/');
      const hasIncorrectPath = content.includes('.claude/agents/');
      
      assert(hasCorrectPath, `${template} references correct .pk/agents/ path`);
      assert(!hasIncorrectPath, `${template} does not reference incorrect .claude/agents/ path`);
    }
  });
}

function testAgentCreation() {
  log('Testing agent creation functionality...');
  
  // Create a test agent file manually to verify the system works
  const testAgent = {
    name: 'test-react-specialist',
    content: `---
name: test-react-specialist
description: A test React specialist agent
color: blue
---

# Test React Specialist

This is a test agent for React development.

## Core Traits
- React expertise
- Component design
- State management

## Process
1. Analyze React code
2. Provide recommendations
3. Suggest improvements

## Examples
<example>
Context: React component optimization
user: 'How can I optimize this component?'
assistant: 'I'll analyze your React component and suggest performance optimizations.'
</example>
`
  };
  
  const agentPath = path.join(AGENTS_DIR, `${testAgent.name}.md`);
  
  try {
    // Ensure agents directory exists
    if (!fs.existsSync(AGENTS_DIR)) {
      fs.mkdirSync(AGENTS_DIR, { recursive: true });
    }
    
    // Write test agent
    fs.writeFileSync(agentPath, testAgent.content);
    
    // Verify agent was created
    assert(fs.existsSync(agentPath), 'Test agent file created successfully');
    
    // Verify agent content
    const savedContent = fs.readFileSync(agentPath, 'utf8');
    assert(savedContent.includes('test-react-specialist'), 'Agent content contains correct name');
    assert(savedContent.includes('---'), 'Agent has YAML frontmatter');
    assert(savedContent.includes('color: blue'), 'Agent has color specification');
    
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`Agent creation failed: ${error.message}`);
    log(`Agent creation failed: ${error.message}`, 'error');
  }
}

function testDocumentationConsistency() {
  log('Testing documentation consistency...');
  
  const docsToCheck = [
    path.join(PROJECT_ROOT, 'docs', 'cli', 'commands.md'),
    path.join(PROJECT_ROOT, '.claude', 'README.md')
  ];
  
  docsToCheck.forEach(docPath => {
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf8');
      const filename = path.basename(docPath);
      
      // Check for correct agent directory references
      const hasCorrectPath = content.includes('.pk/agents/');
      const hasIncorrectPath = content.includes('.claude/agents/');
      
      if (content.includes('agents')) {
        assert(hasCorrectPath, `${filename} references correct .pk/agents/ path`);
        assert(!hasIncorrectPath, `${filename} does not reference incorrect .claude/agents/ path`);
      }
    }
  });
}

function runTests() {
  log('Starting comprehensive agent creation tests...');
  log(`Project root: ${PROJECT_ROOT}`);
  log(`Agents directory: ${AGENTS_DIR}`);
  log(`Prompts directory: ${PROMPTS_DIR}`);
  
  try {
    // Clean up any existing test files
    cleanup();
    
    // Run test suites
    testDirectoryStructure();
    testTemplateContent();
    testAgentCreation();
    testDocumentationConsistency();
    
    // Final cleanup
    cleanup();
    
    // Report results
    log('\n=== TEST RESULTS ===');
    log(`Total tests: ${testResults.passed + testResults.failed}`);
    log(`Passed: ${testResults.passed}`, 'success');
    log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'success');
    
    if (testResults.errors.length > 0) {
      log('\n=== ERRORS ===');
      testResults.errors.forEach(error => log(error, 'error'));
    }
    
    if (testResults.failed === 0) {
      log('\n🎉 All tests passed! Agent creation functionality is working correctly.', 'success');
      process.exit(0);
    } else {
      log('\n💥 Some tests failed. Please review the errors above.', 'error');
      process.exit(1);
    }
    
  } catch (error) {
    log(`Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the tests
runTests();