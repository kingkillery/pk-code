#!/bin/bash
# This script starts the browser-use agent with a persistent profile.

# --- IMPORTANT ---
# Set this path to your actual Chrome/Chromium user data directory.
export BROWSER_USE_USER_DATA_DIR="/path/to/your/chrome/profile"

echo "Starting browser-use MCP server with persistent profile..."
echo "Browser data will be loaded from: $BROWSER_USE_USER_DATA_DIR"

uvx browser-use --mcp
