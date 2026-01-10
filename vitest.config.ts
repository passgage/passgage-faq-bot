import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // Bindings to use in tests
          bindings: {
            SIMILARITY_THRESHOLD: '0.7',
            TOP_K: '3',
            MAX_FAQs_RETURN: '5',
            ALLOWED_ORIGINS: '*',
            RATE_LIMIT_MAX: '60',
            PUBLIC_API_KEYS: 'test-public-key',
            ADMIN_API_KEYS: 'test-admin-key',
          },
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'scripts/',
        'vitest.config.ts',
      ],
    },
  },
});
