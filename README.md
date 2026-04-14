# TapTag

TapTag is a privacy-first wallet intelligence app built with Expo, React Native, Firebase Auth, and Firestore.

The actual app lives in `tapTag/`, but this repo is now set up so a fresh clone can use root-level commands.

## Fast path

```bash
git clone <repo-url>
cd TapTag
npm install
npm run setup
# fill in tapTag/.env with your Firebase project values
npm run first-run
npm start
```

If Expo networking is flaky on your machine:

```bash
npm run start:tunnel
```

## What the root commands do

These all proxy into the real Expo app inside `tapTag/`:

- `npm start`
- `npm run web`
- `npm run android`
- `npm run ios`
- `npm run start:tunnel`
- `npm run setup`
- `npm run doctor`
- `npm run first-run`
- `npm run bootstrap`
- `npm run bootstrap:client`
- `npm run seed:knowledge`
- `npm run cleanup:knowledge`
- `npm run lint`

So you do not have to remember to `cd tapTag` for normal setup and dev work.

## First-run checklist

1. Install dependencies with `npm install` from the repo root.
2. Run `npm run setup` to create `tapTag/.env` from the template.
3. Add your Firebase client config values.
4. The simplest path is `npm run first-run`, which deploys the included Firestore rules and then seeds the app in client mode.
5. If you do have a service account key, you can still place it at `tapTag/seed/serviceAccountKey.json` and use `npm run bootstrap`.
6. Run `npm start` to launch Expo.

## Firebase requirements

Your Firebase project should have:

- Email/Password auth enabled
- Firestore created
- Firestore rules that support your chosen local seeding path

Notes:

- The app uses `EXPO_PUBLIC_FIREBASE_*` env vars.
- The seed and cleanup scripts prefer `GOOGLE_APPLICATION_CREDENTIALS` when a service account JSON exists.
- `npm run first-run` is the best default for a fresh clone once `.env` is filled in.
- `npm run bootstrap:client` forces the no-service-account path for fresh clones.
- See `FIREBASE_SETUP.md` for the included rules, indexes, and deploy flow.

## Current flows that work

- sign up / log in
- add wallet card-product refs
- run Lab merchant/category recommendation tests
- test Nearby foreground recommendation nudges
- inspect lightweight user profile and event tracking

## Where to read next

- `tapTag/README.md` for app-specific setup and flows
- `FIREBASE_SETUP.md` for Firebase rules, indexes, and bootstrap paths
- `TAPTAG_CANONICAL_CONTEXT.md` for product intent
- `CODEBASE_GUIDE.md` for architecture
- `CONFIG_GUIDE.md` for config file explanations
