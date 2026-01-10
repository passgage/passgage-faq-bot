import { describe, it, expect } from 'vitest';
import type { FAQ, SearchResult, Env } from '../types';

describe('TypeScript Type Definitions', () => {
  describe('FAQ Type', () => {
    it('should accept valid FAQ objects', () => {
      const faq: FAQ = {
        id: 'faq-001',
        question: 'Test question',
        answer: 'Test answer',
        category: 'test',
        keywords: ['test', 'example'],
      };

      expect(faq.id).toBe('faq-001');
      expect(faq.question).toBe('Test question');
      expect(faq.answer).toBe('Test answer');
      expect(faq.category).toBe('test');
      expect(faq.keywords).toHaveLength(2);
    });

    it('should allow optional keywords', () => {
      const faq: FAQ = {
        id: 'faq-002',
        question: 'Another question',
        answer: 'Another answer',
        category: 'general',
      };

      expect(faq.keywords).toBeUndefined();
    });
  });

  describe('SearchResult Type', () => {
    it('should accept valid search results', () => {
      const result: SearchResult = {
        id: 'faq-001',
        question: 'Test question',
        answer: 'Test answer',
        category: 'test',
        confidence: 0.95,
        keywords: ['test'],
      };

      expect(result.confidence).toBe(0.95);
      expect(result.id).toBe('faq-001');
    });

    it('should handle confidence scores correctly', () => {
      const lowConfidence: SearchResult = {
        id: 'faq-002',
        question: 'Question',
        answer: 'Answer',
        category: 'test',
        confidence: 0.1,
      };

      const highConfidence: SearchResult = {
        id: 'faq-003',
        question: 'Question',
        answer: 'Answer',
        category: 'test',
        confidence: 1.0,
      };

      expect(lowConfidence.confidence).toBe(0.1);
      expect(highConfidence.confidence).toBe(1.0);
    });
  });

  describe('Env Type', () => {
    it('should define required environment bindings', () => {
      const env: Env = {
        AI: {} as Ai,
        VECTORIZE: {} as VectorizeIndex,
        SIMILARITY_THRESHOLD: '0.7',
        TOP_K: '3',
        MAX_FAQs_RETURN: '5',
        ALLOWED_ORIGINS: '*',
        RATE_LIMIT_MAX: '60',
      };

      expect(env.SIMILARITY_THRESHOLD).toBe('0.7');
      expect(env.TOP_K).toBe('3');
      expect(env.MAX_FAQs_RETURN).toBe('5');
    });

    it('should handle optional secret bindings', () => {
      const env: Env = {
        AI: {} as Ai,
        VECTORIZE: {} as VectorizeIndex,
        SIMILARITY_THRESHOLD: '0.7',
        TOP_K: '3',
        MAX_FAQs_RETURN: '5',
        ALLOWED_ORIGINS: '*',
        RATE_LIMIT_MAX: '60',
        PUBLIC_API_KEYS: 'key1,key2',
        ADMIN_API_KEYS: 'admin-key',
      };

      expect(env.PUBLIC_API_KEYS).toBeDefined();
      expect(env.ADMIN_API_KEYS).toBeDefined();
    });

    it('should handle optional KV binding', () => {
      const env: Env = {
        AI: {} as Ai,
        VECTORIZE: {} as VectorizeIndex,
        SIMILARITY_THRESHOLD: '0.7',
        TOP_K: '3',
        MAX_FAQs_RETURN: '5',
        ALLOWED_ORIGINS: '*',
        RATE_LIMIT_MAX: '60',
        RATE_LIMIT_KV: {} as KVNamespace,
      };

      expect(env.RATE_LIMIT_KV).toBeDefined();
    });
  });

  describe('FAQ Validation', () => {
    it('should have Turkish category names', () => {
      const validCategories = [
        'giriş',
        'geçiş-kontrol',
        'vardiya',
        'buradayım',
        'sosyal-medya',
        'modüller',
      ];

      validCategories.forEach((category) => {
        const faq: FAQ = {
          id: `test-${category}`,
          question: 'Test',
          answer: 'Test',
          category,
        };

        expect(faq.category).toBe(category);
      });
    });

    it('should handle Turkish characters in content', () => {
      const faq: FAQ = {
        id: 'test-turkish',
        question: 'Şifre değiştirme işlemi nasıl yapılır?',
        answer: 'Öncelikle ayarlara girin, şifrenizi güncelleyin.',
        category: 'giriş',
        keywords: ['şifre', 'değiştirme', 'güncelleme'],
      };

      expect(faq.question).toContain('Şifre');
      expect(faq.answer).toContain('Öncelikle');
      expect(faq.keywords).toContain('şifre');
    });
  });
});
