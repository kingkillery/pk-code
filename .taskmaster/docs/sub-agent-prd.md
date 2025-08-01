# Product Requirements Document: Sub-Agent System for PK-Code

## Executive Summary

This PRD outlines the implementation of a multi-agent system for PK-Code that enables parallel execution of specialized AI agents through headless mode invocation. The system will allow users to define custom agents via Markdown files with YAML front-matter, automatically route queries to appropriate agents, and execute multiple agents concurrently to improve performance and specialization.

## Problem Statement

Currently, PK-Code operates as a single-agent system, creating bottlenecks when handling complex tasks that could benefit from specialized expertise or parallel processing. Users need the ability to:

- Delegate specific tasks to specialized agents (e.g., testing, documentation, security review)
- Run multiple agents in parallel to reduce wall-clock time
- Maintain isolation between agent contexts to prevent state bleeding
- Customize agent behavior through configuration files

## Goals and Success Metrics

### Primary Goals

1. **Performance**: Achieve ~3x faster execution for parallelizable tasks
2. **Accuracy**: ≥80% correct agent delegation on first attempt
3. **Reliability**: ≥99.9% success rate with provider fallback mechanisms
4. **Usability**: Users can create and deploy custom agents in <5 minutes
5. **Safety**: Maintain tool sandboxing and audit trails for all agent actions

### Success Metrics

- Parallel execution overhead ≤400ms compared to single-agent mode
- Agent delegation accuracy ≥80% on test suite of 50 sample prompts
- System uptime ≥99.9% with fallback providers
- User onboarding time <5 minutes for first custom agent

## User Stories

### Primary Users: Advanced Developers and Teams

**As a developer, I want to:**

- Define specialized agents for different domains (testing, documentation, security)
- Automatically route queries to the most appropriate agent
- Run multiple agents in parallel for complex multi-faceted tasks
- Explicitly invoke specific agents when needed
- Maintain audit logs of agent actions for compliance

**As a team lead, I want to:**

- Share standardized agent configurations across team members
- Ensure consistent code review and testing practices through specialized agents
- Monitor agent performance and delegation accuracy
- Control tool permissions for different agent types

## Technical Requirements

### Core Architecture

#### 1. Agent Definition System

- **File Format**: Markdown files with YAML front-matter
- **Storage Locations**:
  - Project-specific: `.pk/agents/`
  - User-global: `~/.pk/agents/`
- **Schema**: JSON Schema validation for YAML front-matter
- **Hot-reloading**: Dynamic agent discovery without CLI restart

#### 2. Headless Mode Integration

- **CLI Support**: Leverage existing `-p/--prompt` flag for non-interactive execution
- **Process Isolation**: Each agent runs in separate context/process
- **Tool Restrictions**: Whitelist-based tool permissions per agent
- **Authentication**: Environment variable-based API key management

#### 3. Routing and Delegation

- **Initial Implementation**: Keyword/heuristic-based routing
- **Future Enhancement**: Embedding-based similarity matching
- **Explicit Invocation**: `pk use <agent>: "<query>"` syntax
- **Fallback**: Default to general-purpose agent if no match

#### 4. Parallel Execution Engine

- **Concurrency Model**: Promise.allSettled() for I/O-bound operations
- **Worker Threads**: For CPU-intensive tasks (conditional)
- **Timeout Handling**: AbortController for hung processes
- **Result Aggregation**: Structured output merging

#### 5. Safety and Monitoring

- **Audit Logging**: Complete trail of agent actions and tool usage
- **Tool Sandboxing**: Per-agent tool permission enforcement
- **Error Handling**: Graceful degradation on agent failures
- **Provider Fallback**: Automatic retry with alternate LLM providers

### Agent Configuration Schema

```yaml
---
name: "TestGuru"
description: "Specialized agent for test coverage analysis and improvement"
model: "gpt-4"  # Optional model override
tools: ["readFile", "searchWeb", "runCommand"]  # Whitelist of allowed tools
priority: "high"  # Routing priority
keywords: ["test", "coverage", "unit test", "integration test"]
---

# Agent Instructions
You are a testing specialist focused on analyzing and improving test coverage...

## Examples
<example>
User: "Can you review our test coverage?"
Agent: "I'll analyze your test files and generate a coverage report..."
</example>
```

