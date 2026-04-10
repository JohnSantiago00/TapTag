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
      reason: "No wallet cards were available.",
    };
  }

  let bestCard: RecommenderCard | null = null;
  let bestRate = 0;
  let matchedCategory = normalizedCategory;
  let tiedCards: RecommenderCard[] = [];

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
      tiedCards = [card];
    } else if (chosenRule.rate === bestRate && chosenRule.rate > 0) {
      tiedCards.push(card);
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
  const isFallback = matchedCategory !== normalizedCategory;
  const hasTie = tiedCards.length > 1;

  let reason = isFallback
    ? `No direct ${normalizedCategory} match found. Falling back to Other at ${bestRate}x.`
    : `Best match for ${reasonCategory} at ${bestRate}x.`;

  if (hasTie) {
    const tiedCardNames = tiedCards.map((card) => card.name).join(", ");
    reason += ` Tie at ${bestRate}x between ${tiedCardNames}. Showing ${bestCard.name} as the first matching card.`;
  }

  return {
    bestCard,
    bestRate,
    matchedCategory,
    reason,
  };
}
