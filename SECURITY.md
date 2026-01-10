# API Güvenlik Kılavuzu

Bu dokümanda Passgage FAQ Bot API'sinin nasıl güvenli hale getirileceği açıklanmaktadır.

## Güvenlik Katmanları

### 1. API Key Authentication (Admin Endpoints)

Admin endpoint'leri (`/api/faq`, `/api/seed`, `DELETE /api/faq/:id`) API key ile korunmaktadır.

#### API Key Oluşturma

```bash
# Güçlü bir API key oluştur
openssl rand -hex 32

# Çıktı: 6f7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7
```

#### API Key Ayarlama

**Wrangler Secrets ile (Production - Önerilen)**:
```bash
# API key'i secret olarak kaydet
wrangler secret put API_KEYS

# Prompt geldiğinde key'inizi girin (birden fazla key için virgülle ayırın)
# Örnek: key1,key2,key3
```

**Environment Variable ile (Development)**:
```bash
# .env dosyası oluştur
cp .env.example .env

# .env dosyasını düzenle
API_KEYS=your-api-key-here,another-key-here
```

#### API Key Kullanımı

```bash
# Postman veya curl ile
curl -X POST https://your-worker.workers.dev/api/faq \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"question": "Test?", "answer": "Test cevap", "category": "test"}'
```

### 2. CORS (Cross-Origin Resource Sharing)

Frontend uygulamanızın API'ye erişmesi için CORS ayarlarını yapılandırın.

#### Tüm Origin'lere İzin Ver (Development)

```toml
# wrangler.toml
[vars]
ALLOWED_ORIGINS = "*"
```

#### Belirli Origin'lere İzin Ver (Production - Önerilen)

```toml
# wrangler.toml
[env.production.vars]
ALLOWED_ORIGINS = "https://passgage.com,https://app.passgage.com"
```

veya secrets ile:

```bash
wrangler secret put ALLOWED_ORIGINS --env production
# Prompt'ta girin: https://passgage.com,https://app.passgage.com
```

### 3. Rate Limiting

API'ye yapılan istekleri sınırlandırarak abuse'i önleyin.

#### Rate Limiting Aktifleştirme

1. **KV Namespace Oluştur**:
```bash
npx wrangler kv:namespace create "RATE_LIMIT_KV"
```

Çıktı:
```
🌀 Creating namespace with title "passgage-faq-bot-RATE_LIMIT_KV"
✨ Success!
Add the following to your configuration file:
kv_namespaces = [
  { binding = "RATE_LIMIT_KV", id = "abc123..." }
]
```

2. **wrangler.toml'a Ekle**:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"

[vars]
RATE_LIMIT_MAX = "60"  # Dakikada maksimum 60 istek
```

#### Rate Limit Ayarları

- **RATE_LIMIT_MAX**: Dakikada maksimum istek sayısı
  - Development: 60 (varsayılan)
  - Production: 100 (önerilen)

Rate limit aşıldığında:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.",
  "retryAfter": 45
}
```

### 4. IP Whitelisting (Opsiyonel)

Sadece belirli IP adreslerinden gelen isteklere izin verin.

```bash
# Secrets ile ayarla
wrangler secret put WHITELISTED_IPS

# Prompt'ta virgülle ayrılmış IP'ler girin
# Örnek: 192.168.1.100,10.0.0.50,203.0.113.42
```

veya wrangler.toml'da:
```toml
[vars]
WHITELISTED_IPS = "192.168.1.100,10.0.0.50"
```

## Güvenlik Best Practices

### 1. Secrets Kullanımı

**API key'leri ASLA kod içine yazmayın!** Cloudflare Secrets kullanın:

```bash
# Production için
wrangler secret put API_KEYS --env production

# Development için .env dosyası kullanın
```

### 2. HTTPS Zorunlu

Cloudflare Workers otomatik olarak HTTPS kullanır. HTTP bağlantılar kabul edilmez.

### 3. API Key Rotasyonu

