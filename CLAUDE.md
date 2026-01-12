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

# Check cache statistics (requires ADMIN_API_KEY)
curl http://localhost:8787/api/cache/stats \
  -H "X-API-Key: test-admin-key"

# Clear embedding cache (requires ADMIN_API_KEY)
curl -X DELETE http://localhost:8787/api/cache \
  -H "X-API-Key: test-admin-key"
```

## Architecture

### Request Flow
```
User Question (Turkish)
    ↓
Middleware: requestLogger → corsMiddleware → publicApiKeyAuth → rateLimiter
    ↓
Turkish Normalization: fix typos, informal text (sifre → şifre, napcam → ne yapacağım)
    ↓
Embedding Cache Check (KV): Hit (60-80%) → cached vector | Miss → generate new
    ↓
Workers AI (if cache miss): generateEmbedding() → 1024-dim vector (BGE-M3 multilingual)
    ↓
Vectorize: searchSimilar() → cosine similarity search (top K)
    ↓
Score Evaluation:
  - score >= 0.7 (SIMILARITY_THRESHOLD): Direct answer ✅
  - 0.6 <= score < 0.7 (FUZZY_THRESHOLD): "Did you mean?" 🤔
  - score < 0.6: No match, suggestions ❌
    ↓
Mixpanel Analytics: Track query (non-blocking)
    ↓
