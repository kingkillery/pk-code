# PK Code Bloat Review

## Quick Summary

**Main Friction Points:**
1. **Deprecated orchestration docs** - ARCHITECTURE.md describes systems that don't exist
2. **411 lines of unused ReAct framework** - dead code
3. **Redundant agent runners** - 3 different classes doing similar things
4. **Over-engineered UI** - 45+ hooks for a terminal interface
5. **Massive config class** - 754+ lines doing too much

**Quick Wins (Can Delete Immediately):**
- `packages/core/src/agents/ARCHITECTURE.md` (deprecated docs)
- `packages/core/src/agents/react-framework.ts` (411 lines, unused)
- `packages/cli/src/agent/AgentRunner.ts` (stub, only used in tests)

**Consolidation Needed:**
- Migrate `EnhancedAgentRunner` → `SubagentExecutor` (2 parallel execution paths)

**Biggest Bloat:**
- UI complexity (`useGeminiStream.ts` - 931 lines, `App.tsx` - 1029 lines)
- Config class (754+ lines)

---

## Executive Summary

This review identifies unnecessary complexity and bloat that prevents PK Code from being a simple agent loop with a strong system prompt and set of tools. The core issue is that multiple deprecated systems, redundant abstractions, and over-engineered UI components are creating friction between the user's intent and the actual agent execution.

**Core Agent Loop (What Should Exist):**
```
User Input → System Prompt + Tools → LLM → Tool Execution → Response → Loop
```

**Current Reality:**
Multiple layers of abstraction, deprecated systems, complex UI state management, and redundant execution paths obscure the simple agent loop.

---

## Critical Bloat Areas

### 1. Deprecated Multi-Agent Orchestration System ⚠️ HIGH PRIORITY

**Location:** `packages/core/src/agents/ARCHITECTURE.md` and related files

**Problem:**
- The ARCHITECTURE.md documents a complex system with:
  - Agent Router (keyword-based routing)
  - Agent Executor (parallel execution)
  - Result Aggregator (consensus strategies)
  - Agent Orchestrator (pipeline management)
- These are marked as deprecated in `packages/core/src/agents/index.ts`
- The documentation still exists and may confuse developers
- The actual implementation has been replaced by `SubagentExecutor` and `SubagentManager`

**Evidence:**
```typescript
// packages/core/src/agents/index.ts:8-29
/**
 * @deprecated The complex orchestration system is deprecated.
 * Use the simplified subagent system from '../subagents' instead
 */
```

**Impact:**
- Developers may try to use deprecated APIs
- Documentation mismatch creates confusion
- Legacy code may still be referenced

**Recommendation:**
- Delete `ARCHITECTURE.md` or move to archive/docs/deprecated
- Remove all deprecated exports from `agents/index.ts`
- Audit codebase for any remaining references to router/executor/aggregator/orchestrator

---

### 2. Unused ReAct Framework ⚠️ MEDIUM PRIORITY

**Location:** 
- `packages/core/src/agents/react-framework.ts` (411 lines)

**Problem:**
- Exported but never imported or used anywhere in the codebase
- The actual execution uses native Gemini function calling, not a custom ReAct parser
- `SubagentExecutor` builds prompts directly without using `ReActFramework`
- `nonInteractiveCli.ts` and `useGeminiStream.ts` handle function calls natively

**Evidence:**
- Grep shows `ReActFramework` and `createReActFramework` only appear in the file itself and exports
- No actual usage found in execution paths

**Impact:**
- 411 lines of unused code
- False abstraction that suggests this pattern is used
- Maintenance burden

**Recommendation:**
- **DELETE** `react-framework.ts` - it's completely unused
- Remove exports from `agents/index.ts`

**Note:** `AgentPromptGenerator` IS actually used (in agent creation commands), so keep it.

---

### 3. Redundant Agent Execution Classes ⚠️ MEDIUM PRIORITY

**Location:**
- `packages/cli/src/agent/AgentRunner.ts` (stub implementation)
- `packages/cli/src/agent/EnhancedAgentRunner.ts` (full implementation)
- `packages/core/src/subagents/subagent-executor.ts` (actual implementation)

**Problem:**
- Three different classes for agent execution with overlapping responsibilities
- `AgentRunner` appears to be a stub/test class (just simulates work)
- `EnhancedAgentRunner` duplicates functionality of `SubagentExecutor`
- Both `EnhancedAgentRunner` and `SubagentExecutor` exist and serve similar purposes

