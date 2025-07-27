# Code Agent Prompting Best Practices JSON Schema

## Overview

This schema defines the structure for documenting best practices for prompting code generation agents.

## Schema Structure

```json
{
  "metadata": {
    "version": "string",
    "last_updated": "YYYY-MM-DD",
    "sources_reviewed": "number",
    "total_techniques": "number"
  },
  "best_practices": {
    "code_generation": ["array of technique objects"],
    "debugging": ["array of technique objects"],
    "code_review": ["array of technique objects"],
    "refactoring": ["array of technique objects"],
    "testing": ["array of technique objects"],
    "architecture": ["array of technique objects"],
    "documentation": ["array of technique objects"]
  },
  "agent_patterns": ["array of pattern objects"],
  "prompt_techniques": ["array of technique objects"],
  "quick_reference": {
    "top_5_immediate_wins": ["array of quick tip objects"],
    "common_pitfalls": ["array of pitfall objects"]
  },
  "implementation_roadmap": {
    "week_1": ["array of action objects"],
    "month_1": ["array of action objects"],
    "quarter_1": ["array of action objects"]
  }
}
```

## Object Definitions

### Technique Object

```json
{
  "technique_name": "string",
  "description": "string",
  "when_to_use": "string",
  "prompt_template": "string",
  "example": {
    "context": "string",
    "prompt": "string",
    "expected_improvement": "string"
  },
  "effectiveness_rating": "high|medium|low",
  "source": "string (with URL)"
}
```

### Agent Pattern Object

```json
{
  "pattern_name": "string",
  "description": "string",
  "components": [
    {
      "role": "string",
      "responsibility": "string",
      "prompt_style": "string"
    }
  ],
  "use_cases": ["array of strings"],
  "implementation_complexity": "low|medium|high",
  "example_workflow": "string",
  "source": "string (with URL)"
}
```

### Prompt Technique Object

```json
{
  "technique": "string",
  "category": "structure|context|reasoning|verification",
  "description": "string",
  "code_specific_benefits": ["array of strings"],
  "do_example": "string",
  "dont_example": "string",
  "impact_metrics": {
    "code_quality": "+X%",
    "bug_reduction": "+X%",
    "development_speed": "+X%"
  },
  "source": "string (with URL)"
}
```

## Usage

1. Use this schema when analyzing prompt engineering resources
2. Ensure all techniques are code-specific
3. Include measurable improvements where possible
4. Provide concrete examples for each technique
