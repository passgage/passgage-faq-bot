/**
 * CSV Parser for Passgage FAQ Bot
 * Parses Turkish FAQ data from CSV files
 */

import type { FAQ } from '../types';

/**
 * Remove UTF-8 BOM if present
 */
function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Normalize category name for consistency
 */
function normalizeCategory(category: string): string {
  // Remove trailing colons and trim
  const normalized = category.toLowerCase().trim().replace(/:+$/, '');

  // Map variations to standard categories
  const categoryMap: Record<string, string> = {
    'uygulamaya giriş öncesi': 'giriş',
    'uygulamaya girişöncesi': 'giriş',
    'geçiş kontrol': 'geçiş-kontrol',
    'acces soruları': 'geçiş-kontrol',
    'vardiya modülü': 'vardiya',
    'vardiya modülü soruları': 'vardiya',
    buradayım: 'buradayım',
    'sosyal medya': 'sosyal-medya',
    'sosyal medya:': 'sosyal-medya',
    modüller: 'modüller',
  };

  return categoryMap[normalized] || normalized;
}

/**
 * Parse Passgage Exairon.csv (complex format)
 * Lines 1-13: Headers and metadata
 * Lines 14-29: FAQs with varying column structure
 * Lines 31-56: Module descriptions
 */
export function parsePassgageExairon(csvContent: string): FAQ[] {
  const faqs: FAQ[] = [];
  const lines = removeBOM(csvContent).split('\n');

  let currentCategory = 'general';
  let idCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    const columns = line.split(';').map((col) => col.trim());

    // Lines 14-29: FAQ section (identified by category headers or questions)
    if (i >= 13 && i <= 29) {
      // Category headers (e.g., "Uygulamaya Giriş Öncesi")
      if (columns[0] && columns[1] === 'Açıklama:') {
        currentCategory = normalizeCategory(columns[0]);
        continue;
      }

      // FAQ entry (has question in column 0, non-empty)
      if (
        columns[0] &&
        columns[0] !== 'Başlangıç' &&
        columns[0] !== 'Başlıklar (A)' &&
        !columns[0].startsWith('Modüller')
      ) {
        const question = columns[0];
        const description = columns[1] || '';
        const solution1 = columns[2] || '';
        const solution2 = columns[3] || '';

        // Combine solution steps
        let answer = '';
        if (description) answer += description;
        if (solution1) {
          if (answer) answer += '\n\n';
          answer += solution1;
        }
        if (solution2) {
          if (answer) answer += '\n\n';
          answer += solution2;
        }

        if (question && answer) {
          faqs.push({
            id: `faq-csv1-${String(idCounter).padStart(3, '0')}`,
            question,
            answer,
            category: currentCategory,
            keywords: extractKeywords(question),
          });
          idCounter++;
        }
      }
    }

    // Lines 31-56: Module descriptions section
    if (i >= 30 && i <= 55) {
      // Skip section header
      if (columns[0] === 'Başlıklar (B)') continue;

      // Module name line (single non-empty column)
      if (columns[0] && !columns[1] && columns[0] !== '') {
        const moduleName = columns[0];
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        const nextColumns = nextLine.split(';').map((col) => col.trim());

        // Description is usually on the next line
        if (nextColumns[0] && nextColumns[0] !== '') {
          const description = nextColumns[0];

          faqs.push({
            id: `faq-csv1-${String(idCounter).padStart(3, '0')}`,
            question: `${moduleName} nedir?`,
            answer: description,
            category: 'modüller',
            keywords: extractKeywords(moduleName),
          });
          idCounter++;

          // Skip the next line since we've consumed it
          i++;
        }
      }
    }
  }

  return faqs;
}

/**
 * Parse Sorular - Yanıtlar ChatBot Mobil.csv (simple 3-column format)
 * Format: Question;Description;Solution
 * Category headers followed by FAQ rows
 */
export function parseChatbotMobil(csvContent: string): FAQ[] {
  const faqs: FAQ[] = [];
  const lines = removeBOM(csvContent).split('\n');

  let currentCategory = 'general';
  let idCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    const columns = line.split(';').map((col) => col.trim());

    // Category header line (has category name in column 0, "Açıklama:" or "Cevap:" in column 1)
    if (
      columns[1] &&
      (columns[1] === 'Açıklama:' ||
        columns[1] === 'Cevap:' ||
        columns[1].endsWith(':'))
    ) {
      currentCategory = normalizeCategory(columns[0]);
      continue;
    }

    // FAQ entry (3 columns: Question, Description, Solution)
    if (columns[0] && (columns[1] || columns[2])) {
      const question = columns[0];
      const description = columns[1] || '';
      const solution = columns[2] || '';

      // Combine description and solution
      let answer = '';
      if (description) answer += description;
      if (solution) {
        if (answer) answer += ' ';
        answer += solution;
      }

      if (question && answer) {
        faqs.push({
          id: `faq-csv2-${String(idCounter).padStart(3, '0')}`,
          question,
          answer,
          category: currentCategory,
          keywords: extractKeywords(question),
        });
        idCounter++;
      }
    }
  }

  return faqs;
}

/**
 * Extract keywords from question text (simple word extraction)
 */
function extractKeywords(text: string): string[] {
  // Remove punctuation and split into words
  const words = text
    .toLowerCase()
    .replace(/[.,?!"""''()]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3); // Only keep words longer than 3 chars

  // Remove common Turkish stop words
  const stopWords = new Set([
    'nedir',
    'nasıl',
    'neden',
    'niçin',
    'için',
    'ile',
    'veya',
    'ama',
    'fakat',
    'ancak',
    'çünkü',
    'eğer',
    'şayet',
    'benim',
    'senin',
    'onun',
    'bizim',
    'sizin',
    'onların',
    'bir',
    'iki',
    'üç',
    'bu',
    'şu',
    'o',
    'ne',
    'hangi',
    'kim',
    'nerede',
    'ne zaman',
    'kaç',
  ]);

  return words.filter((word) => !stopWords.has(word)).slice(0, 5);
}

/**
 * Parse both CSV files and return unified FAQ array
 */
export function parseAllCSVs(csv1Content: string, csv2Content: string): FAQ[] {
  const faqs1 = parsePassgageExairon(csv1Content);
  const faqs2 = parseChatbotMobil(csv2Content);

  console.log(`Parsed ${faqs1.length} FAQs from Passgage Exairon.csv`);
  console.log(
    `Parsed ${faqs2.length} FAQs from Sorular - Yanıtlar ChatBot Mobil.csv`
  );
  console.log(`Total: ${faqs1.length + faqs2.length} FAQs`);

  // Merge both arrays (keeping duplicates as per user request)
  return [...faqs1, ...faqs2];
}
