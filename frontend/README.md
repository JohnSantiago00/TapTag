# TapTag App

TapTag is a privacy-first wallet intelligence app.

It helps a user choose the best card product they already own for a merchant or merchant category, using Firebase Auth, a MongoDB-backed API, lightweight wallet refs, foreground location, and in-app nudges without storing sensitive payment credentials.

## Current Stack

- Expo
- React Native
- Expo Router
- Firebase Auth
- Backend API
- MongoDB Atlas
- Expo Location

## What Works Now

- Firebase sign-up and login
- seeded MongoDB knowledge layer
- wallet selection using card product refs
- recommendation flow with normalized category matching
- Lab screen for merchant testing and knowledge-layer inspection
- Nearby foreground location checks with an in-app nudge banner
- lightweight event tracking for recommendation and wallet activity
- minimal user profile upsert

## Fastest Local Setup

From the repo root:

```bash
npm install
npm run setup
# fill in frontend/.env and backend/.env
npm run first-run
npm run api
npm start
```

## Required Frontend `.env` Values

Create `frontend/.env` from `frontend/.env.example`.

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
EXPO_PUBLIC_TAPTAG_API_BASE_URL=http://100.x.y.z:4000
```

The backend listens on `0.0.0.0:4000`, but the app should call your machine LAN or Tailscale IP. Do not use `0.0.0.0` as the client URL.

## Commands

- `npm run doctor` - validate local frontend setup
- `npm run first-run` - validate setup and seed MongoDB from the backend
- `npm start` - start Expo with the local networking helper in LAN mode
- `npm run start:tunnel` - use Expo tunnel mode when LAN or Tailscale is flaky
- `npm run lint` - run ESLint

## Useful Flows

- Sign up or log in
- Go to Wallet and add the seeded card products you own
- Use Lab to test merchant/category recommendations
- Use Nearby to test foreground location recommendations and nudge actions
- Use Profile to verify the lightweight privacy-first user layer

## Tracked Event Examples

- `recommendation_shown`
- `recommendation_opened`
- `recommendation_dismissed`
- `wallet_updated`

## Seeded Knowledge Layer

Cards:

- `amex_gold`
- `chase_sapphire_preferred`
- `citi_custom_cash`

Brands:

- `amazon`
- `starbucks`
- `whole_foods`
- `shell`

MCC docs:

- `4112`
- `5311`
- `5411`
- `5541`
- `5812`
- `5814`
