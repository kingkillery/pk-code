# Suppressing Deprecation Warnings in Qwen CLI

This document outlines several methods to suppress deprecation warnings when running the Qwen CLI.

## Method 1: Using npm Scripts (Recommended)

The `package.json` includes scripts that automatically suppress warnings:

```bash
# Start with deprecation warnings suppressed
npm run start

# Start with all warnings suppressed
npm run start:clean
```

## Method 2: Using Node.js Command Line Flags

You can run the CLI directly with Node.js flags:

```bash
# Suppress only deprecation warnings
node --no-deprecation dist/index.js

# Suppress all warnings
node --no-deprecation --no-warnings dist/index.js

# Examples with arguments
node --no-deprecation dist/index.js --help
node --no-deprecation dist/index.js --debug
```

## Method 3: Using Environment Variables

Set environment variables to suppress warnings:

```bash
# On Unix/Linux/macOS
NODE_NO_WARNINGS=1 node dist/index.js

# On Windows (Command Prompt)
set NODE_NO_WARNINGS=1 && node dist/index.js

# On Windows (PowerShell)
$env:NODE_NO_WARNINGS=1; node dist/index.js
```

## Method 4: Using Wrapper Scripts

We've provided wrapper scripts for convenience:

### Unix/Linux/macOS:

```bash
chmod +x qwen-clean.sh
./qwen-clean.sh --help
```

### Windows:

```batch
qwen-clean.bat --help
```

## Method 5: Global Installation

When installing globally, the shebang in the main entry point should automatically suppress deprecation warnings:

```bash
npm install -g @qwen-code/qwen-code
qwen --help  # Should run without deprecation warnings
```

## Common Deprecation Warnings

The most common deprecation warnings you might see are:

- Buffer constructor deprecation warnings
- Deprecated crypto methods
- Old module resolution patterns
- Legacy event emitter patterns

All of these methods will suppress these warnings while keeping other important error messages visible.
