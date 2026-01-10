/**
 * Passgage FAQ Bot - Main API
 * Semantic search chatbot using Cloudflare Workers AI and Vectorize
 */

import { Hono } from 'hono';
import type {
  Env,
  AskRequest,
  AskResponse,
  CreateFAQRequest,
  CreateFAQResponse,
  SeedRequest,
  SeedResponse,
  StatusResponse,
  FAQ,
  FAQSuggestion,
} from './types';
import { generateEmbedding, generateEmbeddingsBatch } from './embeddings';
import {
  searchSimilar,
  upsertFAQ,
  upsertFAQsBatch,
  deleteFAQ,
} from './vectorize';
import {
  publicApiKeyAuth,
  adminApiKeyAuth,
  rateLimiter,
  corsMiddleware,
  requestLogger,
} from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', requestLogger);
app.use('*', corsMiddleware);

// Public endpoint protection: API key + rate limiting
app.use('/api/ask', publicApiKeyAuth);
app.use('/api/ask', rateLimiter);

/**
 * Health check endpoint
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'passgage-faq-bot',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/status - Check if FAQ database is initialized
 * Verifies that Vectorize has been seeded with data
 */
app.get('/api/status', async (c) => {
  try {
    // Query Vectorize with dummy vector to check if data exists
    // Note: Vectorize doesn't support count queries, so we probe with a query
    const dummyVector = new Array(1024).fill(0);
    const results = await c.env.VECTORIZE.query(dummyVector, {
      topK: 1,
      returnMetadata: true,
    });

    const hasData = results.matches.length > 0;

    return c.json<StatusResponse>({
      status: hasData ? 'ready' : 'empty',
      initialized: hasData,
      message: hasData
        ? 'FAQ veritabanı yüklendi ve hazır'
        : 'FAQ veritabanı boş - seed script çalıştırın',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/status:', error);
    return c.json<StatusResponse>(
      {
        status: 'error',
        initialized: false,
        message: 'Veritabanı durumu kontrol edilirken hata oluştu',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * POST /api/ask - Ask a question and get FAQ answer
 */
app.post('/api/ask', async (c) => {
  try {
    const body = await c.req.json<AskRequest>();
    const { question } = body;

    if (!question || question.trim().length === 0) {
      return c.json<AskResponse>(
        {
          success: false,
          message: 'Soru metni boş olamaz.',
        },
        400
      );
    }

    // Generate embedding for the question
    const queryEmbedding = await generateEmbedding(c.env, question);

    // Search for similar FAQs
    const topK = parseInt(c.env.TOP_K || '3');
    const similarityThreshold = parseFloat(c.env.SIMILARITY_THRESHOLD || '0.7');

    const results = await searchSimilar(c.env, queryEmbedding, topK);

    // Check if best match exceeds threshold
    if (results.length === 0 || results[0].score < similarityThreshold) {
      return c.json<AskResponse>({
        success: false,
        message:
          'Sorunuzla eşleşen bir cevap bulunamadı. Lütfen destek ekibimizle iletişime geçin.',
        suggestions: results.slice(0, 3).map((r) => ({
          question: r.faq.question,
          id: r.faq.id,
          category: r.faq.category,
        })),
      });
    }

    // Return best match
    const bestMatch = results[0];
    const suggestions: FAQSuggestion[] = results.slice(1).map((r) => ({
      question: r.faq.question,
      id: r.faq.id,
      category: r.faq.category,
    }));

    return c.json<AskResponse>({
      success: true,
      answer: bestMatch.faq.answer,
      confidence: bestMatch.score,
      matchedQuestion: bestMatch.faq.question,
      category: bestMatch.faq.category,
      suggestions,
    });
  } catch (error) {
    console.error('Error in /api/ask:', error);
    return c.json<AskResponse>(
      {
        success: false,
        message: 'Bir hata oluştu. Lütfen tekrar deneyin.',
      },
      500
    );
  }
});

/**
 * POST /api/faq - Create a new FAQ (Admin)
 * Requires admin API key authentication
 */
app.post('/api/faq', adminApiKeyAuth, async (c) => {
  try {
    const body = await c.req.json<CreateFAQRequest>();
    const { question, answer, category, keywords } = body;

    if (!question || !answer) {
      return c.json<CreateFAQResponse>(
        {
          success: false,
          message: 'Soru ve cevap alanları zorunludur.',
        },
        400
      );
    }

    // Generate unique ID
    const id = `faq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const faq: FAQ = {
      id,
      question,
      answer,
      category: category || 'general',
      keywords: keywords || [],
    };

    // Generate embedding
    const embedding = await generateEmbedding(c.env, question);

    // Store in Vectorize
    await upsertFAQ(c.env, faq, embedding);

    return c.json<CreateFAQResponse>({
      success: true,
      id,
      message: 'FAQ başarıyla oluşturuldu.',
    });
  } catch (error) {
    console.error('Error in POST /api/faq:', error);
    return c.json<CreateFAQResponse>(
      {
        success: false,
        message: 'FAQ oluşturulurken bir hata oluştu.',
      },
      500
    );
  }
});

/**
 * DELETE /api/faq/:id - Delete a FAQ (Admin)
 * Requires admin API key authentication
 */
app.delete('/api/faq/:id', adminApiKeyAuth, async (c) => {
  try {
    const id = c.req.param('id');

    if (!id) {
      return c.json(
        {
          success: false,
          message: 'FAQ ID gereklidir.',
        },
        400
      );
    }

    await deleteFAQ(c.env, id);

    return c.json({
      success: true,
      message: 'FAQ başarıyla silindi.',
    });
  } catch (error) {
    console.error('Error in DELETE /api/faq/:id:', error);
    return c.json(
      {
        success: false,
        message: 'FAQ silinirken bir hata oluştu.',
      },
      500
    );
  }
});

/**
 * POST /api/seed - Bulk import FAQs (Admin)
 * Requires admin API key authentication
 */
app.post('/api/seed', adminApiKeyAuth, async (c) => {
  try {
    const body = await c.req.json<SeedRequest>();
    const { faqs } = body;

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return c.json<SeedResponse>(
        {
          success: false,
          inserted: 0,
          failed: 0,
          message: 'FAQ listesi boş veya geçersiz.',
        },
        400
      );
    }

    console.log(`Starting seed for ${faqs.length} FAQs...`);

    // Generate embeddings for all questions
    const questions = faqs.map((faq) => faq.question);
    const embeddings = await generateEmbeddingsBatch(c.env, questions);

    // Bulk upsert to Vectorize
    const result = await upsertFAQsBatch(c.env, faqs, embeddings);

    return c.json<SeedResponse>({
      success: result.failed === 0,
      inserted: result.success,
      failed: result.failed,
      message: `${result.success} FAQ başarıyla eklendi${result.failed > 0 ? `, ${result.failed} başarısız oldu` : ''}.`,
    });
  } catch (error) {
    console.error('Error in POST /api/seed:', error);
    return c.json<SeedResponse>(
      {
        success: false,
        inserted: 0,
        failed: 0,
        message: "FAQ'lar yüklenirken bir hata oluştu.",
      },
      500
    );
  }
});

/**
 * GET / - Root endpoint with API info
 */
app.get('/', (c) => {
  return c.json({
    name: 'Passgage FAQ Bot',
    version: '1.0.0',
    description: 'Semantic search FAQ chatbot using Cloudflare Workers AI',
    endpoints: {
      health: 'GET /api/health',
      ask: 'POST /api/ask',
      createFAQ: 'POST /api/faq',
      deleteFAQ: 'DELETE /api/faq/:id',
      seed: 'POST /api/seed',
    },
  });
});

export default app;
