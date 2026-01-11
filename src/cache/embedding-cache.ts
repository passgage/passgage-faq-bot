/**
 * Embedding Cache Module
 * KV-based caching for embeddings to reduce cost and latency
 */

import type { Env } from '../types';
import { generateEmbedding } from '../embeddings';
import { hashString } from '../utils/turkish-normalizer';

interface CacheEntry {
  embedding: number[];
  question: string;
  timestamp: number;
}

interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  lastReset: string;
}

/**
 * Get embedding with cache support
 * Tries cache first, generates on miss, stores result
 *
 * @param env - Worker environment bindings
 * @param question - Normalized question text
 * @returns Embedding vector and cache hit status
 */
export async function getEmbeddingWithCache(
  env: Env,
  question: string
): Promise<{ embedding: number[]; cached: boolean }> {
  // If KV not available, generate directly
  if (!env.EMBEDDING_CACHE_KV) {
    console.log('Cache KV not available, generating embedding directly');
    const embedding = await generateEmbedding(env, question);
    return { embedding, cached: false };
  }

  // Generate cache key from normalized question
  const cacheKey = `emb:${hashString(question)}:${question.substring(0, 20)}`;

  try {
    // Try to get from cache
    const cached = await env.EMBEDDING_CACHE_KV.get(cacheKey, 'json');

    if (cached) {
      const entry = cached as CacheEntry;
      console.log(`Cache HIT for: "${question.substring(0, 50)}..."`);

      // Update stats (cache hit)
      await updateCacheStats(env, true);

      return { embedding: entry.embedding, cached: true };
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue to generate on cache error
  }

  // Cache miss - generate embedding
  console.log(`Cache MISS for: "${question.substring(0, 50)}..."`);
  const embedding = await generateEmbedding(env, question);

  // Store in cache (fire and forget)
  storeCacheEntry(env, cacheKey, question, embedding).catch((error) => {
    console.error('Cache write error:', error);
  });

  // Update stats (cache miss)
  await updateCacheStats(env, false);

  return { embedding, cached: false };
}

/**
 * Store embedding in cache
 * Uses 7-day TTL to keep cache fresh
 *
 * @param env - Worker environment
 * @param key - Cache key
 * @param question - Original question
 * @param embedding - Embedding vector
 */
async function storeCacheEntry(
  env: Env,
  key: string,
  question: string,
  embedding: number[]
): Promise<void> {
  if (!env.EMBEDDING_CACHE_KV) return;

  const entry: CacheEntry = {
    embedding,
    question,
    timestamp: Date.now(),
  };

  // 7-day TTL (604800 seconds)
  await env.EMBEDDING_CACHE_KV.put(key, JSON.stringify(entry), {
    expirationTtl: 604800,
  });
}

/**
 * Update cache statistics
 * Tracks hit rate for monitoring
 *
 * @param env - Worker environment
 * @param isHit - Whether this was a cache hit
 */
async function updateCacheStats(env: Env, isHit: boolean): Promise<void> {
  if (!env.EMBEDDING_CACHE_KV) return;

  const statsKey = 'cache:stats';

  try {
    const existing = await env.EMBEDDING_CACHE_KV.get(statsKey, 'json');
    const stats: CacheStats = existing
      ? (existing as CacheStats)
      : {
          totalQueries: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
          lastReset: new Date().toISOString(),
        };

    // Update stats
    stats.totalQueries++;
    if (isHit) {
      stats.cacheHits++;
    } else {
      stats.cacheMisses++;
    }
    stats.hitRate = stats.cacheHits / stats.totalQueries;

    // Store updated stats (30-day TTL)
    await env.EMBEDDING_CACHE_KV.put(statsKey, JSON.stringify(stats), {
      expirationTtl: 2592000,
    });
  } catch (error) {
    console.error('Error updating cache stats:', error);
  }
}

/**
 * Get cache statistics
 * For monitoring and admin endpoints
 *
 * @param env - Worker environment
 * @returns Cache statistics
 */
export async function getCacheStats(env: Env): Promise<CacheStats | null> {
  if (!env.EMBEDDING_CACHE_KV) return null;

  try {
    const stats = await env.EMBEDDING_CACHE_KV.get('cache:stats', 'json');
    return stats as CacheStats | null;
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}

/**
 * Clear all cache entries
 * Admin operation - use with caution
 *
 * @param env - Worker environment
 * @returns Number of entries cleared
 */
export async function clearCache(env: Env): Promise<number> {
  if (!env.EMBEDDING_CACHE_KV) return 0;

  let cleared = 0;

  try {
    // List all keys with 'emb:' prefix
    const list = await env.EMBEDDING_CACHE_KV.list({ prefix: 'emb:' });

    // Delete all cache entries
    for (const key of list.keys) {
      await env.EMBEDDING_CACHE_KV.delete(key.name);
      cleared++;
    }

    // Reset stats
    await env.EMBEDDING_CACHE_KV.delete('cache:stats');

    console.log(`Cache cleared: ${cleared} entries deleted`);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }

  return cleared;
}

/**
 * Get cache size (number of entries)
 *
 * @param env - Worker environment
 * @returns Number of cached embeddings
 */
export async function getCacheSize(env: Env): Promise<number> {
  if (!env.EMBEDDING_CACHE_KV) return 0;

  try {
    const list = await env.EMBEDDING_CACHE_KV.list({ prefix: 'emb:' });
    return list.keys.length;
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
}
