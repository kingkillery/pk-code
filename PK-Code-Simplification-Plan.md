# PK Code Simplification Plan

## Executive Summary

This plan outlines a systematic approach to simplify PK Code's multi-agent orchestration system while preserving its core value propositions. The goal is to reduce cognitive complexity by 60-70% while maintaining 80-90% of functionality.

**Target Metrics:**
- Reduce orchestration code from ~2000 lines to ~500 lines
- Reduce configuration options from 20+ to 5-8 essential ones
- Reduce execution pathways from 3+ modes to 1-2
- Maintain support for multiple AI providers
- Preserve agent specialization capabilities

---

## Current Complexity Analysis

### High-Complexity Areas (Remove/Simplify)

1. **Multi-Agent Orchestration** (800 lines)
   - 3 orchestration modes (SINGLE/MULTI/AUTO)
   - Complex routing with confidence scoring
   - Automatic query complexity analysis
   - Performance target validation
   - Overhead tracking

2. **Result Aggregation System** (900 lines)
   - 5 consensus strategies
   - Response quality evaluation (6 metrics)
   - Conflict analysis and detection
   - Intelligent merging algorithms
   - Structured response generation

3. **Advanced Execution Features**
   - ReAct framework integration
   - Circuit breakers and retry logic
   - Concurrent/sequential execution modes
   - Task DAG decomposition
   - Blackboard architecture

### Core Value to Preserve

1. **Multi-Provider Support**
   - Anthropic, OpenAI, Gemini, Cohere, OpenRouter
   - Provider registry and abstraction

2. **Agent Specialization**
   - File-based agent configurations
   - Custom tools per agent
   - Domain-specific system prompts

3. **Enhanced Tools**
   - FlowPkTool (browser automation DSL)
   - BrowserUseTool (advanced browser API)
   - Provider-specific optimizations

---

## Simplification Strategy

### Phase 1: Adopt Qwen's Subagent Model (Week 1-2)

**Objective:** Replace complex orchestration with simple file-based configuration

**Actions:**

1. **Create New Subagent System**
   ```
   packages/core/src/subagents/
   ├── index.ts                    # Main exports
   ├── types.ts                    # Core types
   ├── subagent-manager.ts         # File CRUD operations
   ├── subagent-executor.ts        # Simple execution logic
   └── builtin-agents.ts           # Built-in agent definitions
   ```

2. **Convert Agent Configurations to Markdown**
   - Migrate from complex JSON/TypeScript configs to Markdown + YAML
   - Format: `~/.pk/agents/*.md` and `<project>/.pk/agents/*.md`
   
   Example:
   ```markdown
   ---
   name: code-reviewer
   provider: anthropic
   model: claude-3-5-sonnet-20241022
   tools:
     - Read
     - Grep
     - RipGrep
   temperature: 0.2
   ---
   
   # Code Reviewer Agent
   
   You are an expert code reviewer. Focus on:
   - Code quality and best practices
   - Security vulnerabilities
   - Performance optimizations
   - Documentation completeness
   ```

3. **Deprecate Orchestration Layers**
   - Mark `AgentOrchestrator` as deprecated
   - Mark `AgentRouter` as deprecated
   - Mark `ResultAggregator` as deprecated
   - Keep for 1-2 versions with warnings

**Deliverables:**
- ✅ Simple subagent system (200-300 lines)
- ✅ Migration script for existing agents
- ✅ Documentation for new format

---

### Phase 2: Simplify Execution Model (Week 3-4)

**Objective:** Single, straightforward execution path

**Current Flow:**
```
Query → Analyze Complexity → Route (confidence) → Execute (circuit breakers) 
→ Aggregate (5 strategies) → Validate → Blackboard → Return
```

**Simplified Flow:**
```
Query → Select Agent (explicit or default) → Execute → Return
```

**Actions:**

1. **Remove Auto-Selection Logic**
   - Require explicit agent selection: `pk use <agent>: "<task>"`
   - Provide smart default agent (general-purpose)
   - Remove query complexity analysis (300+ lines)

2. **Remove Result Aggregation**
   - Single agent = single response (no merging needed)
   - If user wants multiple perspectives, they run multiple commands
   - Remove all 5 consensus strategies (900 lines)

3. **Simplify Execution**
   ```typescript
   // Before: 400+ lines with circuit breakers, timeouts, ReAct
   async executeAgent(agent: Agent, query: string): Promise<Response>
   
   // After: ~50 lines
   async executeSubagent(subagent: Subagent, query: string): Promise<Response> {
     const generator = await this.createGenerator(subagent);
     const response = await generator.generateContent({
       model: subagent.model,
       contents: [{ role: 'user', parts: [{ text: query }] }]
     });
     return response;
   }
   ```

