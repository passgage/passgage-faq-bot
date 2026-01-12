/**
 * Turkish Query Normalizer
 * Handles common typos, informal Turkish, and word variations
 * for improved semantic matching in FAQ search
 */

/**
 * Comprehensive Turkish character and typo mappings
 */
const TURKISH_TYPO_MAP: Record<string, string> = {
  // Password related (most common)
  sifre: 'şifre',
  sifremi: 'şifremi',
  sifreyi: 'şifreyi',
  sifreni: 'şifreni',

  // Login/Access
  giris: 'giriş',
  girisi: 'girişi',
  girise: 'girişe',
  cikis: 'çıkış',

  // Forgot/Remember
  unuttum: 'unuttum',
  unutdum: 'unuttum',
  unutdun: 'unuttun',
  unutmus: 'unutmuş',

  // SMS/Message
  gelmiyo: 'gelmiyor',
  gelmiyor: 'gelmiyor',
  gelmedi: 'gelmedi',
  gönder: 'gönder',
  gonder: 'gönder',

  // QR Code
  okuturken: 'okuturken',
  okutunca: 'okuturken',
  okuttuğumda: 'okuturken',
  okuttugumda: 'okuturken',

  // Verification
  doğrulama: 'doğrulama',
  dogrulama: 'doğrulama',
  doğrulanamadı: 'doğrulanamadı',
  dogrulanamadi: 'doğrulanamadı',

  // Location
  konum: 'konum',
  konumu: 'konumu',

  // Shift/Vardiya
  vardiya: 'vardiya',
  vardiyam: 'vardiyam',
  vardiyami: 'vardiyamı',
  vardiyayi: 'vardiyayı',

  // Change/Update
  değiştir: 'değiştir',
  degistir: 'değiştir',
  değişiklik: 'değişiklik',
  degisiklik: 'değişiklik',
  güncelle: 'güncelle',
  guncelle: 'güncelle',

  // Error/Problem
  hata: 'hata',
  hatası: 'hatası',
  hatasi: 'hatası',
  sorun: 'sorun',
  sorunu: 'sorunu',

  // Invalid
  geçersiz: 'geçersiz',
  gecersiz: 'geçersiz',

  // User/Person
  kullanıcı: 'kullanıcı',
  kullanici: 'kullanıcı',

  // Find/Search
  bulunmadı: 'bulunmadı',
  bulunmadi: 'bulunmadı',
  bulunamadı: 'bulunamadı',
  bulunamadi: 'bulunamadı',
  bulamıyorum: 'bulamıyorum',
  bulamiyorum: 'bulamıyorum',

  // See/View
  göremiyorum: 'göremiyorum',
  goremiyorum: 'göremiyorum',
  görüntüle: 'görüntüle',
  gorunte: 'görüntüle',

  // Do/Make
  yapamıyorum: 'yapamıyorum',
  yapamiyorum: 'yapamıyorum',
  napcam: 'ne yapacağım',
  napcaz: 'ne yapacağız',

  // Open/Close
  açılmıyor: 'açılmıyor',
  acilmiyor: 'açılmıyor',

  // Work/Function
  çalışmıyor: 'çalışmıyor',
  calismiyor: 'çalışmıyor',
  çalışıyor: 'çalışıyor',
  calisiyor: 'çalışıyor',

  // Module names
  'sosyal medya': 'sosyal medya',
  buradayım: 'buradayım',
  buradayim: 'buradayım',

  // Common words
  için: 'için',
  icin: 'için',
  nasıl: 'nasıl',
  nasil: 'nasıl',
  neden: 'neden',
  niçin: 'niçin',
  nicin: 'niçin',
  niye: 'niye',
};

/**
 * Normalize Turkish text for better semantic matching
 *
 * @param text - Raw user input
 * @returns Normalized text
 */
export function normalizeTurkish(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // 1. Convert to lowercase and trim
  let normalized = text.toLowerCase().trim();

  // 2. Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // 3. Remove special characters but keep Turkish letters and spaces
  // Keep: a-z, ç, ğ, ı, ö, ş, ü, numbers, spaces, question marks
  normalized = normalized.replace(/[^a-zçğıöşü0-9\s?]/gi, ' ');

  // 4. Apply typo corrections (word boundaries for accuracy)
  for (const [typo, correct] of Object.entries(TURKISH_TYPO_MAP)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    normalized = normalized.replace(regex, correct);
  }

  // 5. Collapse spaces again after replacements
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Get a list of word variations for better matching
 * Returns the normalized version plus common variations
 *
 * @param text - Input text
 * @returns Array of text variations
 */
export function getTextVariations(text: string): string[] {
  const normalized = normalizeTurkish(text);
  const variations: string[] = [normalized];

  // Add variation without question marks
  const withoutQuestion = normalized.replace(/\?/g, '').trim();
  if (withoutQuestion !== normalized) {
    variations.push(withoutQuestion);
  }

  return variations;
}

/**
 * Calculate similarity between two Turkish texts after normalization
 * Returns a score between 0 and 1
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @returns Similarity score (0-1)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const norm1 = normalizeTurkish(text1);
  const norm2 = normalizeTurkish(text2);

  // Exact match after normalization
  if (norm1 === norm2) {
    return 1.0;
  }

  // Calculate Jaccard similarity based on words
  const words1 = new Set(norm1.split(' ').filter((w) => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter((w) => w.length > 2));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Check if text contains Turkish characters
 * Useful for detecting if typo correction is needed
 *
 * @param text - Input text
 * @returns True if contains Turkish characters
 */
export function hasTurkishCharacters(text: string): boolean {
  return /[çğıöşü]/i.test(text);
}

/**
 * Generate a hash for caching purposes
 * Used for embedding cache keys
 *
 * @param text - Normalized text
 * @returns Hash string
 */
export function hashString(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
