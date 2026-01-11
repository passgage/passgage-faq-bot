# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Passgage FAQ Bot is a semantic search chatbot built on Cloudflare Workers that uses AI embeddings and vector similarity search to answer user questions in Turkish. The system uses Workers AI (@cf/baai/bge-m3, multilingual model optimized for Turkish) to generate 1024-dimensional embeddings and Cloudflare Vectorize for vector storage and similarity matching.

**Key Technologies**: Cloudflare Workers, Workers AI, Vectorize, Hono, TypeScript

## Common Commands

### Development
```bash
npm run dev          # Local development server (localhost:8787)
npm run typecheck    # TypeScript validation (ALWAYS run before commits)
npm run test         # Run test suite with Vitest (run before commits)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate test coverage report
npm run deploy       # Deploy to Cloudflare Workers
npm run tail         # Live logs from deployed worker
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

### Vectorize Management
```bash
# Create the vector index (required before first run)
npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine

# List existing indexes
npx wrangler vectorize list

# Delete and recreate if needed
npx wrangler vectorize delete faq-index
```

### Data Management & Seeding

**Two-step workflow for FAQ data:**

#### Step 1: Generate faqs.json from CSV files
```bash
npm run build:data   # Parse CSVs → generate data/faqs.json
```
This processes `data/Passgage Exairon.csv` and `data/Sorular - Yanıtlar ChatBot Mobil.csv` into a single JSON file.

#### Step 2: Seed FAQs to worker
```bash
# Production
WORKER_URL=https://your-worker.workers.dev \
ADMIN_API_KEY=your-admin-api-key \
npm run seed

# Local development
npm run dev  # In another terminal
WORKER_URL=http://localhost:8787 \
ADMIN_API_KEY=test-admin-key \
npm run seed
```

**Updating FAQs:**
1. Edit CSV files in `data/`
2. Run `npm run build:data` to regenerate `faqs.json`
3. Re-seed: `npm run seed`

### Testing API Locally
```bash
# Health check
curl http://localhost:8787/api/health

# Check database status (verify FAQs are seeded)
curl http://localhost:8787/api/status

# Test ask endpoint (requires PUBLIC_API_KEY)
curl -X POST http://localhost:8787/api/ask \
  -H "X-API-Key: test-public-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "Şifremi nasıl değiştirebilirim?"}'

# Create FAQ (requires ADMIN_API_KEY)
curl -X POST http://localhost:8787/api/faq \
  -H "X-API-Key: test-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "Yeni soru?", "answer": "Cevap", "category": "giriş"}'
```

## Architecture

### Request Flow
```
User Question (Turkish)
    ↓
Middleware: requestLogger → corsMiddleware → publicApiKeyAuth → rateLimiter
    ↓
Workers AI: generateEmbedding() → 1024-dim vector (BGE-M3 multilingual)
    ↓
Vectorize: searchSimilar() → cosine similarity search
    ↓
Score >= SIMILARITY_THRESHOLD?
    ↓ Yes                    ↓ No
