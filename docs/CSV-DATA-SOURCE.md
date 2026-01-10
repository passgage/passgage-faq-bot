# CSV Data Source Documentation

## Overview

Passgage FAQ Bot kullanılan tüm FAQ verileri **sadece CSV dosyalarından** gelir. Fabricated veya manuel oluşturulmuş JSON data kullanılmaz.

## Kaynak CSV Dosyaları

### 1. Passgage Exairon.csv
- **Konum**: `data/Passgage Exairon.csv`
- **Format**: Çok kolonlu, karmaşık yapı
- **İçerik**:
  - 18 FAQ (sorular ve çözümler)
  - 14 Modül açıklaması
- **Kategoriler**:
  - Uygulamaya Giriş Öncesi
  - Geçiş Kontrol
  - Vardiya Modülü
  - Buradayım
  - Sosyal Medya
  - Modüller (PG Sosyal, Etik Hat, PDKS, vb.)

**Format Yapısı:**
```
Başlık;Açıklama;Çözüm Adım 1;Çözüm Adım 2;...
```

### 2. Sorular - Yanıtlar ChatBot Mobil.csv
- **Konum**: `data/Sorular - Yanıtlar ChatBot Mobil.csv`
- **Format**: Basit 3 kolon yapısı
- **İçerik**: 13 FAQ
- **Kategoriler**:
  - Uygulamaya Giriş Öncesi
  - Acces Soruları (Geçiş Kontrol)
  - Vardiya Modülü
  - Buradayım
  - Sosyal Medya

**Format Yapısı:**
```
Soru;Açıklama;Çözüm
```

## Toplam FAQ Sayısı

- **CSV 1**: ~32 FAQ
- **CSV 2**: ~13 FAQ
- **Toplam**: ~45 FAQ (duplicates dahil, semantic search için faydalı)

## CSV Parsing Süreci

### 1. Otomatik Parsing
`src/utils/csvParser.ts` modülü CSV dosyalarını otomatik olarak parse eder:

```typescript
import { parseAllCSVs } from './src/utils/csvParser';

const csv1Content = fs.readFileSync('./data/Passgage Exairon.csv', 'utf-8');
const csv2Content = fs.readFileSync('./data/Sorular - Yanıtlar ChatBot Mobil.csv', 'utf-8');

const faqs = parseAllCSVs(csv1Content, csv2Content);
// Returns: FAQ[] with unique IDs and normalized categories
```

### 2. ID Oluşturma
- CSV 1'den gelen FAQ'lar: `faq-csv1-001`, `faq-csv1-002`, ...
- CSV 2'den gelen FAQ'lar: `faq-csv2-001`, `faq-csv2-002`, ...

Bu ID formatı sayesinde her FAQ'ın hangi CSV'den geldiği takip edilebilir.

### 3. Kategori Normalizasyonu

Parser kategorileri otomatik olarak normalize eder:

| CSV'deki Kategori | Normalize Kategori |
|-------------------|-------------------|
| Uygulamaya Giriş Öncesi | giriş |
| Acces Soruları | geçiş-kontrol |
| Geçiş Kontrol | geçiş-kontrol |
| Vardiya Modülü | vardiya |
| Buradayım | buradayım |
| Sosyal Medya | sosyal-medya |
| (Modül açıklamaları) | modüller |

### 4. Türkçe Karakter Güvenliği

Tüm CSV okuma işlemleri UTF-8 encoding ile yapılır:
- ✅ Ş, ş
- ✅ Ğ, ğ
- ✅ Ü, ü
- ✅ Ö, ö
- ✅ Ç, ç
- ✅ İ, ı

BOM (Byte Order Mark) karakteri otomatik olarak temizlenir.

## Seed İşlemi

### Manuel Seed (Önerilen)

```bash
# 1. Development ortamı için
npm run dev  # Başka bir terminalde

# Seed script çalıştır
WORKER_URL=http://localhost:8787 \
ADMIN_API_KEY=your-dev-admin-key \
npm run seed:csv

# 2. Production ortamı için
WORKER_URL=https://passgage-faq-bot.your-worker.workers.dev \
ADMIN_API_KEY=your-production-admin-key \
npm run seed:csv
```

### Seed Script İşleyişi

1. **CSV'leri Oku**: Her iki CSV dosyasını okur
2. **Parse Et**: FAQ formatına çevirir
3. **Kaydet**: `data/parsed-faqs.json` dosyasına yazar (inceleme için)
4. **Upload**: Worker'ın `/api/seed` endpoint'ine POST eder
5. **Doğrula**: `/api/status` endpoint'i ile veri yüklendiğini kontrol eder

### Doğrulama

Seed işleminden sonra veri yüklendiğini doğrulamak için:

```bash
curl https://your-worker.workers.dev/api/status
```

