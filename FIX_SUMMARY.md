# Fix for `/model` and `/inference-p` Commands Not Updating OpenRouter Requests

## Problem

The `/model` and `/inference-p` commands were not actually changing what goes to OpenRouter when making requests. When users ran these commands, they would update the environment variables (`OPENROUTER_MODEL` and `OPENROUTER_PROVIDER`), but the changes wouldn't be reflected in the actual API requests.

## Root Cause

The issue was in the content generator lifecycle:

1. **Commands worked correctly**: Both `/model` and `/inference-p` properly updated environment variables
2. **Content generator not recreated**: The `OpenRouterContentGenerator` was created once during authentication and never recreated when environment variables changed
3. **Configuration read only at creation**: Environment variables like `OPENROUTER_PROVIDER` were only read during `createContentGeneratorConfig()` execution
4. **Headers set at initialization**: The `X-OR-Provider` header was set once in the OpenAI client constructor and never updated

## Solution

Added a new method `refreshContentGenerator()` to the `Config` class that:

1. **Recreates content generator config**: Calls `createContentGeneratorConfig()` again to pick up current environment variables
2. **Reinitializes the client**: Calls `geminiClient.initialize()` with the new config
3. **Preserves other settings**: Maintains sampling parameters and other configuration

### Files Modified

#### `packages/core/src/config/config.ts`
- Added `refreshContentGenerator()` method to recreate the content generator with current environment variables

#### `packages/cli/src/ui/commands/model.ts`
- Added call to `config.refreshContentGenerator()` after setting OpenRouter model
- Only refreshes for OpenRouter auth type to avoid unnecessary work

#### `packages/cli/src/ui/commands/inferenceProviderCommand.ts`
- Added call to `config.refreshContentGenerator()` after setting OpenRouter provider
- Added refresh call when clearing provider (setting to "auto")
- Only refreshes for OpenRouter auth type

## How It Works

### Before Fix
```
User runs /model new-model
↓
Environment variable updated: OPENROUTER_MODEL=new-model
↓
Content generator still uses old model (created at auth time)
↓
API requests go to old model ❌
```

### After Fix
```
User runs /model new-model
↓
Environment variable updated: OPENROUTER_MODEL=new-model
↓
config.refreshContentGenerator() called
↓
New content generator created with current environment
↓
API requests go to new model ✅
```

## Testing

The fix was validated by:

1. **Build verification**: Project builds successfully with no TypeScript errors
2. **Code analysis**: Verified the flow from command → environment update → content generator refresh
3. **Environment variable pickup**: Confirmed `createContentGeneratorConfig()` reads current `process.env` values

## Impact

- **Fixes the core issue**: `/model` and `/inference-p` commands now properly affect OpenRouter requests
- **Backward compatible**: No breaking changes to existing functionality
- **Efficient**: Only refreshes content generator for OpenRouter, other auth types unaffected
- **Error resilient**: Refresh failures don't break the command execution

## Usage

After this fix, users can now:

```bash
# Switch models and see immediate effect
/model anthropic/claude-3-sonnet

# Switch inference providers and see immediate effect  
/inference-p cerebras

# Clear provider to use OpenRouter's automatic selection
/inference-p auto
```

All changes will be reflected in subsequent API requests to OpenRouter.