API key'lerinizi düzenli olarak değiştirin:

```bash
# Yeni key oluştur
openssl rand -hex 32

# Yeni key'i ekle (eski key'i virgülle ayırarak)
wrangler secret put API_KEYS
# Girin: old-key,new-key

# Tüm istemciler yeni key'e geçtikten sonra eski key'i kaldır
wrangler secret put API_KEYS
# Girin: new-key
```

### 4. Logging ve Monitoring

Request logger middleware otomatik olarak tüm istekleri loglar:

```bash
# Canlı logları izle
npm run tail

# Log çıktısı:
{
  "method": "POST",
  "path": "/api/ask",
  "ip": "192.168.1.100",
  "duration": 523,
  "status": 200,
  "timestamp": "2026-01-10T12:00:00.000Z"
}
```

## Güvenlik Seviyeleri

### Seviye 1: Temel Güvenlik (Minimum)

✅ CORS ayarları yapılandırılmış
✅ HTTPS zorunlu (otomatik)
✅ Request logging aktif

```toml
[vars]
ALLOWED_ORIGINS = "https://passgage.com"
```

### Seviye 2: Orta Seviye Güvenlik (Önerilen)

✅ Seviye 1
✅ API key authentication
✅ Rate limiting

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-id"

[vars]
ALLOWED_ORIGINS = "https://passgage.com,https://app.passgage.com"
RATE_LIMIT_MAX = "100"
```

```bash
wrangler secret put API_KEYS
```

### Seviye 3: Maksimum Güvenlik (Production)

✅ Seviye 2
✅ IP whitelisting
✅ Cloudflare Access (opsiyonel)

```bash
wrangler secret put API_KEYS
wrangler secret put WHITELISTED_IPS
```

## Frontend Integration Örneği

### React/TypeScript Örneği

```typescript
// src/services/faqService.ts
const API_BASE_URL = import.meta.env.VITE_FAQ_API_URL;

export async function askQuestion(question: string) {
  const response = await fetch(`${API_BASE_URL}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error('FAQ API error');
  }

  return response.json();
}

// Admin fonksiyonları (API key gerektirir)
export async function createFAQ(faq: FAQ, apiKey: string) {
  const response = await fetch(`${API_BASE_URL}/api/faq`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(faq),
  });

  if (!response.ok) {
    throw new Error('FAQ creation failed');
  }

  return response.json();
}
```

### Environment Variables

```env
# Frontend .env
VITE_FAQ_API_URL=https://passgage-faq-bot.your-worker.workers.dev
VITE_FAQ_ADMIN_KEY=your-api-key-here  # Sadece admin panel için
```

## Güvenlik Kontrol Listesi

Deployment öncesi kontrol edin:

- [ ] API_KEYS secrets olarak ayarlandı
- [ ] ALLOWED_ORIGINS production domain'leri içeriyor
- [ ] HTTPS üzerinden çalışıyor (otomatik)
- [ ] Rate limiting aktif ve test edildi
- [ ] API key'ler güçlü (32+ karakter, hex)
- [ ] .env dosyası .gitignore'da
- [ ] Loglar düzenli olarak inceleniyor
- [ ] IP whitelisting gerekirse yapılandırıldı

## Sorun Giderme

### 401 Unauthorized

```
API key required
```

**Çözüm**: `X-API-Key` header'ı ekleyin veya API_KEYS secret'ını ayarlayın.

### 403 Forbidden

```
Invalid API key
```

**Çözüm**: Doğru API key kullanıldığından emin olun. Key'in secrets'ta olup olmadığını kontrol edin.

### 429 Too Many Requests

```
Rate limit exceeded
```

**Çözüm**: Rate limit süresini bekleyin veya RATE_LIMIT_MAX değerini artırın.

### CORS Hatası

```
Access to fetch at '...' has been blocked by CORS policy
```

**Çözüm**: Frontend origin'inizi ALLOWED_ORIGINS'e ekleyin.

## İletişim

Güvenlik sorunları için: security@passgage.com
