/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'node:crypto';
import * as http from 'node:http';
import * as net from 'node:net';
import * as url from 'node:url';
import open from 'open';
import { getCredential, setCredential, deleteCredential } from '../credentials.js';

export interface OAuthConfig {
  provider: 'notion' | 'custom';
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  redirectUri?: string;
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// Provider-specific OAuth configurations
const OAUTH_PROVIDERS = {
  notion: {
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: ['read_content', 'update_content', 'insert_content'],
    // Notion requires a client ID and secret from an integration
    // These would need to be registered with Notion
    clientId: process.env.NOTION_OAUTH_CLIENT_ID,
    clientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET,
  },
};

/**
 * Manages OAuth tokens for MCP servers
 */
export class MCPTokenManager {
  private serverName: string;
  private config: OAuthConfig;
  private debugMode: boolean;
  private tokenCacheKey: string;
  private legacyTokenCacheKey: string;

  constructor(serverName: string, config: OAuthConfig, debugMode: boolean = false) {
    this.serverName = serverName;
    this.config = this.resolveProviderConfig(config);
    this.debugMode = debugMode;
    // Use a stable cache key derived from provider + endpoint + clientId (if present)
    // This avoids reauth when a user renames the server in settings.
    this.tokenCacheKey = this.buildStableCacheKey();
    // Keep a legacy key for migration (prior versions used the raw server name)
    this.legacyTokenCacheKey = `mcp_oauth_${serverName}`;
  }

  /**
   * Get a valid OAuth token, refreshing or initiating OAuth flow if needed
   */
  async getValidToken(): Promise<string> {
    // Try to get cached token
    let cachedToken = await this.getCachedToken();
    
    if (cachedToken && this.isTokenValid(cachedToken)) {
      if (this.debugMode) {
        console.debug(`[MCP Token Manager] Using cached token for ${this.serverName}`);
      }
      return cachedToken.access_token;
    }

    // Try to refresh if we have a refresh token
    if (cachedToken?.refresh_token) {
      try {
        const refreshedToken = await this.refreshToken(cachedToken.refresh_token);
        await this.cacheToken(refreshedToken);
        return refreshedToken.access_token;
      } catch (error) {
        if (this.debugMode) {
          console.debug(`[MCP Token Manager] Refresh failed for ${this.serverName}:`, error);
        }
      }
    }

    // Initiate new OAuth flow
    console.log(`\nAuthentication required for MCP server: ${this.serverName}`);
    const newToken = await this.initiateOAuthFlow();
    await this.cacheToken(newToken);
    return newToken.access_token;
  }

  /**
   * Clear cached token
   */
  async clearToken(): Promise<void> {
    await deleteCredential(this.tokenCacheKey);
  }

  private resolveProviderConfig(config: OAuthConfig): OAuthConfig {
    if (config.provider === 'notion') {
      const providerDefaults = OAUTH_PROVIDERS.notion;
      return {
        ...providerDefaults,
        ...config,
        clientId: config.clientId || providerDefaults.clientId,
        clientSecret: config.clientSecret || providerDefaults.clientSecret,
        scopes: config.scopes || providerDefaults.scopes,
      };
    }
    return config;
  }

  private async getCachedToken(): Promise<TokenData | null> {
    try {
      // Try stable key first
      const tokenString = await getCredential(this.tokenCacheKey);
      if (tokenString) {
        return JSON.parse(tokenString);
      }
      // Fallback: migrate legacy key if present
      const legacyTokenString = await getCredential(this.legacyTokenCacheKey);
      if (legacyTokenString) {
        if (this.debugMode) {
          console.debug(`[MCP Token Manager] Migrating legacy token key for ${this.serverName}`);
        }
        // Persist under stable key and remove legacy entry
        await setCredential(this.tokenCacheKey, legacyTokenString);
        await deleteCredential(this.legacyTokenCacheKey);
        return JSON.parse(legacyTokenString);
      }
    } catch (error) {
      if (this.debugMode) {
        console.debug(`[MCP Token Manager] Failed to get cached token:`, error);
      }
    }
    return null;
  }

  private async cacheToken(token: TokenData): Promise<void> {
    // Calculate expiry time if not provided
    if (!token.expires_at && token.expires_in) {
      token.expires_at = Date.now() + (token.expires_in * 1000);
    }
    
    await setCredential(this.tokenCacheKey, JSON.stringify(token));
  }

  private isTokenValid(token: TokenData): boolean {
    if (!token.access_token) {
      return false;
    }
    
    // Check expiry with 5 minute buffer
    if (token.expires_at) {
      const bufferMs = 5 * 60 * 1000; // 5 minutes
      return token.expires_at > (Date.now() + bufferMs);
    }
    
    // If no expiry, assume it's valid
    return true;
  }

