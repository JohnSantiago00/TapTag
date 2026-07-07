import { apiRequest } from "../api";

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

export interface KnowledgeCard {
  id: string;
  name: string;
  issuer: string;
  network: string;
  rewardRules: KnowledgeCardRewardRule[];
  annualFee?: number | null;
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

// Cards are global knowledge-layer docs, not user-owned card instances.
export async function getAllCards(): Promise<KnowledgeCard[]> {
  try {
    const cards = await apiRequest<KnowledgeCard[]>("/api/cards");

    return cards.map((data) => ({
      id: data.id,
      name: data.name || "Unknown Card",
      issuer: data.issuer || "Unknown Issuer",
      network: data.network || "Unknown Network",
      rewardRules: normalizeRewardRules(data.rewardRules),
      annualFee:
        data.annualFee === undefined || data.annualFee === null
          ? null
          : Number(data.annualFee),
    }));
  } catch (error) {
    console.error("Error fetching cards:", error);
    throw error;
  }
}