Return response with answer/suggestions
```

### Module Structure

**src/index.ts** - Main Hono application with 12 REST endpoints:
- `GET /api/health` - Health check
- `GET /api/status` - Database initialization status (checks if FAQs are seeded)
- `POST /api/ask` - Primary semantic search endpoint (requires PUBLIC_API_KEY)
- `POST /api/faq` - Create single FAQ (requires ADMIN_API_KEY)
- `DELETE /api/faq/:id` - Delete FAQ (requires ADMIN_API_KEY)
- `POST /api/seed` - Bulk import FAQs from JSON (requires ADMIN_API_KEY)
- `GET /api/cache/stats` - Get embedding cache statistics (requires ADMIN_API_KEY)
- `DELETE /api/cache` - Clear embedding cache (requires ADMIN_API_KEY)
- `GET /api/metrics/summary?days=7` - Get metrics summary (requires ADMIN_API_KEY)
- `GET /api/metrics/recent?limit=20` - Get recent queries (requires ADMIN_API_KEY)
- `DELETE /api/metrics` - Clear metrics data (requires ADMIN_API_KEY)
- `GET /` - Root endpoint with API documentation

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

**src/utils/turkish-normalizer.ts** - Turkish text normalization utilities:
- `normalizeTurkish()` - Normalizes Turkish text, fixes common typos and informal variations
- `getTextVariations()` - Generates text variations for better matching
- `calculateTextSimilarity()` - Jaccard similarity for Turkish texts
- `hashString()` - Generate cache keys for embeddings
- Handles Turkish characters (ş, ğ, ü, ö, ç, ı) and common typos in user queries

**src/cache/embedding-cache.ts** - KV-based embedding cache (Phase 2 feature):
- `getEmbeddingWithCache()` - Get embeddings with cache support (60-80% cost reduction)
- `getCacheStats()` - Retrieve cache hit rate and performance metrics
- `clearCache()` - Admin operation to clear all cached embeddings
- 7-day TTL for cache entries, tracks hit/miss rates automatically
- **IMPORTANT**: Requires EMBEDDING_CACHE_KV binding in wrangler.toml

**src/analytics/mixpanel.ts** - Server-side Mixpanel analytics tracking:
- `trackFAQQuery()` - Tracks every FAQ query with confidence, cache status, response time
- `trackFAQCreated()` - Tracks new FAQ creation events
- `trackFAQDeleted()` - Tracks FAQ deletion events
- Non-blocking analytics (errors won't break API)
- Uses Mixpanel EU endpoint for GDPR compliance
- **IMPORTANT**: Requires MIXPANEL_TOKEN secret in wrangler.toml

**src/analytics/metrics.ts** - Internal metrics tracking (deprecated, replaced by Mixpanel):
- KV-based metrics storage (METRICS_KV binding disabled in wrangler.toml)
- Mixpanel is now the primary analytics solution

**scripts/generate-faqs-json.ts** - Parses CSV files → generates data/faqs.json

**scripts/seed-from-json.ts** - Seeds worker from faqs.json via HTTP API

### Environment Bindings

Defined in `wrangler.toml`:
- `AI` - Workers AI binding (automatic)
- `VECTORIZE` - Vector database binding to `faq-index`
- `SIMILARITY_THRESHOLD` (default: "0.7") - Minimum score for direct answer (0-1 range)
- `FUZZY_THRESHOLD` (default: "0.6") - Minimum score for "Did you mean?" fuzzy match
- `TOP_K` (default: "3") - Number of similar FAQs to retrieve
- `MAX_FAQs_RETURN` (default: "5") - Max FAQs in response
- `ALLOWED_ORIGINS` (default: "*") - Comma-separated CORS origins
- `RATE_LIMIT_MAX` (default: "60") - Max requests per minute per IP
- `RATE_LIMIT_KV` (optional) - KV namespace binding for rate limiting
- `EMBEDDING_CACHE_KV` - KV namespace for embedding cache (Phase 2, reduces cost by 60-80%)
- `WHITELISTED_IPS` (optional) - Comma-separated IP whitelist

**Secrets (set via wrangler secret put)**:
- `PUBLIC_API_KEYS` - Comma-separated public API keys for /api/ask
- `ADMIN_API_KEYS` - Comma-separated admin API keys for CRUD operations
- `MIXPANEL_TOKEN` - Mixpanel project token for server-side analytics (optional but recommended)

Production environment overrides: `SIMILARITY_THRESHOLD = "0.75"`, `FUZZY_THRESHOLD = "0.65"`, `TOP_K = "5"`, `RATE_LIMIT_MAX = "100"`

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

### Semantic Search Algorithm (Enhanced with Fuzzy Matching)
The algorithm now has three scoring tiers for better user experience:

1. **User question** → Turkish normalization (typo correction, informal text handling)
2. **Normalized question** → embedding with cache check (60-80% cache hit rate)
3. **Vectorize query** → top K matches sorted by cosine similarity
4. **Score evaluation**:
   - **score >= SIMILARITY_THRESHOLD (0.7)**: Direct answer with high confidence ✅
   - **FUZZY_THRESHOLD (0.6) <= score < SIMILARITY_THRESHOLD**: "Did you mean?" fuzzy match 🤔
   - **score < FUZZY_THRESHOLD**: No match, show suggestions ❌
5. **Analytics tracking** → Track to Mixpanel (non-blocking)

### Turkish Text Normalization (Phase 2)
Before embedding generation, user questions are normalized to handle:
- **Common typos**: `sifre` → `şifre`, `giris` → `giriş`, `degistir` → `değiştir`
- **Informal Turkish**: `napcam` → `ne yapacağım`, `gelmiyo` → `gelmiyor`
- **Character variations**: ASCII → Turkish characters (ş, ğ, ü, ö, ç, ı)
- **Special characters**: Remove punctuation except question marks
- **Multiple spaces**: Collapse to single space

This significantly improves match accuracy for real-world user queries with typos.

### Embedding Cache (Phase 2 - Cost Optimization)
Cache implementation details:
- **Storage**: Cloudflare KV (EMBEDDING_CACHE_KV namespace)
- **Cache key**: Hash of normalized question + first 20 chars
- **TTL**: 7 days (604800 seconds)
- **Hit rate**: Typically 60-80% in production
- **Cost savings**: ~70% reduction in Workers AI costs
- **Stats tracking**: Automatic hit/miss tracking in KV
- **Graceful degradation**: Falls back to direct embedding generation if KV unavailable

### Mixpanel Analytics (Phase 3)
Server-side event tracking for every FAQ query:
- **Events tracked**: FAQ Query, FAQ Created, FAQ Deleted
- **Properties captured**: question, confidence, fuzzy, cached, responseTime, category, matchedQuestion
- **Non-blocking**: Analytics failures don't break the API
- **GDPR compliant**: Uses Mixpanel EU endpoint
- **Setup**: Set MIXPANEL_TOKEN secret via `wrangler secret put MIXPANEL_TOKEN`

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
wrangler secret put MIXPANEL_TOKEN

# Production
wrangler secret put PUBLIC_API_KEYS --env production
wrangler secret put ADMIN_API_KEYS --env production
wrangler secret put MIXPANEL_TOKEN --env production
```

## Troubleshooting

**No matches found even with similar questions**:
- Check if Turkish normalization is working: look for "Normalized:" in logs
- Lower `SIMILARITY_THRESHOLD` in wrangler.toml (try 0.6)
- Check `FUZZY_THRESHOLD` - scores between 0.6-0.7 trigger "Did you mean?" responses
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

**Embedding cache not working**:
- Verify EMBEDDING_CACHE_KV binding exists in wrangler.toml
- Check cache stats: `curl -H "X-API-Key: admin-key" http://localhost:8787/api/cache/stats`
- Look for "Cache HIT/MISS" messages in logs
- Cache gracefully degrades if KV unavailable (check for "Cache KV not available" in logs)