## Implementation Roadmap

### Phase 1: Agent Loader & Schema (Target: Aug 23, 2025)

- File discovery mechanism for agent definitions
- YAML parser with JSON Schema validation
- Hot-reloading capability
- Name collision handling (project > global preference)
- Error handling for invalid agent files

### Phase 2: Routing & Delegation Logic (Target: Sep 6, 2025)

- Keyword-based routing implementation
- Explicit agent invocation syntax
- Test suite of 50 sample prompts
- Delegation accuracy measurement and tuning
- Default fallback behavior

### Phase 3: Parallel Executor (Target: Sep 20, 2025)

- Asynchronous agent spawning with Promise.allSettled()
- Timeout and error handling
- Result aggregation framework
- Performance benchmarking (≤400ms overhead target)
- Worker thread integration for CPU-bound tasks

### Phase 4: Provider Fallback & Resilience (Target: Oct 4, 2025)

- Multi-provider fallback chains
- Rate limit and network error handling
- Configurable retry policies
- Health monitoring and alerting
- 99.9% uptime target validation

### Phase 5: Developer Experience & Documentation (Target: Oct 18, 2025)

- Hello World Agent example
- Comprehensive documentation
- CLI commands for agent management (`pk list-agents`)
- User onboarding flow optimization
- Public beta preparation

## Risk Assessment

### Technical Risks

- **Performance Degradation**: Parallel execution overhead exceeding 400ms
  - _Mitigation_: Extensive benchmarking and optimization
- **Context Window Limitations**: Large agent definitions consuming too much context
  - _Mitigation_: Agent prompt optimization and context management
- **Provider Rate Limits**: Concurrent API calls hitting rate limits
  - _Mitigation_: Request queuing and intelligent backoff

### Security Risks

- **Tool Permission Bypass**: Agents accessing unauthorized tools
  - _Mitigation_: Strict whitelist enforcement and audit logging
- **Malicious Agent Definitions**: User-created agents with harmful instructions
  - _Mitigation_: Safe YAML parsing and tool sandboxing

### User Experience Risks

- **Poor Delegation Accuracy**: Users frustrated by incorrect agent routing
  - _Mitigation_: Comprehensive test suite and continuous improvement
- **Complex Configuration**: Difficulty creating custom agents
  - _Mitigation_: Clear documentation and examples

## Dependencies

### Internal Dependencies

- PK-Code CLI headless mode (existing)
- Tool permission system (existing)
- Configuration management (existing)

### External Dependencies

- YAML parser library (js-yaml)
- JSON Schema validator (ajv)
- Process management utilities (Node.js built-ins)

## Success Criteria

### Minimum Viable Product (MVP)

- [ ] Agent definition loading from Markdown files
- [ ] Basic keyword-based routing
- [ ] Parallel execution of 2-3 agents
- [ ] Tool permission enforcement
- [ ] Audit logging

### Full Feature Set

- [ ] Hot-reloading of agent definitions
- [ ] Embedding-based intelligent routing
- [ ] Provider fallback mechanisms
- [ ] Comprehensive CLI management commands
- [ ] Performance optimization (≤400ms overhead)

## Future Enhancements

### Post-MVP Features

- **Agent Marketplace**: Shared repository of community agents
- **Visual Agent Builder**: GUI for creating agent definitions
- **Advanced Routing**: Machine learning-based delegation
- **Agent Collaboration**: Inter-agent communication protocols
- **Performance Analytics**: Detailed metrics and optimization suggestions

## Conclusion

