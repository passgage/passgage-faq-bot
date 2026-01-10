# Hızlı Başlangıç - Passgage Entegrasyonu

## 🚀 5 Dakikada Kur ve Kullan

### 1. API Key'leri Oluştur

```bash
# Public key (Passgage uygulamanız için)
openssl rand -hex 32
# Kaydet: PUBLIC_KEY

# Admin key (Yönetim için)
openssl rand -hex 32
# Kaydet: ADMIN_KEY
```

### 2. Cloudflare'e Deploy Et

```bash
# Vectorize index oluştur
npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine

# Secrets ayarla
wrangler secret put PUBLIC_API_KEYS
# Girin: [PUBLIC_KEY]

wrangler secret put ADMIN_API_KEYS
# Girin: [ADMIN_KEY]

wrangler secret put ALLOWED_ORIGINS
# Girin: https://passgage.com,https://app.passgage.com

# Deploy
npm run deploy
```

### 3. FAQ'ları Yükle

```bash
# Adım 1: CSV'lerden JSON oluştur (tek seferlik)
npm run build:data

# Adım 2: Worker'a yükle
WORKER_URL=https://passgage-faq-bot.your-worker.workers.dev \
ADMIN_API_KEY=[ADMIN_KEY] \
npm run seed
```

### 4. Passgage Uygulamanıza Ekleyin

```typescript
// config.ts
export const FAQ_CONFIG = {
  apiUrl: 'https://passgage-faq-bot.your-worker.workers.dev',
  apiKey: '[PUBLIC_KEY]' // PUBLIC key kullan
};

// faqService.ts
export async function askQuestion(question: string) {
  const response = await fetch(`${FAQ_CONFIG.apiUrl}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': FAQ_CONFIG.apiKey,
    },
    body: JSON.stringify({ question }),
  });

  return response.json();
}
```

### 5. Test Et!

```bash
# Passgage uygulamanızdan
const result = await askQuestion('Şifremi nasıl değiştirebilirim?');
console.log(result.answer);
```

## ✅ Tamamdır!

Passgage uygulamanız artık:
- ✅ **Güvenli** - API key + CORS + Rate limiting
- ✅ **Hızlı** - Edge'de çalışıyor (~200ms)
- ✅ **Akıllı** - Türkçe semantic search (BGE-M3)
- ✅ **Kolay** - Tek endpoint: `/api/ask`

## 📚 Daha Fazla

- **Detaylı güvenlik**: `docs/API-SECURITY-SETUP.md`
- **Tüm özellikler**: `README.md`
- **Postman collection**: `postman/Passgage-FAQ-Bot.postman_collection.json`