**Mixpanel events not appearing**:
- Verify MIXPANEL_TOKEN is set: `wrangler secret list`
- Check logs for "[Mixpanel]" messages
- Confirm token is from Mixpanel EU project (uses api-eu.mixpanel.com endpoint)
- Analytics failures are non-blocking - API continues to work even if Mixpanel fails

## Performance Characteristics

**Without cache (cold)**:
- Average total response: ~500ms
- Turkish normalization: ~1ms
- Workers AI embedding: ~200ms
- Vectorize similarity search: ~50ms
- Mixpanel tracking: ~100ms (non-blocking)
- Cold start penalty: ~1s

**With cache (warm - typical)**:
- Average total response: ~300ms (40% faster)
- Cache lookup: ~20ms
- No embedding generation needed
- Cache hit rate: 60-80% in production

**Limitations**:
- Vectorize has no direct ID lookup (requires full scan workaround)
- KV operations add ~20ms latency but save ~200ms on cache hits

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
- **Cost optimization**: Embedding cache reduces Workers AI costs by ~70% (60-80% hit rate)
- **Analytics**: Server-side Mixpanel tracking for all FAQ queries (non-blocking)
- **Turkish normalization**: Handles typos and informal Turkish for better matching
- **Fuzzy matching**: Three-tier scoring system (direct answer, "did you mean?", no match)
- The embedding model (@cf/baai/bge-m3) is specifically designed for multilingual support with excellent Turkish language performance
- BGE-M3 properly handles Turkish characters and language structure, providing high accuracy for semantic matching
- Vectorize is in beta - API may change
- **Data source**: CSV files are the source of truth; JSON is auto-generated via `npm run build:data`

## Feature Phases

**Phase 1 (Completed)**: Core semantic search with BGE-M3, security (API keys, rate limiting, CORS)
**Phase 2 (Completed)**: Turkish normalization + embedding cache (70% cost reduction)
**Phase 3 (Completed)**: Mixpanel analytics integration + fuzzy matching

## Health & Status Monitoring

The application provides two critical endpoints for monitoring:

### Health Check - `/api/health`
**Purpose**: Basic service availability check
- No authentication required
- Returns service status and timestamp
- Use for: Uptime monitoring, load balancers, status pages

**Response**:
```json
{
  "status": "healthy",
  "service": "passgage-faq-bot",
  "timestamp": "2026-01-11T13:45:13.533Z"
}
```

**Monitoring Setup**:
```bash
# Simple uptime check (every 5 minutes)
*/5 * * * * curl -f https://passgage-faq-bot.passgage.workers.dev/api/health || alert

# External monitoring services:
# - UptimeRobot: https://uptimerobot.com
# - Pingdom: https://pingdom.com
# - Cloudflare Health Checks (in dashboard)
```

### Database Status - `/api/status`
**Purpose**: Verify FAQ database initialization
- No authentication required
- Checks if Vectorize has been seeded with FAQs
- Use for: Deployment verification, database health checks

**Response**:
```json
{
  "status": "ready|empty|error",
  "initialized": true,
  "message": "FAQ veritabanı yüklendi ve hazır",
  "timestamp": "2026-01-11T13:45:13.783Z"
}
```

**Status Values**:
- `ready` - Database loaded and operational ✅
- `empty` - Database empty, run seed script ⚠️
- `error` - Error checking database ❌

**Post-Deployment Verification**:
```bash
# After deploy, verify database is ready
curl https://passgage-faq-bot.passgage.workers.dev/api/status | jq .

# Expected: status = "ready", initialized = true
# If empty: Run npm run seed to load FAQs
```

### Recommended Monitoring Strategy

1. **Uptime Monitoring**: Check `/api/health` every 5 minutes
2. **Database Monitoring**: Check `/api/status` after every deployment
3. **Alert on**: status != "healthy" or initialized != true
4. **Cloudflare Analytics**: Monitor request counts, error rates, latency

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
- Always set PUBLIC_API_KEYS, ADMIN_API_KEYS, and MIXPANEL_TOKEN as secrets (not in wrangler.toml)
- Vectorize dimensions must match model output (1024 for BGE-M3)
- Don't commit secrets or API keys to version control
- Rate limiting requires RATE_LIMIT_KV namespace binding; gracefully disabled if not configured
- Embedding cache requires EMBEDDING_CACHE_KV namespace binding; falls back to direct generation if not configured
- When testing locally, use test keys from vitest.config.ts: `test-public-key` and `test-admin-key`
- METRICS_KV binding is deprecated (disabled in wrangler.toml) - use Mixpanel for analytics instead

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
