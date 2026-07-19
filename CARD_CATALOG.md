# TapTag Card Catalog

## Production baseline

The catalog in `backend/catalog/cardCatalog.mjs` contains 20 currently active U.S. consumer cards, reviewed against issuer-owned sources on July 11, 2026.

Included products:

- American Express Gold, Platinum, Blue Cash Preferred, Blue Cash Everyday
- Chase Sapphire Preferred, Sapphire Reserve, Freedom Unlimited, Freedom Flex, Prime Visa
- Citi Strata Premier, Custom Cash, Double Cash, Costco Anywhere Visa
- Capital One Savor, Venture, Venture X
- Wells Fargo Autograph, Active Cash
- Bank of America Customized Cash Rewards
- Discover it Cash Back

The catalog deliberately does not assign a universal cents-per-point value. Transfer redemptions are user- and itinerary-specific; pretending they are fixed would make merchant recommendations look more precise than they are.

## Schema

Each product stores:

- stable product ID, issuer, network, market, availability, and annual fee
- reward currency
- full `earningRules` with rate, category, channel or merchant restrictions, geography, caps, post-cap rates, activation requirements, promotion dates, and source IDs
- issuer sources, review date, and next review date
- a conservative `rewardRules` projection for the current category-only app engine

The distinction between `earningRules` and `rewardRules` is important. A portal-only 10x hotel rate, a cardholder-selected 3% category, or an activated quarterly 5% category is not safe to recommend from a merchant category alone. Those offers remain in the full catalog but are omitted from the legacy projection until TapTag has enough context to prove eligibility.

## Admin update workflow

1. Open an issue or branch named `catalog/YYYY-MM-DD`.
2. Review issuer product pages and rewards agreements. Prefer issuer terms over affiliate reviews. Use third-party reporting only to discover a change, then confirm it with the issuer.
3. Update the affected product and every rule's `sourceIds`, restrictions, effective dates, `reviewedAt`, and `nextReviewAt`.
4. For rotating offers, include `validFrom`, `validThrough`, `requiresActivation`, the shared cap group, and the evergreen post-promotion rate.
5. Run:

   ```bash
   npm run catalog:audit
   npm test
   ```

6. Have a second person compare the diff to the linked issuer sources. Check rate, fee, cap period, shared caps, booking channel, geography, exclusions, and activation.
7. Merge, then deploy the reviewed data with:

   ```bash
   npm run seed:knowledge
   npm run smoke:api
   ```

The seed is an idempotent MongoDB upsert. Never delete a discontinued product that a user may already have. Change its `status`/`availability`, keep its historical rules and source, and remove it from new-card selection in a separate product change.

## Cadence and alerts

- Run `npm run catalog:audit` in CI and before every backend deployment.
- Review the full catalog quarterly.
- Review rotating cards before March 15, June 15, September 15, and December 15.
- Review a card immediately after an issuer announcement, annual-fee change, rewards agreement change, or credible user correction.
- The audit exits non-zero when a review date is overdue or schema/source validation fails. `npm run catalog:audit -- --json` produces machine-readable output for future CI alerts.

## Known engine boundary

The current recommendation engine only knows the normalized merchant category. It does not yet know portal versus direct booking, cardholder category choice, quarterly activation, spend-to-cap, billing-cycle top category, or precise travel subtype. The safe projection prevents false high-rate recommendations now. A later rules-engine phase should pass those facts into eligibility evaluation and use `earningRules` directly.
