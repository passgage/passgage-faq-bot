/**
 * Vectorize operations module
 * Handles CRUD operations for FAQ vectors in Cloudflare Vectorize
 */

import type { Env, FAQ, SearchResult } from './types';

/**
 * Insert or update a FAQ with its embedding in Vectorize
 * @param env - Environment bindings
 * @param faq - FAQ object
 * @param embedding - Embedding vector
 * @returns Success status
 */
export async function upsertFAQ(
  env: Env,
  faq: FAQ,
  embedding: number[]
): Promise<boolean> {
  try {
    await env.VECTORIZE.upsert([
      {
        id: faq.id,
        values: embedding,
        metadata: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category || 'general',
          keywords: faq.keywords || [],
        },
      },
    ]);

    return true;
  } catch (error) {
    console.error(`Error upserting FAQ ${faq.id}:`, error);
    throw new Error(
      `Failed to upsert FAQ: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Bulk upsert multiple FAQs
 * @param env - Environment bindings
 * @param faqs - Array of FAQ objects
 * @param embeddings - Array of embedding vectors
 * @returns Object with success and failure counts
 */
export async function upsertFAQsBatch(
  env: Env,
  faqs: FAQ[],
  embeddings: number[][]
): Promise<{ success: number; failed: number }> {
  if (faqs.length !== embeddings.length) {
    throw new Error('FAQs and embeddings arrays must have same length');
  }

  let successCount = 0;
  let failedCount = 0;

  // Vectorize supports batch operations, but we'll process in chunks
  const BATCH_SIZE = 100;

  for (let i = 0; i < faqs.length; i += BATCH_SIZE) {
    const batchFAQs = faqs.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    try {
      const vectors = batchFAQs.map((faq, index) => ({
        id: faq.id,
        values: batchEmbeddings[index],
        metadata: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category || 'general',
          keywords: faq.keywords || [],
        },
      }));

      await env.VECTORIZE.upsert(vectors);
      successCount += batchFAQs.length;
    } catch (error) {
      console.error(`Error upserting batch starting at index ${i}:`, error);
      failedCount += batchFAQs.length;
    }
  }

  return { success: successCount, failed: failedCount };
}

/**
 * Search for similar FAQs using vector similarity
 * @param env - Environment bindings
 * @param queryEmbedding - Query embedding vector
 * @param topK - Number of results to return
 * @returns Array of search results with scores
 */
export async function searchSimilar(
  env: Env,
  queryEmbedding: number[],
  topK: number = 3
): Promise<SearchResult[]> {
  try {
    const results = await env.VECTORIZE.query(queryEmbedding, {
      topK,
      returnMetadata: true,
    });

    if (!results.matches || results.matches.length === 0) {
      return [];
    }

    return results.matches.map((match) => ({
      faq: {
        id: match.id,
        question: (match.metadata?.question as string) || '',
        answer: (match.metadata?.answer as string) || '',
        category: (match.metadata?.category as string) || 'general',
        keywords: (match.metadata?.keywords as string[]) || [],
      },
      score: match.score,
    }));
  } catch (error) {
    console.error('Error searching Vectorize:', error);
    throw new Error(
      `Failed to search Vectorize: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a FAQ from Vectorize
 * @param env - Environment bindings
 * @param id - FAQ ID to delete
 * @returns Success status
 */
export async function deleteFAQ(env: Env, id: string): Promise<boolean> {
  try {
    await env.VECTORIZE.deleteByIds([id]);
    return true;
  } catch (error) {
    console.error(`Error deleting FAQ ${id}:`, error);
    throw new Error(
      `Failed to delete FAQ: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete multiple FAQs from Vectorize
 * @param env - Environment bindings
 * @param ids - Array of FAQ IDs to delete
 * @returns Success status
 */
export async function deleteFAQsBatch(
  env: Env,
  ids: string[]
): Promise<boolean> {
  try {
    await env.VECTORIZE.deleteByIds(ids);
    return true;
  } catch (error) {
    console.error('Error deleting FAQs batch:', error);
    throw new Error(
      `Failed to delete FAQs: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get FAQ by ID (requires a dummy query since Vectorize doesn't have direct get)
 * Note: This is a workaround - Vectorize doesn't support direct ID lookup
 * @param env - Environment bindings
 * @param id - FAQ ID
 * @returns FAQ object or null
 */
export async function getFAQById(env: Env, id: string): Promise<FAQ | null> {
  try {
    // This is not efficient - Vectorize doesn't support direct ID lookup
    // For production, consider maintaining a separate KV store for metadata
    const dummyVector = new Array(1024).fill(0);
    const results = await env.VECTORIZE.query(dummyVector, {
      topK: 1000,
      returnMetadata: true,
    });

    const match = results.matches?.find((m) => m.id === id);

    if (!match || !match.metadata) {
      return null;
    }

    return {
      id: match.id,
      question: (match.metadata.question as string) || '',
      answer: (match.metadata.answer as string) || '',
      category: (match.metadata.category as string) || 'general',
      keywords: (match.metadata.keywords as string[]) || [],
    };
  } catch (error) {
    console.error(`Error getting FAQ ${id}:`, error);
    return null;
  }
}
