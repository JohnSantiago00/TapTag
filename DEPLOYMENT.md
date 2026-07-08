# TapTag Deployment Guide

## Backend API

TapTag's backend is a stateless Express API that can run on Render, Fly, Railway, a VPS, or Docker.

Required environment:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=taptag
FIREBASE_PROJECT_ID=your-project-id
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=*
```

Production notes:

- Rotate any MongoDB password that was pasted into chat or logs.
- Restrict MongoDB Atlas Network Access to the backend host IP when the host has a stable egress IP.
- Replace `CORS_ORIGIN=*` with the deployed app/dev origins once the frontend target is known.
- Keep MongoDB credentials in backend/server env only. Never put them in `frontend/.env`.

## Wallet Companion Passes

The app can store and dynamically update each user's latest TapTag companion-pass recommendation today. Real Apple Wallet or Google Wallet pass installation requires issuer credentials that should only live on the backend.

Apple Wallet production setup needs:

- Apple Developer account
- Pass Type ID
- Team ID
- Pass signing certificate/private key
- Pass web service URL/auth token

Google Wallet production setup needs:

- Google Wallet issuer account
- Generic Pass class/object setup
- Service account credentials for JWT signing

Until those are configured, `/api/users/me/companion-pass/install-link` intentionally returns `501` with a setup message instead of pretending a real pass can be installed.

## Health And Smoke Checks

Health:

```bash
curl https://your-api-host.example.com/health
```

Smoke check:

```bash
TAPTAG_API_SMOKE_URL=https://your-api-host.example.com npm run smoke:api
```

The smoke check verifies:

- `/health`
- seeded cards
- seeded brands
- MCC mappings

## Frontend

Set the frontend API URL to the deployed backend:

```env
EXPO_PUBLIC_TAPTAG_API_BASE_URL=https://your-api-host.example.com
```

For local phone testing, use the machine LAN or Tailscale URL instead:

```env
EXPO_PUBLIC_TAPTAG_API_BASE_URL=http://100.x.y.z:4000
```

Do not use `0.0.0.0` as the client URL. `0.0.0.0` is only the backend bind address.

## Release Validation

Before handing off a build:

```bash
npm run first-run
npm run lint
npm run test
npm run smoke:api
```

Then run the real-device checklist in `QA_CHECKLIST.md`.
