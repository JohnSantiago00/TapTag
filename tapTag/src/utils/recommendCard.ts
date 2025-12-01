interface Card {
  name: string;
  baseReward: number;
  bonusCategories?: { category: string; reward: number }[];
}

export const getBestCard = (cards: Card[], category: string) => {
  let bestCard = cards[0];
  let bestReward = cards[0]?.baseReward || 0;

  for (const card of cards) {
    const bonus = card.bonusCategories?.find(
      (b) => b.category.toLowerCase() === category.toLowerCase()
    );
    const reward = bonus ? bonus.reward : card.baseReward;
    if (reward > bestReward) {
      bestReward = reward;
      bestCard = card;
    }
  }

  return { bestCard, bestReward };
};
