/**
 * Authentication middleware for Passgage FAQ Bot
 * Supports multiple authentication strategies
 */

import { Context } from 'hono';
import type { Env } from '../types';

/**
 * Public API Key authentication middleware
 * For frontend applications - allows only /api/ask endpoint
 * Uses PUBLIC_API_KEYS environment variable
 */
export async function publicApiKeyAuth(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: 'API key required',
        message: 'API anahtarı gereklidir. X-API-Key header ekleyin.',
      },
      401
    );
  }

  // Get allowed public API keys from environment
  const publicKeys = c.env.PUBLIC_API_KEYS?.split(',') || [];

  if (publicKeys.length > 0 && !publicKeys.includes(apiKey)) {
    return c.json(
      {
        success: false,
        error: 'Invalid API key',
        message: 'Geçersiz API anahtarı.',
      },
      403
    );
  }

  // API key is valid, continue
  await next();
}

/**
 * Admin API Key authentication middleware
 * For admin operations - create, update, delete FAQs
 * Uses ADMIN_API_KEYS environment variable
 */
export async function adminApiKeyAuth(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: 'Admin API key required',
        message: 'Admin API anahtarı gereklidir.',
      },
      401
    );
  }

  // Get allowed admin API keys from environment
  const adminKeys = c.env.ADMIN_API_KEYS?.split(',') || [];

  if (!adminKeys.includes(apiKey)) {
    return c.json(
      {
        success: false,
        error: 'Invalid admin API key',
        message: 'Geçersiz admin API anahtarı.',
      },
      403
    );
  }

  // Admin API key is valid, continue
  await next();
}

/**
 * Legacy API Key authentication middleware (backward compatibility)
 * Checks X-API-Key header against configured keys
 */
export async function apiKeyAuth(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: 'API key required',
        message: 'X-API-Key header eksik. Lütfen API anahtarınızı ekleyin.',
      },
      401
    );
  }

  // Get allowed API keys from environment
  const allowedKeys = c.env.API_KEYS?.split(',') || [];

  if (!allowedKeys.includes(apiKey)) {
    return c.json(
      {
        success: false,
        error: 'Invalid API key',
        message: 'Geçersiz API anahtarı.',
      },
      403
    );
  }

  // API key is valid, continue
  await next();
}

/**
 * Rate limiting middleware
 * Prevents abuse by limiting requests per IP
 */
export async function rateLimiter(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `ratelimit:${ip}`;

  // If KV binding exists, use it for rate limiting
  if (c.env.RATE_LIMIT_KV) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = parseInt(c.env.RATE_LIMIT_MAX || '60');

    const rateLimitData = await c.env.RATE_LIMIT_KV.get(rateLimitKey, 'json');

    if (rateLimitData) {
      const { count, resetTime } = rateLimitData as {
        count: number;
        resetTime: number;
      };

      if (now < resetTime) {
        if (count >= maxRequests) {
          return c.json(
            {
              success: false,
              error: 'Rate limit exceeded',
              message:
                'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.',
              retryAfter: Math.ceil((resetTime - now) / 1000),
            },
            429
          );
        }

        // Increment count
        await c.env.RATE_LIMIT_KV.put(
          rateLimitKey,
          JSON.stringify({ count: count + 1, resetTime }),
          { expirationTtl: Math.ceil((resetTime - now) / 1000) }
        );
      } else {
        // Reset window
        await c.env.RATE_LIMIT_KV.put(
          rateLimitKey,
          JSON.stringify({ count: 1, resetTime: now + windowMs }),
          { expirationTtl: Math.ceil(windowMs / 1000) }
        );
      }
    } else {
      // First request
      await c.env.RATE_LIMIT_KV.put(
        rateLimitKey,
        JSON.stringify({ count: 1, resetTime: now + windowMs }),
        { expirationTtl: Math.ceil(windowMs / 1000) }
      );
    }
  }

  await next();
}

/**
 * CORS middleware with configurable origins
 */
export async function corsMiddleware(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];

  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

  if (isAllowed) {
    // Set CORS headers
    c.header('Access-Control-Allow-Origin', origin || '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, X-API-Key, Authorization'
    );
    c.header('Access-Control-Max-Age', '86400');
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204, {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    });
  }

  await next();
}

/**
 * IP Whitelist middleware
 * Only allows requests from whitelisted IPs
 */
export async function ipWhitelist(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const ip = c.req.header('CF-Connecting-IP');
  const whitelistedIPs = c.env.WHITELISTED_IPS?.split(',') || [];

  if (whitelistedIPs.length > 0 && ip && !whitelistedIPs.includes(ip)) {
    return c.json(
      {
        success: false,
        error: 'Access denied',
        message: 'Bu IP adresinden erişim izni yok.',
      },
      403
    );
  }

  await next();
}

/**
 * Request logging middleware
 */
export async function requestLogger(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  await next();

  const duration = Date.now() - start;
  console.log(
    JSON.stringify({
      method,
      path,
      ip,
      duration,
      status: c.res.status,
      timestamp: new Date().toISOString(),
    })
  );
}