Return answer          Return "no match" + suggestions
```

### Module Structure

**src/index.ts** - Main Hono application with 6 REST endpoints:
- `GET /api/health` - Health check
- `GET /api/status` - Database initialization status (checks if FAQs are seeded)
- `POST /api/ask` - Primary semantic search endpoint (requires PUBLIC_API_KEY)
- `POST /api/faq` - Create single FAQ (requires ADMIN_API_KEY)
- `DELETE /api/faq/:id` - Delete FAQ (requires ADMIN_API_KEY)
- `POST /api/seed` - Bulk import FAQs from JSON (requires ADMIN_API_KEY)

**src/embeddings.ts** - Workers AI wrapper:
- `generateEmbedding()` - Single text → vector (1024 dims)
- `generateEmbeddingsBatch()` - Batch processing with 100ms delays
- Uses model: `@cf/baai/bge-m3` (multilingual, optimized for Turkish)
- Properly handles Turkish characters (ş, ğ, ü, ö, ç, ı) and morphology

**src/vectorize.ts** - Vector database operations:
- `upsertFAQ()` / `upsertFAQsBatch()` - Store FAQ vectors
- `searchSimilar()` - Cosine similarity search with configurable topK
- `deleteFAQ()` / `deleteFAQsBatch()` - Remove vectors
- **Important**: Vectorize doesn't support direct ID lookup; `getFAQById()` uses a workaround with dummy vector queries (inefficient for production)

**src/types.ts** - TypeScript definitions for FAQ, SearchResult, API requests/responses, and Env bindings

**src/middleware/auth.ts** - Security middleware stack:
- `publicApiKeyAuth` - Validates PUBLIC_API_KEYS for /api/ask endpoint
- `adminApiKeyAuth` - Validates ADMIN_API_KEYS for CRUD operations
- `rateLimiter` - IP-based rate limiting using KV (configurable per-minute limit)
- `corsMiddleware` - Configurable CORS with ALLOWED_ORIGINS
- `ipWhitelist` - Optional IP whitelist validation
- `requestLogger` - JSON-structured request/response logging

**src/utils/csvParser.ts** - CSV parsing utilities for FAQ data import

**scripts/generate-faqs-json.ts** - Parses CSV files → generates data/faqs.json

**scripts/seed-from-json.ts** - Seeds worker from faqs.json via HTTP API

### Environment Bindings

Defined in `wrangler.toml`:
- `AI` - Workers AI binding (automatic)
- `VECTORIZE` - Vector database binding to `faq-index`
- `SIMILARITY_THRESHOLD` (default: "0.7") - Minimum score to return a match (0-1 range)
- `TOP_K` (default: "3") - Number of similar FAQs to retrieve
- `MAX_FAQs_RETURN` (default: "5") - Max FAQs in response
- `ALLOWED_ORIGINS` (default: "*") - Comma-separated CORS origins
- `RATE_LIMIT_MAX` (default: "60") - Max requests per minute per IP
- `RATE_LIMIT_KV` (optional) - KV namespace binding for rate limiting
- `WHITELISTED_IPS` (optional) - Comma-separated IP whitelist

**Secrets (set via wrangler secret put)**:
- `PUBLIC_API_KEYS` - Comma-separated public API keys for /api/ask
- `ADMIN_API_KEYS` - Comma-separated admin API keys for CRUD operations

Production environment overrides: `SIMILARITY_THRESHOLD = "0.75"`, `TOP_K = "5"`, `RATE_LIMIT_MAX = "100"`

## FAQ Data Structure

**Source**: CSV files in `data/` directory
- `data/Passgage Exairon.csv` (32 FAQs)
- `data/Sorular - Yanıtlar ChatBot Mobil.csv` (13 FAQs)

**Generated JSON** (`data/faqs.json`):
```json
{
  "id": "faq-1",
  "question": "Turkish question text",
  "answer": "Turkish answer text",
  "category": "giriş|geçiş-kontrol|vardiya|buradayım|sosyal-medya|modüller",
  "keywords": ["optional", "search", "terms"]
}
```

Categories represent Passgage modules and features. When adding new FAQs, edit CSV files and regenerate JSON with `npm run build:data`.

## Key Implementation Details

### Semantic Search Algorithm
1. User question → embedding via Workers AI
2. Vectorize query returns top K matches sorted by cosine similarity
3. If best match score < threshold: return "no match" message with suggestions
4. Otherwise: return best answer + confidence score + related suggestions

### Batch Operations
When using `upsertFAQsBatch()`, embeddings are generated sequentially with 100ms delays to avoid rate limits. Vectorize upserts happen in batches of 100.

### TypeScript Strictness
The project uses strict TypeScript. When working with Vectorize responses:
- Always use optional chaining for `match.metadata?.field`
- Provide fallback values for missing metadata
- Native Cloudflare types differ from custom types; avoid custom `VectorizeMatch` interface

### Security Architecture

**Two-tier API key system**:
1. **PUBLIC_API_KEYS**: For frontend applications calling `/api/ask`
2. **ADMIN_API_KEYS**: For backend operations (create, update, delete FAQs)

**Middleware stack** (executed in order):
1. `requestLogger` - Logs all requests with IP, duration, status
2. `corsMiddleware` - Validates origin against ALLOWED_ORIGINS
3. `publicApiKeyAuth` - Applied only to `/api/ask` endpoint
4. `rateLimiter` - Applied only to `/api/ask` endpoint (requires KV binding)
5. `adminApiKeyAuth` - Applied to admin endpoints (/api/faq, /api/seed, DELETE)

**Rate limiting**: IP-based, uses Cloudflare KV for state. Disabled if RATE_LIMIT_KV binding not configured.

**Setting up secrets**:
```bash
# Development (test keys in vitest.config.ts)
wrangler secret put PUBLIC_API_KEYS
wrangler secret put ADMIN_API_KEYS

# Production
wrangler secret put PUBLIC_API_KEYS --env production
wrangler secret put ADMIN_API_KEYS --env production
```

## Troubleshooting

**No matches found even with similar questions**:
- Lower `SIMILARITY_THRESHOLD` in wrangler.toml (try 0.6)
- Verify FAQs are seeded: check logs after POST /api/seed
- Turkish embeddings may have lower similarity scores than English

**Vectorize errors on query**:
- Ensure index exists: `npx wrangler vectorize list`
- Verify dimensions match (1024) and metric is cosine
- Recreate index if corrupted

**Database shows as empty**:
- Check status: `curl http://localhost:8787/api/status`
- Verify FAQs seeded: Run `npm run seed` with correct ADMIN_API_KEY
- Check logs for seed errors: `npm run tail`

**TypeScript errors with Vectorize types**:
- Use Cloudflare's native types from `@cloudflare/workers-types`
- Don't create custom interfaces for Vectorize responses
- Always null-check metadata fields

**Slow response times**:
- Embedding generation: ~200ms (unavoidable)
- Consider implementing KV cache for frequent questions
- Cold starts add ~1s latency

