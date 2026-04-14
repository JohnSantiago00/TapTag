# TapTag app

TapTag is a privacy-first wallet intelligence app.

It helps a user choose the best card product they already own for a merchant or merchant category, using Firestore-backed knowledge data, lightweight wallet refs, foreground location, and in-app nudges without storing sensitive payment credentials.

## Current stack

- Expo
- React Native
- Expo Router
- Firebase Auth
- Firestore
- Expo Location

## What works now

- seeded Firestore knowledge layer
- wallet selection using card product refs
- recommendation flow with normalized category matching
- Lab screen for merchant testing and knowledge-layer inspection
- Nearby foreground location checks with an in-app nudge banner
- lightweight event tracking for recommendation and wallet activity
- minimal user profile upsert
- local seed and cleanup scripts aligned to the current data model

## Fastest local setup

From the repo root:

```bash
npm install
npm run setup
# fill in tapTag/.env
npm run first-run
npm start
```

If you prefer to work directly inside this folder instead of the repo root:

```bash
cd tapTag
npm install
npm run setup
npm run first-run
npm start
```

## Required `.env` values

Create `tapTag/.env` from `tapTag/.env.example`.

Required for the app and client-SDK fallback seeding:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Optional but preferred for seed/cleanup scripts:

```env
GOOGLE_APPLICATION_CREDENTIALS=./seed/serviceAccountKey.json
```

Notes:

- The app itself uses the `EXPO_PUBLIC_FIREBASE_*` variables.
- The knowledge-layer scripts prefer `GOOGLE_APPLICATION_CREDENTIALS` when a Firebase Admin service-account JSON exists.
- `npm run first-run` is the easiest path after `.env` is filled in.
- `npm run bootstrap:client` makes the client-only seed path explicit for fresh clones.
- `npm run doctor` checks the expected env vars and warns about missing credentials.
- See `../FIREBASE_SETUP.md` for Firestore rules, indexes, and deploy steps.

## Commands

- `npm run setup` - create `.env` from `.env.example` if it does not exist
- `npm run doctor` - validate local setup before first run
- `npm run first-run` - deploy included Firestore rules/indexes and seed the app in client mode for a fresh clone
- `npm start` - start Expo with the local networking helper
- `npm run start:tunnel` - use Expo tunnel mode when LAN or Tailscale is flaky
- `npm run bootstrap` - run setup checks, then seed Firestore knowledge data with admin creds when available
- `npm run bootstrap:client` - force client-SDK seeding for fresh clones without a service account key
- `npm run seed:knowledge` - seed Firestore knowledge data directly
- `npm run cleanup:knowledge` - delete older prototype docs
- `npm run lint` - run ESLint

## Notes on networking

- This repo prefers the Tailscale IP from `tailscale0` when available, so Expo advertises that address instead of a local `192.168.x.x` LAN address.
- If Expo Go or local routing still acts up, run `npm run start:tunnel`.

## Useful flows

- Sign up or log in
- Go to Wallet and add the seeded card products you own
- Use Lab to test merchant/category recommendations
- Use Nearby to test foreground location recommendations and nudge actions
- Use Profile to verify the lightweight privacy-first user layer

## Tracked event examples

- `recommendation_shown`
- `recommendation_opened`
- `recommendation_dismissed`
- `wallet_updated`

## Firebase requirements

- Email/Password auth enabled
- Firestore database created
- Firestore rules must allow the current development flow

## Seeded knowledge layer

### Cards

- `amex_gold`
- `chase_sapphire_preferred`
- `citi_custom_cash`

### Brands

- `amazon`
- `starbucks`
- `whole_foods`
- `shell`

### MCC docs

- `4112`
- `5311`
- `5411`
- `5541`
- `5812`
- `5814`
