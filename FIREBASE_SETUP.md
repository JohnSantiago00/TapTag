# TapTag Auth And Data Setup

Firebase is now used for Authentication only. App data lives in MongoDB behind the backend API.

## Firebase Requirements

Create a Firebase project with:

- Authentication enabled
- Email/Password auth enabled

The frontend uses Firebase client env vars, and the backend verifies Firebase ID tokens using the Firebase project id and Google public signing keys. No Firebase Admin service account is required for normal local auth verification.

## MongoDB Requirements

Create a MongoDB Atlas cluster and put the connection string in `backend/.env`:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=taptag
PORT=4000
FIREBASE_PROJECT_ID=your-project-id
CORS_ORIGIN=*
```

Keep the real MongoDB URI out of committed files.

In Atlas, add your current development machine to Network Access before running seed commands. If seeding fails with a TLS alert before authentication, the Atlas IP allowlist or cluster network settings are the first thing to check.

## Frontend Config

Create `frontend/.env`:

```bash
npm run setup
```

Then fill in:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
EXPO_PUBLIC_TAPTAG_API_BASE_URL=http://localhost:4000
```

For physical devices, use a LAN or Tailscale host instead of `localhost`.

## First Run

```bash
npm install
npm run setup
# fill in frontend/.env and backend/.env
npm run first-run
npm run api
npm start
```

`npm run first-run` validates the frontend setup and seeds MongoDB with cards, brands, and MCC mappings.

## Manual Data Commands

```bash
npm run seed:knowledge
npm run cleanup:knowledge
```

These operate on MongoDB through `backend/.env`.
