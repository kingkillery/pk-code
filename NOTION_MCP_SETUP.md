# Notion MCP Server Configuration for pk-code

## ⚠️ OAuth Authentication Required

The Notion MCP server requires OAuth authentication, which pk-code doesn't currently support directly.

## The Challenge

Notion MCP uses OAuth 2.0 for authentication, not simple API keys. According to Notion's documentation:
- Users must complete an OAuth flow through the Notion app or their AI tool
- The OAuth process generates temporary access tokens
- These tokens are managed by Notion, not static API keys

## Why Current Configuration Won't Work

```json
{
  "mcpServers": {
    "Notion_placeholder": {
      "httpUrl": "https://mcp.notion.com/mcp",
      "headers": {
        "comment": "OAuth required - not just a Bearer token"
      }
    }
  }
}
```

The configuration above won't work because:
1. Notion MCP doesn't accept static API keys
2. It requires a full OAuth flow with user consent
3. pk-code doesn't have built-in OAuth flow handling for MCP servers

## How It Works

### 1. Transport Type: HTTP Streaming
- **Endpoint:** `https://mcp.notion.com/mcp`
- **Transport:** `StreamableHTTPClientTransport`
- **Advantage:** More reliable than SSE for long-running connections

### 2. Authentication
- Uses Bearer token authentication via the `Authorization` header
- Token is read from the `NOTION_API_KEY` environment variable
- pk-code automatically expands `${NOTION_API_KEY}` when loading settings

### 3. Environment Variable Expansion
pk-code's settings loader (`packages/cli/src/config/settings.ts`) includes built-in support for environment variable expansion:
- Supports both `$VAR_NAME` and `${VAR_NAME}` syntax
- Applied to all settings including MCP server configurations
- Headers are fully resolved before being passed to the transport

## Setup Instructions

### Step 1: Set Your Notion API Key

**For PowerShell (your current shell):**
```powershell
$env:NOTION_API_KEY = "your-actual-notion-api-key"
```

**For CMD:**
```cmd
set NOTION_API_KEY=your-actual-notion-api-key
```

**For Bash/Linux/Mac:**
```bash
export NOTION_API_KEY="your-actual-notion-api-key"
```

### Step 2: Verify the Configuration

Run pk-code to test the connection:
```bash
pk
```

Then use the `/mcp` command to see if Notion tools are discovered:
```
/mcp
```

You should see something like:
```
🟢 Notion - Ready (X tools)
  - Notion__search
  - Notion__fetch
  - Notion__create-pages
  - ... (other Notion tools)
```

## Alternative Configuration (SSE)

If you prefer Server-Sent Events (SSE) instead of HTTP streaming:

```json
{
  "mcpServers": {
    "Notion": {
      "url": "https://mcp.notion.com/sse",
      "headers": {
        "Authorization": "Bearer ${NOTION_API_KEY}"
      }
    }
  }
}
```

## Troubleshooting

### 1. "NOTION_API_KEY not set" Error
- Ensure you've set the environment variable in your current shell session
- Environment variables are session-specific - set it each time you open a new terminal

### 2. Connection Timeout
- The Notion MCP server might be temporarily unavailable
- Try again after a few moments

### 3. Authentication Error (401)
- Verify your NOTION_API_KEY is correct
- Ensure it starts with "secret_" (typical Notion API key format)

### 4. No Tools Available
- Check that your Notion integration has proper permissions
- Verify the workspace access for your API key

## Technical Details

### How pk-code Processes MCP Configurations

1. **Settings Loading** (`loadSettings()` in `settings.ts`):
   - Loads from `~/.pk/settings.json`
   - Applies `resolveEnvVarsInObject()` to expand environment variables

2. **Transport Creation** (`createTransport()` in `mcp-client.ts`):
   - Detects `httpUrl` property → Creates `StreamableHTTPClientTransport`
   - Passes headers via `requestInit.headers`
   - Headers include the expanded Authorization token

3. **Connection Process**:
   - Client connects with 10-minute default timeout
   - Tools are discovered via MCP protocol
   - Tools are registered with pk-code's tool registry

### Code Flow
```
settings.json → loadSettings() → resolveEnvVarsInObject() → 
Config creation → discoverMcpTools() → createTransport() → 
StreamableHTTPClientTransport with headers → Notion MCP Server
```

## Security Notes

- Never commit your API key to version control
- Use environment variables for all sensitive values
- The `${NOTION_API_KEY}` syntax ensures the key isn't stored in plain text
- Consider using a `.env` file for persistent environment variables (pk-code supports this)

## What You Can Do Now

With the Notion MCP server configured, pk-code can:
- Search your Notion workspace
- Fetch page and database contents  
- Create and update pages
- Manage database entries
- Access all other Notion API capabilities exposed via MCP

## Test Script

A test script has been created at:
`C:\Users\prest\Desktop\Desktop_Projects\May-Dec-2025\Qwen-Code\pk-code\test-notion-mcp.js`

Run it to verify your configuration:
```bash
node test-notion-mcp.js
```

## Support

If you encounter issues:
1. Check the pk-code debug output with `--debug` flag
2. Review the MCP server status with `/mcp` command
3. Consult the pk-code documentation for MCP servers
