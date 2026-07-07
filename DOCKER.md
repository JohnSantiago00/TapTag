# TapTag Docker Development

TapTag is split into:

- `frontend/` - Expo / React Native app
- `backend/` - Express API plus MongoDB seed/cleanup utilities

## Environment Files

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill `frontend/.env` with Firebase client config and API URL.

Fill `backend/.env` with MongoDB URI, database name, Firebase project id, and API settings.

## Backend API

```bash
docker compose --profile api up backend-api
# or
npm run docker:api
```

The API listens on port `4000`.

## Backend Data Commands

```bash
npm run docker:seed
npm run docker:cleanup
npm run docker:backend:shell
```

## Frontend

```bash
npm run docker:frontend
```

For phone testing from Docker, set `EXPO_PUBLIC_TAPTAG_API_BASE_URL` and possibly `REACT_NATIVE_PACKAGER_HOSTNAME` to a host LAN/Tailscale IP.

Local Expo remains preferred for simulator/device work:

```bash
npm install
npm run api
npm start
```
