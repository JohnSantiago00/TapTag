# TapTag Canonical Context

Last updated: 2026-04-10 UTC
Source: direct user product brief in chat, designated as the current source of truth.

## Rule
If repo code, comments, or older notes conflict with this file, treat this file as the intended product and architecture direction.

## Product
TapTag is a privacy-first wallet intelligence app.

It helps a user choose the best credit card product they already own for a merchant or merchant category.

It is not:
- a payments app
- a bank integration app
- a card credential vault
- an NFC product

## Core behavior
TapTag should:
- detect merchant or nearby merchant context
- resolve MCC/category
- use `normalizedCategory` as the primary recommendation key
- compare against the user’s selected wallet card products
- recommend the best card product
- support useful nudges when the user is near a merchant

Example: “Use Amex Gold here for better Dining rewards.”

## Privacy boundaries
Do not store:
- card numbers
- CVV
- expiration dates
- billing addresses
- bank login credentials
- long-term exact location history

Allowed lightweight data includes:
- card product refs
- wallet selections
- privacy-safe user preferences
- muted brands/categories later
- lightweight recommendation events later

## Current stack
Frontend:
- Expo
- React Native
- Expo Router
- Expo Go for development

Backend/data:
- Firebase Auth
- Firestore

Device capability currently used:
- Expo Location

## Current product status
Treat TapTag as a real working prototype, not a blank scaffold.

Completed roadmap slices:
- Level 1 complete
- Level 2 complete
- Level 3 complete
- Level 4 complete
- Level 5 complete
- Level 6 complete (first version)
- Level 7 complete (thin slice)

Implemented at a product level:
- seeded knowledge layer
- recommendation engine
- merchant simulation
- real wallet selection
- foreground location prototype
- in-app nudge
- minimal privacy-first user layer

## Current Firestore reality
Global collections:
- `cards`
- `brands`
- `mcc_map`

User-scoped data:
- `users/{uid}`
- `users/{uid}/wallet/{cardProductId}`

Official user profile shape:
- `displayName` optional
- `privacyMode: "strict"`
- `notificationsEnabled: false` by default
- `createdAt`
- `updatedAt`

Official wallet shape:
- `enabled`
- `nickname` optional
- `addedAt`
- `updatedAt`

Seeded card products:
- `amex_gold`
- `chase_sapphire_preferred`
- `citi_custom_cash`

Seeded brands:
- `starbucks`
- `whole_foods`
- `shell`
- `amazon`

Seeded MCC docs:
- `4112`
- `5311`
- `5411`
- `5541`
- `5812`
- `5814`

## Normalized category rule
Recommendation logic should match on `normalizedCategory`.
Examples:
- `Dining - Coffee Shop` -> `Dining`
- `Dining - Restaurants` -> `Dining`
- `Gas Stations` -> `Gas`
- `Online Shopping` -> `Online Shopping`

Raw category/subcategory may be shown in UI, but matching should be based on `normalizedCategory`.

## Current important screens
Home:
- honest product overview
- explains what works now and what comes next
- fake recommendation behavior removed

Cards:
- real wallet setup
- user adds/removes seeded card products they own
- stores wallet refs only
- no fake card creation

Lab:
- debug and recommendation prototype screen
- shows cards, brands, MCC mappings
- lets user simulate merchant selection
- shows merchant, MCC, normalized category, best card, and reason
- uses real wallet refs

Nearby:
- foreground location prototype
- reads current location
- compares against seeded merchant locations
- computes recommendation from selected wallet
- shows in-app nudge banner when recommendation exists

Profile:
- minimal
- logout exists

## Recommendation logic today
Keep it intentionally simple unless explicitly asked to expand it.

Current behavior:
- direct match on `normalizedCategory`
- fallback to `Other`
- clearer fallback messaging
- simple tie handling

Not yet implemented:
- advanced issuer-specific logic
- dynamic category optimization like Citi Custom Cash
- rotating categories
- portal-specific logic
- heavy cap tracking

## Intentionally removed / should not return
Do not reintroduce:
- fake prototype card creation
- fake recommendation behavior on Home
- old Nearby placeholder behavior
- hardcoded demo wallet in the main recommendation flow

## Intentionally deferred
Do not present these as already built:
- production hardening
- full analytics/event platform
- muted brands/categories UI
- cooldown systems
- quiet hours
- background notifications
- geofencing
- heavy preference systems
- richer settings/profile UI
- complex issuer special cases
- bank/card credential storage
- payment processing

## Long-term architecture direction
Future logical entities may include:
- CARD_PRODUCT
- CARD_REWARD_RULE
- MCC_MAP
- BRAND
- MERCHANT_LOCATION
- USER_PROFILE
- USER_WALLET_CARD
- USER_CARD_REWARD_STATE
- USER_PREFERENCE
- MUTED_BRAND
- MUTED_CATEGORY
- GEOFENCE_CANDIDATE
- NEARBY_CONTEXT
- RECOMMENDATION_EVENT

Important: these are future-facing logical entities. Do not assume all already exist as separate Firestore collections today.

## Architecture principles to preserve
- privacy-first storage
- thin useful slices over heavy redesigns
- `normalizedCategory` as main recommendation key
- brand is merchant identity
- merchant location is a physical place
- wallet stores card product references only
- recommendation confidence/suppression matter later
- schema versioning will matter later
- reward rules should stay flexible enough for fixed earn, portal-only, top-category, rotating-category, and merchant-specific rules

## Working rule for future changes
When helping on TapTag:
- preserve the privacy-first wallet-intelligence direction
- distinguish current behavior from deferred architecture
- do not describe TapTag as just an Expo starter
- do not turn it into a payments app
- do not assume older prototype code is still intended
- call out repo conflicts clearly when found
