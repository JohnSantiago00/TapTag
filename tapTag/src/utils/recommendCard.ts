// src/utils/recommendCard.ts

export interface Card {
  name: string;
  categoryRewards: Record<string, number>;
  baseReward?: number; // Optional fallback
}

// Kept as a small utility for later recommendation phases.
export const getBestCard = (cards: Card[], category: string) => {
  if (!cards || cards.length === 0) {
    return { bestCard: { name: "None", categoryRewards: {} }, bestReward: 0 };
  }

  let bestCards: Card[] = [];
  let bestReward = 0;

  for (const card of cards) {
    // Get the reward for this merchant category
    const reward = card.categoryRewards?.[category] ?? card.baseReward ?? 1; // default 1% if missing

    if (reward > bestReward) {
      bestReward = reward;
      bestCards = [card];
    } else if (reward === bestReward) {
      bestCards.push(card);
    }
  }

  // 🟦 Handle ties
  let bestCard: Card;
  if (bestCards.length > 1) {
    // Prefer the card with more category coverage (more reward types)
    const maxCategoryCount = Math.max(
      ...bestCards.map((c) => Object.keys(c.categoryRewards).length)
    );
    const topCandidates = bestCards.filter(
      (c) => Object.keys(c.categoryRewards).length === maxCategoryCount
    );

    // If still tied, pick randomly
    bestCard = topCandidates[Math.floor(Math.random() * topCandidates.length)];
  } else {
    bestCard = bestCards[0];
  }

  return { bestCard, bestReward };
};