**Rate limit errors (429)**:
- Increase `RATE_LIMIT_MAX` in wrangler.toml
- Check IP in logs - may need IP whitelisting for internal services
- Disable rate limiting: remove RATE_LIMIT_KV binding

**API key authentication failures**:
- Verify secrets are set: `wrangler secret list`
- Check X-API-Key header is included in request
- Public vs Admin keys: /api/ask uses PUBLIC_API_KEYS, admin endpoints use ADMIN_API_KEYS
- Test keys defined in vitest.config.ts for local development

## Performance Characteristics

- Average total response: ~500ms
- Workers AI embedding: ~200ms
- Vectorize similarity search: ~50ms
- Cold start penalty: ~1s
- Vectorize has no direct ID lookup (requires full scan workaround)

## Testing

The project uses **Vitest** with Cloudflare Workers pool for testing.

### Running Tests
```bash
npm run test           # Run all tests once
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage report
```

### Test Structure
- `src/__tests__/api.test.ts` - API endpoint tests (health, status, ask, faq, seed)
- `src/__tests__/auth.test.ts` - Authentication middleware tests
- `src/__tests__/csvParser.test.ts` - CSV parsing utility tests
- `src/__tests__/types.test.ts` - TypeScript type validation tests

### Test Configuration
Test bindings defined in `vitest.config.ts`:
- Test API keys: `PUBLIC_API_KEYS = "test-public-key"`, `ADMIN_API_KEYS = "test-admin-key"`
- Mocked environment variables for similarity threshold, rate limits, etc.

**Important**: Always run `npm run typecheck` and `npm run test` before committing.

## Adding New FAQs

1. Edit CSV files in `data/` directory
2. Run `npm run build:data` to regenerate `data/faqs.json`
3. Re-seed the database:
   ```bash
   WORKER_URL=https://your-worker.workers.dev \
   ADMIN_API_KEY=your-admin-api-key \
   npm run seed
   ```
4. Test with similar question variations to verify semantic matching

## Important Notes

- This project is specifically for Turkish language FAQs about Passgage workforce management platform
- **Security implemented**: Two-tier API key authentication (PUBLIC_API_KEYS for /api/ask, ADMIN_API_KEYS for admin endpoints)
- **Rate limiting**: Optional KV-based rate limiting (60 req/min default, 100 req/min in production)
- The embedding model (@cf/baai/bge-m3) is specifically designed for multilingual support with excellent Turkish language performance
- BGE-M3 properly handles Turkish characters and language structure, providing high accuracy for semantic matching
- Vectorize is in beta - API may change
- **Data source**: CSV files are the source of truth; JSON is auto-generated via `npm run build:data`

## Development Workflow

### Making Code Changes
1. Create/modify TypeScript files in `src/`
2. Run `npm run typecheck` to validate types
3. Run `npm run test` to ensure tests pass
4. Test locally: `npm run dev` and test endpoints with curl
5. Format code: `npm run format`
6. Deploy: `npm run deploy`

### Modifying FAQ Data
1. Edit CSV files in `data/` (source of truth)
2. Regenerate JSON: `npm run build:data`
3. Commit both CSV and JSON changes
4. Re-seed worker: `npm run seed`
5. Verify: `curl https://your-worker.workers.dev/api/status`

### Adding New Middleware
Middleware in `src/middleware/auth.ts` follows Hono patterns:
- Signature: `async (c: Context<{ Bindings: Env }>, next: () => Promise<void>): Promise<Response | void>`
- Return `c.json(...)` to short-circuit, `await next()` to continue
- Apply in `src/index.ts` via `app.use(path, middleware)`
- Global middleware: `app.use('*', middleware)`
- Route-specific: `app.use('/api/ask', middleware)` or inline: `app.post('/api/endpoint', middleware, handler)`

### Common Mistakes to Avoid
- Don't forget to run `npm run build:data` after editing CSV files
- Always set both PUBLIC_API_KEYS and ADMIN_API_KEYS as secrets (not in wrangler.toml)
- Vectorize dimensions must match model output (1024 for BGE-M3)
- Don't commit secrets or API keys to version control
- Rate limiting requires KV namespace binding to work; gracefully disabled if not configured
- When testing locally, use test keys from vitest.config.ts: `test-public-key` and `test-admin-key`

## Why BGE-M3 for Turkish?

The BGE-M3 model provides superior performance for Turkish compared to English-focused models:
- **Native Turkish support**: Trained on Turkish text, understands language-specific patterns
- **Character handling**: Properly processes Turkish-specific characters (ş, ğ, ü, ö, ç, ı)
- **Morphology awareness**: Understands Turkish word formation and suffixes
- **Higher accuracy**: Better semantic similarity scores for Turkish question-answer pairs
- **1024 dimensions**: More expressive embeddings capture nuanced meaning

If switching models, remember to:
1. Delete old Vectorize index: `npx wrangler vectorize delete faq-index`
2. Create new index with correct dimensions: `npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine`
3. Re-seed all FAQs with new embeddings
