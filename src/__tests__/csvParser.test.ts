import { describe, it, expect } from 'vitest';
import {
  parsePassgageExairon,
  parseChatbotMobil,
  parseAllCSVs,
} from '../utils/csvParser';

describe('CSV Parser', () => {
  describe('parsePassgageExairon', () => {
    it('should parse basic FAQ entries', () => {
      const csv = `Başlangıç;;Adım 1;Adım 2;;;;;;;;;;;;;
Merhaba size  yardımcı olabilmemiz için aşağıdaki başlıklardan uygun olanı seçebilirsiniz. (A) ;Başlıklar (A);;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm Adım 1;Çözüm Adım 2;;;;;;;;;;;;;;
Kullanıcı Bulunamadı.;Sistemde kayıtlı telefon numaranızın bulunmaması;Bilgilerinizi kontrol ediniz.;;;;;;;;;;;;;;;`;

      const result = parsePassgageExairon(csv);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'faq-csv1-001',
        question: 'Kullanıcı Bulunamadı.',
        category: 'giriş',
      });
      expect(result[0].answer).toContain('telefon numaranızın');
      expect(result[0].keywords).toContain('kullanıcı');
      expect(result[0].keywords).toContain('bulunamadı');
    });

    it('should parse module descriptions', () => {
      const csv = `${';;;;;;;;;;;;;;;;'.repeat(30)}\nBaşlıklar (B);;;;;;;;;;;;;;;;
PG Sosyal;;;;;;;;;;;;;;;;
PG Sosyal modülü sayesinde şirketiniz için oluşturulan sosyal medya platformudur.;;;;;;;;;;;;;;;;`;

      const result = parsePassgageExairon(csv);

      expect(result.length).toBeGreaterThan(0);
      const pgSocial = result.find((faq) => faq.question.includes('PG Sosyal'));
      expect(pgSocial).toBeDefined();
      expect(pgSocial?.category).toBe('modüller');
      expect(pgSocial?.answer).toContain('sosyal medya platformudur');
    });

    it('should handle category changes', () => {
      const csv = `Başlangıç;;;;;;;;;;;;;;;;;;
${';;;;;;;;;;;;;;;;'.repeat(12)}
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm;;;;;;;;;;;;;;;
Soru 1;Açıklama 1;Çözüm 1;;;;;;;;;;;;;;;
Geçiş Kontrol;Açıklama:;Çözüm;;;;;;;;;;;;;;;
Soru 2;Açıklama 2;Çözüm 2;;;;;;;;;;;;;;;`;

      const result = parsePassgageExairon(csv);

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('giriş');
      expect(result[1].category).toBe('geçiş-kontrol');
    });

    it('should remove BOM if present', () => {
      const csvWithBOM = '\uFEFF' + `Başlangıç;;;;;;;;;;;;;;;;;;
${';;;;;;;;;;;;;;;;'.repeat(12)}
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm;;;;;;;;;;;;;;;
Test Soru;Test Açıklama;Test Çözüm;;;;;;;;;;;;;;;`;

      const result = parsePassgageExairon(csvWithBOM);

      expect(result).toHaveLength(1);
      expect(result[0].question).toBe('Test Soru');
    });

    it('should combine description and solutions into answer', () => {
      const csv = `Başlangıç;;;;;;;;;;;;;;;;;;
${';;;;;;;;;;;;;;;;'.repeat(12)}
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm Adım 1;Çözüm Adım 2;;;;;;;;;;;;;;
Test Soru;Bu bir açıklama;İlk çözüm;İkinci çözüm;;;;;;;;;;;;;;`;

      const result = parsePassgageExairon(csv);

      expect(result[0].answer).toContain('Bu bir açıklama');
      expect(result[0].answer).toContain('İlk çözüm');
      expect(result[0].answer).toContain('İkinci çözüm');
      expect(result[0].answer.split('\n\n')).toHaveLength(3);
    });

    it('should handle Turkish characters correctly', () => {
      const csv = `Başlangıç;;;;;;;;;;;;;;;;;;
${';;;;;;;;;;;;;;;;'.repeat(12)}
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm;;;;;;;;;;;;;;;
Şifre değiştirme işlemi;Şifrenizi değiştirebilirsiniz;Lütfen ayarlara gidiniz;;;;;;;;;;;;;;;`;

      const result = parsePassgageExairon(csv);

      expect(result[0].question).toContain('Şifre');
      expect(result[0].answer).toContain('değiştirebilirsiniz');
      expect(result[0].keywords).toContain('şifre');
    });
  });

  describe('parseChatbotMobil', () => {
    it('should parse simple FAQ entries', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Kullanıcı Bulunamadı.;Sistemde kayıtlı telefon numaranız yok;İnsan kaynaklarınızla görüşünüz`;

      const result = parseChatbotMobil(csv);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'faq-csv2-001',
        question: 'Kullanıcı Bulunamadı.',
        category: 'giriş',
      });
      expect(result[0].answer).toContain('telefon numaranız');
      expect(result[0].answer).toContain('görüşünüz');
    });

    it('should handle category headers', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Soru 1;Açıklama 1;Çözüm 1
Geçiş Kontrol;Açıklama:;Çözüm:
Soru 2;Açıklama 2;Çözüm 2`;

      const result = parseChatbotMobil(csv);

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('giriş');
      expect(result[1].category).toBe('geçiş-kontrol');
    });

    it('should skip entries with empty answers', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Soru 1;;
Soru 2;Açıklama 2;Çözüm 2`;

      const result = parseChatbotMobil(csv);

      expect(result).toHaveLength(1);
      expect(result[0].question).toBe('Soru 2');
    });

    it('should handle empty description but present solution', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Soru 1;;Çözüm burada`;

      const result = parseChatbotMobil(csv);

      expect(result).toHaveLength(1);
      expect(result[0].answer).toBe('Çözüm burada');
    });

    it('should normalize category names', () => {
      const csv = `Acces Soruları:;Açıklama:;Çözüm:
Soru 1;Açıklama;Çözüm
Vardiya Modülü soruları:;;Cevap:
Soru 2;Açıklama 2;Çözüm 2`;

      const result = parseChatbotMobil(csv);

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('geçiş-kontrol'); // 'acces soruları' → 'geçiş-kontrol'
      expect(result[1].category).toBe('vardiya'); // 'vardiya modülü soruları' → 'vardiya'
    });

    it('should extract keywords from questions', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Şifre yenileme yaparken sms gelmiyor;Açıklama;Çözüm`;

      const result = parseChatbotMobil(csv);

      expect(result[0].keywords).toContain('şifre');
      expect(result[0].keywords).toContain('yenileme');
      expect(result[0].keywords).toContain('yaparken');
      expect(result[0].keywords).toContain('gelmiyor');
    });
  });

  describe('parseAllCSVs', () => {
    it('should merge FAQs from both CSV sources', () => {
      const csv1 = `Başlangıç;;;;;;;;;;;;;;;;;;
${';;;;;;;;;;;;;;;;'.repeat(12)}
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm;;;;;;;;;;;;;;;
Soru 1;Açıklama 1;Çözüm 1;;;;;;;;;;;;;;;`;

      const csv2 = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Soru 2;Açıklama 2;Çözüm 2`;

      const result = parseAllCSVs(csv1, csv2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('faq-csv1-001');
      expect(result[1].id).toBe('faq-csv2-001');
    });

    it('should handle empty CSVs', () => {
      const result = parseAllCSVs('', '');

      expect(result).toHaveLength(0);
    });

    it('should preserve order: CSV1 first, CSV2 second', () => {
      const csv1 = `Başlangıç;;;;;;;;;;;;;;;;;;
${';;;;;;;;;;;;;;;;'.repeat(12)}
Başlıklar (A);;;;;;;;;;;;;;;;
Uygulamaya Giriş Öncesi;Açıklama:;Çözüm;;;;;;;;;;;;;;;
CSV1 Soru;Açıklama;Çözüm;;;;;;;;;;;;;;;`;

      const csv2 = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
CSV2 Soru;Açıklama;Çözüm`;

      const result = parseAllCSVs(csv1, csv2);

      expect(result[0].question).toBe('CSV1 Soru');
      expect(result[1].question).toBe('CSV2 Soru');
    });
  });

  describe('Keyword Extraction', () => {
    it('should filter out short words (<=3 chars)', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
Bu bir ve ile test;Açıklama;Çözüm`;

      const result = parseChatbotMobil(csv);

      expect(result[0].keywords).not.toContain('bir');
      expect(result[0].keywords).not.toContain('ile');
      expect(result[0].keywords).toContain('test');
    });

    it('should filter out Turkish stop words', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
nedir nasıl neden önemli soru;Açıklama;Çözüm`;

      const result = parseChatbotMobil(csv);

      expect(result[0].keywords).not.toContain('nedir');
      expect(result[0].keywords).not.toContain('nasıl');
      expect(result[0].keywords).not.toContain('neden');
      expect(result[0].keywords).toContain('önemli');
      expect(result[0].keywords).toContain('soru');
    });

    it('should limit keywords to 5 maximum', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
kelime1 kelime2 kelime3 kelime4 kelime5 kelime6 kelime7;Açıklama;Çözüm`;

      const result = parseChatbotMobil(csv);

      expect(result[0].keywords.length).toBeLessThanOrEqual(5);
    });

    it('should convert keywords to lowercase', () => {
      const csv = `Uygulamaya Giriş Öncesi;Açıklama:;Çözüm:
ŞİFRE KULLANICI GİRİŞ;Açıklama;Çözüm`;

      const result = parseChatbotMobil(csv);

      expect(result[0].keywords).toContain('şifre');
      expect(result[0].keywords).toContain('kullanici'); // Note: lowercase ı becomes i
      expect(result[0].keywords).toContain('giriş');
    });
  });
});
