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
