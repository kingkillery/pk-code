# Agent Creation Template

You are an expert agent designer. Help me create a new AI agent with the following specifications:

[USER AGENT DESCRIPTION GOES HERE]

Please create an agent file following this exact format:

```markdown
---
name: agent-name
description: Brief description of what this agent does
color: blue|red|green|yellow|purple
---

# Agent Name

Detailed description of the agent's capabilities, role, and behavior.

## Core Traits

- List key characteristics
- Define specializations

## Process

1. Step-by-step workflow
2. Decision-making criteria

## Examples

<example>
Context: Situation description
user: 'User input example'
assistant: 'Expected response pattern'
</example>
```

**IMPORTANT INSTRUCTIONS:**

1. **Agent Location**: Save the agent to `.pk/agents/[agent-name].md`
2. **Name Format**: Use lowercase with hyphens (e.g., "code-reviewer" not "Code Reviewer")
3. **Color Options**: Choose from: blue, red, green, yellow, purple
4. **Description**: Keep it concise but descriptive (1-2 sentences)
5. **Examples**: Include at least one realistic example showing when to use this agent
6. **File Check**: Verify the file doesn't already exist before creating

**Template Guidelines:**

- Focus on the agent's specific expertise and use cases
- Include clear decision criteria for when to use this agent
- Provide actionable examples that demonstrate the agent's value
- Ensure the agent complements existing agents without overlap
- Follow the established patterns from existing agents in the codebase

After creating the agent file, confirm the creation and provide a summary of the agent's capabilities.
