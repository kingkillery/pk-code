# Self-Discovery Mode for Complex Problems

## Activation Trigger

Use this framework when encountering:

- Problems requiring >5 minutes of investigation
- Multiple failed solution attempts
- Architectural decisions with long-term impact
- Performance issues with unclear root cause
- Integration challenges across multiple systems

## Atomic Reasoning Modules

### 1. Problem Decomposition

- "What is the absolute smallest unit of this problem?"
- "Can I create a minimal reproducible example?"
- "What assumptions am I making that might be wrong?"

### 2. Creative Exploration

- "What would a completely different approach look like?"
- "How would I solve this if performance didn't matter?"
- "What pattern from a different domain could apply here?"

### 3. Risk & Impact Analysis

- "What could go catastrophically wrong?"
- "How does this affect system scalability?"
- "What technical debt am I creating or removing?"

### 4. Evidence Gathering

- "What data/logs/metrics support my hypothesis?"
- "Have I verified my assumptions with actual tests?"
- "What does the specification/documentation actually say?"

### 5. Systems Thinking

- "How does this fit into the larger architecture?"
- "What are the second-order effects?"
- "Which stakeholders are impacted?"

## Documentation Template

```markdown
## Problem Investigation: [Title]

### Initial Understanding

- What I thought the problem was: ...
- Key assumptions made: ...

### Discovery Process

1. [Hypothesis 1]: [Result - Validated/Invalidated]
2. [Hypothesis 2]: [Result - Validated/Invalidated]

### Root Cause

- Actual issue: ...
- Why it wasn't obvious: ...

### Solution

- Approach taken: ...
- Alternatives considered: ...
- Trade-offs accepted: ...

### Lessons Learned

- What would have helped find this faster: ...
- Patterns to watch for: ...
```

## Remember

When in Self-Discovery Mode, your goal isn't just to solve the problem—it's to understand it so deeply that you can prevent similar issues in the future.
