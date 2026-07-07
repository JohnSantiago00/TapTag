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

/*
  File role:
  Pure recommendation logic with no React, Firebase, or UI concerns.

  Why keeping this pure matters:
  - easier to reason about than screen-bound logic
  - reusable by both Lab and Nearby
  - easier to expand later if issuer-specific rules are added
*/

// This is the thin-slice recommendation engine. It deliberately avoids complex
// issuer-specific logic and instead answers one simple question, which selected
// wallet card has the best multiplier for this normalized category?
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

  // We remember tied cards so the user-facing reason can explain why the first
  // winner was chosen when multiple cards share the same rate.
  let tiedCards: RecommenderCard[] = [];

  for (const card of cards) {
    // Direct category wins. If a card has no direct rule, Other acts as the
    // fallback floor so every card can still compete at its baseline rate.
    const directMatch = card.rewardRules.find(
      (rule) => rule.category === normalizedCategory
    );
    const fallbackMatch = card.rewardRules.find((rule) => rule.category === "Other");
    const chosenRule = directMatch ?? fallbackMatch;

    if (!chosenRule) {
      continue;
    }

    if (chosenRule.rate > bestRate) {
      // A strictly better rate becomes the new winner and resets the tie list.
      bestCard = card;
      bestRate = chosenRule.rate;
      matchedCategory = chosenRule.category;
      tiedCards = [card];
    } else if (chosenRule.rate === bestRate && chosenRule.rate > 0) {
      // Equal positive rate means we keep the original winner but record the tie
      // so the explanation remains honest.
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

  // The reason string is product-facing, not just debug text. Lab and Nearby
  // both surface it so a tester can understand why a recommendation appeared.
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
