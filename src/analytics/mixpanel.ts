/**
 * Mixpanel Server-Side Tracking for Cloudflare Workers
 * Tracks FAQ queries directly from backend to Mixpanel HTTP API
 */

import type { Env } from '../types';

const MIXPANEL_API_ENDPOINT = 'https://api-eu.mixpanel.com/track';

interface MixpanelEvent {
  event: string;
  properties: {
    token: string;
    time?: number;
    distinct_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Track FAQ query to Mixpanel
 * Sends event asynchronously without blocking response
 */
export async function trackFAQQuery(
  env: Env,
  data: {
    question: string;
    success: boolean;
    confidence?: number;
    fuzzy?: boolean;
    category?: string;
    cached?: boolean;
    responseTimeMs?: number;
    matchedQuestion?: string;
  }
): Promise<void> {
  // Skip if Mixpanel token not configured
  if (!env.MIXPANEL_TOKEN) {
    console.log('[Mixpanel] Token not configured, skipping tracking');
    return;
  }

  try {
    const event: MixpanelEvent = {
      event: 'FAQ Query',
      properties: {
        token: env.MIXPANEL_TOKEN,
        time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
        distinct_id: 'backend-api', // Or use user IP/ID if available
        // FAQ Query specific properties
        question: data.question,
        success: data.success,
        confidence: data.confidence,
        fuzzy: data.fuzzy || false,
        category: data.category,
        cached: data.cached || false,
        responseTime: data.responseTimeMs,
        matchedQuestion: data.matchedQuestion,
        // Additional metadata
        source: 'backend',
        timestamp: new Date().toISOString(),
      },
    };

    // Send to Mixpanel (non-blocking)
    const response = await fetch(MIXPANEL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain',
      },
      body: JSON.stringify([event]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        '[Mixpanel] Failed to track event:',
        response.status,
        errorText
      );
    } else {
      console.log('[Mixpanel] Event tracked successfully');
    }
  } catch (error) {
    // Don't throw - tracking errors shouldn't break the API
    console.error('[Mixpanel] Error tracking event:', error);
  }
}

/**
 * Track FAQ created event
 */
export async function trackFAQCreated(
  env: Env,
  data: {
    faqId: string;
    category?: string;
  }
): Promise<void> {
  if (!env.MIXPANEL_TOKEN) return;

  try {
    const event: MixpanelEvent = {
      event: 'FAQ Created',
      properties: {
        token: env.MIXPANEL_TOKEN,
        time: Math.floor(Date.now() / 1000),
        distinct_id: 'backend-api',
        faq_id: data.faqId,
        category: data.category,
        source: 'backend',
        timestamp: new Date().toISOString(),
      },
    };

    await fetch(MIXPANEL_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([event]),
    });
  } catch (error) {
    console.error('[Mixpanel] Error tracking FAQ created:', error);
  }
}

/**
 * Track FAQ deleted event
 */
export async function trackFAQDeleted(
  env: Env,
  data: {
    faqId: string;
  }
): Promise<void> {
  if (!env.MIXPANEL_TOKEN) return;

  try {
    const event: MixpanelEvent = {
      event: 'FAQ Deleted',
      properties: {
        token: env.MIXPANEL_TOKEN,
        time: Math.floor(Date.now() / 1000),
        distinct_id: 'backend-api',
        faq_id: data.faqId,
        source: 'backend',
        timestamp: new Date().toISOString(),
      },
    };

    await fetch(MIXPANEL_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([event]),
    });
  } catch (error) {
    console.error('[Mixpanel] Error tracking FAQ deleted:', error);
  }
}
