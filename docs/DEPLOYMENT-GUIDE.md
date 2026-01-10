# Passgage FAQ Bot - Deployment Guide

## Hızlı Özet

Bu proje artık **sadece CSV dosyalarından** FAQ verisi kullanıyor. Fabricated JSON data tamamen kaldırıldı.

## Değişiklikler

### ✅ Eklenenler
1. **CSV Parser** (`src/utils/csvParser.ts`)
   - 2 farklı CSV formatını parse eder
   - Türkçe karakterleri korur
   - Kategori normalizasyonu yapar
   - 44 FAQ çıkarır

2. **Seed Script** (`scripts/seed-from-csv.ts`)
   - CSV'leri okur ve parse eder
   - JSON formatına çevirir
   - Worker'a upload eder
   - Veri yüklendiğini doğrular

3. **Status Endpoint** (`GET /api/status`)
   - Veritabanı initialization durumunu kontrol eder
   - Seed işleminden sonra doğrulama için kullanılır

4. **Dokümantasyon**
   - `docs/CSV-DATA-SOURCE.md` - CSV format ve data source açıklaması
   - `docs/DEPLOYMENT-GUIDE.md` - Bu dosya
   - README.md ve QUICK-START.md güncellendi

### ❌ Silinenler
1. **data/faqs.json** - Fabricated FAQ data silindi

### 🔧 Değişenler
1. **package.json** - tsx dependency ve seed:csv script eklendi
2. **README.md** - CSV seeding dokümantasyonu eklendi
3. **QUICK-START.md** - Seed adımı güncellendi

## Data Kaynağı

### CSV Dosyaları
1. **Passgage Exairon.csv**: 28 FAQ (complex format)
2. **Sorular - Yanıtlar ChatBot Mobil.csv**: 16 FAQ (simple format)

**Toplam**: 44 FAQ

### Kategoriler
- **giriş**: 6 FAQ
- **geçiş-kontrol**: 26 FAQ
- **modüller**: 12 FAQ

## Deployment Adımları

### 1. Gereksinimler
```bash
# Node.js 20+ gerekli
node --version  # v20.x.x veya üzeri

# Dependencies yükle
npm install
```

### 2. Vectorize Index Oluştur
```bash
npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine
```

### 3. Secrets Ayarla
```bash
# Public API key (Passgage uygulaması için)
wrangler secret put PUBLIC_API_KEYS --env production
# Örnek: public-key-123,public-key-456

# Admin API key (Yönetim için)
wrangler secret put ADMIN_API_KEYS --env production
# Örnek: admin-key-789

# CORS origins
wrangler secret put ALLOWED_ORIGINS --env production
# Örnek: https://passgage.com,https://app.passgage.com
```

### 4. Deploy Worker
```bash
npm run deploy
```

### 5. Seed FAQs
```bash
WORKER_URL=https://passgage-faq-bot.your-worker.workers.dev \
ADMIN_API_KEY=admin-key-789 \
npm run seed:csv
```

Beklenen çıktı:
```
📋 Testing CSV Parser

Parsed 28 FAQs from Passgage Exairon.csv
Parsed 16 FAQs from Sorular - Yanıtlar ChatBot Mobil.csv
Total: 44 FAQs

✅ SUCCESS!
  - Inserted: 44 FAQs
  - Failed: 0 FAQs
  - Message: 44 FAQ başarıyla eklendi.

🔍 Verifying data load...
✅ Verification successful: FAQ veritabanı yüklendi ve hazır
```

### 6. Doğrulama
```bash
# Status check
curl https://passgage-faq-bot.your-worker.workers.dev/api/status

# Test query
curl -X POST https://passgage-faq-bot.your-worker.workers.dev/api/ask \
  -H "Content-Type: application/json" \
  -H "X-API-Key: public-key-123" \
  -d '{"question": "Kullanıcı bulunamadı hatası alıyorum"}'
```

## Local Development

### 1. Start Worker
```bash
npm run dev
```

### 2. Seed Locally
```bash
# Başka bir terminalde
WORKER_URL=http://localhost:8787 \
ADMIN_API_KEY=dev-admin-key \
npm run seed:csv
```

### 3. Test
```bash
# Status check
curl http://localhost:8787/api/status

# Test query
curl -X POST http://localhost:8787/api/ask \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-public-key" \
  -d '{"question": "Şifremi unuttum"}'
```

