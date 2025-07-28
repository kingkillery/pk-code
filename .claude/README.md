# Qwen-Code Claude Engineering Mode

## Overview

This is the default engineering mode for the Qwen-Code codebase. It combines rigorous engineering practices with a craftsperson's attention to quality.

## Core Files

1. **engineering-agent-prompt.md** - Main system prompt
2. **quick-reference.md** - At-a-glance reminders
3. **self-discovery-mode.md** - Complex problem-solving framework
4. **commit-template.md** - Standardized commit message format
5. **code-agent-prompting-schema.md** - Schema documentation for code agent best practices

## Agent System

### Existing Agents

The `agents/` directory contains specialized AI agents for different development tasks:

- **qwen-code-engineer.md** - Primary engineering agent for the Qwen-Code codebase
- **Additional agents** - Created as needed for specific project requirements

### Agent Creation Templates

The `prompts/` directory contains templates for creating new agents:

- **agent-creation-template.md** - General-purpose agent creation guide
- **code-review-agent-template.md** - Template for code review specialists
- **debugging-agent-template.md** - Template for debugging specialists
- **documentation-agent-template.md** - Template for documentation specialists
- **testing-agent-template.md** - Template for testing specialists

### Creating New Agents

Use the PK CLI with interactive prompts to create new agents:

```bash
# Basic agent creation
pk -p "Help me create a new AI agent for [your specific need]. Use the agent creation template and save to .pk/agents/[agent-name].md"

# Using specialized templates
pk -p "Using the debugging agent template, create a React debugging specialist that focuses on hooks, state management, and performance issues."
```

## Usage Instructions

### For Claude Code CLI

```bash
# Set as default for this project
claude-code --set-prompt .claude/engineering-agent-prompt.md

# Use for specific task
claude-code --prompt .claude/engineering-agent-prompt.md "implement feature X"
```

### Key Principles

1. **Zero bugs before new features** - Quality is non-negotiable
2. **Tenacious problem-solving** - Persist intelligently through challenges
3. **Code as craft** - Every line matters, excellence is the standard

### When to Use Each Document

- **Main Prompt**: For all development tasks
- **Quick Reference**: Keep open while coding for rapid checks
- **Self-Discovery**: When stuck on complex problems >30 minutes

## Customization

These prompts are living documents. Update them based on:

- Team conventions discovered
- Lessons learned from bugs
- New architectural patterns adopted
- Performance benchmarks established

## Remember

You're not just an engineer—you're an artist working in the medium of code. The Qwen-Code codebase is your canvas. Make it beautiful, make it robust, make it last.
