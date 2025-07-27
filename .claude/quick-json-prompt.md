# Quick Prompt: Generate Code Agent Best Practices JSON

## Task

Analyze https://github.com/promptslab/Awesome-Prompt-Engineering and create a JSON guide of best practices specifically for prompting code generation agents.

## Focus

Extract ONLY techniques that improve AI code generation for:

- Writing functions/classes
- Debugging code
- Code reviews
- Testing
- Refactoring
- Architecture

## Required JSON Structure

```json
{
  "best_practices": {
    "code_generation": [{
      "name": "Technique Name",
      "description": "What it does",
      "example_prompt": "Concrete example",
      "improvement": "+X% quality/speed"
    }],
    "debugging": [...],
    "testing": [...],
    "refactoring": [...]
  },
  "top_5_techniques": [{
    "technique": "Name",
    "one_liner": "Quick description",
    "impact": "high/medium/low"
  }],
  "implementation_plan": {
    "immediate": ["Do X", "Do Y"],
    "next_month": ["Try Z"]
  }
}
```

## Output

Return ONLY valid JSON. No explanations outside the JSON structure.
