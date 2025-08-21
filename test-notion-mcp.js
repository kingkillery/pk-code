#!/usr/bin/env node

/**
 * Test script to verify Notion MCP server configuration
 * This tests the HTTP streaming transport with headers
 */

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testNotionMCP() {
  console.log('Testing Notion MCP Server Configuration...\n');
  
  // Check if NOTION_API_KEY is set
  const apiKey = process.env.NOTION_API_KEY;
  
  if (!apiKey) {
    console.error('❌ NOTION_API_KEY environment variable is not set!');
    console.log('\nTo set it in PowerShell:');
    console.log('  $env:NOTION_API_KEY = "your-notion-api-key"');
    console.log('\nTo set it in CMD:');
    console.log('  set NOTION_API_KEY=your-notion-api-key');
    console.log('\nTo set it in Bash:');
    console.log('  export NOTION_API_KEY="your-notion-api-key"');
    process.exit(1);
  }
  
  console.log('✅ NOTION_API_KEY is set\n');
  
  const httpUrl = 'https://mcp.notion.com/mcp';
  const headers = {
    'Authorization': `Bearer ${apiKey}`
  };
  
  console.log(`Connecting to: ${httpUrl}`);
  console.log('Headers: Authorization header is set\n');
  
  try {
    // Create transport with headers
    const transportOptions = {
      requestInit: {
        headers: headers
      }
    };
    
    const transport = new StreamableHTTPClientTransport(
      new URL(httpUrl),
      transportOptions
    );
    
    // Create and connect client
    const client = new Client({
      name: 'test-notion-mcp-client',
      version: '0.0.1'
    });
    
    console.log('Attempting connection...');
    await client.connect(transport, {
      timeout: 10000 // 10 second timeout
    });
    
    console.log('✅ Successfully connected to Notion MCP server!\n');
    
    // Try to list available tools
    console.log('Discovering available tools...');
    const { CallableTool, mcpToTool } = await import('@google/genai');
    const mcpCallableTool = mcpToTool(client);
    const tool = await mcpCallableTool.tool();
    
    if (tool.functionDeclarations && Array.isArray(tool.functionDeclarations)) {
      console.log(`\n✅ Found ${tool.functionDeclarations.length} tools:`);
      tool.functionDeclarations.forEach((func, index) => {
        console.log(`  ${index + 1}. ${func.name}${func.description ? ': ' + func.description.substring(0, 60) + '...' : ''}`);
      });
    } else {
      console.log('⚠️  No tools found or unexpected response format');
    }
    
    // Clean up
    await client.close();
    console.log('\n✅ Test completed successfully!');
    console.log('Your Notion MCP configuration is working correctly.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n⚠️  Authentication error. Please check your NOTION_API_KEY.');
    } else if (error.message.includes('404')) {
      console.log('\n⚠️  Endpoint not found. The URL might be incorrect.');
    } else if (error.message.includes('timeout')) {
      console.log('\n⚠️  Connection timed out. The server might be unavailable.');
    } else {
      console.log('\n⚠️  Unexpected error. Details:', error);
    }
    
    process.exit(1);
  }
}

// Run the test
testNotionMCP().catch(console.error);
