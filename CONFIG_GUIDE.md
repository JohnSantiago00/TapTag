# TapTag Config Guide

## Packages

Root `package.json` proxies common commands:

- `npm start` - Expo app
- `npm run api` - backend API
- `npm run setup` - create frontend/backend env files
- `npm run first-run` - validate setup and seed MongoDB
- `npm run seed:knowledge` - seed MongoDB knowledge data
- `npm run cleanup:knowledge` - remove known stale MongoDB docs
- `npm run lint` - frontend lint

`frontend/package.json` owns Expo scripts and frontend dependency overrides used to keep npm audit clean without jumping Expo major versions.

`backend/package.json` owns the Express API and MongoDB scripts.

## Environment

Frontend env values are client-safe and bundled into the app:

- `EXPO_PUBLIC_FIREBASE_*`
- `EXPO_PUBLIC_TAPTAG_API_BASE_URL`

Backend env values are server-side only:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `PORT`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_PLACES_API_KEY` (server-only Places API key for live nearby merchants)
- `CORS_ORIGIN`

Do not put MongoDB credentials in `frontend/.env`.

## Firebase

Firebase is used for Auth only.

The backend verifies Firebase ID tokens with Google's public Firebase Auth JWKS and the configured Firebase project id. It does not need Firebase Admin credentials for normal local operation.

## MongoDB

MongoDB stores TapTag data:

- card-product knowledge
- brand/MCC knowledge
- user profiles
- wallet card-product refs
- lightweight events

Indexes are created in `backend/src/mongo.mjs`.

## Expo Config

`frontend/app.json` defines app identity, Expo Router, splash config, native identifiers, and EAS metadata.

The backend listens on `0.0.0.0:4000` by default. For physical devices, set `EXPO_PUBLIC_TAPTAG_API_BASE_URL` to a LAN or Tailscale URL instead of `localhost`; the app should not use `0.0.0.0` as its API URL.

## Docker

Docker supports:

- backend API
- backend seed/cleanup scripts
- frontend Expo container workflow

Local Expo is still preferred for native simulator/device work.
