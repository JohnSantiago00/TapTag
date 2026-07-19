import { CARD_CATALOG_AS_OF, cards, getCatalogSummary, validateCardCatalog } from '../catalog/cardCatalog.mjs';

const jsonOutput = process.argv.includes('--json');
const todayArg = process.argv.find((argument) => argument.startsWith('--today='));
const today = todayArg?.split('=')[1] || new Date().toISOString().slice(0, 10);
const errors = validateCardCatalog(cards);
const summary = getCatalogSummary(cards, today);
const expiringPromotions = cards.flatMap((card) =>
  card.earningRules
    .filter((rule) => rule.validThrough && rule.validThrough >= today)
    .map((rule) => ({ cardId: card.id, ruleId: rule.id, validThrough: rule.validThrough }))
);
const result = { ok: errors.length === 0 && summary.overdueCardIds.length === 0, today, catalogAsOf: CARD_CATALOG_AS_OF, ...summary, expiringPromotions, errors };

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Card catalog ${result.ok ? 'passed' : 'needs attention'}`);
  console.log(`As of ${summary.asOf}: ${summary.cardCount} cards, ${summary.issuerCount} issuers, ${summary.sourceCount} issuer sources`);
  console.log(`${summary.promotionRuleCount} time-limited rules; ${expiringPromotions.length} are active or upcoming as of ${today}`);
  if (summary.overdueCardIds.length) console.error(`Overdue reviews: ${summary.overdueCardIds.join(', ')}`);
  for (const error of errors) console.error(`- ${error}`);
}

if (!result.ok) process.exitCode = 1;
