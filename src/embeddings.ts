/**
 * Embeddings module using Cloudflare Workers AI
 * Model: @cf/baai/bge-m3 (1024 dimensions)
 * Optimized for multilingual support including Turkish
 */

import type { Env, EmbeddingResponse } from './types';

const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const EMBEDDING_DIMENSIONS = 1024;

/**
 * Generate embedding vector for a text input
 * @param env - Environment bindings
 * @param text - Input text to embed
 * @returns Float32Array of embedding vector
 */
export async function generateEmbedding(
  env: Env,
  text: string
): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text input cannot be empty');
    }

    // Workers AI expects input in specific format
    const response = (await env.AI.run(EMBEDDING_MODEL, {
      text: text.trim(),
    })) as EmbeddingResponse;

    // Extract embedding vector from response
    if (
      !response.data ||
      !Array.isArray(response.data) ||
      response.data.length === 0
    ) {
      throw new Error('Invalid embedding response from Workers AI');
    }

    const embedding = response.data[0];

    // Validate dimensions
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param env - Environment bindings
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(
  env: Env,
  texts: string[]
): Promise<number[][]> {
  try {
    // Process each text sequentially to avoid rate limits
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await generateEmbedding(env, text);
      embeddings.push(embedding);

      // Small delay to avoid overwhelming the AI service
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return embeddings;
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw new Error(
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

export { EMBEDDING_DIMENSIONS };
