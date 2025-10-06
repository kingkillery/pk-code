# PK Code Authentication Guide

PK Code supports multiple authentication methods for AI providers, modeled after OpenAI's Codex CLI authentication flow.

## Table of Contents

- [Authentication Methods](#authentication-methods)
- [Getting Started](#getting-started)
- [Supported Providers](#supported-providers)
- [API Key Management](#api-key-management)
- [Environment Variables](#environment-variables)
- [Credential Storage](#credential-storage)
- [Troubleshooting](#troubleshooting)

---

## Authentication Methods

### 1. API Key Authentication (Recommended)

The primary authentication method uses API keys stored securely in `~/.pk/auth.json`.

#### Quick Start

```bash
# OpenAI
echo "sk-your-openai-key" | pk login --with-api-key --provider=openai

# Anthropic (Claude)
echo "sk-ant-your-anthropic-key" | pk login --with-api-key --provider=anthropic

# Google (Gemini)
echo "your-google-api-key" | pk login --with-api-key --provider=google
```

#### From File

```bash
# Store your API key in a file
echo "sk-your-api-key" > my_key.txt

# Login using the file
cat my_key.txt | pk login --with-api-key --provider=openai

# Or use input redirection
pk login --with-api-key --provider=openai < my_key.txt
```

### 2. Environment Variable Authentication

PK Code automatically detects environment variables for supported providers:

```bash
# OpenAI
export OPENAI_API_KEY="sk-your-key"

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-your-key"

# Google
export GOOGLE_API_KEY="your-google-key"

# Start PK Code (will use environment variables)
pk
```

**Note**: Environment variables are convenient but less secure than `auth.json` for long-term storage.

---

## Getting Started

### Step 1: Get Your API Key

#### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-` or `sk-proj-`)

#### Anthropic (Claude)
1. Visit https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copy the key (starts with `sk-ant-`)

#### Google (Gemini)
1. Visit https://makersuite.google.com/app/apikey
2. Click "Create API key"
3. Copy the key

### Step 2: Authenticate

```bash
# Method 1: Pipe the API key
echo "sk-your-api-key" | pk login --with-api-key --provider=openai

# Method 2: Use environment variable
export OPENAI_API_KEY="sk-your-api-key"
pk login --with-api-key --provider=openai
# When prompted, choose whether to save to auth.json
```

### Step 3: Verify Authentication

```bash
pk auth status
```

Expected output:
```
🔐 PK Code - Authentication Status

📁 Auth file: C:\Users\YourName\.pk\auth.json
   ✅ Exists

OpenAI:
   ✅ Configured
   📝 Source: auth.json
   📅 Added: 10/5/2025

Anthropic:
   ❌ Not configured
   💡 Run: echo "your-api-key" | pk login --with-api-key --provider=anthropic

Google:
   ❌ Not configured
   💡 Run: echo "your-api-key" | pk login --with-api-key --provider=google
```

### Step 4: Start Using PK Code

```bash
# Start interactive session
pk

# Or use directly with a prompt
pk --prompt "Explain how async/await works in JavaScript"

# Specify a model
pk --model gpt-4 --prompt "Write a Python script to parse JSON"
```

---

## Supported Providers

| Provider | API Key Prefix | Environment Variable | Default Model |
|----------|---------------|---------------------|---------------|
| **OpenAI** | `sk-` or `sk-proj-` | `OPENAI_API_KEY` | `gpt-4` |
| **Anthropic** | `sk-ant-` | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet-20241022` |
| **Google** | Alphanumeric (39 chars) | `GOOGLE_API_KEY` | `gemini-1.5-pro` |

### Additional Providers

PK Code also supports these providers through environment variables only:

- **OpenRouter**: `OPENROUTER_API_KEY`
- **Qwen**: `QWEN_API_KEY`
- **Cohere**: `COHERE_API_KEY`
- **Azure OpenAI**: `AZURE_OPENAI_API_KEY`
- **ModelScope**: `MODELSCOPE_API_KEY`

---

## API Key Management

### Check Authentication Status

```bash
pk auth status
```

This command shows:
- Auth file location and status
- Configured providers with source (auth.json or environment variable)
- Creation and last used dates
- Legacy credential storage status

### Logout from Provider

```bash
# Logout from specific provider
pk auth logout --provider=openai

# Logout from all providers
pk auth logout
```

### Update API Key

To update an existing API key, simply login again:

```bash
echo "sk-new-key" | pk login --with-api-key --provider=openai
```

The new key will replace the old one.

---

## Environment Variables

### Priority Order

PK Code uses the following priority order for credentials:

1. **auth.json** (highest priority)
2. **Environment variables**
3. **Legacy storage** (keytar/credentials.json)

### Setting Environment Variables

#### Windows (PowerShell)
```powershell
$env:OPENAI_API_KEY="sk-your-key"
```

#### Windows (Command Prompt)
```cmd
set OPENAI_API_KEY=sk-your-key
```

#### macOS/Linux
```bash
export OPENAI_API_KEY="sk-your-key"
```

### Permanent Environment Variables

#### Windows
Add to System Environment Variables via System Properties

#### macOS/Linux
Add to `~/.bashrc`, `~/.zshrc`, or `~/.profile`:
```bash
export OPENAI_API_KEY="sk-your-key"
export ANTHROPIC_API_KEY="sk-ant-your-key"
```

### Using .env Files

Create a `.env` file in your project directory:

```bash
# .env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_API_KEY=your-google-key
```

PK Code will automatically load environment variables from `.env` files.

---

## Credential Storage

### auth.json Location

| Platform | Location |
|----------|----------|
| **Windows** | `C:\Users\USERNAME\.pk\auth.json` |
| **macOS** | `~/.pk/auth.json` |
| **Linux** | `~/.pk/auth.json` |

### File Permissions

The `auth.json` file is created with restrictive permissions:
- **Unix/Linux/macOS**: `0600` (read/write for owner only)
- **Windows**: Default file permissions (protected by user account)

### File Structure

```json
{
  "openai": {
    "apiKey": "sk-your-key",
    "createdAt": "2025-10-05T12:34:56.789Z",
    "lastUsed": "2025-10-05T15:20:00.000Z"
  },
  "anthropic": {
    "apiKey": "sk-ant-your-key",
    "createdAt": "2025-10-05T12:35:00.000Z"
  }
}
```

### Security Best Practices

1. **Never commit auth.json** to version control
   ```bash
   # Add to .gitignore
   echo ".pk/auth.json" >> .gitignore
   ```

2. **Use environment variables for CI/CD**
   ```yaml
   # GitHub Actions example
   env:
     OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
   ```

3. **Rotate API keys regularly**
   - Create new keys every 90 days
   - Delete old keys from provider dashboard

4. **Use separate keys for different environments**
   - Development: Lower rate limits
   - Production: Higher rate limits with monitoring

---

## Headless & Remote Authentication

### SSH Port Forwarding (for remote servers)

```bash
# On local machine: Forward port 1455
ssh -L 1455:localhost:1455 user@remote-server

# On remote server: Login will use forwarded port
pk login --with-api-key
```

### Docker Containers

```bash
# Build and login locally first
pk login --with-api-key --provider=openai

# Copy auth.json to container
docker cp ~/.pk/auth.json container_name:/root/.pk/auth.json

# Or mount as volume
docker run -v ~/.pk:/root/.pk your-image
```

### CI/CD Environments

Use environment variables in CI/CD:

```yaml
# GitHub Actions
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run PK Code
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npm install -g pk-code-cli
          pk --prompt "Generate tests"
```

---

## Troubleshooting

### Invalid API Key Format

```
❌ Invalid OPENAI API key format
   OpenAI API keys should start with 'sk-' or 'sk-proj-'
```

**Solution**: Verify you copied the complete API key from your provider's dashboard.

### Permission Denied

```
Error: EACCES: permission denied, open '/home/user/.pk/auth.json'
```

**Solution**: Check file permissions:
```bash
chmod 600 ~/.pk/auth.json
```

### API Key Not Detected

```bash
pk auth status
# Shows provider as "Not configured"
```

**Solutions**:
1. Verify environment variable is set: `echo $OPENAI_API_KEY`
2. Check auth.json exists: `cat ~/.pk/auth.json`
3. Re-login: `echo "sk-key" | pk login --with-api-key`

### 401 Unauthorized Errors

Possible causes:
1. Invalid or expired API key
2. Incorrect provider configuration
3. API key doesn't have required permissions

**Solution**:
```bash
# Check status
pk auth status

# Logout and re-login
pk auth logout --provider=openai
echo "sk-new-key" | pk login --with-api-key --provider=openai
```

### Multiple API Keys

If you have multiple API keys for different projects:

```bash
# Project A
echo "sk-project-a-key" | pk login --with-api-key --provider=openai

# Project B (in different directory)
cd ~/project-b
export OPENAI_API_KEY="sk-project-b-key"
pk  # Uses environment variable
```

---

## Migration from Legacy Credentials

If you were using the old `credentials.json` or keytar storage:

```bash
# Check for legacy credentials
pk auth status
# Look for "Legacy Credentials" section

# Migrate to auth.json
echo "your-api-key" | pk login --with-api-key --provider=openai

# Verify migration
pk auth status
```

---

## Advanced Configuration

### Custom Auth File Location

Set the `CODEX_HOME` environment variable:

```bash
export CODEX_HOME="/custom/path"
# Auth file will be at /custom/path/auth.json
```

### Disabling Secure Storage

To force file-based storage only:

```bash
export PK_DISABLE_SECURE_STORE=1
# Or
export NO_KEYTAR=1
```

### Multiple Provider Keys

You can authenticate with multiple providers simultaneously:

```bash
# Add OpenAI
echo "sk-openai-key" | pk login --with-api-key --provider=openai

# Add Anthropic
echo "sk-ant-anthropic-key" | pk login --with-api-key --provider=anthropic

# Add Google
echo "google-key" | pk login --with-api-key --provider=google

# Check all
pk auth status
```

---

## API Reference

### Commands

```bash
# Login with API key
pk login --with-api-key [--provider=openai|anthropic|google]

# Check authentication status
pk auth status

# Logout from provider
pk auth logout [--provider=openai|anthropic|google]

# Logout from all providers
pk auth logout
```

### Environment Variables

```bash
# Required (at least one)
OPENAI_API_KEY          # OpenAI API key
ANTHROPIC_API_KEY       # Anthropic (Claude) API key
GOOGLE_API_KEY          # Google (Gemini) API key

# Optional
PK_DISABLE_SECURE_STORE # Disable keytar, use file storage only
CODEX_HOME              # Custom auth file directory
NO_KEYTAR               # Alternative flag to disable keytar
```

---

## Examples

### Basic Workflow

```bash
# 1. Get API key from https://platform.openai.com/api-keys

# 2. Login
echo "sk-your-key" | pk login --with-api-key --provider=openai

# 3. Verify
pk auth status

# 4. Use PK Code
pk
> How do I implement a binary search tree in Python?
```

### Multi-Provider Setup

```bash
# Setup all providers
echo "sk-openai-key" | pk login --with-api-key --provider=openai
echo "sk-ant-key" | pk login --with-api-key --provider=anthropic
echo "google-key" | pk login --with-api-key --provider=google

# Use specific provider
pk --model gpt-4 --prompt "OpenAI task"
pk --model claude-3-5-sonnet --prompt "Anthropic task"
pk --model gemini-1.5-pro --prompt "Google task"
```

### Team Setup

For teams, use service accounts:

```bash
# Create service account key at https://platform.openai.com/api-keys
# Name: pk-code-team (Service Account)

# Each team member:
echo "sk-service-account-key" | pk login --with-api-key
```

---

## See Also

- [PK Code README](../README.md)
- [Provider Configuration](./providers.md)
- [Environment Variables](./environment-variables.md)
- [Security Best Practices](./security.md)
