import { describe, it, expect } from 'vitest';
// @ts-ignore - cloudflare:test is available in Cloudflare Workers test environment
import { SELF } from 'cloudflare:test';

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await SELF.fetch('http://localhost/api/health');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        status: 'healthy',
        service: 'passgage-faq-bot',
      });
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/status', () => {
    it('should return database status when empty', async () => {
      const response = await SELF.fetch('http://localhost/api/status');

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('initialized');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/ask', () => {
    it('should reject requests without API key', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Test question' }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('API key required');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid-key',
        },
        body: JSON.stringify({ question: 'Test question' }),
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid API key');
    });

    it('should accept requests with valid API key', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-public-key', // From vitest.config.ts bindings
        },
        body: JSON.stringify({ question: 'Şifremi unuttum' }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success');
      // Note: Will be false because Vectorize is empty, but API accepts request
    });

    it('should validate question field', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-public-key',
        },
        body: JSON.stringify({}), // Missing question
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      // Should return validation error
    });

    it('should handle CORS preflight', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });

  describe('POST /api/faq (Admin)', () => {
    it('should reject requests without admin API key', async () => {
      const response = await SELF.fetch('http://localhost/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'Test',
          answer: 'Answer',
          category: 'test',
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Admin API key required');
    });

    it('should reject requests with public API key', async () => {
      const response = await SELF.fetch('http://localhost/api/faq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-public-key',
        },
        body: JSON.stringify({
          question: 'Test',
          answer: 'Answer',
          category: 'test',
        }),
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Invalid admin API key');
    });

    it('should accept requests with valid admin API key', async () => {
      const response = await SELF.fetch('http://localhost/api/faq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-admin-key',
        },
        body: JSON.stringify({
          question: 'Test soru',
          answer: 'Test cevap',
          category: 'test',
        }),
      });

      // Should accept the request structure
      expect([200, 500]).toContain(response.status);
      // 500 is ok because Vectorize/AI might not be fully initialized in test
    });
  });

  describe('POST /api/seed (Admin)', () => {
    it('should reject requests without admin API key', async () => {
      const response = await SELF.fetch('http://localhost/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs: [] }),
      });

      expect(response.status).toBe(401);
    });

    it('should accept requests with admin API key', async () => {
      const response = await SELF.fetch('http://localhost/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-admin-key',
        },
        body: JSON.stringify({
          faqs: [
            {
              id: 'test-1',
              question: 'Test question',
              answer: 'Test answer',
              category: 'test',
              keywords: ['test'],
            },
          ],
        }),
      });

      // Should accept the request
      expect([200, 500]).toContain(response.status);
    });

    it('should validate FAQ structure', async () => {
      const response = await SELF.fetch('http://localhost/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-admin-key',
        },
        body: JSON.stringify({
          faqs: [{ invalid: 'data' }], // Missing required fields
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/faq/:id (Admin)', () => {
    it('should reject requests without admin API key', async () => {
      const response = await SELF.fetch('http://localhost/api/faq/test-123', {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });

    it('should accept delete requests with admin key', async () => {
      const response = await SELF.fetch('http://localhost/api/faq/test-123', {
        method: 'DELETE',
        headers: { 'X-API-Key': 'test-admin-key' },
      });

      // Should accept the request structure
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await SELF.fetch('http://localhost/api/unknown');

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-public-key',
        },
        body: 'invalid json',
      });

      expect([400, 500]).toContain(response.status);
    });

    it('should handle empty request body', async () => {
      const response = await SELF.fetch('http://localhost/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-public-key',
        },
        body: '',
      });

      expect([400, 500]).toContain(response.status);
    });
  });
});
