import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../config/firebase";

export type TapTagEventType =
  | "recommendation_shown"
  | "recommendation_opened"
  | "recommendation_dismissed"
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

export async function trackUserEvent(
  uid: string,
  event: Omit<TapTagEvent, "occurredAt">
) {
  const ref = collection(db, `users/${uid}/events`);

  await addDoc(ref, {
    ...event,
    occurredAt: new Date().toISOString(),
  });
}

export async function getRecentUserEvents(
  uid: string,
  maxResults = 10
): Promise<TapTagEvent[]> {
  const ref = collection(db, `users/${uid}/events`);
  const eventsQuery = query(ref, orderBy("occurredAt", "desc"), limit(maxResults));
  const snapshot = await getDocs(eventsQuery);

  return snapshot.docs.map((eventDoc) => {
    const data = eventDoc.data();

    return {
      id: eventDoc.id,
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