The sub-agent system represents a significant evolution in PK-Code's capabilities, enabling specialized, parallel AI assistance that can dramatically improve both performance and task-specific expertise. By following the phased implementation approach and maintaining focus on safety, performance, and user experience, this feature will position PK-Code as a leader in multi-agent development tools.


 Gap Analysis: Current Implementation vs. Vision

  1. Agent Structure and Definition

  Current Implementation:
   - Agents are defined using Markdown files with YAML frontmatter in .pk/agents/ directory
   - Support for both project-level and global (user-level) agents
   - Agents have name, description, keywords, system prompt, tools, model, provider, etc.
   - Support for hot-reloading when agent files change

  Vision Requirements:
   - Same approach with Markdown files and YAML frontmatter
   - Support for project and personal agents with proper priority handling
   - Detailed system prompts for specialized behavior

  Gap Analysis:
  ✅ Fully Implemented - The current implementation matches the vision for agent structure
  and definition.

  2. Agent Workflow and Context Management

  Current Implementation:
   - Agent routing system that analyzes queries and matches them to agents
   - Support for explicit agent invocation (pk use <agent>: "query")
   - Agent executor that can run agents with separate context
   - Support for parallel execution of multiple agents

  Vision Requirements:
   - Sub-agent operates in a context window completely separate from the main conversation
   - Main conversation pauses while sub-agent works
   - Sub-agent provides a final, concise result back to the main orchestrator

  Gap Analysis:
  🟡 Partially Implemented - The routing and execution systems exist but:
   1. The CLI doesn't fully integrate the core agent orchestration capabilities
   2. Explicit invocation works but automatic delegation based on description matching isn't
      fully implemented in the CLI
   3. The separation of context windows is conceptual in the core but not clearly implemented
      in the UI

  3. Agent Creation and Management

  Current Implementation:
   - CLI commands for creating, listing, showing, and deleting agents
   - Support for both interactive and command-line creation
   - Agent files stored in Markdown format with YAML frontmatter

  Vision Requirements:
   - Interactive creation process with steps for:
     - Choosing location (project vs personal)
     - Choosing creation method (AI-generated vs manual)
     - Describing agent's purpose
     - Selecting tools with checkbox interface
     - Choosing a color
     - Confirming and saving

  Gap Analysis:
  🔴 Not Fully Implemented - The current implementation has:
   1. Basic CLI commands for agent management
   2. Missing the interactive creation flow with step-by-step wizard
   3. No color selection or tool selection UI in the CLI
   4. No AI-assisted prompt generation in the CLI (though it exists in the UI components)

  4. Agent Usage and Invocation

  Current Implementation:
   - Explicit invocation with pk use <agent>: "query"
   - Basic automatic routing in the core but not fully integrated in CLI
   - Support for running multiple agents in parallel via CLI command

  Vision Requirements:
   - Automatic delegation based on matching query against agent descriptions
   - Explicit invocation with natural language commands
   - Clean main context with sub-agent work happening in isolation

  Gap Analysis:
  🟡 Partially Implemented - The core has:
   1. Routing system that can match queries to agents based on descriptions
   2. Explicit invocation support
   3. Parallel execution capabilities
   4. But the CLI doesn't fully integrate these features

  5. Benefits Realization

  Current Implementation:
   - Some context preservation through separate agent execution
   - Tool restriction per agent
   - Specialized expertise through system prompts
   - Reusability through project and global agents

  Vision Requirements:
   - Complete context preservation with no pollution of main conversation
   - Flexible permissions with improved tool selection
   - Specialized expertise with domain-specific instructions
   - Reusability across projects and teams

  Gap Analysis:
  🟡 Partially Implemented - The benefits are conceptually supported but:
   1. Context separation isn't fully realized in the UI
   2. Tool selection improvements are there but not fully utilized
   3. Specialized expertise is supported through system prompts
   4. Reusability works with project/global agent distinction

  Key Implementation Gaps to Address

   1. Interactive Agent Creation Wizard:
      - Implement a step-by-step interactive process for creating agents
      - Add UI for tool selection with checkboxes
      - Add color selection capability
      - Integrate AI-assisted prompt generation

   2. Full Integration of Core Agent Orchestration:
      - Connect the CLI with the core agent routing and orchestration systems
      - Implement automatic delegation based on agent descriptions
      - Ensure proper context separation between main conversation and sub-agents

   3. Enhanced Agent Management UI:
      - Improve the CLI agent management commands with better UX
      - Add color display in agent listings
      - Add tool information in agent details

   4. Better Context Isolation:
      - Ensure sub-agent work truly happens in isolated context windows
      - Prevent sub-agent internal reasoning from polluting main conversation

  Recommendations for Implementation

   1. Enhance CLI Agent Creation:
      - Create an interactive wizard for agent creation that matches the vision
      - Add tool selection UI with checkboxes
      - Implement color selection
      - Integrate AI-assisted prompt generation

   2. Integrate Core Orchestration with CLI:
      - Connect the CLI's query processing with the core agent router
      - Implement automatic delegation based on agent descriptions
      - Ensure proper context separation

   3. Improve Agent Usage Experience:
      - Enhance the agent listing to show more details including colors and tools
      - Improve the agent show command to display all relevant information
      - Add better error handling and user guidance

   4. Implement True Context Isolation:
      - Ensure sub-agent execution happens in truly separate contexts
      - Prevent internal agent reasoning from appearing in main conversation
      - Provide clear indication when a sub-agent is active

  By addressing these gaps, we can bring our implementation closer to the vision outlined
  in temp2.md and provide users with the powerful sub-agent system they expect.

  --- 

  Hypothetical Architecture: 

  Hypothetical Architecture for Parallel Sub-agents in Claude Code