4. **Remove Task Decomposition**
   - Remove `TaskPlanner` (DAG-based planning)
   - Remove `Blackboard` (shared state management)
   - Keep simple sequential execution

**Deliverables:**
- ✅ Streamlined executor (~150 lines)
- ✅ Updated CLI commands
- ✅ Performance benchmarks showing minimal overhead

---

### Phase 3: Streamline Configuration (Week 5)

**Objective:** Reduce configuration surface area by 70%

**Before:**
```typescript
interface OrchestrationOptions {
  mode: OrchestrationMode;                    // Remove
  maxAgents?: number;                         // Remove
  routing?: {                                 // Remove
    minConfidence?: number;
    fallbackAgent?: string;
  };
  execution?: ExecutionOptions;               // Simplify
  aggregation?: AggregationOptions;           // Remove
  performance?: {                             // Remove
    maxExecutionTime?: number;
    targetConfidence?: number;
  };
  react?: {                                   // Optional: Keep
    enabled?: boolean;
    promptConfig?: Partial<ReActPromptConfig>;
    maxReprompts?: number;
  };
}
```

**After:**
```typescript
interface SubagentExecutionOptions {
  timeout?: number;              // Simple timeout (default: 60s)
  tools?: string[];              // Override agent's tools
  temperature?: number;          // Override temperature
}
```

**Actions:**

1. **Create Minimal Config Schema**
   - Keep only essential runtime options
   - Move advanced options to subagent file frontmatter

2. **Update CLI Interface**
   ```bash
   # Before: Complex orchestration
   pk ask "complex query" --mode multi-agent --strategy intelligent-merge
   
   # After: Simple and explicit
   pk use code-reviewer: "review this function"
   pk use @default: "general question"
   pk ask "question"  # uses default agent
   ```

3. **Simplify Settings File**
   - Remove orchestration settings
   - Remove aggregation settings
   - Keep provider credentials and model selection

**Deliverables:**
- ✅ Simplified config schema
- ✅ Updated settings documentation
- ✅ Migration guide for existing configs

---

### Phase 4: Preserve Unique PK Features (Week 6)

**Objective:** Keep what makes PK Code special

**Features to Preserve:**

1. **Multi-Provider Architecture**
   - Keep separate provider packages
   - Keep provider registry
   - Keep OAuth integrations
   
   ```
   packages/
   ├── anthropic/          # Keep
   ├── openai/            # Keep
   ├── gemini/            # Keep
   ├── cohere/            # Keep
   └── openrouter/        # Keep
   ```

2. **Advanced Tools**
   - `FlowPkTool` - Browser automation DSL (unique to PK)
   - `BrowserUseTool` - Advanced browser integration
   - MCP integration
   - Memory system (mem0ai)

3. **Enhanced Authentication**
   - OAuth2 flows for each provider
   - Secure credential storage
   - Token refresh mechanisms

**Actions:**

1. **Refactor Provider Packages**
   - Keep provider-specific code
   - Simplify registration process
   - Remove orchestration dependencies

2. **Simplify Tool Registry**
   ```typescript
   // Before: Complex with tool scheduling, priorities
   class ToolRegistry {
     register(tool: Tool, priority: number, schedule: Schedule): void;
     // ... 500+ lines
   }
   
   // After: Simple registration
   class ToolRegistry {
     register(tool: Tool): void;
     get(name: string): Tool | undefined;
     list(): Tool[];
   }
   ```

3. **Keep FlowPk and Browser Tools**
   - These are unique differentiators
   - Simplify integration with new execution model
   - Update documentation

**Deliverables:**
- ✅ Refactored provider packages
- ✅ Simplified tool registry
- ✅ Updated tool documentation

---

### Phase 5: Update CLI and UX (Week 7)

**Objective:** Align user experience with simplified architecture

**CLI Changes:**

1. **Agent Management Commands**
   ```bash
   # List available agents
   pk agent list
   
   # Create new agent
   pk agent create code-reviewer
   
   # Edit agent configuration
   pk agent edit code-reviewer
   
   # Delete agent
   pk agent delete code-reviewer
   
   # Show agent details
   pk agent info code-reviewer
   ```

2. **Simplified Execution Commands**
   ```bash
   # Use specific agent
   pk use code-reviewer: "review src/utils/helper.ts"
   
   # Use default agent
   pk ask "what is the project structure?"
   
   # Interactive mode with agent selection
   pk
   > /agent code-reviewer
   > review this code
   ```

3. **Remove Orchestration Commands**
   - Remove `--mode` flags
   - Remove `--strategy` flags
   - Remove `--max-agents` flags
   - Remove complexity analysis commands

