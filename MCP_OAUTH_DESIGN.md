# MCP OAuth Implementation Design for pk-code

## Overview

The Notion MCP server and potentially other MCP servers require OAuth 2.0 authentication. Currently, pk-code only supports static authentication methods (API keys, environment variables). This design outlines how to add OAuth support to pk-code's MCP client implementation.

## Current State

### Existing Components
1. **OAuth Implementation**: `packages/core/src/code_assist/oauth2.ts` - Google OAuth client
2. **MCP Transports**: 
   - `StdioClientTransport` - Process-based communication
   - `SSEClientTransport` - Server-Sent Events 
   - `StreamableHTTPClientTransport` - HTTP streaming
3. **Settings System**: Environment variable expansion in headers

### Gap Analysis
- No OAuth flow for MCP servers
- No token management for MCP connections
- No automatic token refresh for long-running MCP sessions

## Proposed Solution

### Architecture

```
User → pk-code → OAuthMCPTransport → OAuth Provider → MCP Server
                        ↓
                  Token Manager
                        ↓
                  Token Storage
```

### Components to Build

#### 1. OAuthMCPTransport Class
A new transport class that wraps existing transports with OAuth capabilities:

```typescript
class OAuthMCPTransport implements Transport {
  private innerTransport: StreamableHTTPClientTransport | SSEClientTransport;
  private tokenManager: MCPTokenManager;
  
  constructor(config: OAuthMCPConfig) {
    this.tokenManager = new MCPTokenManager(config);
    // Initialize inner transport based on config
  }
  
  async connect(): Promise<void> {
    const token = await this.tokenManager.getValidToken();
    // Configure inner transport with Bearer token
    await this.innerTransport.connect();
  }
}
```

#### 2. MCPTokenManager Class
Handles OAuth flow and token lifecycle:

```typescript
class MCPTokenManager {
  private oauth2Client: OAuth2Client;
  private tokenCache: TokenCache;
  
  async getValidToken(): Promise<string> {
    // Check cache for valid token
    // If expired, refresh
    // If no token, initiate OAuth flow
    return token;
  }
  
  private async initiateOAuthFlow(): Promise<void> {
    // Open browser for OAuth consent
    // Handle callback
    // Store tokens
  }
}
```

#### 3. Configuration Schema Update
Add OAuth configuration to MCPServerConfig:

```typescript
interface MCPServerConfig {
  // Existing fields...
  
  // OAuth configuration
  oauth?: {
    provider: 'notion' | 'custom';
    clientId?: string;
    clientSecret?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    redirectUri?: string;
  };
}
```

### OAuth Flow for Notion MCP

1. **Discovery Phase**:
   - Detect `oauth` configuration in settings
   - Initialize OAuth client with Notion's endpoints

2. **Authentication Phase**:
   - Check for cached tokens
   - If no valid token:
     - Start local HTTP server for callback
     - Open browser to Notion OAuth URL
     - Handle callback and exchange code for token
     - Cache tokens securely

3. **Connection Phase**:
   - Create transport with Bearer token header
   - Connect to MCP server

4. **Token Refresh**:
   - Monitor token expiry
   - Automatically refresh using refresh token
   - Update transport headers

### Settings Configuration

```json
{
  "mcpServers": {
    "Notion": {
      "httpUrl": "https://mcp.notion.com/mcp",
      "oauth": {
        "provider": "notion",
        "scopes": ["read_content", "write_content"],
        "redirectUri": "http://localhost:3000/oauth/callback"
      }
    }
  }
}
```

### Token Storage

- **Location**: `~/.pk/tokens/mcp/`
- **Format**: Encrypted JSON files per server
- **Security**: Use OS keychain when available (via keytar)

## Implementation Plan

### Phase 1: Core OAuth Infrastructure
1. Create `OAuthMCPTransport` class
2. Implement `MCPTokenManager` 
3. Add token storage with encryption

### Phase 2: Notion Integration
1. Add Notion OAuth provider configuration
2. Implement Notion-specific OAuth flow
3. Handle Notion's token format and refresh

### Phase 3: User Experience
1. Add CLI commands for OAuth management:
   - `pk mcp auth <server>` - Initiate authentication
   - `pk mcp logout <server>` - Clear tokens
   - `pk mcp status` - Show auth status
2. Improve error messages for auth failures
3. Add automatic browser opening with fallback to manual URL

### Phase 4: Testing & Documentation
1. Unit tests for OAuth components
2. Integration tests with mock OAuth server
3. Documentation for users and developers

## Security Considerations

1. **Token Storage**: 
   - Encrypt tokens at rest
   - Use OS keychain when available
   - Clear tokens on logout

2. **PKCE Flow**: 
   - Use PKCE for public clients
   - Generate secure state parameters
   - Validate state on callback

3. **Refresh Tokens**:
   - Store securely
   - Rotate on use
   - Handle expiry gracefully

## Alternative Approaches Considered

### 1. Manual Token Entry
Users manually obtain tokens from Notion and paste them in settings.
- **Pros**: Simple to implement
- **Cons**: Poor UX, tokens expire, no refresh

### 2. Proxy Server
Run a proxy that handles OAuth and forwards to MCP.
- **Pros**: Centralized auth management
- **Cons**: Additional complexity, requires hosting

### 3. Browser Extension
Use a browser extension to capture OAuth tokens.
- **Pros**: Works with any OAuth provider
- **Cons**: Requires extension installation, platform-specific

## Next Steps

1. Review and approve design
2. Create feature branch
3. Implement Phase 1
4. Test with Notion MCP
5. Iterate based on feedback

## Questions to Resolve

1. Should we use Notion's official OAuth endpoints or discover them?
2. How to handle multiple Notion workspaces?
3. Should tokens be per-project or global?
4. What's the token refresh strategy for long-running sessions?

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [Notion OAuth Documentation](https://developers.notion.com/docs/authorization)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
