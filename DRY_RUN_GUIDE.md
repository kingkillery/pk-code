# Development Environment Variables

This document describes environment variables useful for development, testing, and troubleshooting.

## Dry-Run Mode

### PK_DRY_RUN
Set to `1`, `true`, or `yes` to enable dry-run mode, which simulates responses without executing actual providers or making external API calls.

**Examples:**
```bash
# Bash/Linux/macOS
PK_DRY_RUN=1 node bundle/pk.js --prompt "Hello world"
PK_DRY_RUN=1 node bundle/pk.js use test-agent "Debug this issue"

# PowerShell/Windows
$env:PK_DRY_RUN=1; node bundle/pk.js --prompt "Hello world"
$env:PK_DRY_RUN=1; node bundle/pk.js use test-agent "Debug this issue"
```

**Use cases:**
- Testing CLI behavior without credentials
- Verifying command parsing and dry-run output
- Development environments where provider access is limited

## Parallel Processing

### PK_PARALLEL_PK_SCRIPT
Override the script path used by parallel task runners to spawn child processes. Useful when running bundled versions.

**Example:**
```bash
PK_PARALLEL_PK_SCRIPT="$(pwd)/bundle/pk.js" PK_DRY_RUN=1 node bundle/pk.js --parallel "Task 1,Task 2" --parallel-tasks 2
```

## Security Store Options

### PK_DISABLE_SECURE_STORE
Set to `1`, `true`, or `yes` to disable keytar/system keychain and use file-based credential storage instead.

**Example:**
```bash
PK_DISABLE_SECURE_STORE=1 node bundle/pk.js config set openrouter YOUR_API_KEY
```

**Use cases:**
- Environments where native modules (keytar) can't be loaded
- Development setups requiring portable credential storage
- Troubleshooting keychain access issues

**Security note:** File-based storage writes credentials to `~/.gemini/credentials.json` with restrictive permissions (0600 on POSIX systems).

## Troubleshooting with keytar-stub

For environments where keytar native module loading fails:

```bash
NODE_OPTIONS="--require $(pwd)/scripts/keytar-stub.cjs" PK_DRY_RUN=1 node bundle/pk.js use reviewer "Audit tests"
```

## Combined Example

Full dry-run with all overrides for bundled testing:

```bash
NODE_OPTIONS="--require $(pwd)/scripts/keytar-stub.cjs" \
PK_PARALLEL_PK_SCRIPT="$(pwd)/bundle/pk.js" \
PK_DRY_RUN=1 \
node bundle/pk.js --parallel "Say hello,Give me 3 testing tips" --parallel-tasks 2 --yolo
```
