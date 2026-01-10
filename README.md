# Passgage FAQ Bot

Semantic search FAQ chatbot using Cloudflare Workers AI and Vectorize for Turkish language support.

## Overview

This project implements a smart FAQ chatbot that uses:
- **Cloudflare Workers** - Serverless compute
- **Workers AI** - Text embeddings (@cf/baai/bge-m3, multilingual, optimized for Turkish)
- **Vectorize** - Vector database for similarity search
- **Hono** - Web framework for routing

## Features

- Semantic search for FAQs in Turkish
- Vector-based similarity matching
- REST API with multiple endpoints
- Support for 40-45 FAQs covering Passgage modules and features
- **CSV-based data source** - Real FAQ data from CSV files
- Database initialization verification endpoint
- CORS enabled for frontend integration

## Architecture

```
User Question → Workers AI (Embedding) → Vectorize (Similarity Search) → Best Match Answer
```

## Project Structure

```
passgage-faq-bot/
├── src/
│   ├── index.ts          # Main API with Hono routes
│   ├── embeddings.ts     # Workers AI embedding functions
│   ├── vectorize.ts      # Vectorize CRUD operations
│   ├── types.ts          # TypeScript type definitions
│   ├── middleware/       # Security middleware (auth, rate limiting, CORS)
│   └── utils/
│       └── csvParser.ts  # CSV parsing utilities
├── scripts/
│   └── seed-from-csv.ts  # Node.js script to seed FAQs from CSV
├── data/
│   ├── Passgage Exairon.csv                    # Source CSV #1 (32 FAQs)
│   ├── Sorular - Yanıtlar ChatBot Mobil.csv    # Source CSV #2 (13 FAQs)
│   └── parsed-faqs.json                         # Auto-generated from CSVs
├── docs/                 # Documentation
├── wrangler.toml         # Cloudflare configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
cd passgage-faq-bot
npm install
```

### 2. Create Vectorize Index

```bash
npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine
```

This creates a vector database index with:
- **1024 dimensions** (matching the BGE-M3 embedding model)
- **Cosine similarity** metric

### 3. Update wrangler.toml

Ensure your `wrangler.toml` has the correct Vectorize binding:

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "faq-index"
```

### 4. Development

Run locally:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

### 5. Deploy

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

### 6. Seed FAQs

**Two-step process:**

#### Step 1: Generate faqs.json from CSV files (run once after CSV changes)

```bash
npm run build:data
```

This will:
1. Parse both CSV files (`Passgage Exairon.csv` and `Sorular - Yanıtlar ChatBot Mobil.csv`)
2. Generate `data/faqs.json` with 44 FAQs
3. Add metadata (generated timestamp, source info)
4. Display category breakdown

#### Step 2: Seed to worker

```bash
# Production
WORKER_URL=https://your-worker.workers.dev \
ADMIN_API_KEY=your-admin-api-key \
npm run seed

# Local development
npm run dev  # Start worker (in another terminal)

