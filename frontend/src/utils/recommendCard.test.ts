import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendBestCardForCategory } from "./recommendCard";

describe("recommendBestCardForCategory", () => {
  it("chooses the highest direct category reward", () => {
    const result = recommendBestCardForCategory(
      [
        {
          id: "flat_card",
          name: "Flat Card",
          rewardRules: [{ category: "Other", rate: 2 }],
        },
        {
          id: "dining_card",
          name: "Dining Card",
          rewardRules: [
            { category: "Dining", rate: 4 },
            { category: "Other", rate: 1 },
          ],
        },
      ],
      "Dining"
    );

    assert.equal(result.bestCard?.id, "dining_card");
    assert.equal(result.bestRate, 4);
    assert.equal(result.matchedCategory, "Dining");
  });

  it("falls back to Other when no direct category matches", () => {
    const result = recommendBestCardForCategory(
      [
        {
          id: "travel_card",
          name: "Travel Card",
          rewardRules: [
            { category: "Travel", rate: 3 },
            { category: "Other", rate: 1 },
          ],
        },
      ],
      "Groceries"
    );

    assert.equal(result.bestCard?.id, "travel_card");
    assert.equal(result.bestRate, 1);
    assert.equal(result.matchedCategory, "Other");
    assert.match(result.reason, /Falling back to Other/);
  });

  it("keeps the first winner but explains ties", () => {
    const result = recommendBestCardForCategory(
      [
        {
          id: "card_one",
          name: "Card One",
          rewardRules: [{ category: "Gas", rate: 3 }],
        },
        {
          id: "card_two",
          name: "Card Two",
          rewardRules: [{ category: "Gas", rate: 3 }],
        },
      ],
      "Gas"
    );

    assert.equal(result.bestCard?.id, "card_one");
    assert.match(result.reason, /Tie at 3x/);
  });

  it("returns an empty recommendation for an empty wallet", () => {
    const result = recommendBestCardForCategory([], "Dining");

    assert.equal(result.bestCard, null);
    assert.equal(result.bestRate, 0);
    assert.match(result.reason, /No wallet cards/);
  });

  it("uses custom wallet reward rules when present", () => {
    const result = recommendBestCardForCategory(
      [
        {
          id: "custom_card",
          name: "Wallet Ref",
          rewardRules: [],
          custom: {
            name: "My Custom Card",
            rewardRules: [
              { category: "Groceries", rate: 5 },
              { category: "Other", rate: 1 },
            ],
          },
        },
      ],
      "Groceries"
    );

    assert.equal(result.bestCard?.id, "custom_card");
    assert.equal(result.bestRate, 5);
    assert.equal(result.matchedCategory, "Groceries");
  });

  it("prefers a repeatedly confirmed card for the same merchant", () => {
    const result = recommendBestCardForCategory(
      [
        {
          id: "grocery_card",
          name: "Grocery Card",
          rewardRules: [{ category: "Groceries", rate: 5 }],
        },
        {
          id: "habit_card",
          name: "Habit Card",
          rewardRules: [{ category: "Groceries", rate: 3 }],
        },
      ],
      "Groceries",
      {
        merchantName: "Trader Joe's",
        learningSignals: {
          merchantCardUseCounts: {
            "trader joe's": {
              habit_card: 2,
            },
          },
        },
      }
    );

    assert.equal(result.bestCard?.id, "habit_card");
    assert.equal(result.bestRate, 3);
    assert.match(result.reason, /usually use Habit Card here/);
  });

  it("uses category learning only after repeated confirmations", () => {
    const result = recommendBestCardForCategory(
      [
        {
          id: "max_card",
          name: "Max Card",
          rewardRules: [{ category: "Dining", rate: 4 }],
        },
        {
          id: "category_habit",
          name: "Category Habit",
          rewardRules: [{ category: "Dining", rate: 2 }],
        },
      ],
      "Dining",
      {
        learningSignals: {
          categoryCardUseCounts: {
            dining: {
              category_habit: 3,
            },
          },
        },
      }
    );

    assert.equal(result.bestCard?.id, "category_habit");
    assert.match(result.reason, /usually use Category Habit for Dining/);
  });
});
