# TapTag

TapTag is a privacy-first wallet intelligence app built with Expo, React Native, Firebase Auth, a MongoDB-backed API, and MongoDB Atlas.

The repo is split into:

- `frontend/` - Expo / React Native app
- `backend/` - Express API, MongoDB seed/cleanup scripts, and auth-token verification

## Fast Path

```bash
npm install
npm run setup
# fill in frontend/.env with Firebase client values
# fill in backend/.env with MongoDB URI and Firebase project id
npm run first-run
npm run api
npm start
```

If Expo networking is flaky on your machine:

```bash
npm run start:tunnel
```

The backend binds to `0.0.0.0:4000` by default. For a physical phone, set `EXPO_PUBLIC_TAPTAG_API_BASE_URL` in `frontend/.env` to your machine LAN or Tailscale URL, for example `http://100.x.y.z:4000`; do not use `0.0.0.0` as the client URL.

## What The Root Commands Do

- `npm start` - start the Expo app in LAN mode
- `npm run api` - start the backend API on `0.0.0.0:4000`
- `npm run setup` - create `frontend/.env` and `backend/.env` from examples
- `npm run doctor` - validate frontend env and local setup
- `npm run first-run` - validate setup and seed MongoDB knowledge data
- `npm run test` - run backend API and frontend logic/API-client tests
- `npm run smoke:api` - verify a running API has health and seeded knowledge data
- `npm run catalog:audit` - validate card rules, issuer sources, and review freshness
- `npm run seed:knowledge` - seed MongoDB card, brand, and MCC data
- `npm run cleanup:knowledge` - remove known stale prototype MongoDB docs
- `npm run lint` - run frontend ESLint

## Current Flows

- sign up / log in with Firebase Auth
- add wallet card-product refs
- search the curated merchant directory for card recommendations
- discover real nearby merchants through Google Places and get a foreground recommendation
- inspect lightweight user profile and event tracking

## Data Boundary

TapTag does not store card numbers, CVV, expiration dates, billing addresses, bank login credentials, or payment credentials.

MongoDB stores:

- global card product knowledge
- brand/MCC knowledge
- user profile defaults
- wallet card-product references
- lightweight user-scoped events

TapTag sends a coordinate to its backend only when a signed-in user opens or
refreshes Nearby. The backend uses it for a live Places lookup and does not
persist the coordinate or Places response.

## Where To Read Next

- `TAPTAG_CANONICAL_CONTEXT.md` for product intent
- `CODEBASE_GUIDE.md` for architecture
- `CARD_CATALOG.md` for the researched card schema and admin update workflow
- `CONFIG_GUIDE.md` for config file explanations
- `DEPLOYMENT.md` for backend deployment and smoke checks
- `QA_CHECKLIST.md` for real-device validation
- `frontend/README.md` for app-specific setup
- `FIREBASE_SETUP.md` for Firebase Auth and MongoDB setup notes
