/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPTokenManager } from './mcp-token-manager.js';
import { MCPServerConfig } from '../config/config.js';
import { EventEmitter } from 'events';

export interface OAuthMCPConfig extends MCPServerConfig {
  oauth: {
    provider: 'notion' | 'custom';
    clientId?: string;
    clientSecret?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    redirectUri?: string;
  };
}

/**
 * Transport that handles OAuth authentication for MCP servers.
 * Wraps existing HTTP/SSE transports with OAuth token management.
 */
export class OAuthMCPTransport implements Transport {
  private innerTransport?: StreamableHTTPClientTransport | SSEClientTransport;
  private tokenManager: MCPTokenManager;
  private config: OAuthMCPConfig;
  private serverName: string;
  private debugMode: boolean;

  // Transport interface implementation
  private messageEmitter = new EventEmitter();
  private errorEmitter = new EventEmitter();
  private closeEmitter = new EventEmitter();

  constructor(
    serverName: string,
    config: OAuthMCPConfig,
    debugMode: boolean = false,
  ) {
    this.serverName = serverName;
    this.config = config;
    this.debugMode = debugMode;
    this.tokenManager = new MCPTokenManager(serverName, config.oauth, debugMode);
  }

  async start(): Promise<void> {
    // Get valid OAuth token
    const token = await this.tokenManager.getValidToken();
    
    if (this.debugMode) {
      console.debug(`[OAuth MCP] Got token for ${this.serverName}`);
    }

    // Create inner transport with OAuth headers
    const headers: Record<string, string> = {
      ...(this.config.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    };

    // Some providers (e.g., Notion) require a version header for API access
    if (this.config.oauth?.provider === 'notion' && !headers['Notion-Version']) {
      headers['Notion-Version'] = '2022-06-28';
    }

    if (this.debugMode) {
      const authSet = typeof headers['Authorization'] === 'string';
      const maskedAuth = authSet ? `Bearer ${'*'.repeat(8)}...` : 'MISSING';
      console.debug(
        `[OAuth MCP] Outbound headers for ${this.serverName}: ` +
          `Authorization=${maskedAuth}` +
          (headers['Notion-Version'] ? `, Notion-Version=${headers['Notion-Version']}` : ''),
      );
    }

    if (this.config.httpUrl) {
      const transportOptions: StreamableHTTPClientTransportOptions = {
        requestInit: { headers },
      };
      this.innerTransport = new StreamableHTTPClientTransport(
        new URL(this.config.httpUrl),
        transportOptions,
      );
    } else if (this.config.url) {
      const transportOptions: SSEClientTransportOptions = {
        requestInit: { headers },
      };
      this.innerTransport = new SSEClientTransport(
        new URL(this.config.url),
        transportOptions,
      );
    } else {
      throw new Error('OAuth MCP transport requires httpUrl or url configuration');
    }

    // Forward events from inner transport
    this.innerTransport.onmessage = (message) => {
      this.messageEmitter.emit('message', message);
    };
    
    this.innerTransport.onerror = (error) => {
      // Check if error is auth-related
      if (this.isAuthError(error)) {
        // Try to refresh token
        this.handleAuthError().catch((refreshError) => {
          this.errorEmitter.emit('error', refreshError);
        });
      } else {
        this.errorEmitter.emit('error', error);
      }
    };
    
    this.innerTransport.onclose = () => {
      this.closeEmitter.emit('close');
    };

    // Start the inner transport
    await this.innerTransport.start();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.innerTransport) {
      throw new Error('Transport not started');
    }
    await this.innerTransport.send(message);
  }

  async close(): Promise<void> {
    if (this.innerTransport) {
      await this.innerTransport.close();
    }
  }

  // Event handlers for Transport interface
  set onmessage(handler: (message: unknown) => void) {
    this.messageEmitter.removeAllListeners('message');
    if (handler) {
      this.messageEmitter.on('message', handler);
    }
  }

  set onerror(handler: (error: Error) => void) {
    this.errorEmitter.removeAllListeners('error');
    if (handler) {
      this.errorEmitter.on('error', handler);
    }
  }

  set onclose(handler: () => void) {
    this.closeEmitter.removeAllListeners('close');
    if (handler) {
      this.closeEmitter.on('close', handler);
    }
  }

  private isAuthError(error: Error): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('401') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('token')
    );
  }

  private async handleAuthError(): Promise<void> {
    if (this.debugMode) {
      console.debug(`[OAuth MCP] Handling auth error for ${this.serverName}, attempting token refresh...`);
    }

    try {
      // Clear the current token to force refresh
      await this.tokenManager.clearToken();

      // Trigger token refresh by restarting transport; token will be fetched during start()
      await this.close();
      await this.start();

      if (this.debugMode) {
        console.debug(`[OAuth MCP] Successfully refreshed token for ${this.serverName}`);
      }
    } catch (error) {
      console.error(`[OAuth MCP] Failed to refresh token for ${this.serverName}:`, error);
      throw error;
    }
  }
}

/**
 * Check if a server configuration requires OAuth
 */
export function requiresOAuth(config: MCPServerConfig): config is OAuthMCPConfig {
  return !!(config as OAuthMCPConfig).oauth;
}
