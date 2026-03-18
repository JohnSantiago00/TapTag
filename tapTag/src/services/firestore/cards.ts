import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

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

export async function getAllCards(): Promise<KnowledgeCard[]> {
  try {
    const ref = collection(db, "cards");
    const snapshot = await getDocs(ref);

    return snapshot.docs.map((cardDoc) => {
      const data = cardDoc.data();

      return {
        id: cardDoc.id,
        name: data.name || "Unknown Card",
        issuer: data.issuer || "Unknown Issuer",
        network: data.network || "Unknown Network",
        rewardRules: Array.isArray(data.rewardRules)
          ? data.rewardRules.map((rule: any) => ({
              category: rule.category || "Other",
              rate: Number(rule.rate) || 0,
            }))
          : [],
        annualFee:
          data.annualFee === undefined || data.annualFee === null
            ? null
            : Number(data.annualFee),
      };
    });
  } catch (error) {
    console.error("Error fetching cards:", error);
    throw error;
  }
}
