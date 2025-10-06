# Provider Registry System

The Provider Registry is a centralized system for managing AI providers, their capabilities, and default models in PK Code. This system provides a unified way to discover, configure, and use different AI providers.

## Overview

The provider registry system consists of:

- **Registry Schema**: JSON schema defining provider structure and validation
- **Registry Service**: Runtime loading and access to provider data
- **Utility Functions**: Helper functions for provider operations
- **CLI Integration**: Command-line tools for provider management

## Features

### 🔍 **Provider Discovery**

- List all available AI providers
- Filter providers by capabilities (vision, tool calling, etc.)
- Get detailed information about specific providers

### 🎯 **Intelligent Model Selection**

- Automatic model selection based on requirements
- Capability-based filtering (vision, embedding, etc.)
- Cost optimization with cheapest model selection
- Fallback chains for reliability

### ⚙️ **Configuration Management**

- Validate provider configurations
- Check environment variable setup
- Detect missing API keys
- Provide actionable configuration advice

### 📊 **Capability Matching**

- Find providers that support specific features
- Compare providers by capabilities
- Get recommendations for different use cases

## CLI Commands

### List All Providers

```bash
pk config providers
```

Shows a table of all available providers with their configuration status.

### Get Provider Details

```bash
pk config provider <provider-id>
```

Displays detailed information about a specific provider, including:

- Capabilities and features
- Available models
- Configuration status
- Required environment variables

### Get Recommendations

```bash
pk config recommend
```

Provides provider recommendations for different use cases:

- General purpose chat
- Fast responses
- Vision and image analysis
- Large context windows
- Text embeddings

### Configuration Doctor

```bash
pk config doctor
```

Checks your overall configuration and provides actionable advice.

## Provider Schema

Each provider in the registry includes:

### Basic Information

- `id`: Unique identifier (e.g., "openai", "anthropic")
- `name`: Human-readable name
- `description`: Provider description
- `envKey`: Environment variable for API key
- `package`: NPM package name

### Models

- `defaultModels`: Default models for different types
  - `chat`: Primary chat model
  - `fast`: Fast response model
  - `embedding`: Text embedding model
  - `image`: Image generation model

### Capabilities

- `vision`: Can process images
- `toolCalling`: Can call external tools
- `streaming`: Supports streaming responses
- `embedding`: Can generate embeddings
- `imageGeneration`: Can generate images
- `maxContext`: Maximum context window size
- `supportsSystemMessages`: Supports system messages
- `supportsParallelTools`: Can execute tools in parallel

### Pricing (Optional)

- `currency`: Currency code
- `perMillionTokens`: Pricing per 1M tokens
  - Input and output pricing for each model

### Endpoints

- `chat`: Chat completion endpoint
- `embedding`: Embedding generation endpoint
- `image`: Image generation endpoint

## Programmatic Usage

### Import Registry Functions

```typescript
import {
  getAllProviders,
  getProvider,
  getProvidersWithCapability,
  selectBestModel,
  validateProviderConfiguration,
} from '@pk-code/core';
```

### Get All Providers

```typescript
const providers = await getAllProviders();
console.log(`Found ${providers.length} providers`);
```

### Filter by Capability

```typescript
const visionProviders = await getProvidersWithCapability('vision');
console.log(
  'Vision-capable providers:',
  visionProviders.map((p) => p.name),
);
```

### Select Best Model

```typescript
// Get best chat model with vision capability
const selection = await selectBestModel({
  modelType: 'chat',
  capability: 'vision',
  preferCheapest: true,
});

if (selection) {
  console.log(`Selected: ${selection.provider.name} - ${selection.model}`);
}
```

### Validate Configuration

```typescript
const validation = await validateProviderConfiguration('openai');
if (!validation.isValid) {
  console.log('Missing variables:', validation.missingVars);
}
```

## Adding New Providers

To add a new provider to the registry:

### 1. Update Registry JSON

Edit `packages/core/providers/registry.json`:

```json
{
  "providers": {
    "new-provider": {
      "id": "new-provider",
      "name": "New Provider",
      "description": "Description of the provider",
      "envKey": "NEW_PROVIDER_API_KEY",
      "package": "@pk-code/new-provider",
      "defaultModels": {
        "chat": "new-chat-model",
        "fast": "new-fast-model"
      },
      "capabilities": {
        "vision": true,
        "toolCalling": true,
        "streaming": true,
        "embedding": false,
        "imageGeneration": false,
        "maxContext": 128000,
        "supportsSystemMessages": true,
        "supportsParallelTools": true
      },
      "endpoints": {
        "chat": "https://api.new-provider.com/v1/chat"
      }
    }
  }
}
```

