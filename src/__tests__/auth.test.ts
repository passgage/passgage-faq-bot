import { describe, it, expect, vi } from 'vitest';
import { Context } from 'hono';
import {
  publicApiKeyAuth,
  adminApiKeyAuth,
  apiKeyAuth,
  corsMiddleware,
  ipWhitelist,
} from '../middleware/auth';
import type { Env } from '../types';

// Helper to create mock Hono context
function createMockContext(
  headers: Record<string, string> = {},
  env: Partial<Env> = {}
): Context<{ Bindings: Env }> {
  const mockContext = {
    req: {
      header: (key: string) => headers[key],
      method: 'POST',
      path: '/api/ask',
    },
    env: {
      SIMILARITY_THRESHOLD: '0.7',
      TOP_K: '3',
      MAX_FAQs_RETURN: '5',
      ALLOWED_ORIGINS: '*',
      RATE_LIMIT_MAX: '60',
      ...env,
    } as Env,
    json: vi.fn((data, status) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    header: vi.fn(),
    res: {
      status: 200,
    },
  } as unknown as Context<{ Bindings: Env }>;

  return mockContext;
}

describe('Authentication Middleware', () => {
  describe('publicApiKeyAuth', () => {
    it('should reject requests without API key', async () => {
      const ctx = createMockContext({}, { PUBLIC_API_KEYS: 'valid-key' });
      const next = vi.fn();

      const response = await publicApiKeyAuth(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(401);
      const data = (await response?.json()) as any;
      expect(data.error).toBe('API key required');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid API key', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'invalid-key' },
        { PUBLIC_API_KEYS: 'valid-key' }
      );
      const next = vi.fn();

      const response = await publicApiKeyAuth(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(403);
      const data = (await response?.json()) as any;
      expect(data.error).toBe('Invalid API key');
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid API key', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'valid-key' },
        { PUBLIC_API_KEYS: 'valid-key' }
      );
      const next = vi.fn();

      await publicApiKeyAuth(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should support multiple API keys (comma-separated)', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'key2' },
        { PUBLIC_API_KEYS: 'key1,key2,key3' }
      );
      const next = vi.fn();

      await publicApiKeyAuth(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should allow all requests if no PUBLIC_API_KEYS configured', async () => {
      const ctx = createMockContext({ 'X-API-Key': 'any-key' }, {});
      const next = vi.fn();

      await publicApiKeyAuth(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('adminApiKeyAuth', () => {
    it('should reject requests without admin API key', async () => {
      const ctx = createMockContext({}, { ADMIN_API_KEYS: 'admin-key' });
      const next = vi.fn();

      const response = await adminApiKeyAuth(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(401);
      const data = (await response?.json()) as any;
      expect(data.error).toBe('Admin API key required');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid admin API key', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'invalid-admin-key' },
        { ADMIN_API_KEYS: 'valid-admin-key' }
      );
      const next = vi.fn();

      const response = await adminApiKeyAuth(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(403);
      const data = (await response?.json()) as any;
      expect(data.error).toBe('Invalid admin API key');
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid admin API key', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'valid-admin-key' },
        { ADMIN_API_KEYS: 'valid-admin-key' }
      );
      const next = vi.fn();

      await adminApiKeyAuth(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should support multiple admin keys', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'admin2' },
        { ADMIN_API_KEYS: 'admin1,admin2,admin3' }
      );
      const next = vi.fn();

      await adminApiKeyAuth(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should be strict - reject if no keys configured', async () => {
      const ctx = createMockContext({ 'X-API-Key': 'any-key' }, {});
      const next = vi.fn();

      const response = await adminApiKeyAuth(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('apiKeyAuth (legacy)', () => {
    it('should reject requests without API key', async () => {
      const ctx = createMockContext({}, { API_KEYS: 'legacy-key' });
      const next = vi.fn();

      const response = await apiKeyAuth(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept requests with valid legacy API key', async () => {
      const ctx = createMockContext(
        { 'X-API-Key': 'legacy-key' },
        { API_KEYS: 'legacy-key' }
      );
      const next = vi.fn();

      await apiKeyAuth(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('corsMiddleware', () => {
    it('should allow all origins when ALLOWED_ORIGINS is *', async () => {
      const ctx = createMockContext(
        { Origin: 'https://example.com' },
        { ALLOWED_ORIGINS: '*' }
      );
      const next = vi.fn();

      await corsMiddleware(ctx, next);

      expect(ctx.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
      expect(next).toHaveBeenCalledOnce();
    });

    it('should only allow specific origins', async () => {
      const ctx = createMockContext(
        { Origin: 'https://passgage.com' },
        { ALLOWED_ORIGINS: 'https://passgage.com,https://app.passgage.com' }
      );
      const next = vi.fn();

      await corsMiddleware(ctx, next);

      expect(ctx.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://passgage.com'
      );
      expect(next).toHaveBeenCalledOnce();
    });

    it('should not set CORS headers for disallowed origins', async () => {
      const ctx = createMockContext(
        { Origin: 'https://evil.com' },
        { ALLOWED_ORIGINS: 'https://passgage.com' }
      );
      const next = vi.fn();

      await corsMiddleware(ctx, next);

      expect(ctx.header).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        expect.anything()
      );
      expect(next).toHaveBeenCalledOnce();
    });

    it('should handle OPTIONS preflight requests', async () => {
      const ctx = createMockContext(
        { Origin: 'https://passgage.com' },
        { ALLOWED_ORIGINS: '*' }
      );
      (ctx.req as any).method = 'OPTIONS';
      const next = vi.fn();

      const response = await corsMiddleware(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(204);
      expect(next).not.toHaveBeenCalled();
    });

    it('should set standard CORS headers', async () => {
      const ctx = createMockContext({ Origin: 'https://test.com' }, {});
      const next = vi.fn();

      await corsMiddleware(ctx, next);

      expect(ctx.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      expect(ctx.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, X-API-Key, Authorization'
      );
      expect(ctx.header).toHaveBeenCalledWith(
        'Access-Control-Max-Age',
        '86400'
      );
    });
  });

  describe('ipWhitelist', () => {
    it('should allow requests when no whitelist configured', async () => {
      const ctx = createMockContext({ 'CF-Connecting-IP': '1.2.3.4' }, {});
      const next = vi.fn();

      await ipWhitelist(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should allow whitelisted IPs', async () => {
      const ctx = createMockContext(
        { 'CF-Connecting-IP': '1.2.3.4' },
        { WHITELISTED_IPS: '1.2.3.4,5.6.7.8' }
      );
      const next = vi.fn();

      await ipWhitelist(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should block non-whitelisted IPs', async () => {
      const ctx = createMockContext(
        { 'CF-Connecting-IP': '9.9.9.9' },
        { WHITELISTED_IPS: '1.2.3.4,5.6.7.8' }
      );
      const next = vi.fn();

      const response = await ipWhitelist(ctx, next);

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(403);
      const data = (await response?.json()) as any;
      expect(data.error).toBe('Access denied');
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests without IP header when whitelist is empty', async () => {
      const ctx = createMockContext({}, {});
      const next = vi.fn();

      await ipWhitelist(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });
});