**Actions:**

1. **Update Command Parser**
   - Simplify argument parsing
   - Remove orchestration options
   - Add agent selection shortcuts

2. **Update Interactive UI**
   - Add agent switcher in UI
   - Show current agent in prompt
   - Remove orchestration status indicators

3. **Update Help Documentation**
   - Rewrite help text for simplicity
   - Add examples for common workflows
   - Remove advanced orchestration docs

**Deliverables:**
- ✅ Updated CLI commands
- ✅ New interactive UI
- ✅ Updated help documentation

---

### Phase 6: Testing and Migration (Week 8)

**Objective:** Ensure stability and smooth migration path

**Testing Strategy:**

1. **Unit Tests**
   - Test subagent loading from files
   - Test execution with each provider
   - Test tool registry operations
   - Target: 80%+ coverage

2. **Integration Tests**
   - Test end-to-end workflows
   - Test agent switching
   - Test multi-provider scenarios
   - Test browser automation tools

3. **Performance Tests**
   - Benchmark execution overhead (target: <100ms)
   - Compare response times with old system
   - Memory usage profiling

**Migration Strategy:**

1. **Backward Compatibility Layer (Temporary)**
   ```typescript
   // Adapter for old orchestration API
   class OrchestrationAdapter {
     async processQuery(
       query: string, 
       options: OrchestrationOptions
     ): Promise<OrchestrationResult> {
       // Convert to new subagent execution
       console.warn('Orchestration API is deprecated. Use SubagentExecutor.');
       const agent = await this.selectAgent(query, options);
       return this.executor.execute(agent, query);
     }
   }
   ```

2. **Migration Script**
   ```bash
   # Convert old agent configs to new format
   pk migrate agents
   
   # Update settings file
   pk migrate config
   
   # Show migration report
   pk migrate status
   ```

3. **Documentation Updates**
   - Create migration guide
   - Update all examples
   - Add troubleshooting section

**Deliverables:**
- ✅ Comprehensive test suite
- ✅ Migration script and guide
- ✅ Performance benchmarks

---

## File Structure Changes

### Remove (Archive or Delete)

```
packages/core/src/
├── agents/
│   ├── agent-orchestrator.ts          # DELETE (800 lines)
│   ├── agent-router.ts                # DELETE (600 lines)
│   ├── result-aggregator.ts           # DELETE (900 lines)
│   ├── agent-executor.ts              # SIMPLIFY (keep basic execution only)
│   └── react-framework.ts             # OPTIONAL (keep if useful)
├── orchestrator/
│   ├── TaskPlanner.ts                 # DELETE
│   ├── Blackboard.ts                  # DELETE
│   └── guardrails.ts                  # KEEP (security is important)
```

### Add

```
packages/core/src/
├── subagents/
│   ├── index.ts                       # NEW (main exports)
│   ├── types.ts                       # NEW (core types)
│   ├── subagent-manager.ts            # NEW (file operations)
│   ├── subagent-executor.ts           # NEW (simple execution)
│   ├── subagent-validator.ts          # NEW (config validation)
│   └── builtin-agents.ts              # NEW (default agents)
```

### Modify

```
packages/core/src/
├── tools/
│   ├── tool-registry.ts               # SIMPLIFY (remove scheduling)
│   ├── flowpk-tool.ts                 # KEEP (unique value)
│   └── browser-use-tool.ts            # KEEP (unique value)
├── providers/
│   └── registry.ts                    # SIMPLIFY (remove orchestration deps)
```

---

## Code Reduction Estimates

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Orchestration | 800 lines | 0 lines | -100% |
| Routing | 600 lines | 0 lines | -100% |
| Aggregation | 900 lines | 0 lines | -100% |
| Task Planning | 400 lines | 0 lines | -100% |
| Blackboard | 300 lines | 0 lines | -100% |
| Executor | 600 lines | 150 lines | -75% |
| **New: Subagents** | 0 lines | 300 lines | +300 lines |
| **Total** | ~3600 lines | ~450 lines | **-87%** |

---

## Benefits

### For Users

1. **Easier to Understand**
   - "I want to use the code-review agent" is clearer than "orchestrate multiple agents with intelligent merge strategy"
   - Explicit agent selection vs automatic routing

2. **Faster Execution**
   - Remove orchestration overhead (300-400ms)
   - Direct agent execution
   - No complexity analysis or result aggregation

3. **More Predictable**
   - No surprises from auto-selection
   - Consistent behavior per agent
   - Clear agent capabilities

4. **Easier Configuration**
   - Markdown files vs complex TypeScript configs
   - Visual editing in any text editor
   - Version control friendly

### For Developers

