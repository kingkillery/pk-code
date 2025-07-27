https://docs.anthropic.com/en/docs/claude-code/sub-agents

## File-Based Structure and Implementation Mechanics

Claude Code's sub-agent system employs a **file-based configuration approach** using Markdown files with YAML frontmatter to define each specialized agent. This structure provides both flexibility and simplicity for creating and managing custom AI assistants.

## File Organization and Hierarchy

The sub-agent system operates on a **two-tier hierarchy** with clear precedence rules[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents):

| Type                   | Location            | Scope                         | Priority    |
| ---------------------- | ------------------- | ----------------------------- | ----------- |
| **Project sub-agents** | `.claude/agents/`   | Available in current project  | **Highest** |
| **User sub-agents**    | `~/.claude/agents/` | Available across all projects | Lower       |

When sub-agent names conflict, project-level agents take precedence over user-level agents[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents). This design enables teams to maintain project-specific customizations while preserving personal productivity agents across multiple codebases.

## Configuration File Structure

Each sub-agent is defined using a **standardized Markdown format with YAML frontmatter**[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents):

```
text---
name: your-sub-agent-name
description: Description of when this sub agent should be invoked
tools: tool1, tool2, tool3 # Optional - inherits all tools if omitted
---

Your sub agent's system prompt goes here. This can be multiple paragraphs
and should clearly define the sub agent's role, capabilities, and approach
to solving problems.

Include specific instructions, best practices, and any constraints
the sub agent should follow.
```

- **`name`** (Required): Unique identifier using lowercase letters and hyphens
- **`description`** (Required): Natural language description of the sub-agent's purpose and when it should be invoked
- **`tools`** (Optional): Comma-separated list of specific tools; if omitted, inherits all tools from the main thread

## Tool Permission System

Sub-agents implement a **granular tool access control system**[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents). They can either inherit all available tools from the main Claude Code session (including MCP server tools) or be restricted to specific tools for security and focus. The `/agents` command provides an interactive interface showing all available tools, making permission management straightforward[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents).



The tool inheritance mechanism ensures that sub-agents can access **MCP tools from configured servers** when the `tools` field is omitted, enabling integration with external systems while maintaining security boundaries[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents).

## Agent Selection and Delegation Mechanics

The **automatic delegation mechanism** represents one of the most sophisticated aspects of Claude Code's sub-agent system. Understanding how Claude Code chooses which agents to use reveals the underlying intelligence of the task routing system.

## Multi-Factor Selection Algorithm

Claude Code's agent selection process operates on **three primary factors**[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents)[2](https://www.claudelog.com/mechanics/custom-agents/):

1. **Task description matching** against agent descriptions
2. **Current context analysis** of the conversation and codebase state
3. **Available tools** required for the task

The system performs **intelligent matching** between user requests and sub-agent descriptions, with more specific and action-oriented descriptions yielding better automatic selection results[2](https://www.claudelog.com/mechanics/custom-agents/)[3](https://www.claudelog.com/faqs/what-is-sub-agent-delegation-in-claude-code/). To encourage proactive use, developers can include phrases like "use PROACTIVELY" or "MUST BE USED" in the description field[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents).

## Dynamic Context Evaluation

The selection algorithm evaluates the **current conversation context** to determine task appropriateness. This includes analyzing:

- **File changes** and code modifications
- **Error messages** and debugging scenarios
- **Testing requirements** and code quality needs
- **Data analysis** and query operations

The system demonstrates **contextual intelligence** by recognizing patterns that indicate when specialized expertise would be beneficial[3](https://www.claudelog.com/faqs/what-is-sub-agent-delegation-in-claude-code/).

## Implementation Architecture

The technical implementation reveals a **sophisticated concurrency system**[4](https://www.anthropic.com/ai-fluency/ai-fluency-delegation). According to reverse-engineering analysis, Claude Code employs:

- **Internal concurrency architecture** creating multiple SubAgents within a single Task
- **Isolated execution environments** for each sub-agent with separate context windows
- **Resource monitoring and limits** including execution time, tool calls, and token usage
- **Security sandboxing** with filtered tool access and permission inheritance

## Agent Lifecycle Management

Each sub-agent follows a **structured lifecycle**[4](https://www.anthropic.com/ai-fluency/ai-fluency-delegation):

1. **Initialization**: Unique agent ID generation and context setup
2. **Permission filtering**: Tool access validation based on configuration
3. **Context gathering**: Independent information collection without main thread pollution
4. **Task execution**: Specialized processing using dedicated system prompts
5. **Result synthesis**: Output integration back to the main conversation

The system implements **resource constraints** for each sub-agent, including maximum execution time (5 minutes), tool call limits (50 calls), and token usage boundaries (100,000 tokens)[4](https://www.anthropic.com/ai-fluency/ai-fluency-delegation).

## Performance Considerations

While sub-agents provide significant benefits, they introduce **initialization latency** as each agent starts with a clean context[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents)[3](https://www.claudelog.com/faqs/what-is-sub-agent-delegation-in-claude-code/). This "clean slate" approach ensures focus and prevents context pollution but requires time for agents to gather relevant information.



The system balances this through **context efficiency gains** in the main conversation, enabling longer development sessions without overwhelming the primary context window[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents)[3](https://www.claudelog.com/faqs/what-is-sub-agent-delegation-in-claude-code/).

## Explicit vs. Implicit Invocation

Sub-agents can be triggered through two distinct mechanisms[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents):



**Automatic Delegation**: Claude Code proactively selects appropriate agents based on task analysis and agent descriptions



**Explicit Invocation**: Users can directly request specific agents using natural language:

```
text> Use the code-reviewer sub agent to check my recent changes
> Have the debugger sub agent investigate this error  
> Ask the data-scientist sub agent to analyze this query
```

This dual-mode operation provides both **intelligent automation** and **direct control** when specific expertise is required[1](https://docs.anthropic.com/en/docs/claude-code/sub-agents).



The sophisticated selection and delegation system represents a **fundamental advancement** in AI-assisted development, moving beyond simple command-response patterns to intelligent task routing that mirrors effective human team structures[3](https://www.claudelog.com/faqs/what-is-sub-agent-delegation-in-claude-code/).

