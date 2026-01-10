# API Güvenlik Kurulum Kılavuzu - Passgage Entegrasyonu

## İki Katmanlı Güvenlik Sistemi

Passgage FAQ Bot, **2 seviyeli API key** sistemi kullanır:

### 1️⃣ PUBLIC API KEY (Frontend/Mobil Uygulama)
- **Kullanım**: Passgage uygulamanızdan FAQ sorguları (`/api/ask`)
- **Yetkiler**: Sadece soru sorabilir (read-only)
- **Güvenlik**: CORS + API Key + Rate Limiting

### 2️⃣ ADMIN API KEY (Backend/Yönetim Paneli)
- **Kullanım**: FAQ ekleme, silme, güncelleme
- **Yetkiler**: Tam erişim (create, update, delete)
- **Güvenlik**: Sadece güvenli backend'den kullanılmalı

## Hızlı Kurulum (Production)

### Adım 1: API Key'leri Oluştur

```bash
# Public key oluştur (Passgage uygulamanız için)
openssl rand -hex 32
# Örnek çıktı: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Admin key oluştur (yönetim için)
openssl rand -hex 32
# Örnek çıktı: z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4
```

### Adım 2: Cloudflare Secrets'a Kaydet

```bash
# PUBLIC_API_KEYS ayarla
wrangler secret put PUBLIC_API_KEYS --env production
# Prompt'ta girin: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# ADMIN_API_KEYS ayarla
wrangler secret put ADMIN_API_KEYS --env production
# Prompt'ta girin: z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4

# ALLOWED_ORIGINS ayarla (Passgage domain'leriniz)
wrangler secret put ALLOWED_ORIGINS --env production
# Prompt'ta girin: https://passgage.com,https://app.passgage.com,https://mobile.passgage.com
```

### Adım 3: Deploy Et

```bash
npm run deploy -- --env production
```

## Passgage Uygulaması Entegrasyonu

### Frontend/Mobil Uygulama (.env)

```env
# Passgage uygulamanızın .env dosyası
VITE_FAQ_API_URL=https://passgage-faq-bot-production.your-worker.workers.dev
VITE_FAQ_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### React/TypeScript Örnek Kod

```typescript
// src/services/faqService.ts
const FAQ_API_URL = import.meta.env.VITE_FAQ_API_URL;
const FAQ_API_KEY = import.meta.env.VITE_FAQ_API_KEY;

export async function askFAQ(question: string) {
  const response = await fetch(`${FAQ_API_URL}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': FAQ_API_KEY,
    },
    body: JSON.stringify({ question }),
  });

  if (response.status === 401) {
    throw new Error('API key geçersiz');
  }

  if (response.status === 429) {
    const data = await response.json();
    throw new Error(`Rate limit aşıldı. ${data.retryAfter} saniye bekleyin`);
  }

  if (!response.ok) {
    throw new Error('FAQ API hatası');
  }

  return response.json();
}

// Kullanım
try {
  const result = await askFAQ('Şifremi nasıl değiştirebilirim?');

  if (result.success) {
    console.log('Cevap:', result.answer);
    console.log('Güven skoru:', result.confidence);
    console.log('İlgili sorular:', result.suggestions);
  } else {
    console.log('Eşleşme bulunamadı:', result.message);
  }
} catch (error) {
  console.error('Hata:', error);
}
```

### React Native Örnek

```typescript
// services/faqService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAQ_API_URL = 'https://passgage-faq-bot-production.your-worker.workers.dev';
const FAQ_API_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';

export const askFAQQuestion = async (question: string) => {
  try {
    const response = await fetch(`${FAQ_API_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': FAQ_API_KEY,
      },
      body: JSON.stringify({ question }),
    });

    const data = await response.json();

    if (response.status === 429) {
      Alert.alert(
        'Çok Fazla İstek',
        `Lütfen ${data.retryAfter} saniye bekleyip tekrar deneyin.`
      );
      return null;
    }

    return data;
  } catch (error) {
    console.error('FAQ API Error:', error);
    return null;
  }
};