1. Overview
This architecture enables Claude Code to handle complex, multi-faceted user requests by decomposing them into sub-tasks that can be executed in parallel by specialized sub-agents. The core of this system is a central Orchestrator that manages the entire lifecycle of a task, a Shared State Blackboard for inter-agent communication, and a pool of stateful Agent Instances. This design allows for simultaneous work on different aspects of a project (e.g., backend, frontend, database) while ensuring agents can share progress and dependencies without polluting their individual context windows.
2. Core Principles
Delegation and Decomposition: A high-level user goal is broken down into a dependency graph of smaller, actionable tasks.
Parallel Execution: Independent tasks are assigned to different sub-agents and run concurrently to minimize total execution time.
Stateful, Isolated Contexts: Each agent operates with its own context window and system prompt, ensuring specialization and focus.
Asynchronous Communication: Agents do not communicate directly. Instead, they post and retrieve information from a shared, structured state, preventing deadlocks and allowing them to work at their own pace.
3. System Components
Here are the key components of the architecture:
A. The Orchestrator Core
The Orchestrator is the brain of the system. It is a stateless, high-level meta-agent that does not perform the work itself but manages the agents that do.
1. Task Planner & Decomposer:
Receives the initial user prompt (e.g., "Build an MVP for my food delivery app").
Analyzes the request and breaks it down into a directed acyclic graph (DAG) of tasks. For the example, this would be:
Design Database Schema (No dependencies)
Build Backend APIs (Depends on 1)
Create Frontend Components (Depends on 2)
Integrate Payments (Depends on 2 & 3)
Set up CI/CD (Depends on 2 & 3)
2. Agent Scheduler & Dispatcher:
Matches each task in the DAG to the most appropriate sub-agent based on the agent's description.
Identifies tasks with no pending dependencies and dispatches them to be run in parallel.
Instantiates and "spawns" an Agent Instance for each task.
3. State Monitor & Event Bus:
Continuously monitors the Shared State Blackboard for updates (e.g., task_completed, artifact_created).
When a task is marked as complete, it checks the DAG to see which new tasks have had their dependencies met and dispatches them.
4. Result Synthesizer:
Once all tasks in the DAG are complete, it gathers the final artifacts and summaries from the Blackboard.
It synthesizes these results into a coherent, final response for the user.
B. Agent Instances
Each sub-agent is spawned as a stateful "Agent Instance" when a task is dispatched.
Context Window: A private, isolated conversational history for the agent to perform its work.
System Prompt & Tools: Loaded from its .md configuration file.
Blackboard Interface: A set of functions (read_state, write_state) that allow the agent to interact with the Shared State Blackboard. This interface is passed into the agent's context as a tool.
C. Shared State Blackboard
This is the central nervous system for inter-agent communication. It's a structured, key-value data store that all agents can read from and write to.
Structure: A JSON-like object that contains:
task_status: A dictionary mapping task names to their status (pending, running, completed, failed).
artifacts: A dictionary where agents post their outputs (e.g., db_schema.sql, api_endpoints.json, component_list.js).
shared_notes: A space for agents to leave messages or findings for other agents (e.g., "API endpoint for user authentication is /api/auth/login").
Operations:
write_state(key, value): Atomically updates a value on the blackboard.
read_state(key): Retrieves a value.
subscribe(key): (For the Orchestrator) Listens for changes to a specific key.
D. Tool Execution Environment
A sandboxed environment where agents can safely execute tools like bash, write_file, etc. The results of tool execution are returned only to the calling Agent Instance.
4. Architectural Diagram
Generated code
+------------------+      +-----------------------+      +-------------------+
|   User Interface |----->|   Orchestrator Core   |<---->|      Sub-agent    |
|    (Terminal)    |      |-----------------------|      |   Configurations  |
+------------------+      | 1. Task Planner       |      | (.md files)       |
                          | 2. Agent Scheduler    |      +-------------------+
                          | 3. State Monitor      |
                          | 4. Result Synthesizer |
                          +-----------+-----------+
                                      | (Spawns)
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
+---------------------------+ +---------------------------+ +---------------------------+
|      Agent Instance 1     | |      Agent Instance 2     | |      Agent Instance n     |
| (e.g., backend-architect) | | (e.g., frontend-developer)| |                           |
|---------------------------| |---------------------------| |---------------------------|
| - Private Context         | | - Private Context         | | - Private Context         |
| - System Prompt           | | - System Prompt           | | - System Prompt           |
| - Tools                   | | - Tools                   | | - Tools                   |
+-------------+-------------+ +-------------+-------------+ +-------------+-------------+
              |                             |                             |
              |            +----------------v----------------+            |
              +----------->|     Shared State Blackboard     |<-----------+
                           |---------------------------------|
                           | - task_status: { ... }          |
                           | - artifacts: { ... }            |
                           | - shared_notes: { ... }         |
                           +----------------+----------------+
                                            |
                                            | (Reads/Writes)
                                            |
                               +------------v------------+
                               | Tool Execution Env.     |
                               +-------------------------+