Beklenen yanıt:
```json
{
  "status": "ready",
  "initialized": true,
  "message": "FAQ veritabanı yüklendi ve hazır",
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

## Yeni FAQ Ekleme

### CSV Dosyalarına Ekleme (Önerilen)

1. **Uygun CSV dosyasını seç**:
   - Basit FAQ → `Sorular - Yanıtlar ChatBot Mobil.csv`
   - Karmaşık, çok adımlı FAQ → `Passgage Exairon.csv`

2. **Formatı koru**:
   ```
   Soru metni;Açıklama;Çözüm
   ```

3. **Kategori ekle** (gerekirse):
   ```
   Yeni Kategori;Açıklama:;Çözüm:
   FAQ soru 1;açıklama;çözüm
   FAQ soru 2;açıklama;çözüm
   ```

4. **Re-seed et**:
   ```bash
   npm run seed:csv
   ```

### API ile Ekleme (Tek FAQ)

```bash
curl -X POST https://your-worker.workers.dev/api/faq \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-key" \
  -d '{
    "question": "Yeni soru?",
    "answer": "Cevap metni",
    "category": "kategori",
    "keywords": ["anahtar", "kelime"]
  }'
```

⚠️ **Not**: API ile eklenen FAQ'lar CSV'lere kaydedilmez. Kalıcı olması için CSV'lere manuel ekleme yapılmalı.

## CSV Format Detayları

### Passgage Exairon.csv Format

**FAQ Satırları:**
```
Kullanıcı Bulunamadı.;Sistemde kayıtlı telefon numaranızın...;Bilgilerinizin güncel olduğundan emin olduktan sonra...;Eğer sorun hala devam ediyorsa...
```

- **Kolon 0**: Soru
- **Kolon 1**: Açıklama
- **Kolon 2**: Çözüm Adım 1
- **Kolon 3**: Çözüm Adım 2
- **Kolon 4+**: Ekstra adımlar (varsa)

Parser tüm çözüm adımlarını birleştirir (newline ile).

**Modül Satırları:**
```
PG Sosyal;;;
PG Sosyal modülü  sayesinde şirketiniz için oluşturulan; metin, fotoğraf ve video paylaşımı...;;;
```

- **Satır 1**: Modül adı
- **Satır 2**: Modül açıklaması

Parser bunları "Modül nedir?" şeklinde FAQ'a çevirir.

### Sorular - Yanıtlar ChatBot Mobil.csv Format

```
Kategori Adı;Açıklama:;Çözüm:
Kullanıcı Bulunamadı.;Sistemde kayıtlı telefon numaranızın...;Konuyla ilgili insan kaynaklarınızla görüşmeniz...
```

- **Kategori satırı**: Kolon 1'de "Açıklama:" veya "Cevap:" içerir
- **FAQ satırı**: 3 kolon (Soru, Açıklama, Çözüm)

## Duplicate FAQ'lar

Bazı FAQ'lar her iki CSV'de de vardır. **User kararı: Her ikisini de sakla.**

**Sebep**: Farklı ifadeler semantic search'e yardımcı olur.

**Örnek:**
- CSV 1: "Kullanıcı Bulunamadı." → Detaylı çözüm adımları
- CSV 2: "Kullanıcı Bulunamadı." → Daha basit çözüm

BGE-M3 modeli her iki versiyonu da kullanarak daha iyi semantic matching yapar.

## Önemli Notlar

1. ✅ **CSV'ler kaynak**: Tüm FAQ verileri CSV'lerden gelir
2. ✅ **parsed-faqs.json**: Otomatik oluşturulur, inceleme için kullanılır
3. ✅ **UTF-8 encoding**: Türkçe karakterler korunur
4. ✅ **ID traceability**: Her FAQ'ın kaynağı ID'den anlaşılır
5. ⚠️ **Manual edits**: API ile eklenen FAQ'lar CSV'lere eklenmez
6. ⚠️ **Re-seed**: CSV değişikliklerinden sonra mutlaka `npm run seed:csv` çalıştırılmalı

## Sorun Giderme

### CSV parse hatası
```
Error: CSV file not found
```
**Çözüm**: CSV dosyalarının `data/` klasöründe olduğundan emin olun.

### Türkçe karakterler bozuk
```
Şifre → ?ifre
```
**Çözüm**: CSV dosyasının UTF-8 encoding ile kaydedildiğinden emin olun.

### Seed başarısız
```
Error seeding FAQs
```
**Çözümler**:
1. Worker çalışıyor mu? `npm run dev`
2. Admin API key doğru mu?
3. Vectorize index oluşturuldu mu? `npx wrangler vectorize list`

### FAQ bulunamıyor
```
{"status": "empty", "initialized": false}
```
**Çözüm**: Seed script çalıştırın: `npm run seed:csv`

## İletişim

Sorularınız için: Passgage development team