  private buildStableCacheKey(): string {
    const parts: string[] = ['mcp_oauth'];
    const provider = this.config.provider || 'custom';
    parts.push(provider);
    // Try to derive a stable endpoint identity from httpUrl/url when present
    try {
      // Prefer HTTP URL if available, otherwise SSE URL; fallback to server name
      const rawUrl = (globalThis as any).__mcp_server_http_url__ as string | undefined; // not set; just for types
      const endpoint = (this as any).endpoint as string | undefined; // none
      const urlStr = (endpoint as string) || '';
    } catch {
      // ignore
    }
    let host = '';
    try {
      // The OAuth flow is used for HTTP/SSE transports. Use the configured URLs if available.
      const endpointUrl = (this as any).config?.['httpUrl'] || (this as any).config?.['url'];
      if (endpointUrl) {
        const u = new URL(endpointUrl);
        host = `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, '')}`;
      }
    } catch {
      // ignore parsing failures
    }
    if (host) parts.push(host);
    if (this.config.clientId) parts.push(`cid:${this.config.clientId}`);
    // Join and sanitize to a keytar-friendly account name
    const raw = parts.join('|');
    // Keep it readable but safe
    const safe = raw.replace(/[^a-zA-Z0-9:_|./-]/g, '_');
    return safe;
  }

  private async refreshToken(refreshToken: string): Promise<TokenData> {
    if (!this.config.tokenUrl) {
      throw new Error('Token URL not configured for OAuth refresh');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (this.config.clientId) {
      params.append('client_id', this.config.clientId);
    }
    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return await response.json() as TokenData;
  }

  private async initiateOAuthFlow(): Promise<TokenData> {
    if (!this.config.authorizationUrl || !this.config.tokenUrl) {
      throw new Error('OAuth endpoints not configured for this server');
    }

    if (!this.config.clientId) {
      throw new Error(`OAuth client ID not configured. Please set ${this.serverName.toUpperCase()}_OAUTH_CLIENT_ID environment variable`);
    }

    // Determine redirect URI and callback port
    let redirectUri: string;
    let callbackPort: number;
    if (this.config.redirectUri) {
      const u = new URL(this.config.redirectUri);
      // If no explicit port, infer from protocol
      callbackPort = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
      redirectUri = this.config.redirectUri;
    } else {
      callbackPort = await this.getAvailablePort();
      redirectUri = `http://localhost:${callbackPort}/oauth/callback`;
    }

    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const authUrl = new URL(this.config.authorizationUrl);
    authUrl.searchParams.append('client_id', this.config.clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    // Notion requires owner=user for OAuth authorization
    if (this.config.provider === 'notion') {
      authUrl.searchParams.append('owner', 'user');
    }
    
    // Add PKCE parameters for security
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    
    if (this.config.scopes && this.config.scopes.length > 0) {
      authUrl.searchParams.append('scope', this.config.scopes.join(' '));
    }

    console.log(`Opening browser for authentication...`);
    console.log(`If browser doesn't open, visit: ${authUrl.toString()}\n`);

    // Open browser
    await open(authUrl.toString());

    // Wait for callback
    const authCode = await this.waitForCallback(callbackPort, state);

    // Exchange code for token
    return await this.exchangeCodeForToken(authCode, redirectUri, codeVerifier);
  }

  private async waitForCallback(port: number, expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = new url.URL(req.url!, `http://localhost:${port}`);
          
          if (parsedUrl.pathname !== '/oauth/callback') {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const code = parsedUrl.searchParams.get('code');
          const state = parsedUrl.searchParams.get('state');
          const error = parsedUrl.searchParams.get('error');

          if (error) {
            res.writeHead(400);
            res.end(`Authentication error: ${error}`);
            reject(new Error(`OAuth error: ${error}`));
            server.close();
            return;
          }

          if (state !== expectedState) {
            res.writeHead(400);
            res.end('State mismatch - possible CSRF attack');
            reject(new Error('OAuth state mismatch'));
            server.close();
            return;
          }

          if (!code) {
            res.writeHead(400);
            res.end('No authorization code received');
            reject(new Error('No authorization code'));
            server.close();
            return;
          }

          // Success response
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1>✅ Authentication Successful!</h1>
                <p>You can close this window and return to pk-code.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);

          resolve(code);
          server.close();
        } catch (error) {
          reject(error);
          server.close();
        }
      });

      server.listen(port);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth callback timeout'));
      }, 5 * 60 * 1000);
    });
  }

  private async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<TokenData> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    if (this.config.clientId) {
      params.append('client_id', this.config.clientId);
    }
    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    const response = await fetch(this.config.tokenUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const tokenData = await response.json() as unknown as Partial<TokenData>;
    
    // Ensure we have the expected token structure
    if (!tokenData.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }

    return tokenData as TokenData;
  }

  private async getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address() as net.AddressInfo;
        const port = address.port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }
}
