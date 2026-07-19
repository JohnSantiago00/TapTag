# TapTag Codebase Guide

TapTag is a privacy-first wallet intelligence app.

It answers one product question: which card product from the user's selected wallet is best for a merchant or merchant category?

Non-goals:

- payments
- card credential storage
- bank integrations
- payment-network-grade MCC certainty

## Repo Structure

- `frontend/` - Expo / React Native app
- `backend/` - Express API, MongoDB connection, seed/cleanup scripts
- `TAPTAG_CANONICAL_CONTEXT.md` - product source of truth
- `CONFIG_GUIDE.md` - config and tooling notes

## Runtime Architecture

Firebase is used for Auth only.

MongoDB stores app data:

- `cards`
- `brands`
- `mcc_map`
- `users`
- `wallet`
- `events`

The Expo app never connects directly to MongoDB. It calls the backend API using Firebase ID tokens for user-scoped routes.

## Frontend Flow

Important files:

- `frontend/app/_layout.tsx`
- `frontend/src/config/firebase.ts`
- `frontend/src/context/AuthContext.tsx`
- `frontend/hooks/useAuthRedirect.ts`
- `frontend/src/services/api.ts`
- `frontend/src/services/data/*`

The `src/services/data/*` modules call `src/services/api.ts` and normalize API responses for screens.

Main screens:

- Home - product orientation
- Wallet - selected card-product refs
- Merchant Finder - search the curated merchant directory
- Nearby - live Google Places discovery and foreground recommendations
- Profile - account, privacy, notification, and recent-activity controls

## Backend Flow

Important files:

- `backend/src/server.mjs`
- `backend/src/mongo.mjs`
- `backend/src/firebaseAuth.mjs`
- `backend/catalog/cardCatalog.mjs`
- `backend/seed/seedKnowledgeLayer.mjs`
- `backend/seed/cleanupKnowledgeLayer.mjs`

The backend:

- exposes public knowledge endpoints for cards, brands, and MCC mappings
- verifies Firebase ID tokens for user profile, wallet, and event routes
- stores MongoDB credentials server-side only
- keeps the Google Places key server-side and proxies authenticated nearby lookups
- seeds the reviewed 20-card catalog and beta merchant/MCC knowledge into MongoDB

## Recommendation Logic

File:

- `frontend/src/utils/recommendCard.ts`

Inputs:

- selected wallet cards
- normalized category

Behavior:

- direct match on `normalizedCategory`
- fallback to `Other`
- tie explanation when rates match

This stays intentionally simple while TapTag proves the core loop.

## Nearby

File:

- `frontend/app/(tabs)/Nearby.tsx`

Nearby asks for foreground location permission and sends the current coordinate to
the authenticated backend route only for that lookup. The backend queries Google
Places, returns up to 12 nearby merchants, and does not persist the coordinate or
Places response. The app maps provider place types to conservative TapTag reward
categories, lets the user disambiguate the merchant, and runs the recommendation
engine against the user's enabled wallet cards.

It is not background geofencing.

## Setup Flow

```bash
npm install
npm run setup
npm run first-run
npm run api
npm start
```

`first-run` validates frontend config and seeds MongoDB.

## Read Order

1. `TAPTAG_CANONICAL_CONTEXT.md`
2. `frontend/app/_layout.tsx`
3. `frontend/src/context/AuthContext.tsx`
4. `frontend/src/services/api.ts`
5. `frontend/src/services/data/*`
6. `frontend/src/utils/recommendCard.ts`
7. `frontend/app/(tabs)/Cards.tsx`
8. `frontend/app/(tabs)/Lab.tsx`
9. `frontend/app/(tabs)/Nearby.tsx`
10. `backend/src/server.mjs`
11. `backend/seed/seedKnowledgeLayer.mjs`
