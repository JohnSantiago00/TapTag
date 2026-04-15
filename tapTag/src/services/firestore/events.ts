import { readJson, writeJson } from '../../demo/storage';

/*
  File role:
  Persists lightweight user-scoped product events.

  Demo mode keeps this local so Profile can still act like a QA surface without
  any backend setup.
*/

export type TapTagEventType =
  | 'recommendation_shown'
  | 'recommendation_opened'
  | 'recommendation_dismissed'
  | 'brand_muted'
  | 'wallet_updated';

export interface TapTagEvent {
  id?: string;
  eventType: TapTagEventType;
  source: 'lab' | 'nearby' | 'wallet' | 'profile';
  occurredAt: string;
  brandId?: string;
  brandName?: string;
  cardProductId?: string;
  cardProductIds?: string[];
  recommendedCardProductId?: string;
  recommendedCardName?: string;
  normalizedCategory?: string;
  merchantMcc?: number;
  distanceMeters?: number;
  action?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

function eventsKey(uid: string) {
  return `taptag.demo.events.${uid}`;
}

export async function trackUserEvent(
  uid: string,
  event: Omit<TapTagEvent, 'occurredAt'>
) {
  const events = await readJson<TapTagEvent[]>(eventsKey(uid), []);

  const nextEvent: TapTagEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  };

  await writeJson(eventsKey(uid), [nextEvent, ...events].slice(0, 50));
}

export async function getRecentUserEvents(
  uid: string,
  maxResults = 10
): Promise<TapTagEvent[]> {
  const events = await readJson<TapTagEvent[]>(eventsKey(uid), []);

  return [...events]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, maxResults);
}