### 2. Create Provider Package

Create a new package in `packages/new-provider/` with the provider implementation.

### 3. Update Tests

Add tests for the new provider in `packages/core/test/providers/`.

### 4. Update Documentation

Add provider-specific documentation and examples.

## Provider Capabilities

### Vision

Providers with vision capability can analyze and process images. Use for:

- Image analysis and description
- Visual question answering
- OCR and text extraction
- Chart and diagram interpretation

### Tool Calling

Providers that can call external tools and functions. Use for:

- API integrations
- Database queries
- File system operations
- External service calls

### Streaming

Providers that support real-time streaming responses. Use for:

- Real-time chat applications
- Long-running tasks
- Interactive applications
- Progressive response display

### Embedding

Providers that can generate text embeddings. Use for:

- Semantic search
- Document similarity
- Clustering and classification
- Recommendation systems

### Image Generation

Providers that can generate images from text. Use for:

- Creative content generation
- Illustrations and graphics
- Concept visualization
- Marketing materials

## Best Practices

### Model Selection

1. **Use capability-based selection**: Filter by required features first
2. **Consider cost**: Use `preferCheapest` for cost-sensitive applications
3. **Plan for context**: Ensure sufficient context window for your use case
4. **Have fallbacks**: Use fallback chains for reliability

### Configuration

1. **Use environment variables**: Store API keys securely
2. **Validate configuration**: Use the doctor command to check setup
3. **Document requirements**: Keep track of required variables
4. **Test provider access**: Verify connectivity before use

### Performance

1. **Cache provider data**: Registry data is cached automatically
2. **Use appropriate models**: Match model capabilities to requirements
3. **Monitor usage**: Track token usage and costs
4. **Optimize prompts**: Use efficient prompting strategies

## Troubleshooting

### Provider Not Found

```bash
pk config providers
```

Check if the provider ID is correct and listed in the registry.

### Configuration Issues

```bash
pk config doctor
```

Run the configuration doctor to identify and fix issues.

### Missing Environment Variables

Check the provider details for required environment variables:

```bash
pk config provider <provider-id>
```

### Model Selection Issues

Use the recommend command to get suitable models:

```bash
pk config recommend
```

## Examples

### Basic Provider Listing

```typescript
import { getAllProviders } from '@pk-code/core';

const providers = await getAllProviders();
providers.forEach((provider) => {
  console.log(`${provider.name}: ${provider.description}`);
});
```

### Capability-Based Selection

```typescript
import { getProvidersWithCapability, selectBestModel } from '@pk-code/core';

// Get vision-capable providers
const visionProviders = await getProvidersWithCapability('vision');

// Select best vision model
const bestVisionModel = await selectBestModel({
  modelType: 'chat',
  capability: 'vision',
});
```

### Configuration Validation

```typescript
import {
  validateProviderConfiguration,
  getConfiguredProviders,
} from '@pk-code/core';

// Check specific provider
const openaiValidation = await validateProviderConfiguration('openai');
if (!openaiValidation.isValid) {
  console.log('OpenAI not configured:', openaiValidation.missingVars);
}

// Get all configured providers
const configuredProviders = await getConfiguredProviders();
console.log(
  'Configured providers:',
  configuredProviders.map((p) => p.name),
);
```

## Architecture

The provider registry system follows a layered architecture:

```
┌─────────────────────────────────────┐
│           CLI Commands              │
├─────────────────────────────────────┤
│         Utility Functions           │
├─────────────────────────────────────┤
│        Registry Service             │
├─────────────────────────────────────┤
│         Registry Schema              │
├─────────────────────────────────────┤
│        Registry JSON                 │
└─────────────────────────────────────┘
```

- **Registry JSON**: Central data store for provider information
- **Registry Schema**: Validation and type safety
- **Registry Service**: Data access and caching
- **Utility Functions**: High-level operations
- **CLI Commands**: User-facing tools

## Contributing

To contribute to the provider registry system:

1. **Fork the repository** and create a feature branch
2. **Add tests** for any new functionality
3. **Update documentation** for any changes
4. **Validate the registry** using the JSON schema
5. **Test CLI commands** to ensure they work correctly
6. **Submit a pull request** with a clear description

## License

The provider registry system is part of PK Code and licensed under the Apache License 2.0.
