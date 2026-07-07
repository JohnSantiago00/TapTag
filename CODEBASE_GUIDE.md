# TapTag Codebase Guide

TapTag is a privacy-first wallet intelligence app.

It answers one product question: which card product from the user's selected wallet is best for a merchant or merchant category?

Non-goals:

- payments
- card credential storage
- bank integrations
- production-scale merchant discovery

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
- Lab - deterministic merchant recommendation testing
- Nearby - foreground location recommendation nudges
- Profile - profile state and event QA

## Backend Flow

Important files:

- `backend/src/server.mjs`
- `backend/src/mongo.mjs`
- `backend/src/firebaseAuth.mjs`
- `backend/seed/seedKnowledgeLayer.mjs`
- `backend/seed/cleanupKnowledgeLayer.mjs`

The backend:

- exposes public knowledge endpoints for cards, brands, and MCC mappings
- verifies Firebase ID tokens for user profile, wallet, and event routes
- stores MongoDB credentials server-side only
- seeds the small beta knowledge layer into MongoDB

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

Nearby asks for foreground location permission, finds the nearest seeded merchant location, resolves the normalized category, runs the recommendation engine, and tracks nudge interactions.

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
