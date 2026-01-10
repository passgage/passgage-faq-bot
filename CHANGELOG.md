# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-10

### Added
- Initial release of Passgage FAQ Bot
- Semantic search using Cloudflare Workers AI and Vectorize
- Support for 26 Turkish FAQs across 6 categories
- REST API with 5 endpoints (health, ask, create, delete, seed)
- **BGE-M3 multilingual model optimized for Turkish language**
- Native support for Turkish characters (ş, ğ, ü, ö, ç, ı)
- Turkish morphology and semantic understanding
- CORS enabled for frontend integration
- Configurable similarity threshold and result limits
- Batch FAQ import via seed endpoint

### Technical
- TypeScript implementation with strict mode
- Hono web framework for routing
- **Workers AI embedding model: @cf/baai/bge-m3 (1024 dimensions)**
- Multilingual model trained on 100+ languages including Turkish
- Vectorize with cosine similarity metric
- Comprehensive documentation (README, CLAUDE, CONTRIBUTING)
- CI/CD pipeline with GitHub Actions
- Code formatting with Prettier
- Development tooling (EditorConfig, VSCode settings)

### Why BGE-M3?
- Superior Turkish language support compared to English-focused models
- Proper handling of Turkish-specific characters and word formation
- Higher accuracy for Turkish semantic similarity matching
- 1024-dimensional embeddings for nuanced meaning capture

### Categories
- Giriş (Login/Authentication)
- Geçiş Kontrol (Access Control/QR Codes)
- Vardiya (Shift Management)
- Buradayım (Check-in Module)
- Sosyal Medya (Social Media)
- Modüller (General Modules)

[1.0.0]: https://github.com/passgage/passgage-faq-bot/releases/tag/v1.0.0
