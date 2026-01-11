/**
 * Type definitions for Passgage FAQ Bot
 */

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  keywords?: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  faq: FAQ;
  score: number;
}

export interface AskRequest {
  question: string;
}

export interface AskResponse {
  success: boolean;
  answer?: string;
  confidence?: number;
  matchedQuestion?: string;
  category?: string;
  suggestions?: FAQSuggestion[];
  message?: string;
  fuzzy?: boolean; // NEW: Indicates fuzzy match (confidence between fuzzy and primary thresholds)
  suggestedQuestion?: string; // NEW: For "Did you mean?" scenarios
  _metadata?: {
    cached?: boolean;
    responseTimeMs?: number;
    fuzzy?: boolean;
  };
}

export interface FAQSuggestion {
  question: string;
  id: string;
  category?: string;
}

export interface CreateFAQRequest {
  question: string;
  answer: string;
  category?: string;
  keywords?: string[];
}

export interface CreateFAQResponse {
  success: boolean;
  id?: string;
  message?: string;
}

export interface SeedRequest {
  faqs: FAQ[];
}

export interface SeedResponse {
  success: boolean;
  inserted: number;
  failed: number;
  message?: string;
}

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  SIMILARITY_THRESHOLD: string;
  TOP_K: string;
  MAX_FAQs_RETURN: string;

  // NEW: Fuzzy matching threshold
  FUZZY_THRESHOLD?: string; // Minimum score for "Did you mean?" (default: 0.60)

  // Security - Two-tier API keys
  PUBLIC_API_KEYS?: string; // Comma-separated list of public API keys (for /api/ask)
  ADMIN_API_KEYS?: string; // Comma-separated list of admin API keys (for CRUD operations)
  API_KEYS?: string; // Legacy: Comma-separated list of valid API keys (backward compatibility)

  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins
  WHITELISTED_IPS?: string; // Comma-separated list of whitelisted IPs

  // Rate limiting (optional KV namespace)
  RATE_LIMIT_KV?: KVNamespace;
  RATE_LIMIT_MAX?: string; // Max requests per window (default: 60)

  // NEW: Embedding cache (optional KV namespace)
  EMBEDDING_CACHE_KV?: KVNamespace;

  // NEW: Metrics tracking (optional KV namespace)
  METRICS_KV?: KVNamespace;

  // Mixpanel token for server-side analytics tracking
  MIXPANEL_TOKEN?: string;
}

export interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

export interface StatusResponse {
  status: 'ready' | 'empty' | 'error';
  initialized: boolean;
  message: string;
  timestamp: string;
}