// Kullanım - ChatBot component'inde
const handleUserMessage = async (userMessage: string) => {
  setLoading(true);

  const faqResult = await askFAQQuestion(userMessage);

  if (faqResult?.success) {
    // FAQ cevabını göster
    addMessage({
      type: 'bot',
      text: faqResult.answer,
      confidence: faqResult.confidence,
      suggestions: faqResult.suggestions,
    });
  } else {
    // Eşleşme bulunamadı
    addMessage({
      type: 'bot',
      text: 'Üzgünüm, bu konuda size yardımcı olamıyorum. Destek ekibimizle iletişime geçebilirsiniz.',
    });
  }

  setLoading(false);
};
```

## Admin Panel Entegrasyonu

### Backend API'den FAQ Yönetimi

```typescript
// backend/services/faqAdmin.ts
const FAQ_API_URL = process.env.FAQ_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function createFAQ(faq: {
  question: string;
  answer: string;
  category: string;
  keywords?: string[];
}) {
  const response = await fetch(`${FAQ_API_URL}/api/faq`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ADMIN_API_KEY, // ADMIN key kullan
    },
    body: JSON.stringify(faq),
  });

  return response.json();
}

export async function deleteFAQ(id: string) {
  const response = await fetch(`${FAQ_API_URL}/api/faq/${id}`, {
    method: 'DELETE',
    headers: {
      'X-API-Key': ADMIN_API_KEY,
    },
  });

  return response.json();
}

export async function bulkImportFAQs(faqs: FAQ[]) {
  const response = await fetch(`${FAQ_API_URL}/api/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ADMIN_API_KEY,
    },
    body: JSON.stringify({ faqs }),
  });

  return response.json();
}
```

## Güvenlik Kontrol Listesi

### ✅ Production Deploy Öncesi

- [ ] PUBLIC_API_KEYS secret olarak ayarlandı
- [ ] ADMIN_API_KEYS secret olarak ayarlandı
- [ ] ALLOWED_ORIGINS Passgage domain'lerini içeriyor
- [ ] Rate limiting KV namespace oluşturuldu (opsiyonel ama önerilen)
- [ ] Public key frontend .env dosyasında
- [ ] Admin key sadece backend'de, KOD İÇİNE YAZILMADI
- [ ] .env dosyası .gitignore'da

### ✅ Güvenlik Doğrulama

```bash
# Test 1: Public endpoint - key olmadan çalışmamalı
curl -X POST https://your-worker.workers.dev/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}'
# Beklenen: 401 Unauthorized

# Test 2: Public endpoint - public key ile çalışmalı
curl -X POST https://your-worker.workers.dev/api/ask \
  -H "Content-Type: application/json" \
  -H "X-API-Key: PUBLIC_KEY_HERE" \
  -d '{"question": "Şifremi nasıl değiştirebilirim?"}'
# Beklenen: 200 OK

# Test 3: Admin endpoint - public key ile çalışmamalı
curl -X POST https://your-worker.workers.dev/api/faq \
  -H "Content-Type: application/json" \
  -H "X-API-Key: PUBLIC_KEY_HERE" \
  -d '{"question": "test", "answer": "test"}'
# Beklenen: 403 Forbidden

# Test 4: Admin endpoint - admin key ile çalışmalı
curl -X POST https://your-worker.workers.dev/api/faq \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ADMIN_KEY_HERE" \
  -d '{"question": "test", "answer": "test", "category": "test"}'
# Beklenen: 200 OK
```

## Güvenlik Özeti

| Endpoint | Authentication | CORS | Rate Limit | Açıklama |
|----------|---------------|------|------------|----------|
| `GET /api/health` | ❌ Yok | ✅ Var | ❌ Yok | Public health check |
| `POST /api/ask` | ✅ **PUBLIC_API_KEY** | ✅ Var | ✅ Var | Passgage uygulaması kullanır |
| `POST /api/faq` | ✅ **ADMIN_API_KEY** | ✅ Var | ❌ Yok | Sadece backend/admin |
| `DELETE /api/faq/:id` | ✅ **ADMIN_API_KEY** | ✅ Var | ❌ Yok | Sadece backend/admin |
| `POST /api/seed` | ✅ **ADMIN_API_KEY** | ✅ Var | ❌ Yok | Sadece backend/admin |

## Sorun Giderme

### 401 Unauthorized

```json
{
  "success": false,
  "error": "API key required",
  "message": "API anahtarı gereklidir. X-API-Key header ekleyin."
}
```

**Çözüm**: `X-API-Key` header'ını ekleyin.

### 403 Forbidden (Public key ile admin endpoint)

```json
{
  "success": false,
  "error": "Invalid admin API key",
  "message": "Geçersiz admin API anahtarı."
}
```

**Çözüm**: Admin endpoint için ADMIN_API_KEY kullanın, PUBLIC_API_KEY değil.

### 429 Rate Limit

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.",
  "retryAfter": 45
}
```

**Çözüm**: `retryAfter` saniye bekleyin veya RATE_LIMIT_MAX değerini artırın.

## İletişim

Sorularınız için: tech@passgage.com
