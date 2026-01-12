/**
 * Metrics Module
 * Tracks query performance, accuracy, cache hits, and estimated costs
 */

import type { Env } from '../types';

export interface QueryMetrics {
  timestamp: number;
  question: string;
  success: boolean;
  confidence?: number;
  cached: boolean;
  fuzzy: boolean;
  responseTimeMs: number;
  category?: string;
}

export interface DailyMetrics {
  date: string;
  totalQueries: number;
  successCount: number;
  fuzzyCount: number;
  failureCount: number;
  cacheHits: number;
  confidenceScores: number[];
  responseTimesMs: number[];
  categories: Record<string, number>;
}

export interface MetricsSummary {
  totalQueries: number;
  successRate: number;
  fuzzyRate: number;
  cacheHitRate: number;
  avgConfidence: number;
  avgResponseTime: number;
  estimatedCost: number;
  topCategories: Array<{ category: string; count: number }>;
  period: { from: string; to: string };
}

/**
 * Track a query and its results
 * Stores metrics for analysis and monitoring
 *
 * @param env - Worker environment
 * @param metrics - Query metrics to track
 */
export async function trackQuery(
  env: Env,
  metrics: QueryMetrics
): Promise<void> {
  if (!env.METRICS_KV) return;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const metricsKey = `metrics:daily:${today}`;

  try {
    // Get existing metrics for today
    const existing = await env.METRICS_KV.get(metricsKey, 'json');
    const daily: DailyMetrics = existing
      ? (existing as DailyMetrics)
      : {
          date: today,
          totalQueries: 0,
          successCount: 0,
          fuzzyCount: 0,
          failureCount: 0,
          cacheHits: 0,
          confidenceScores: [],
          responseTimesMs: [],
          categories: {},
        };

    // Update metrics
    daily.totalQueries++;

    if (metrics.success) {
      daily.successCount++;
    } else if (metrics.fuzzy) {
      daily.fuzzyCount++;
    } else {
      daily.failureCount++;
    }

    if (metrics.cached) {
      daily.cacheHits++;
    }

    if (metrics.confidence !== undefined) {
      daily.confidenceScores.push(metrics.confidence);
    }

    daily.responseTimesMs.push(metrics.responseTimeMs);

    if (metrics.category) {
      daily.categories[metrics.category] =
        (daily.categories[metrics.category] || 0) + 1;
    }

    // Store updated metrics (30-day TTL)
    await env.METRICS_KV.put(metricsKey, JSON.stringify(daily), {
      expirationTtl: 2592000, // 30 days
    });

    // Also track recent queries (for debugging)
    await trackRecentQuery(env, metrics);
  } catch (error) {
    console.error('Error tracking query metrics:', error);
  }
}

/**
 * Track recent queries for debugging
 * Keeps last 100 queries
 *
 * @param env - Worker environment
 * @param metrics - Query metrics
 */
async function trackRecentQuery(
  env: Env,
  metrics: QueryMetrics
): Promise<void> {
  if (!env.METRICS_KV) return;

  try {
    const recentKey = 'metrics:recent';
    const existing = await env.METRICS_KV.get(recentKey, 'json');
    const recent: QueryMetrics[] = existing ? (existing as QueryMetrics[]) : [];

    // Add new query
    recent.unshift(metrics);

    // Keep only last 100
    if (recent.length > 100) {
      recent.splice(100);
    }

    // Store (7-day TTL)
    await env.METRICS_KV.put(recentKey, JSON.stringify(recent), {
      expirationTtl: 604800,
    });
  } catch (error) {
    console.error('Error tracking recent query:', error);
  }
}

/**
 * Get metrics summary for the last N days
 *
 * @param env - Worker environment
 * @param days - Number of days to summarize (default: 7)
 * @returns Aggregated metrics summary
 */
