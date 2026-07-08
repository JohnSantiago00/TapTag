import { apiRequest } from "../api";

/*
  File role:
  Persists lightweight user-scoped product events.

  Why it is deliberately small:
  TapTag currently needs enough tracking to answer "was a recommendation shown,
  opened, dismissed, or did the wallet change?" It does not need a full event
  bus, warehouse schema, or analytics SDK abstraction yet.
*/

export type TapTagEventType =
  | "recommendation_shown"
  | "recommendation_opened"
  | "recommendation_dismissed"
  | "payment_prompt_opened"
  | "payment_prompt_confirmed"
  | "brand_muted"
  | "wallet_updated";

export interface TapTagEvent {
  id?: string;
  eventType: TapTagEventType;
  source: "lab" | "nearby" | "wallet" | "profile";
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

// Event tracking is intentionally lightweight. The goal is product learning and
// QA visibility, not a heavy analytics platform.
export async function trackUserEvent(
  uid: string,
  event: Omit<TapTagEvent, "occurredAt">
) {
  void uid;
  await apiRequest<void>("/api/users/me/events", {
    method: "POST",
    authRequired: true,
    body: event,
  });
}

// Profile reads the most recent event docs so QA can verify tracking inside the
// app instead of needing to inspect MongoDB manually.
export async function getRecentUserEvents(
  uid: string,
  maxResults = 10
): Promise<TapTagEvent[]> {
  void uid;
  const events = await apiRequest<TapTagEvent[]>(
    `/api/users/me/events?limit=${maxResults}`,
    { authRequired: true }
  );

  return events.map((data) => {

    return {
      // Every field is normalized defensively because event docs may evolve over
      // time and Profile should not crash on partially shaped historical data.
      id: data.id,
      eventType: data.eventType,
      source: data.source,
      occurredAt:
        typeof data.occurredAt === "string"
          ? data.occurredAt
          : new Date().toISOString(),
      brandId: typeof data.brandId === "string" ? data.brandId : undefined,
      brandName: typeof data.brandName === "string" ? data.brandName : undefined,
      cardProductId:
        typeof data.cardProductId === "string" ? data.cardProductId : undefined,
      cardProductIds: Array.isArray(data.cardProductIds)
        ? data.cardProductIds.filter((value: unknown) => typeof value === "string")
        : undefined,
      recommendedCardProductId:
        typeof data.recommendedCardProductId === "string"
          ? data.recommendedCardProductId
          : undefined,
      recommendedCardName:
        typeof data.recommendedCardName === "string"
          ? data.recommendedCardName
          : undefined,
      normalizedCategory:
        typeof data.normalizedCategory === "string"
          ? data.normalizedCategory
          : undefined,
      merchantMcc:
        typeof data.merchantMcc === "number" ? data.merchantMcc : undefined,
      distanceMeters:
        typeof data.distanceMeters === "number" ? data.distanceMeters : undefined,
      action: typeof data.action === "string" ? data.action : undefined,
      metadata:
        typeof data.metadata === "object" && data.metadata !== null
          ? data.metadata
          : undefined,
    } as TapTagEvent;
  });
}