WORKER_URL=http://localhost:8787 \
ADMIN_API_KEY=your-dev-admin-key \
npm run seed
```

The seed script will:
1. Read `data/faqs.json` (fast - no CSV parsing!)
2. Upload to worker via `/api/seed` endpoint
3. Verify data load via `/api/status` endpoint

**Updating FAQs:**
1. Edit CSV files in `data/`
2. Run `npm run build:data` to regenerate `faqs.json`
3. Commit both CSV and JSON changes
4. Re-seed: `npm run seed`

## API Endpoints

### Health Check
```http
GET /api/health
```

Returns service status.

### Database Status Check
```http
GET /api/status
```

Returns database initialization status. Use this to verify that FAQs have been seeded.

Response:
```json
{
  "status": "ready",
  "initialized": true,
  "message": "FAQ veritabanı yüklendi ve hazır",
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

Possible status values:
- `"ready"` - Database is loaded and ready
- `"empty"` - Database is empty, run seed script
- `"error"` - Error checking database status

### Ask a Question
```http
POST /api/ask
Content-Type: application/json

{
  "question": "Şifremi nasıl sıfırlayabilirim?"
}
```

Response:
```json
{
  "success": true,
  "answer": "Öncelikle smslerin spam klasörüne düşmediğinden emin olunuz...",
  "confidence": 0.87,
  "matchedQuestion": "Şifre yenileme yaparken sms gelmiyor.",
  "category": "giriş",
  "suggestions": [
    {
      "question": "Şifre yenilemesi yaparken maile kod gelmiyor.",
      "id": "faq-3",
      "category": "giriş"
    }
  ]
}
```

### Create FAQ (Admin)
```http
POST /api/faq
Content-Type: application/json

{
  "question": "Yeni soru?",
  "answer": "Cevap metni",
  "category": "kategori",
  "keywords": ["anahtar", "kelime"]
}
```

Response:
```json
{
  "success": true,
  "id": "faq-1234567890",
  "message": "FAQ başarıyla oluşturuldu."
}
```

### Delete FAQ (Admin)
```http
DELETE /api/faq/:id
```

Response:
```json
{
  "success": true,
  "message": "FAQ başarıyla silindi."
}
```

### Bulk Seed FAQs (Admin)
```http
POST /api/seed
Content-Type: application/json

{
  "faqs": [
    {
      "id": "faq-1",
      "question": "Soru?",
      "answer": "Cevap",
      "category": "kategori"
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "inserted": 26,
  "failed": 0,
  "message": "26 FAQ başarıyla eklendi."
}
```

## Configuration

Environment variables in `wrangler.toml`:

```toml
[vars]
SIMILARITY_THRESHOLD = "0.7"    # Minimum similarity score (0-1)
TOP_K = "3"                      # Number of results to return
MAX_FAQs_RETURN = "5"            # Max FAQs in response
```

### Adjusting Sensitivity

- **SIMILARITY_THRESHOLD**: Lower values (0.6) = more lenient matching, Higher values (0.8) = stricter matching
- **TOP_K**: Increase to get more alternative suggestions

## FAQ Categories

The system includes FAQs in these categories:

1. **giriş** - Login and authentication
2. **geçiş-kontrol** - QR code and access control
3. **vardiya** - Shift management
4. **buradayım** - Check-in module
5. **sosyal-medya** - Social media module
6. **modüller** - General module information

## How It Works

1. **User asks a question** in Turkish
2. **Workers AI generates embedding** (1024-dimensional vector using BGE-M3 multilingual model)
3. **Vectorize searches** for similar FAQ embeddings using cosine similarity
4. **Best match returned** if similarity score > threshold
5. **Related suggestions** included in response

### Why BGE-M3?

The BGE-M3 model is specifically optimized for 100+ languages including Turkish. It properly handles:
- Turkish characters (ş, ğ, ü, ö, ç, ı)
- Turkish morphology and word structure
- Language-specific semantic nuances

This provides significantly better accuracy than English-focused models for Turkish FAQ matching.

## Testing

### Local Testing

```bash
# Start dev server
npm run dev

# In another terminal, test the API
curl -X POST http://localhost:8787/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Şifremi unuttum"}'
```

### Type Checking

```bash
npm run typecheck
```

### View Logs

```bash
npm run tail
```

## Troubleshooting

### No matches found
- Lower `SIMILARITY_THRESHOLD` in wrangler.toml
- Ensure FAQs are seeded with `npm run seed:csv`
- Verify database is initialized: `curl https://your-worker.workers.dev/api/status`
- Check if question is significantly different from existing FAQs

### Vectorize errors
- Verify index exists: `npx wrangler vectorize list`
- Recreate index if needed: `npx wrangler vectorize delete faq-index` then create again

### AI embedding errors
- Workers AI is automatically available in Workers
- No additional setup required for AI binding

## Performance

- **Average response time**: ~500ms (including AI inference + vector search)
- **Embedding generation**: ~200ms
- **Vector search**: ~50ms
- **Cold start**: ~1s

## Limitations

- Vectorize doesn't support direct ID lookup (workaround implemented)
- Turkish language support depends on multilingual embedding model
- Rate limits apply per Cloudflare Workers plan

## Security

The API includes multiple security layers:

### API Key Authentication
Admin endpoints (`/api/faq`, `/api/seed`, `DELETE /api/faq/:id`) require API key authentication:

```bash
# Set API key as secret
wrangler secret put API_KEYS

# Use in requests
curl -X POST https://your-worker.workers.dev/api/faq \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "...", "answer": "..."}'
```

### Rate Limiting
Protect your API from abuse with configurable rate limits:
- Default: 60 requests per minute per IP
- Requires KV namespace setup (see SECURITY.md)

### CORS Configuration
Control which domains can access your API:
```toml
[vars]
ALLOWED_ORIGINS = "https://passgage.com,https://app.passgage.com"
```

### Additional Security
- IP whitelisting (optional)
- Request logging
- HTTPS enforced automatically

For complete security setup guide, see [SECURITY.md](SECURITY.md)

## Postman Collection

Import the Postman collection for easy API testing:

```
postman/Passgage-FAQ-Bot.postman_collection.json
```

The collection includes:
- Public endpoints (health, ask)
- Admin endpoints with API key auth
- Turkish FAQ examples
- Example responses

## Future Enhancements

- [x] API key authentication
- [x] Rate limiting
- [x] CORS configuration
- [ ] KV cache for frequent questions
- [ ] Analytics tracking
- [ ] Support for multi-turn conversations
- [ ] Add more FAQs from customer support data

## License

MIT

## Support

For issues or questions, contact the Passgage development team.

Security issues: See [SECURITY.md](SECURITY.md)