1. **Easier Onboarding**
   - Understand codebase in hours vs days
   - Fewer abstractions to learn
   - Clear execution flow

2. **Easier to Extend**
   - Add new agent: create Markdown file
   - Add new tool: register in registry
   - Add new provider: implement interface

3. **Easier to Debug**
   - Linear execution path
   - No complex state management
   - Clear error messages

4. **Easier to Test**
   - Unit tests for simple functions
   - No mocking complex orchestration
   - Integration tests are straightforward

---

## Risks and Mitigations

### Risk 1: Loss of Multi-Agent Capabilities

**Impact:** Users who rely on multi-agent consensus lose functionality

**Mitigation:**
- Provide CLI commands to run multiple agents sequentially
- Document workflows for comparing agent outputs
- Consider adding simple "compare" command later if needed

```bash
# Instead of automatic multi-agent orchestration
pk use code-reviewer: "review code" > review1.txt
pk use security-expert: "review code" > review2.txt
diff review1.txt review2.txt
```

### Risk 2: Performance Regression

**Impact:** Simplified system might be slower due to lack of optimization

**Mitigation:**
- Benchmark before/after
- Keep provider-level optimizations
- Add caching where beneficial
- Target: <100ms overhead (vs 300-400ms currently)

### Risk 3: User Migration Friction

**Impact:** Existing users need to update workflows and configs

**Mitigation:**
- Provide automatic migration script
- Keep backward compatibility layer for 2 versions
- Comprehensive migration guide
- Clear deprecation warnings

### Risk 4: Loss of Differentiation

**Impact:** PK Code might seem too similar to Qwen Code

**Mitigation:**
- Emphasize preserved unique features:
  - Multi-provider support (5 providers)
  - FlowPk browser automation
  - Advanced OAuth integrations
  - Memory system (mem0ai)
- Better marketing of unique tools

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1-2 | Subagent System | New subagent code, migration script |
| 3-4 | Execution Simplification | Streamlined executor, removed orchestration |
| 5 | Configuration | New config schema, updated CLI |
| 6 | Preserve Features | Refactored providers, tools intact |
| 7 | CLI/UX Updates | New commands, updated UI |
| 8 | Testing & Migration | Test suite, migration guide, release |

**Total: 8 weeks** (2 months)

---

## Success Criteria

1. **Code Metrics**
   - ✅ 80%+ reduction in orchestration code
   - ✅ <500 lines for core subagent system
   - ✅ Test coverage >80%

2. **Performance Metrics**
   - ✅ Execution overhead <100ms
   - ✅ No regression in provider latency
   - ✅ Memory usage reduced by 30%+

3. **User Experience Metrics**
   - ✅ Onboarding time reduced by 60%
   - ✅ 90%+ of existing workflows supported
   - ✅ Clear migration path for 100% of users

4. **Developer Experience Metrics**
   - ✅ New contributor onboarding <2 hours
   - ✅ Add new agent: <5 minutes
   - ✅ Debug issues 50% faster

---

## Next Steps

1. **Get Stakeholder Buy-In**
   - Present this plan to team
   - Gather feedback on approach
   - Confirm preservation of unique features

2. **Create Implementation Issues**
   - Break down phases into GitHub issues
   - Assign owners to each phase
   - Set up project board

3. **Start with Prototype**
   - Build minimal subagent system in branch
   - Test with 2-3 real agents
   - Validate performance improvements

4. **Iterate and Refine**
   - Gather early feedback
   - Adjust timeline as needed
   - Document decisions and trade-offs

---

## Questions to Answer

1. **Should we keep ReAct framework?**
   - Pro: Useful for structured reasoning
   - Con: Adds complexity
   - Decision: Make it optional, disabled by default

2. **How to handle users who want multi-agent?**
   - Option A: Remove completely (they run multiple commands)
   - Option B: Add simple "compare mode" later
   - Decision: Start with Option A, add Option B if demanded

3. **Versioning strategy?**
   - Option A: Major version bump (v1.0.0 → v2.0.0)
   - Option B: Keep version, mark as "simplified edition"
   - Decision: Major version bump with clear migration guide

4. **Keep PK branding or merge with Qwen?**
   - This is strategic decision
   - Simplification makes merging easier
   - Could become "Qwen Code Pro" or keep separate
   - Decision: TBD based on product strategy

---

## Conclusion

This simplification plan reduces PK Code's complexity by **~87%** while preserving its unique value propositions:
- Multi-provider support
- Advanced browser automation
- Enhanced OAuth integrations
- Memory system

The result is a system that's **easier to understand, use, and maintain** while keeping the features that differentiate PK Code from competitors.

**Recommended Approach:** Execute phases 1-8 sequentially over 8 weeks, with continuous testing and user feedback.
