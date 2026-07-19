import { apiRequest } from "../api";
import type { WalletCardRef } from "./wallet";

/*
  File role:
  Reads global card-product knowledge from the backend API.

  These documents describe reward behavior of products like Amex Gold or Chase
  Sapphire Preferred. They are not user-specific data.
*/

export interface KnowledgeCardRewardRule {
  category: string;
  rate: number;
}

export interface KnowledgeCardEarningRule extends KnowledgeCardRewardRule {
  id: string;
  unit: "points" | "miles" | "percent";
  subcategories?: string[];
  channels?: string[];
  merchants?: string[];
  merchantExamples?: string[];
  geography?: string;
  exclusions?: string[];
  requiresActivation?: boolean;
  validFrom?: string;
  validThrough?: string;
  afterCapRate?: number;
  selector?: string;
  eligibleCategories?: string[];
  details?: string;
  cap?: {
    amount: number;
    period: string;
    sharedGroup?: string;
  };
}

export interface KnowledgeCard {
  id: string;
  name: string;
  issuer: string;
  network: string;
  rewardRules: KnowledgeCardRewardRule[];
  earningRules?: KnowledgeCardEarningRule[];
  annualFee?: number | null;
  rewardCurrency?: {
    type: string;
    name: string;
  };
  requirements?: string[];
  notes?: string[];
  reviewedAt?: string;
  isCustom?: boolean;
}

// Seed data is trusted only loosely. These normalizers keep the UI
// resilient if docs are incomplete, stale, or shaped slightly differently.
function normalizeRewardRules(rawRules: unknown): KnowledgeCardRewardRule[] {
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    // Normalize first because persisted docs can contain mixed types or incomplete
    // seed data, especially during earlier prototype stages.
    .map((rule: any) => ({
      category:
        typeof rule?.category === "string" && rule.category.trim()
          ? rule.category.trim()
          : "Other",
      rate: Number(rule?.rate) || 0,
    }))
    .filter((rule) => rule.rate > 0);
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : undefined;
}

function normalizeEarningRules(rawRules: unknown): KnowledgeCardEarningRule[] {
  if (!Array.isArray(rawRules)) return [];

  return rawRules
    .map((raw: any): KnowledgeCardEarningRule | null => {
      const rate = Number(raw?.rate);
      if (
        typeof raw?.id !== "string" ||
        typeof raw?.category !== "string" ||
        !Number.isFinite(rate) ||
        !["points", "miles", "percent"].includes(raw?.unit)
      ) {
        return null;
      }

      const capAmount = Number(raw?.cap?.amount);
      return {
        id: raw.id,
        category: raw.category,
        rate,
        unit: raw.unit,
        subcategories: stringList(raw.subcategories),
        channels: stringList(raw.channels),
        merchants: stringList(raw.merchants),
        merchantExamples: stringList(raw.merchantExamples),
        geography: typeof raw.geography === "string" ? raw.geography : undefined,
        exclusions: stringList(raw.exclusions),
        requiresActivation: raw.requiresActivation === true,
        validFrom: typeof raw.validFrom === "string" ? raw.validFrom : undefined,
        validThrough: typeof raw.validThrough === "string" ? raw.validThrough : undefined,
        afterCapRate: Number.isFinite(Number(raw.afterCapRate))
          ? Number(raw.afterCapRate)
          : undefined,
        selector: typeof raw.selector === "string" ? raw.selector : undefined,
        eligibleCategories: stringList(raw.eligibleCategories),
        details: typeof raw.details === "string" ? raw.details : undefined,
        cap:
          Number.isFinite(capAmount) && typeof raw?.cap?.period === "string"
            ? {
                amount: capAmount,
                period: raw.cap.period,
                sharedGroup:
                  typeof raw.cap.sharedGroup === "string"
                    ? raw.cap.sharedGroup
                    : undefined,
              }
            : undefined,
      };
    })
    .filter((rule): rule is KnowledgeCardEarningRule => Boolean(rule));
}

// Cards are global knowledge-layer docs, not user-owned card instances.
export async function getAllCards(): Promise<KnowledgeCard[]> {
  try {
    const [cards, customCards] = await Promise.all([
      apiRequest<KnowledgeCard[]>("/api/cards"),
      getCustomWalletCards(),
    ]);

    const normalizedCards = cards.map((data) => ({
      id: data.id,
      name: data.name || "Unknown Card",
      issuer: data.issuer || "Unknown Issuer",
      network: data.network || "Unknown Network",
      rewardRules: normalizeRewardRules(data.rewardRules),
      earningRules: normalizeEarningRules(data.earningRules),
      annualFee:
        data.annualFee === undefined || data.annualFee === null
          ? null
          : Number(data.annualFee),
      rewardCurrency:
        typeof data.rewardCurrency?.name === "string"
          ? {
              type: data.rewardCurrency.type || "rewards",
              name: data.rewardCurrency.name,
            }
          : undefined,
      requirements: stringList(data.requirements),
      notes: stringList(data.notes),
      reviewedAt: typeof data.reviewedAt === "string" ? data.reviewedAt : undefined,
    }));
    const existingIds = new Set(normalizedCards.map((card) => card.id));

    return [
      ...normalizedCards,
      ...customCards.filter((card) => !existingIds.has(card.id)),
    ];
  } catch (error) {
    console.error("Error fetching cards:", error);
    throw error;
  }
}

async function getCustomWalletCards(): Promise<KnowledgeCard[]> {
  try {
    const wallet = await apiRequest<WalletCardRef[]>("/api/users/me/wallet", {
      authRequired: true,
    });

    return wallet
      .filter((item) => item.enabled && item.custom)
      .map((item) => ({
        id: item.id,
        name: item.custom?.name || item.nickname || "Custom Card",
        issuer: item.custom?.issuer || "Custom",
        network: item.custom?.network || "Other",
        rewardRules: normalizeRewardRules(item.custom?.rewardRules),
        annualFee: null,
        isCustom: true,
      }));
  } catch {
    return [];
  }
}