export async function getMetricsSummary(
  env: Env,
  days = 7
): Promise<MetricsSummary | null> {
  if (!env.METRICS_KV) return null;

  try {
    const dailyMetrics: DailyMetrics[] = [];
    const today = new Date();

    // Fetch metrics for last N days
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const metricsKey = `metrics:daily:${dateStr}`;

      const data = await env.METRICS_KV.get(metricsKey, 'json');
      if (data) {
        dailyMetrics.push(data as DailyMetrics);
      }
    }

    if (dailyMetrics.length === 0) {
      return null;
    }

    // Aggregate metrics
    let totalQueries = 0;
    let successCount = 0;
    let fuzzyCount = 0;
    let cacheHits = 0;
    const allConfidenceScores: number[] = [];
    const allResponseTimes: number[] = [];
    const allCategories: Record<string, number> = {};

    for (const day of dailyMetrics) {
      totalQueries += day.totalQueries;
      successCount += day.successCount;
      fuzzyCount += day.fuzzyCount;
      cacheHits += day.cacheHits;
      allConfidenceScores.push(...day.confidenceScores);
      allResponseTimes.push(...day.responseTimesMs);

      // Merge categories
      for (const [category, count] of Object.entries(day.categories)) {
        allCategories[category] = (allCategories[category] || 0) + count;
      }
    }

    // Calculate averages
    const avgConfidence =
      allConfidenceScores.length > 0
        ? allConfidenceScores.reduce((a, b) => a + b, 0) /
          allConfidenceScores.length
        : 0;

    const avgResponseTime =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
        : 0;

    const successRate = totalQueries > 0 ? successCount / totalQueries : 0;
    const fuzzyRate = totalQueries > 0 ? fuzzyCount / totalQueries : 0;
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;

    // Estimate cost (assumes $0.003 per embedding)
    const embeddingsGenerated = totalQueries - cacheHits;
    const estimatedCost = embeddingsGenerated * 0.003;

    // Top categories
    const topCategories = Object.entries(allCategories)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Period
    const oldestDate =
      dailyMetrics[dailyMetrics.length - 1]?.date ||
      today.toISOString().split('T')[0];
    const newestDate =
      dailyMetrics[0]?.date || today.toISOString().split('T')[0];

    return {
      totalQueries,
      successRate: parseFloat((successRate * 100).toFixed(2)),
      fuzzyRate: parseFloat((fuzzyRate * 100).toFixed(2)),
      cacheHitRate: parseFloat((cacheHitRate * 100).toFixed(2)),
      avgConfidence: parseFloat(avgConfidence.toFixed(4)),
      avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
      topCategories,
      period: {
        from: oldestDate,
        to: newestDate,
      },
    };
  } catch (error) {
    console.error('Error getting metrics summary:', error);
    return null;
  }
}

/**
 * Get recent queries for debugging
 *
 * @param env - Worker environment
 * @param limit - Max number of queries to return (default: 20)
 * @returns Recent query metrics
 */
export async function getRecentQueries(
  env: Env,
  limit = 20
): Promise<QueryMetrics[]> {
  if (!env.METRICS_KV) return [];

  try {
    const recentKey = 'metrics:recent';
    const data = await env.METRICS_KV.get(recentKey, 'json');

    if (!data) return [];

    const recent = data as QueryMetrics[];
    return recent.slice(0, limit);
  } catch (error) {
    console.error('Error getting recent queries:', error);
    return [];
  }
}

/**
 * Clear all metrics data
 * Admin operation
 *
 * @param env - Worker environment
 * @returns Number of entries cleared
 */
export async function clearMetrics(env: Env): Promise<number> {
  if (!env.METRICS_KV) return 0;

  let cleared = 0;

  try {
    // List all metrics keys
    const list = await env.METRICS_KV.list({ prefix: 'metrics:' });

    // Delete all
    for (const key of list.keys) {
      await env.METRICS_KV.delete(key.name);
      cleared++;
    }

    console.log(`Metrics cleared: ${cleared} entries deleted`);
  } catch (error) {
    console.error('Error clearing metrics:', error);
  }

  return cleared;
}
