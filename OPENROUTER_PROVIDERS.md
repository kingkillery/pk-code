# OpenRouter Provider Selection Guide

This guide explains how to specify inference providers when using OpenRouter as your model provider in Qwen Code.

## Quick Start

Set the `OPENROUTER_PROVIDER` environment variable to specify your preferred inference provider:

```bash
# Example: Use Cerebras for faster inference
export OPENROUTER_PROVIDER=cerebras

# Example: Use DeepInfra for cost-effective inference
export OPENROUTER_PROVIDER=deepinfra

# Example: Use Chutes for high-throughput inference
export OPENROUTER_PROVIDER=chutes
```

## Supported Providers

The following inference providers are supported:

- **openai** - OpenAI's native infrastructure
- **anthropic** - Anthropic's Claude infrastructure
- **google** - Google's infrastructure
- **meta-llama** - Meta's Llama infrastructure
- **mistralai** - Mistral AI's infrastructure
- **cohere** - Cohere's infrastructure
- **together** - Together AI's infrastructure
- **deepinfra** - DeepInfra (cost-effective)
- **fireworks** - Fireworks AI (high-speed)
- **lepton** - Lepton AI
- **novita** - Novita AI
- **cerebras** - Cerebras (ultra-fast inference)
- **chutes** - Chutes (high-throughput)

## Configuration Methods

### 1. Environment Variable

```bash
export OPENROUTER_PROVIDER=cerebras
```

### 2. .env File

Add to your `.env` file:

```
OPENROUTER_PROVIDER=deepinfra
```

### 3. Interactive Setup

When configuring OpenRouter for the first time, you'll be prompted to optionally specify a provider.

### 4. Slash Command (Runtime)

Use the `/inference-p` command to change the provider during a chat session:

```
# View current provider and options
/inference-p

# Set a specific provider
/inference-p cerebras

# Reset to automatic selection
/inference-p auto
```

**Features:**

- Tab completion for provider names
- Alternative command: `/infp` (short form)
- Only works when using OpenRouter authentication
- Changes take effect immediately for new requests

## Usage Examples

### Basic Setup

```bash
# Set your OpenRouter API key
export OPENROUTER_API_KEY=your_api_key_here

# Set your preferred model
export OPENROUTER_MODEL=qwen/qwen-2.5-coder-32b-instruct

# Set your preferred provider (optional)
export OPENROUTER_PROVIDER=cerebras

# Run Qwen Code
qwen
```

### Provider-Specific Use Cases

**For fastest inference (Cerebras):**

```bash
export OPENROUTER_PROVIDER=cerebras
export OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct
```

**For cost-effective inference (DeepInfra):**

```bash
export OPENROUTER_PROVIDER=deepinfra
export OPENROUTER_MODEL=qwen/qwen-2.5-coder-32b-instruct
```

**For high-throughput workloads (Chutes):**

```bash
export OPENROUTER_PROVIDER=chutes
export OPENROUTER_MODEL=anthropic/claude-3-sonnet
```

## How It Works

When you specify a provider, Qwen Code sends the `X-OR-Provider` header to OpenRouter's API, which routes your request to the specified inference provider. This allows you to:

- **Optimize for speed** - Use Cerebras for ultra-fast inference
- **Optimize for cost** - Use DeepInfra for budget-friendly inference
- **Optimize for throughput** - Use Chutes for high-volume workloads
- **Use specific infrastructure** - Route to the provider that best suits your needs

## Notes

- Provider selection is optional - OpenRouter will choose automatically if not specified
- Not all models are available on all providers
- Different providers may have different pricing and performance characteristics
- The provider setting is applied to all requests until changed

## Troubleshooting

If you encounter issues:

1. **Check provider availability**: Not all models are supported by all providers
2. **Verify spelling**: Provider names are case-sensitive
3. **Check your model**: Some models may only be available on specific providers
4. **Remove provider temporarily**: Set `OPENROUTER_PROVIDER=` to let OpenRouter choose automatically

For more information, visit the [OpenRouter documentation](https://openrouter.ai/docs).
