export interface RewardRule {
  category: string;
  rate: number;
}

export interface RecommenderCard {
  id?: string;
  name: string;
  rewardRules: RewardRule[];
  custom?: {
    name?: string;
    rewardRules?: RewardRule[];
  };
}

export interface RecommendationResult {
  bestCard: RecommenderCard | null;
  bestRate: number;
  matchedCategory: string;
  reason: string;
}

export interface PaymentLearningSignals {
  merchantCardUseCounts?: Record<string, Record<string, number>>;
  categoryCardUseCounts?: Record<string, Record<string, number>>;
}

export interface RecommendationLearningContext {
  merchantName?: string;
  learningSignals?: PaymentLearningSignals | null;
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
  normalizedCategory: string,
  context: RecommendationLearningContext = {}
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
  const evaluatedCards = new Map<
    string,
    { card: RecommenderCard; rate: number; matchedCategory: string }
  >();

  // We remember tied cards so the user-facing reason can explain why the first
  // winner was chosen when multiple cards share the same rate.
  let tiedCards: RecommenderCard[] = [];

  for (const card of cards) {
    const rewardRules =
      card.custom?.rewardRules && card.custom.rewardRules.length
        ? card.custom.rewardRules
        : card.rewardRules;
    // Direct category wins. If a card has no direct rule, Other acts as the
    // fallback floor so every card can still compete at its baseline rate.
    const directMatch = rewardRules.find(
      (rule) => rule.category === normalizedCategory
    );
    const fallbackMatch = rewardRules.find((rule) => rule.category === "Other");
    const chosenRule = directMatch ?? fallbackMatch;

    if (!chosenRule) {
      continue;
    }

    const cardId = getCardId(card);
    if (cardId) {
      evaluatedCards.set(cardId, {
        card,
        rate: chosenRule.rate,
        matchedCategory: chosenRule.category,
      });
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
  const learnedPreference = getLearnedPreference(
    evaluatedCards,
    normalizedCategory,
    context
  );

  if (learnedPreference) {
    return {
      bestCard: learnedPreference.card,
      bestRate: learnedPreference.rate,
      matchedCategory: learnedPreference.matchedCategory,
      reason: getLearnedPreferenceReason(learnedPreference, normalizedCategory),
    };
  }

  // The reason string is product-facing, not just debug text. Lab and Nearby
  // both surface it so a tester can understand why a recommendation appeared.
  let reason = isFallback
    ? `No direct ${normalizedCategory} match found. Falling back to Other at ${bestRate}x.`
    : `Best match for ${reasonCategory} at ${bestRate}x.`;

  if (hasTie) {
    const tiedCardNames = tiedCards.map(getCardDisplayName).join(", ");
    reason += ` Tie at ${bestRate}x between ${tiedCardNames}. Showing ${getCardDisplayName(bestCard)} as the first matching card.`;
  }

  return {
    bestCard,
    bestRate,
    matchedCategory,
    reason,
  };
}

function getCardDisplayName(card: RecommenderCard) {
  return card.custom?.name || card.name;
}

function getCardId(card: RecommenderCard) {
  return card.id ?? card.name;
}

function getLearnedPreference(
  evaluatedCards: Map<
    string,
    { card: RecommenderCard; rate: number; matchedCategory: string }
  >,
  normalizedCategory: string,
  context: RecommendationLearningContext
) {
  const merchantKey = normalizeLearningKey(context.merchantName);
  const categoryKey = normalizeLearningKey(normalizedCategory);
  const merchantPreference = findPreferredCard(
    evaluatedCards,
    merchantKey
      ? context.learningSignals?.merchantCardUseCounts?.[merchantKey]
      : undefined,
    2,
    "merchant"
  );

  if (merchantPreference) {
    return merchantPreference;
  }

  return findPreferredCard(
    evaluatedCards,
    categoryKey
      ? context.learningSignals?.categoryCardUseCounts?.[categoryKey]
      : undefined,
    3,
    "category"
  );
}

function findPreferredCard(
  evaluatedCards: Map<
    string,
    { card: RecommenderCard; rate: number; matchedCategory: string }
  >,
  counts: Record<string, number> | undefined,
  minimumCount: number,
  preferenceType: "merchant" | "category"
) {
  if (!counts) return null;

  return Object.entries(counts).reduce<{
    card: RecommenderCard;
    rate: number;
    matchedCategory: string;
    count: number;
    preferenceType: "merchant" | "category";
  } | null>((best, [cardId, count]) => {
    const evaluatedCard = evaluatedCards.get(cardId);
    if (!evaluatedCard || count < minimumCount) {
      return best;
    }

    if (
      !best ||
      count > best.count ||
      (count === best.count && evaluatedCard.rate > best.rate)
    ) {
      return {
        ...evaluatedCard,
        count,
        preferenceType,
      };
    }

    return best;
  }, null);
}

function getLearnedPreferenceReason(
  preference: {
    card: RecommenderCard;
    rate: number;
    matchedCategory: string;
    count: number;
    preferenceType: "merchant" | "category";
  },
  normalizedCategory: string
) {
  const cardName = getCardDisplayName(preference.card);
  const habitReason =
    preference.preferenceType === "merchant"
      ? `You usually use ${cardName} here.`
      : `You usually use ${cardName} for ${normalizedCategory}.`;
  const rewardReason =
    preference.matchedCategory === normalizedCategory
      ? `It earns ${preference.rate}x ${normalizedCategory}.`
      : `It falls back to ${preference.rate}x ${preference.matchedCategory}.`;

  return `${habitReason} ${rewardReason}`;
}

function normalizeLearningKey(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
