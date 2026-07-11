import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PaymentLearningSignals } from "../utils/recommendCard";

const PAYMENT_CONFIRMATION_HISTORY_LIMIT = 200;

export type PaymentConfirmationOutcome =
  | "used_recommended"
  | "used_other"
  | "did_not_pay";

export interface PaymentConfirmationRecord {
  id: string;
  occurredAt: string;
  outcome: PaymentConfirmationOutcome;
  merchantName?: string;
  merchantMcc?: number;
  normalizedCategory?: string;
  recommendedCardProductId?: string;
  recommendedCardName?: string;
  rewardRate?: number;
  source?: string;
}

export async function recordPaymentConfirmation(
  uid: string,
  confirmation: Omit<PaymentConfirmationRecord, "id" | "occurredAt">
) {
  const history = await getPaymentConfirmationHistory(uid);
  const record: PaymentConfirmationRecord = {
    ...confirmation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(
    getStorageKey(uid),
    JSON.stringify([record, ...history].slice(0, PAYMENT_CONFIRMATION_HISTORY_LIMIT))
  );
}

export async function getPaymentConfirmationHistory(
  uid: string
): Promise<PaymentConfirmationRecord[]> {
  const rawHistory = await AsyncStorage.getItem(getStorageKey(uid));
  if (!rawHistory) return [];

  try {
    const parsed = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizePaymentConfirmationRecord)
      .filter((record): record is PaymentConfirmationRecord => record !== null);
  } catch {
    return [];
  }
}

export async function getPaymentLearningSignals(
  uid: string
): Promise<PaymentLearningSignals> {
  const history = await getPaymentConfirmationHistory(uid);
  const merchantCardUseCounts: Record<string, Record<string, number>> = {};
  const categoryCardUseCounts: Record<string, Record<string, number>> = {};

  for (const record of history) {
    if (
      record.outcome !== "used_recommended" ||
      !record.recommendedCardProductId
    ) {
      continue;
    }

    const cardId = record.recommendedCardProductId;
    const merchantKey = normalizeLearningKey(record.merchantName);
    const categoryKey = normalizeLearningKey(record.normalizedCategory);

    if (merchantKey) {
      merchantCardUseCounts[merchantKey] = incrementCount(
        merchantCardUseCounts[merchantKey],
        cardId
      );
    }

    if (categoryKey) {
      categoryCardUseCounts[categoryKey] = incrementCount(
        categoryCardUseCounts[categoryKey],
        cardId
      );
    }
  }

  return {
    merchantCardUseCounts,
    categoryCardUseCounts,
  };
}

function getStorageKey(uid: string) {
  return `taptag.paymentConfirmations.${uid}`;
}

function incrementCount(
  counts: Record<string, number> | undefined,
  cardId: string
) {
  return {
    ...(counts ?? {}),
    [cardId]: (counts?.[cardId] ?? 0) + 1,
  };
}

function normalizePaymentConfirmationRecord(
  value: unknown
): PaymentConfirmationRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  const outcome = data.outcome;

  if (
    outcome !== "used_recommended" &&
    outcome !== "used_other" &&
    outcome !== "did_not_pay"
  ) {
    return null;
  }

  return {
    id: typeof data.id === "string" ? data.id : "unknown",
    occurredAt:
      typeof data.occurredAt === "string"
        ? data.occurredAt
        : new Date().toISOString(),
    outcome,
    merchantName:
      typeof data.merchantName === "string" ? data.merchantName : undefined,
    merchantMcc:
      typeof data.merchantMcc === "number" ? data.merchantMcc : undefined,
    normalizedCategory:
      typeof data.normalizedCategory === "string"
        ? data.normalizedCategory
        : undefined,
    recommendedCardProductId:
      typeof data.recommendedCardProductId === "string"
        ? data.recommendedCardProductId
        : undefined,
    recommendedCardName:
      typeof data.recommendedCardName === "string"
        ? data.recommendedCardName
        : undefined,
    rewardRate: typeof data.rewardRate === "number" ? data.rewardRate : undefined,
    source: typeof data.source === "string" ? data.source : undefined,
  };
}

function normalizeLearningKey(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
