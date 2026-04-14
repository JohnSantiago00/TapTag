# TapTag Firebase setup

Use this if you want a fresh clone to behave like the current project without guessing the Firestore shape.

## Minimum Firebase services

Create a Firebase project with:

- Authentication
- Firestore Database

Then enable:

- Email/Password auth

## Local app config

Create your local env file:

```bash
npm run setup
```

Then fill in `tapTag/.env` with your Firebase client values.

## Two supported bootstrap paths

### Path A, preferred: with service account key

1. Put your service account JSON at:
   `tapTag/seed/serviceAccountKey.json`
2. Keep this in `tapTag/.env`:
   `GOOGLE_APPLICATION_CREDENTIALS=./seed/serviceAccountKey.json`
3. Run:

```bash
npm run bootstrap
```

This uses Firebase Admin credentials for seeding.

### Path B, easier for a brand-new clone: client-only bootstrap

Use this if you do not want to create a service account key yet.

1. Fill in `tapTag/.env`
2. Deploy the included Firestore rules and indexes
3. Run:

```bash
npm run bootstrap:client
```

This forces the seed script to use the Firebase client SDK instead of admin credentials.

## Deploying the included Firestore rules

The repo includes:

- `firebase.json`
- `tapTag/firestore.rules`
- `tapTag/firestore.indexes.json`

If you use the Firebase CLI:

```bash
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

The included rules match the app's current behavior:

- global knowledge collections are readable
- global knowledge collections are not writable from the app
- users can read/write only their own profile, wallet, and events

## Why `bootstrap:client` exists

A lot of fresh clones have Firebase app config but not a service account file.

`npm run bootstrap:client` makes that setup explicit instead of failing into a half-documented fallback. It clears `GOOGLE_APPLICATION_CREDENTIALS` and forces the seed script into client mode.

## Recommended first run

```bash
git clone <repo>
cd TapTag
npm install
npm run setup
# fill in tapTag/.env
npm run first-run
npm start
```

What `npm run first-run` does:

1. makes sure `tapTag/.env` exists
2. runs the setup doctor
3. deploys the included Firestore rules and indexes using your Firebase project id from `.env`
4. runs `npm run bootstrap:client`

If you prefer the steps manually, you can still run `npm run doctor` and `npm run bootstrap:client` yourself.