## CSV Parser Test

CSV parser'ın doğru çalıştığını test etmek için:

```bash
npx tsx scripts/test-csv-parser.ts
```

Bu script:
- CSV dosyalarını parse eder
- FAQ sayısını ve kategorilerini gösterir
- `data/parsed-faqs.json` dosyasını oluşturur (inceleme için)

## Troubleshooting

### CSV parse hatası
**Hata**: `Error: CSV file not found`

**Çözüm**: CSV dosyalarının `data/` klasöründe olduğunu doğrula:
```bash
ls -la data/*.csv
```

### Seed başarısız
**Hata**: `Error seeding FAQs`

**Çözümler**:
1. Worker çalışıyor mu? → `npm run dev`
2. Admin API key doğru mu?
3. Vectorize index var mı? → `npx wrangler vectorize list`

### Vectorize index hatası
**Hata**: `Vectorize index not found`

**Çözüm**: Index'i oluştur:
```bash
npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine
```

### TypeScript hataları
**Çözüm**: Typecheck çalıştır:
```bash
npm run typecheck
```

### Türkçe karakterler bozuk
**Çözüm**: CSV dosyalarının UTF-8 encoding ile kaydedildiğinden emin ol.

## FAQ Data Güncellemeleri

### Yeni FAQ Ekleme (Önerilen Yöntem)

1. **CSV dosyasını düzenle**:
   ```
   # data/Sorular - Yanıtlar ChatBot Mobil.csv
   Yeni soru?;Açıklama;Çözüm metni
   ```

2. **Re-seed et**:
   ```bash
   npm run seed:csv
   ```

### API ile Ekleme (Geçici)

```bash
curl -X POST https://your-worker.workers.dev/api/faq \
  -H "Content-Type: application/json" \
  -H "X-API-Key: admin-key-789" \
  -d '{
    "question": "Yeni soru?",
    "answer": "Cevap metni",
    "category": "kategori"
  }'
```

⚠️ **Not**: API ile eklenen FAQ'lar CSV'lere kaydedilmez. Kalıcı olması için CSV'ye manuel ekleme yapılmalı.

## Production Checklist

- [ ] Vectorize index oluşturuldu
- [ ] PUBLIC_API_KEYS secret ayarlandı
- [ ] ADMIN_API_KEYS secret ayarlandı
- [ ] ALLOWED_ORIGINS secret ayarlandı
- [ ] Worker deploy edildi (`npm run deploy`)
- [ ] FAQs seed edildi (`npm run seed:csv`)
- [ ] Status check başarılı (`/api/status` returns "ready")
- [ ] Test query başarılı (`/api/ask` returns valid response)
- [ ] Postman collection test edildi
- [ ] Documentation güncel

## Endpoints

| Endpoint | Method | Auth | Açıklama |
|----------|--------|------|----------|
| `/api/health` | GET | ❌ | Health check |
| `/api/status` | GET | ❌ | DB initialization status |
| `/api/ask` | POST | ✅ PUBLIC | Soru sor |
| `/api/faq` | POST | ✅ ADMIN | FAQ ekle |
| `/api/faq/:id` | DELETE | ✅ ADMIN | FAQ sil |
| `/api/seed` | POST | ✅ ADMIN | Bulk FAQ import |

## Monitoring

### Logs
```bash
npm run tail
```

### Analytics
- Cloudflare Dashboard → Workers & Pages → passgage-faq-bot → Metrics
- Request count, errors, CPU time, etc.

## Security

- ✅ Two-tier API key system (PUBLIC + ADMIN)
- ✅ CORS protection
- ✅ Rate limiting (60 req/min default)
- ✅ Request logging
- ✅ HTTPS enforced

Detaylı güvenlik bilgisi: `docs/API-SECURITY-SETUP.md`

## Support

Sorular için:
- Dokümantasyon: `docs/` klasörü
- Postman collection: `postman/Passgage-FAQ-Bot.postman_collection.json`
- Passgage development team

## Version

- **Current**: 1.0.0
- **Last Updated**: January 2026
- **CSV Parser**: v1.0
- **BGE-M3 Model**: 1024 dimensions
- **Vectorize**: Cosine similarity
