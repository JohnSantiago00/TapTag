# TapTag Codebase Guide

This guide explains how the current TapTag codebase fits together and why it is written this way.

## 1. Product intent

TapTag is a privacy-first wallet intelligence app.

It answers a narrow question:
Which card product from the user's selected wallet is the best fit for a merchant or merchant category?

Important non-goals in the current codebase:
- not a payments app
- not a card credential vault
- not a bank integration app
- not production-scale merchant discovery

That product boundary explains many code decisions:
- wallet stores card-product references only
- recommendation logic stays simple and readable
- location is used in the foreground only
- event tracking is lightweight and user-scoped

Canonical product direction: `TAPTAG_CANONICAL_CONTEXT.md`

## 2. Repo structure

Root files:
- `TAPTAG_CANONICAL_CONTEXT.md` is the current source of truth for product direction
- `AGENTS.md` documents project workflow conventions, including branch discipline
- `CODEBASE_GUIDE.md` is this architecture walkthrough
- `tapTag/` contains the actual Expo app

Inside `tapTag/`:
- `app/` contains Expo Router screens and route layouts
- `src/config/` contains Firebase bootstrapping
- `src/context/` contains global React context like auth state
- `src/services/firestore/` contains Firestore read/write helpers
- `src/utils/` contains pure helper logic such as recommendation and distance math
- `seed/` contains local scripts for seeding and cleanup of Firestore knowledge data
- `scripts/` contains local dev helpers like Expo startup networking behavior

## 3. App shell and routing

Files:
- `tapTag/app/_layout.tsx`
- `tapTag/app/index.tsx`
- `tapTag/app/(auth)/_layout.tsx`
- `tapTag/app/(tabs)/_layout.tsx`
- `tapTag/hooks/useAuthRedirect.ts`

How it works:
1. `app/_layout.tsx` initializes Firebase, wraps the app in `AuthProvider`, and blocks rendering behind a loading spinner until auth state is known.
2. `useAuthRedirect()` reads auth state and current route segment, then pushes users into either the auth group or the tab group.
3. `app/index.tsx` simply redirects to Login. Real access control is handled by the auth hook.
4. The tab layout defines the main product journey: Home, Wallet, Lab, Nearby, Profile.

Why this structure was chosen:
- route protection is centralized instead of duplicated across screens
- auth state is resolved once, not through multiple listeners
- screen files stay mostly focused on product logic and UI

## 4. Firebase bootstrapping

File:
- `tapTag/src/config/firebase.ts`

Responsibilities:
- initialize Firebase app from Expo env vars
- initialize Firebase Auth with AsyncStorage persistence
- initialize Firestore

Important implementation detail:
The file includes a custom React Native persistence wrapper instead of importing a helper from Firebase that had package/export compatibility issues in this environment.

Why this matters:
- auth state persists across app restarts
- the app avoids SDK-export drift that previously caused setup/runtime pain

## 5. Auth flow

Files:
- `tapTag/src/context/AuthContext.tsx`
- `tapTag/app/(auth)/Login.tsx`
- `tapTag/app/(auth)/SignUp.tsx`
- `tapTag/src/utils/validation.ts`

How it works:
- `AuthProvider` listens to Firebase auth changes with `onAuthStateChanged`
- when a user signs in, it also ensures a matching Firestore profile exists
- Login and SignUp do local validation first, then call Firebase Auth
- both auth screens translate Firebase error codes into clearer UI messages

Why it is written this way:
- one shared auth context avoids duplicate listeners and route flicker
- profile upsert on sign-in keeps the rest of the app simple, because screens can assume the user doc should exist
- validation stays intentionally minimal because TapTag is not building a heavy onboarding system yet

## 6. Firestore model

Global collections:
- `cards`
- `brands`
- `mcc_map`

User data:
- `users/{uid}`
- `users/{uid}/wallet/{cardProductId}`
- `users/{uid}/events/{eventId}`

Why this matters:
- global knowledge stays separate from user state
- wallet docs store only references to product docs, not sensitive financial data
- events are user-scoped and lightweight

## 7. Firestore service layer

Files:
- `src/services/firestore/cards.ts`
- `src/services/firestore/brands.ts`
- `src/services/firestore/mccMap.ts`
- `src/services/firestore/wallet.ts`
- `src/services/firestore/userProfile.ts`
- `src/services/firestore/events.ts`

Design pattern:
Each file does one thing, normalize Firestore documents into shapes the UI can trust.

Why this is useful:
- screen code stays readable
- Firestore normalization is centralized
- seed data can evolve without every screen having to defend against shape drift separately

Specific notes:

### cards.ts
Reads seeded card-product data and normalizes reward rules.
This is global knowledge, not a user's actual card instance.

### brands.ts
Reads merchant brand identity and normalizes merchant locations.
Supports both `commonLocations` and older single `coordinates` formats.

### mccMap.ts
Normalizes MCC docs into a `normalizedCategory` that powers the recommendation engine.
This file is one of the most important in the whole repo, because category normalization is the bridge between merchant context and reward logic.

### wallet.ts
Stores and reads wallet refs under `users/{uid}/wallet`.
This file preserves the core privacy boundary, TapTag knows which product IDs a user selected, but not full card credentials.

### userProfile.ts
Upserts and updates the lightweight user profile.
`privacyMode` is hard-coded to `strict` because that is a product rule today, not an editable preference.

### events.ts
Tracks recommendation and wallet activity.
This is intentionally not a full analytics system. It exists to make the app measurable and QA-friendly.

