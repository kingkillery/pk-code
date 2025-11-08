# MCP HTTP Transport Configuration for PK-Code

## Quick Start

To configure an HTTP-based MCP server in PK-Code, add the configuration to `~/.pk/settings.json`:

```json
{
  "mcpServers": {
    "my-http-server": {
      "httpUrl": "http://localhost:8080/mcp",
      "headers": {
        "Authorization": "Bearer your-token-here"
      },
      "timeout": 600000,
      "trust": true
    }
  }
}
```

## Configuration Location

PK-Code loads MCP server configurations from (in order of precedence):

1. **System settings**:
   - macOS: `/Library/Application Support/QwenCode/settings.json`
   - Windows: `C:\ProgramData\qwen-code\settings.json`
   - Linux: `/etc/qwen-code/settings.json`

2. **User settings**: `~/.pk/settings.json` (**Recommended**)

3. **Workspace settings**: `<your-project>/.pk/settings.json`

## Configuration Format

### HTTP Transport Configuration

```json
{
  "mcpServers": {
    "<server-name>": {
      "httpUrl": "<http-or-https-url>",
      "headers": {
        "<header-name>": "<header-value>"
      },
      "timeout": <milliseconds>,
      "trust": <true-or-false>,
      "description": "<optional-description>"
    }
  }
}
```

### Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `httpUrl` | string | Yes | The HTTP/HTTPS URL where your MCP server is accessible (e.g., `http://localhost:8080/mcp`) |
| `headers` | object | No | Custom HTTP headers to send with requests (e.g., `Authorization`) |
| `timeout` | number | No | Request timeout in milliseconds (default: 600000 = 10 minutes) |
| `trust` | boolean | No | If true, allows potentially unsafe tool execution (default: false) |
| `description` | string | No | Human-readable description of the server |
| `includeTools` | string[] | No | Array of tool names to include (all others excluded) |
| `excludeTools` | string[] | No | Array of tool names to exclude from this server |

## Configuration Examples

### Example 1: Local HTTP MCP Server

```json
{
  "mcpServers": {
    "local-mcp-server": {
      "httpUrl": "http://localhost:3000/mcp",
      "timeout": 300000,
      "trust": true,
      "description": "Local development MCP server"
    }
  }
}
```

### Example 2: Remote MCP Server with Authentication

```json
{
  "mcpServers": {
    "remote-mcp-server": {
      "httpUrl": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}",
        "X-Custom-Header": "custom-value"
      },
      "timeout": 600000,
      "trust": false
    }
  }
}
```

**Note**: Environment variables like `${API_KEY}` are automatically expanded from your environment.

### Example 3: Multiple MCP Servers

```json
{
  "mcpServers": {
    "server-one": {
      "httpUrl": "http://localhost:8080/mcp",
      "headers": {
        "Authorization": "Bearer token1"
      }
    },
    "server-two": {
      "httpUrl": "http://localhost:8081/mcp",
      "headers": {
        "Authorization": "Bearer token2"
      }
    },
    "server-three": {
      "httpUrl": "https://production.example.com/mcp"
    }
  }
}
```

### Example 4: Filtering Tools

```json
{
  "mcpServers": {
    "restricted-server": {
      "httpUrl": "http://localhost:8080/mcp",
      "includeTools": ["safe-tool-1", "safe-tool-2"]
    },
    "exclude-dangerous": {
      "httpUrl": "http://localhost:8081/mcp",
      "excludeTools": ["dangerous-tool", "file-system-delete"]
    }
  }
}
```

## Verifying Your Configuration

### Step 1: Create/Edit Settings File

```bash
# Create user settings directory if it doesn't exist
mkdir -p ~/.pk

# Edit settings file
nano ~/.pk/settings.json
```

### Step 2: Validate JSON Syntax

Use a JSON validator or run:

```bash
cat ~/.pk/settings.json | python -m json.tool
```

### Step 3: Start PK-Code

```bash
pk
```

### Step 4: Check MCP Server Status

In the PK-Code interface, MCP server status will be displayed during startup, or you can check debug logs:

```bash
pk --debug
```

Look for messages like:
```
[MCP] Tool discovery started
[MCP] Tool discovery completed in Xms
```

## Troubleshooting

### Issue: "No enabled tools found"

**Solution**: Check that your MCP server is actually providing tools. You can test with:

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Issue: "Failed to start or connect to MCP server"

**Solution**:
1. Verify the server is running: `curl http://localhost:8080/mcp`
2. Check network connectivity
3. Verify the URL path is correct (some servers use `/`, others use `/mcp`)
4. Check if authentication headers are required

### Issue: "Request timeout"

**Solution**: Increase the timeout value in your configuration:
```json
{
  "mcpServers": {
    "my-server": {
      "httpUrl": "http://localhost:8080/mcp",
      "timeout": 1200000  // 20 minutes
    }
  }
}
```

### Issue: "Unauthorized" or "401"

**Solution**: Verify your authentication headers are correct and properly formatted.

### Issue: "Invalid configuration: missing httpUrl"

**Solution**: Make sure you're using `httpUrl` (for HTTP transport) and not `url` (for SSE) or `command` (for stdio).

## How It Works (Technical Details)

PK-Code uses the `@modelcontextprotocol/sdk` library to connect to MCP servers. When you configure an HTTP-based server:

1. **Configuration Loading**: PK-Code reads `~/.pk/settings.json` and extracts the `mcpServers` object
2. **Transport Creation**: For each server with an `httpUrl`, it creates a `StreamableHTTPClientTransport` instance
3. **Connection**: PK-Code establishes a persistent HTTP connection using the MCP protocol
4. **Tool Discovery**: PK-Code queries the server for available tools using the MCP `tools/list` method
5. **Tool Registration**: Discovered tools are registered in the tool registry and made available during your session

The HTTP transport supports:
- ✅ Bidirectional communication over HTTP/HTTPS
- ✅ Custom headers for authentication
- ✅ Configurable timeouts
- ✅ Multiple concurrent servers
- ✅ Tool filtering (include/exclude)
- ✅ Automatic reconnection

## Comparison with Other Transport Types

| Transport | Configuration Key | Use Case | Example |
|-----------|-------------------|----------|---------|
| HTTP | `httpUrl` | Remote servers, cloud services | `http://api.example.com/mcp` |
| SSE (Server-Sent Events) | `url` | Remote servers with streaming | `http://api.example.com/sse` |
| Stdio | `command` + `args` | Local processes | `{ "command": "node", "args": ["server.js"] }` |

## Security Considerations

1. **Always use HTTPS in production**: Never send authentication tokens over HTTP in production environments
2. **Use environment variables for secrets**: Store API keys in environment variables, not directly in settings.json
3. **Be cautious with `trust: true`**: Only set `trust: true` for servers you completely trust, as it allows potentially dangerous operations
4. **Filter tools when needed**: Use `includeTools` or `excludeTools` to limit tool access from untrusted servers

## Additional Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [PK-Code Documentation](https://github.com/your-org/pk-code)
- [MCP SDK for TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)

## Support

If you continue experiencing issues:

1. Check the debug logs: `pk --debug`
2. Verify your MCP server is working with other MCP clients
3. Test with a simple MCP server implementation
4. Report issues at: https://github.com/your-org/pk-code/issues
