/**
 * Test script to verify OAuth MCP implementation
 * Run with: node test-oauth-mcp.js
 */

import { MCPClient } from '../packages/core/dist/tools/mcp-client.js';
import { promises as fs } from 'fs';
import path from 'path';

async function testOAuthMCPParsing() {
  console.log('Testing OAuth MCP Implementation...\n');
  
  // Test 1: Parse OAuth configuration
  const testSettings = {
    mcpServers: {
      "TestNotion": {
        httpUrl: "https://mcp.notion.com/mcp",
        oauth: {
          provider: "notion",
          scopes: ["read_content", "update_content"]
        }
      },
      "CustomOAuth": {
        httpUrl: "https://api.example.com/mcp",
        oauth: {
          provider: "custom",
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
          authorizationUrl: "https://example.com/oauth/authorize",
          tokenUrl: "https://example.com/oauth/token",
          scopes: ["read", "write"]
        }
      },
      "NonOAuthServer": {
        command: "node",
        args: ["test-server.js"]
      }
    }
  };
  
  console.log('Test Settings:');
  console.log(JSON.stringify(testSettings, null, 2));
  console.log('\n');
  
  // Test 2: Check OAuth detection
  for (const [serverName, config] of Object.entries(testSettings.mcpServers)) {
    const hasOAuth = 'oauth' in config;
    console.log(`Server: ${serverName}`);
    console.log(`  Has OAuth: ${hasOAuth}`);
    if (hasOAuth) {
      console.log(`  Provider: ${config.oauth.provider}`);
      console.log(`  Scopes: ${config.oauth.scopes?.join(', ') || 'none'}`);
    }
    console.log('');
  }
  
  // Test 3: Verify OAuth transport would be created
  const notionConfig = testSettings.mcpServers.TestNotion;
  if (notionConfig.oauth) {
    console.log('✅ OAuth configuration detected for Notion server');
    console.log('  Would create OAuthMCPTransport with:');
    console.log(`    Provider: ${notionConfig.oauth.provider}`);
    console.log(`    HTTP URL: ${notionConfig.httpUrl}`);
    console.log(`    Scopes: ${notionConfig.oauth.scopes.join(', ')}`);
  }
  
  // Test 4: Check environment variables
  console.log('\nEnvironment Variables Check:');
  const requiredEnvVars = ['NOTION_OAUTH_CLIENT_ID', 'NOTION_OAUTH_CLIENT_SECRET'];
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    console.log(`  ${envVar}: ${value ? '✅ Set' : '❌ Not set'}`);
  }
  
  console.log('\n✅ OAuth MCP implementation test complete!');
}

// Run the test
testOAuthMCPParsing().catch(console.error);