## 8. Recommendation engine

File:
- `tapTag/src/utils/recommendCard.ts`

This is the heart of the product.

Inputs:
- wallet cards
- normalized category

Output:
- best card
- best rate
- matched category
- user-facing explanation string

Current rule set:
- direct match on `normalizedCategory`
- fallback to `Other`
- tie messaging if multiple cards share the same best rate

Why it stays simple:
- the project is proving the usefulness of the loop first
- advanced issuer logic is intentionally deferred
- the current version is readable enough that a tester can understand why a recommendation happened

## 9. Screen-by-screen walkthrough

### Home
File: `app/(tabs)/Home.tsx`

Purpose:
- product framing
- first-run clarity
- quick links to the main loops
- lightweight beta checklist

Why it matters:
Earlier versions of the repo felt closer to a prototype shell. Home now explains the product honestly and gives the tester a clear next step.

### Wallet
File: `app/(tabs)/Cards.tsx`

Purpose:
- select which seeded card products the user owns
- show current wallet summary
- track wallet update events

Why it is important:
Every recommendation depends on this screen. Lab and Nearby only make sense if the user has selected at least one card.

### Lab
File: `app/(tabs)/Lab.tsx`

Purpose:
- controlled merchant simulation
- recommendation proof screen
- knowledge-layer inspection surface

How it works:
- loads cards, brands, MCC mappings, and wallet together
- derives selected brand and normalized category
- runs the recommendation engine
- tracks deduped `recommendation_shown` events

Why it exists:
Lab gives a deterministic environment for testing the recommendation engine before relying on real location context.

### Nearby
File: `app/(tabs)/Nearby.tsx`

Purpose:
- live foreground recommendation loop
- location-powered nudge surface
- recommendation engagement tracking

How it works:
- asks for foreground location permission
- loads seeded brands, cards, MCC mappings, and wallet
- computes nearest known seeded merchant using Haversine distance
- checks whether the nearest merchant is within a fixed radius
- recommends the best card for that merchant's normalized category
- tracks shown, opened, and dismissed interactions

Why it is written this way:
- no external places API required yet
- no geofencing or background behavior yet
- easy to reason about while still demonstrating the product's “magic moment”

### Profile
File: `app/(tabs)/Profile.tsx`

Purpose:
- lightweight user profile editing
- display privacy defaults
- show wallet count
- surface event tracking health and recent events

Why it matters:
This screen doubles as a QA dashboard. It lets someone verify that the recommendation loop and wallet updates are actually being recorded.

## 10. Utility helpers

### distance.ts
Implements Haversine distance in meters.
Nearby uses it to compare the device location with seeded merchant coordinates.

### validation.ts
Minimal auth validation helpers.
These are intentionally small because richer onboarding rules are not the current priority.

## 11. Seed and cleanup scripts

Files:
- `tapTag/seed/seedKnowledgeLayer.mjs`
- `tapTag/seed/cleanupKnowledgeLayer.mjs`

Why they exist:
The app depends on seeded global knowledge data. Without it, Wallet, Lab, and Nearby do not have the card, brand, and MCC context they need.

Important behavior:
- prefer Firebase Admin credentials when available
- if no admin key exists, fall back to client SDK using `.env`
- validate seed data before writing it
- keep normalized categories constrained so the recommendation engine does not drift away from supported values

Why the fallback is valuable:
It makes local setup work even when a service account JSON is missing.

## 12. Dev environment helpers

### start-expo.sh
This script prefers the Tailscale IP when present so Expo advertises a reachable host during device testing.

Why it exists:
On this machine, Expo previously chose the wrong LAN IP, which made cross-device development unreliable.

## 13. Why the codebase looks thin instead of abstract

This repo favors thin vertical slices over heavy architecture.
That means:
- fewer abstractions
- screen logic that is still readable in one file
- small Firestore services
- plain helper utilities
- minimal indirection

That is intentional.
The current goal is to prove product usefulness and tester clarity, not to build a large platform prematurely.

## 14. Best mental model for reading the repo

Read it in this order:
1. `TAPTAG_CANONICAL_CONTEXT.md`
2. `tapTag/app/_layout.tsx`
3. `tapTag/src/context/AuthContext.tsx`
4. `tapTag/src/config/firebase.ts`
5. `tapTag/src/services/firestore/*`
6. `tapTag/src/utils/recommendCard.ts`
7. `tapTag/app/(tabs)/Cards.tsx`
8. `tapTag/app/(tabs)/Lab.tsx`
9. `tapTag/app/(tabs)/Nearby.tsx`
10. `tapTag/app/(tabs)/Profile.tsx`
11. `tapTag/seed/seedKnowledgeLayer.mjs`

That order mirrors how the app actually thinks:
- product rules
- app shell
- auth state
- backend connection
- data access
- recommendation logic
- user setup
- merchant simulation
- live recommendation
- QA verification
- data seeding

## 15. Current limitations, intentionally left simple

These are not accidental omissions. They are deferred on purpose:
- no real card credential storage
- no bank integrations
- no background location engine
- no production analytics platform
- no quiet hours or cooldown system
- no advanced issuer-specific reward logic
- no complex settings system
- no large merchant database

## 16. If you want to understand one thing first

Start with this chain:
`brands -> mcc_map -> normalizedCategory -> wallet cards -> recommendBestCardForCategory()`

That chain is the product.
Everything else exists to support, explain, or measure it.
