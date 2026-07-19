import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARD_CATALOG_AS_OF, cards, getCatalogSummary, validateCardCatalog } from './cardCatalog.mjs';

describe('production card catalog', () => {
  it('contains 20 validated, sourced US products', () => {
    assert.equal(cards.length, 20);
    assert.deepEqual(validateCardCatalog(cards), []);
    assert.equal(new Set(cards.map((card) => card.id)).size, 20);
    assert.ok(cards.every((card) => card.market === 'US' && card.sources.length >= 1));
  });

  it('keeps the category-only projection conservative', () => {
    const customCash = cards.find((card) => card.id === 'citi_custom_cash');
    assert.deepEqual(customCash.rewardRules, [{ category: 'Other', rate: 1 }]);

    const ventureX = cards.find((card) => card.id === 'capital_one_venture_x');
    assert.deepEqual(ventureX.rewardRules, [{ category: 'Other', rate: 2 }]);

    const flex = cards.find((card) => card.id === 'chase_freedom_flex');
    assert.equal(flex.rewardRules.some((rule) => rule.rate === 5), false);
  });

  it('tracks current promotions and review freshness', () => {
    const summary = getCatalogSummary(cards, CARD_CATALOG_AS_OF);
    assert.equal(summary.cardCount, 20);
    assert.equal(summary.issuerCount, 7);
    assert.equal(summary.overdueCardIds.length, 0);
    assert.equal(summary.promotionRuleCount, 7);
  });
});
