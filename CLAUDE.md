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
npm run deploy       # Deploy to Cloudflare Workers
npm run tail         # Live logs from deployed worker
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

### Seeding FAQs
```bash
# After deployment, seed the FAQ database
curl -X POST https://your-worker.workers.dev/api/seed \
  -H "Content-Type: application/json" \
  -d @data/faqs.json
```

### Testing API Locally
```bash
# Test ask endpoint
curl -X POST http://localhost:8787/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Şifremi nasıl değiştirebilirim?"}'

# Health check
curl http://localhost:8787/api/health
```

## Architecture

### Request Flow
```
User Question (Turkish)
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

**src/index.ts** - Main Hono application with 5 REST endpoints:
- `GET /api/health` - Health check
- `POST /api/ask` - Primary semantic search endpoint
- `POST /api/faq` - Create single FAQ (admin)
- `DELETE /api/faq/:id` - Delete FAQ (admin)
- `POST /api/seed` - Bulk import FAQs from JSON (admin)

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

### Environment Bindings

Defined in `wrangler.toml`:
- `AI` - Workers AI binding (automatic)
- `VECTORIZE` - Vector database binding to `faq-index`
- `SIMILARITY_THRESHOLD` (default: "0.7") - Minimum score to return a match (0-1 range)
- `TOP_K` (default: "3") - Number of similar FAQs to retrieve
- `MAX_FAQs_RETURN` (default: "5") - Max FAQs in response

Production environment overrides: `SIMILARITY_THRESHOLD = "0.75"`, `TOP_K = "5"`

## FAQ Data Structure

FAQs are stored in `data/faqs.json` with this schema:
```json
{
  "id": "faq-1",
  "question": "Turkish question text",
  "answer": "Turkish answer text",
  "category": "giriş|geçiş-kontrol|vardiya|buradayım|sosyal-medya|modüller",
  "keywords": ["optional", "search", "terms"]
}
```

Categories represent Passgage modules and features. When adding new FAQs, maintain consistent Turkish language and categorization.

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

### CORS Configuration
CORS is enabled globally via `app.use('*', cors())` in Hono for frontend integration.

## Troubleshooting

**No matches found even with similar questions**:
- Lower `SIMILARITY_THRESHOLD` in wrangler.toml (try 0.6)
- Verify FAQs are seeded: check logs after POST /api/seed
- Turkish embeddings may have lower similarity scores than English

**Vectorize errors on query**:
- Ensure index exists: `npx wrangler vectorize list`
- Verify dimensions match (768) and metric is cosine
- Recreate index if corrupted

**TypeScript errors with Vectorize types**:
- Use Cloudflare's native types from `@cloudflare/workers-types`
- Don't create custom interfaces for Vectorize responses
- Always null-check metadata fields

**Slow response times**:
- Embedding generation: ~200ms (unavoidable)
- Consider implementing KV cache for frequent questions
- Cold starts add ~1s latency

## Performance Characteristics

- Average total response: ~500ms
- Workers AI embedding: ~200ms
- Vectorize similarity search: ~50ms
- Cold start penalty: ~1s
- Vectorize has no direct ID lookup (requires full scan workaround)

## Adding New FAQs

1. Add to `data/faqs.json` following the schema
2. Use appropriate category and Turkish language
3. After deployment, re-run seed endpoint:
   ```bash
   curl -X POST https://your-worker.workers.dev/api/seed \
     -H "Content-Type: application/json" \
     -d @data/faqs.json
   ```
4. Test with similar question variations to verify semantic matching

## Important Notes

- This project is specifically for Turkish language FAQs about Passgage workforce management platform
- Admin endpoints (/api/faq, /api/seed, DELETE) have no authentication - add auth before production use
- The embedding model (@cf/baai/bge-m3) is specifically designed for multilingual support with excellent Turkish language performance
- BGE-M3 properly handles Turkish characters and language structure, providing high accuracy for semantic matching
- Vectorize is in beta - API may change

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
