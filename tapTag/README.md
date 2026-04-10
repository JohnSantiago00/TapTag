# TapTag

TapTag is a privacy-first wallet intelligence app.
This repo is no longer a generic Expo starter and should not be treated like one.

It helps a user choose the best card product they already own for a merchant or merchant category, using Firestore-backed knowledge data, lightweight wallet refs, foreground location, and in-app nudges without storing sensitive payment credentials.

Current stack
- Expo
- React Native
- Expo Router
- Firebase Auth
- Firestore
- Expo Location

What works now
- seeded Firestore knowledge layer
- wallet selection using card product refs
- recommendation flow with normalized category matching
- Lab screen for merchant testing and knowledge-layer inspection
- Nearby foreground location checks with an in-app nudge banner
- lightweight event tracking for recommendation and wallet activity
- minimal user profile upsert
- local seed and cleanup scripts aligned to the current data model

Setup
1. Install dependencies
   npm install

2. Create a .env file in this directory with:
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
   GOOGLE_APPLICATION_CREDENTIALS=./seed/serviceAccountKey.json

Notes:
- The app itself uses the EXPO_PUBLIC_FIREBASE_* variables.
- The knowledge-layer scripts prefer GOOGLE_APPLICATION_CREDENTIALS when a Firebase Admin service-account JSON exists.
- If that file is missing, the seed and cleanup scripts can fall back to client-SDK Firestore writes using the EXPO_PUBLIC_FIREBASE_* config.

3. Seed Firestore knowledge data
   npm run seed:knowledge

4. Optional cleanup for older test docs
   npm run cleanup:knowledge

5. Start the app
   npm start

6. If direct LAN/Tailscale networking is flaky
   npm run start:tunnel

Notes on networking
- This repo prefers the Tailscale IP from `tailscale0` when available, so Expo advertises that address instead of a local `192.168.x.x` LAN address.
- If Expo Go or local routing still acts up, run `npm run start:tunnel`.

Useful flows
- Sign up or log in
- Go to Wallet and add the seeded card products you own
- Use Lab to test merchant/category recommendations
- Use Nearby to test foreground location recommendations and nudge actions
- Use Profile to verify the lightweight privacy-first user layer

Tracked event examples
- recommendation_shown
- recommendation_opened
- recommendation_dismissed
- wallet_updated

Firebase requirements
- Email/Password auth enabled
- Firestore database created
- Firestore rules must allow the current development flow

Seeded knowledge layer
Cards
- amex_gold
- chase_sapphire_preferred
- citi_custom_cash

Brands
- amazon
- starbucks
- whole_foods
- shell

MCC docs
- 4112
- 5311
- 5411
- 5541
- 5812
- 5814
