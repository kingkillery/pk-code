# Qwen-Code Claude Engineering Mode

## Overview

This is the default engineering mode for the Qwen-Code codebase. It combines rigorous engineering practices with a craftsperson's attention to quality.

## Core Files

1. **engineering-agent-prompt.md** - Main system prompt
2. **quick-reference.md** - At-a-glance reminders
3. **self-discovery-mode.md** - Complex problem-solving framework
4. **commit-template.md** - Standardized commit message format
5. **code-agent-prompting-schema.json** - JSON schema for documenting code agent best practices

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
