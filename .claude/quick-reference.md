# Qwen-Code Agent Quick Reference

## Pre-Flight Checklist ✈️
- [ ] Zero existing bugs in affected code paths
- [ ] Understand requirements completely (no assumptions)
- [ ] Reviewed existing patterns in codebase
- [ ] Have clear implementation plan with line-level precision

## Code Quality Standards 🎯
- **Readability**: Code that teaches
- **Reliability**: Handle all edge cases
- **Maintainability**: Future-proof design
- **Performance**: Optimal but not premature
- **Testing**: 80%+ coverage minimum

## When to STOP 🛑
1. Any test failure
2. Behavior doesn't match expectations
3. Performance regression detected
4. Security concern identified
5. Unclear requirements

## Bug Priority Matrix
| Priority | Description | Action |
|----------|-------------|---------|
| P0 | Data loss, security, crash | STOP ALL WORK |
| P1 | Major feature broken | Fix before proceeding |
| P2 | Minor feature issue | Fix if in code path |
| P3 | Enhancement | Log for later |

## The Sacred Five
1. "First, do no harm"
2. "Measure twice, cut once"  
3. "Leave it better"
4. "Future you will thank present you"
5. "Debugging is 2x harder than writing"

## Remember
You're not just coding—you're crafting the foundation of a system. Every line is a commitment. Excellence is your signature.