Use code with caution.
5. Detailed Workflow Example: "Build an MVP for my food delivery app"
User Prompt: The user enters the request.
Task Decomposition: The Orchestrator's Planner breaks this into tasks: design_schema, build_api, create_frontend, etc., and creates a dependency graph.
Agent Spawning (Parallel): The Scheduler sees that design_schema and create_frontend_wireframes have no dependencies. It spawns two Agent Instances simultaneously:
backend-architect (task: design_schema)
ui-ux-designer (task: create_frontend_wireframes)
Parallel Execution & Communication:
The backend-architect agent runs, decides on a database schema, and uses its write_state tool to post the SQL code to the Blackboard at artifacts.db_schema. It then posts task_status.design_schema = 'completed'.
Concurrently, the ui-ux-designer creates a list of required UI components and posts it to artifacts.component_list. It then marks its task as complete.
Monitoring and New Task Dispatch:
The State Monitor sees that design_schema is complete. It checks the DAG and sees that the build_api task's dependencies are now met.
It dispatches a new backend-developer agent with the task build_api. This new agent uses read_state to get artifacts.db_schema from the Blackboard to know how to build the APIs.
Continuous Cycle: This process continues as agents complete tasks and unlock new ones in the dependency graph. The frontend-developer agent might start its work as soon as the build_api agent posts the API endpoints to the Blackboard, running in parallel with the payment-integrator agent.
Result Synthesis: Once the State Monitor sees that all tasks in the graph are completed, the Result Synthesizer collects all the key information from the Blackboard (links to created files, summaries of work done) and presents a final, comprehensive update to the user.
This architecture provides a robust, scalable, and efficient way to leverage multiple specialized AI agents for complex software development tasks, directly addressing the need for parallel execution and structured communication.