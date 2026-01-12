# Contributing to Passgage FAQ Bot

## Development Setup

1. **Prerequisites**
   - Node.js 20+ (see `.nvmrc`)
   - npm or pnpm
   - Cloudflare account with Workers access

2. **Installation**
   ```bash
   npm install
   ```

3. **Create Vectorize Index**
   ```bash
   npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine
   ```

   Note: Using 1024 dimensions for BGE-M3 multilingual model (optimized for Turkish)

4. **Run Locally**
   ```bash
   npm run dev
   ```

## Code Quality

### Pre-commit Hooks (Automatic)

We use **Husky** and **lint-staged** to automatically enforce code quality before every commit:

- ✅ **Prettier** - Auto-formats all staged files
- ✅ **TypeScript** - Type checks staged TypeScript files
- ✅ **Tests** - Runs full test suite

**The commit will be blocked if any check fails.** Fix the issues and try again.

### Manual Checks

You can also run these checks manually:

```bash
# TypeScript type checking (required)
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Format code
npm run format

# Check formatting
npm run format:check
```

### TypeScript Guidelines

- This project uses **strict TypeScript** mode
- Always run `npm run typecheck` before committing
- When working with Vectorize responses:
  - Use optional chaining: `match.metadata?.field`
  - Provide fallback values for undefined cases
  - Avoid creating custom interfaces for Cloudflare types

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Max line length: 80 characters
- See `.prettierrc` for full style guide

## Adding FAQs

1. Edit `data/faqs.json`:
   ```json
   {
     "id": "faq-XX",
     "question": "Turkish question",
     "answer": "Turkish answer",
     "category": "category-name",
     "keywords": ["keyword1", "keyword2"]
   }
   ```

2. Use appropriate categories:
   - `giriş` - Login/authentication
   - `geçiş-kontrol` - Access control/QR codes
   - `vardiya` - Shift management
   - `buradayım` - Check-in
   - `sosyal-medya` - Social media
   - `modüller` - General modules

3. Test locally with `npm run dev`

4. Deploy and re-seed:
   ```bash
   npm run deploy
   curl -X POST https://your-worker.workers.dev/api/seed \
     -H "Content-Type: application/json" \
     -d @data/faqs.json
   ```

## Project Structure

```
src/
├── index.ts        # Main Hono API routes
├── embeddings.ts   # Workers AI wrapper
├── vectorize.ts    # Vector DB operations
└── types.ts        # TypeScript types

data/
└── faqs.json       # FAQ database
```

## Testing

### Automated Tests

The project includes a comprehensive test suite using **Vitest**:

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test files** are located in `src/__tests__/`:
- `api.test.ts` - API endpoint tests
- `auth.test.ts` - Authentication middleware tests
- `csvParser.test.ts` - CSV parsing utility tests
- `types.test.ts` - TypeScript type validation tests

### CI/CD Testing

Every push and pull request automatically runs:
1. ✅ Code formatting check (Prettier)
2. ✅ TypeScript type checking
3. ✅ Full test suite
4. ✅ Security audit (informational)

See `.github/workflows/ci.yml` for details.

### Manual API Testing

```bash
# Start dev server
npm run dev

# In another terminal
curl -X POST http://localhost:8787/api/ask \
  -H "X-API-Key: test-public-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "Şifremi nasıl değiştirebilirim?"}'
```

### Health Check

```bash
curl http://localhost:8787/api/health
```

## Deployment

### To Production

```bash
# 1. Ensure all checks pass
npm run typecheck
npm run format:check

# 2. Deploy
npm run deploy

# 3. View logs
npm run tail
```

### Environment Configuration

Edit `wrangler.toml` for environment-specific settings:

```toml
[env.production]
name = "passgage-faq-bot-production"
vars = { SIMILARITY_THRESHOLD = "0.75", TOP_K = "5" }
```

## Common Issues

### Vectorize Errors
- Ensure index exists: `npx wrangler vectorize list`
- Recreate if needed: `npx wrangler vectorize delete faq-index`

### Low Similarity Scores
- Adjust `SIMILARITY_THRESHOLD` in wrangler.toml (default: 0.7)
- Test with various question phrasings
- BGE-M3 model is optimized for Turkish - should provide good scores

### Turkish Character Issues
- BGE-M3 model properly handles Turkish characters (ş, ğ, ü, ö, ç, ı)
- Ensure your terminal/editor uses UTF-8 encoding
- Test with both Turkish and English variations if needed

### Type Errors
- Always use Cloudflare's native types
- Check for null/undefined with optional chaining
- Run `npm run typecheck` frequently

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Make your changes
3. Run `npm run typecheck` and `npm run format`
4. Test locally with `npm run dev`
5. Commit with clear, descriptive messages
6. Create pull request with detailed description

## Questions?

Contact the Passgage development team.
