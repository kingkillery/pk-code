# Commit Message Template

## Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Code style (formatting, semicolons, etc)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates

## Scope Examples
- core
- utils
- api
- ui
- config
- tests

## Subject Rules
- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Max 50 characters

## Body Guidelines
- Explain WHAT and WHY, not HOW
- Include issue/ticket reference
- Note breaking changes
- Document trade-offs made

## Examples

```
feat(api): add rate limiting to prevent abuse

Implements token bucket algorithm with configurable limits per endpoint.
Default: 100 requests per minute per IP.

Refs: #123
```

```
fix(core): prevent memory leak in event handler

Event listeners were not being properly removed on component unmount,
causing memory to accumulate over time. Now using WeakMap to track
listeners and ensure cleanup.

Bug introduced in: v2.3.0
Fixes: #456
```