**Evidence:**
- `use.ts` uses `SubagentExecutor` for main agent execution
- `EnhancedAgentRunner` IS used in `MultiAgentRun.tsx` and `agent.ts` commands
- `AgentRunner` only used in tests and appears to be a stub

**Impact:**
- Confusion about which class to use
- Duplicate code to maintain
- Two parallel execution paths (`EnhancedAgentRunner` vs `SubagentExecutor`)

**Recommendation:**
- **DELETE** `AgentRunner.ts` - it's a stub and only used in tests (use mocks instead)
- **CONSOLIDATE** `EnhancedAgentRunner` and `SubagentExecutor`:
  - They both create content generators and execute agents
  - `SubagentExecutor` is cleaner and more focused
  - Migrate `MultiAgentRun` and `agent.ts` to use `SubagentExecutor`
  - Then delete `EnhancedAgentRunner`

---

### 4. Over-Engineered UI with 45+ Hooks ⚠️ HIGH PRIORITY

**Location:** `packages/cli/src/ui/` (66+ component files, 45+ hook files)

**Problem:**
- The terminal UI has grown to be a complex React application
- 45+ custom hooks for what should be a simple terminal interface
- Complex state management with multiple contexts
- Features like:
  - Theme system (19 theme files)
  - Multiple command processors (slash, at, shell)
  - History management
  - Console message patching
  - Tool scheduling
  - Stats tracking
  - Memory display
  - Diagnostics panel
  - Help system
  - Update notifications
  - Privacy notices

**Key Bloat Files:**
- `useGeminiStream.ts` (931 lines) - manages streaming, tool calls, history, commands
- `App.tsx` (1029 lines) - massive component with too many responsibilities
- Multiple contexts: `StreamingContext`, `SessionContext`, `OverflowContext`

**Evidence:**
```typescript
// packages/cli/src/ui/hooks/ - 45+ hook files
useCompletion.ts
useGeminiStream.ts  // 931 lines!
useHistoryManager.ts
useToolScheduler.ts
useReactToolScheduler.ts
useShellCommandProcessor.ts
useSlashCommandProcessor.ts
useAtCommandProcessor.ts
// ... 37 more
```

**Impact:**
- Hard to understand the UI flow
- Difficult to debug issues
- Performance overhead from React re-renders
- The UI complexity distracts from the core agent loop

**Recommendation:**
- Audit which UI features are actually essential vs nice-to-have
- Consider if a simpler terminal UI would suffice (e.g., like `nonInteractiveCli.ts`)
- Move optional features behind flags or separate commands
- Simplify `useGeminiStream.ts` - it's doing too much

---

### 5. Agent Registry System (Legacy) ⚠️ LOW PRIORITY

**Location:** `packages/core/src/agents/agent-registry.ts`

**Problem:**
- Still exists and is imported in `config.ts`
- But `SubagentManager` is the new system
- Two parallel systems for loading agents

**Evidence:**
```typescript
// packages/core/src/config/config.ts:32-34
import {
  getGlobalAgentRegistry,
  initializeGlobalAgentRegistry,
} from '../agents/agent-registry.js';
```

**Impact:**
- Confusion about which system to use
- Potential for bugs if both are used simultaneously

**Recommendation:**
- Audit usage of `AgentRegistry` vs `SubagentManager`
- Migrate remaining uses to `SubagentManager`
- Delete `agent-registry.ts` if fully replaced

---

### 6. Complex Command Structure ⚠️ MEDIUM PRIORITY

**Location:** `packages/cli/src/commands/`

**Problem:**
- Multiple commands that may not be needed for core functionality:
  - `parallel.ts` - parallel execution
  - `create-agent.tsx` - interactive agent creation
  - `agent.ts` - agent management commands
  - `memory.ts` - memory management
  - `sandbox.ts` - sandbox management
  - Plus many UI commands via slash commands

**Impact:**
- Feature creep from core mission
- More code to maintain
- User confusion about what's available

**Recommendation:**
- Identify which commands are essential vs convenience
- Move non-essential commands to `pk-tools` or separate package
- Keep core focused on: `pk [prompt]` → agent loop

---

### 7. Configuration Complexity ⚠️ MEDIUM PRIORITY

**Location:** `packages/core/src/config/config.ts` (754+ lines)

**Problem:**
- Massive `Config` class with many responsibilities
- Handles: auth, tools, memory, telemetry, sandbox, extensions, MCP servers, etc.
- Many getter methods suggesting it's doing too much

