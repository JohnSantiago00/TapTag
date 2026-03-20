export interface RewardRule {
  category: string;
  rate: number;
}

export interface RecommenderCard {
  id?: string;
  name: string;
  rewardRules: RewardRule[];
}

export interface RecommendationResult {
  bestCard: RecommenderCard | null;
  bestRate: number;
  matchedCategory: string;
  reason: string;
}

export function recommendBestCardForCategory(
  cards: RecommenderCard[],
  normalizedCategory: string
): RecommendationResult {
  if (!cards.length) {
    return {
      bestCard: null,
      bestRate: 0,
      matchedCategory: normalizedCategory,
      reason: "No demo wallet cards were available.",
    };
  }

  let bestCard: RecommenderCard | null = null;
  let bestRate = 0;
  let matchedCategory = normalizedCategory;

  for (const card of cards) {
    const directMatch = card.rewardRules.find(
      (rule) => rule.category === normalizedCategory
    );
    const fallbackMatch = card.rewardRules.find((rule) => rule.category === "Other");
    const chosenRule = directMatch ?? fallbackMatch;

    if (!chosenRule) {
      continue;
    }

    if (chosenRule.rate > bestRate) {
      bestCard = card;
      bestRate = chosenRule.rate;
      matchedCategory = chosenRule.category;
    }
  }

  if (!bestCard) {
    return {
      bestCard: null,
      bestRate: 0,
      matchedCategory: normalizedCategory,
      reason: `No matching reward rule was found for ${normalizedCategory}.`,
    };
  }

  const reasonCategory =
    matchedCategory === normalizedCategory ? normalizedCategory : "Other";

  return {
    bestCard,
    bestRate,
    matchedCategory,
    reason: `Best match for ${reasonCategory} at ${bestRate}x`,
  };
}