**Evidence:**
```typescript
// Config class has methods like:
getModel()
getAuthType()
getToolRegistry()
getGeminiClient()
getSandbox()
getDefaultSubagentName()
getSubagentExecutionOptions()
getDebugMode()
getApprovalMode()
// ... many more
```

**Impact:**
- Hard to understand what config does
- Difficult to test
- Tight coupling between concerns

**Recommendation:**
- Split Config into focused classes:
  - `AuthConfig`
  - `ToolConfig`
  - `AgentConfig`
  - `UIConfig`
- Use composition instead of one monolithic class

---

### 8. Tool System Abstraction Layers ⚠️ LOW PRIORITY

**Location:** `packages/core/src/tools/`

**Problem:**
- Multiple abstraction layers:
  - `ToolRegistry` - tool registration
  - `executeToolCall` - execution wrapper
  - `nonInteractiveToolExecutor` - execution implementation
  - Individual tool classes

**Impact:**
- May be necessary for flexibility
- But worth auditing if simpler would work

**Recommendation:**
- Review if all abstraction layers are needed
- Consider direct tool execution if possible

---

## The Simple Agent Loop (Target Architecture)

What PK Code should be:

```typescript
// Core loop (pseudocode)
async function agentLoop(
  systemPrompt: string,
  tools: Tool[],
  query: string
) {
  const messages = [{ role: 'user', content: query }];
  
  while (true) {
    // 1. Call LLM with system prompt + tools
    const response = await llm.generate({
      systemPrompt,
      messages,
      tools: tools.map(t => t.toFunctionDeclaration())
    });
    
    // 2. Check for tool calls
    if (response.functionCalls?.length > 0) {
      // 3. Execute tools
      const toolResults = await Promise.all(
        response.functionCalls.map(call => 
          executeTool(tools, call)
        )
      );
      
      // 4. Add results to messages
      messages.push({
        role: 'assistant',
        content: response.text,
        functionCalls: response.functionCalls
      });
      messages.push({
        role: 'user',
        content: toolResults
      });
      
      continue; // Loop back
    }
    
    // 5. No tool calls - return final response
    return response.text;
  }
}
```

**Current blockers:**
- UI complexity (useGeminiStream.ts doing too much)
- Multiple execution paths
- Configuration complexity
- Deprecated systems creating confusion

---

## Priority Recommendations

### Immediate (High Impact, Low Risk)
1. ✅ Delete deprecated agent orchestration docs (`ARCHITECTURE.md`)
2. ✅ **DELETE** unused `AgentRunner.ts` stub
3. ✅ **DELETE** unused `react-framework.ts` (411 lines of dead code)
4. ✅ **CONSOLIDATE** `EnhancedAgentRunner` → `SubagentExecutor` migration
   - Migrate `MultiAgentRun.tsx` and `agent.ts` to use `SubagentExecutor`
   - Delete `EnhancedAgentRunner.ts` after migration

### Short Term (High Impact, Medium Risk)
5. ✅ Simplify `useGeminiStream.ts` - split into smaller, focused hooks
6. ✅ Reduce `App.tsx` complexity - extract major sections
7. ✅ Audit UI hooks - remove unused ones
8. ✅ Migrate remaining `AgentRegistry` uses to `SubagentManager`

### Medium Term (Medium Impact, Higher Risk)
9. ⚠️ Consider simplifying UI to match `nonInteractiveCli.ts` simplicity
10. ⚠️ Split `Config` class into focused modules
11. ⚠️ Evaluate if all CLI commands are needed

### Long Term (Lower Priority)
12. ⚠️ Review tool system abstractions
13. ⚠️ Consider feature flags for optional UI features

---

## Metrics

**Current Codebase Size (estimated):**
- UI components: 66+ files
- UI hooks: 45+ files
- Commands: 10+ files
- Core agent logic: Multiple overlapping systems
- Config: 754+ lines in single file

**Target:**
- Core agent loop: ~200-300 lines
- Tool execution: ~100-200 lines
- Simple UI: ~500-1000 lines (vs current 3000+)
- Config: Split into focused modules

---

## Notes

- The `nonInteractiveCli.ts` implementation is actually quite clean and close to the ideal
- The subagent system (`SubagentExecutor`, `SubagentManager`) is a good simplification
- The main friction comes from UI complexity and deprecated systems
- Consider making the interactive UI optional - core should work without it
