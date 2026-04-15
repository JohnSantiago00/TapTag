# TapTag app

This folder contains the actual Expo app for TapTag.

On the `demo-mode` branch, this app is intentionally set up so a tester can run it without Firebase, Firestore, or any local secret configuration.

## What this branch is optimized for

This branch is optimized for:

- clone and run testing
- product walkthroughs
- demo sessions
- quick UX evaluation
- validating the recommendation flow without backend setup

This branch is **not** optimized for backend integration testing. It replaces the normal Firebase runtime path with local demo auth and local persisted state.

## One-minute setup

From the repo root:

```bash
npm install
npm start
```

Or from inside this folder:

```bash
cd tapTag
npm install
npm start
```

That should be enough to get the app running.

## No Firebase required on this branch

You do **not** need any of the following to test `demo-mode`:

- `.env`
- Firebase app config
- Firestore
- Auth configuration
- service account JSON
- seeding scripts
- Firestore rules deployment

The branch ships with demo data bundled into the app.

## What demo mode uses instead

### Authentication

Authentication is local and AsyncStorage-backed.

A tester can either:

- create a local demo account with email/password
- or tap **Continue in Demo Mode** / **Skip to Demo Mode**

### Knowledge layer

The following are bundled into the app as local demo data:

- cards
- merchant brands
- MCC mappings

### User state

The following are stored locally on-device with AsyncStorage:

- current user session
- profile
- selected wallet cards
- event history

## Commands

### Start Expo

```bash
npm start
```

This uses the local startup helper script.

### Start tunnel mode

```bash
npm run start:tunnel
```

Use this if Expo networking is unreliable on your machine or phone.

### Start web

```bash
npm run web
```

### Run lint

```bash
npm run lint
```

## First launch walkthrough

When the app opens:

1. you land on Login
2. tap **Continue in Demo Mode** for the fastest path
3. you are routed into the tabbed app
4. open **Wallet** and add some seeded cards
5. open **Lab** and test recommendations
6. optionally open **Nearby** and allow location access
7. open **Profile** to inspect local saved state and recent events

## Recommended test script for a human tester

If you are handing this to someone else, tell them to do this:

### Step 1
Open the app and tap **Continue in Demo Mode**.

### Step 2
Go to **Wallet**.

Add at least two cards, for example:

- American Express Gold Card
- Chase Sapphire Preferred

### Step 3
Go to **Lab**.

Tap through the seeded merchants and confirm:

- a best card appears
- the reason text is understandable
- the result changes when the merchant/category changes

### Step 4
Go to **Nearby**.

If you want to test live location behavior:

- grant foreground location permission
- use **Refresh Nearby Check**

If no nearby suggestion appears, that does not necessarily mean something is broken. Nearby still depends on distance to one of the seeded merchant coordinates.

### Step 5
Go to **Profile**.

Confirm:

- display name can be saved
- wallet count updates
- recent event history updates
- recommendation and wallet activity are visible

## Included demo data

### Cards

- `amex_gold`
- `chase_sapphire_preferred`
- `citi_custom_cash`

### Brands

- `amazon`
- `starbucks`
- `whole_foods`
- `shell`

### MCC docs

- `4112`
- `5311`
- `5411`
- `5541`
- `5812`
- `5814`

## Resetting demo data

Open **Profile** for reset controls.

### Reset My Demo Data

This clears the current demo user’s:

- wallet
- profile
- event history

Then it signs the current user out.

### Reset All Demo Data On This Device

This clears all TapTag demo data stored on the current device, including:

- local demo users
- current session
- wallet state
- profile state
- event history

Then it signs the current user out.

Use this when you want the app to behave like a totally fresh install.

## Nearby behavior on this branch

Nearby still uses real foreground location APIs.

That means:

- the app will ask for location permission
- the app compares your current location against seeded merchant coordinates
- a recommendation only appears if you are within the configured distance threshold

So for quickest product validation, use **Lab** first and **Nearby** second.

## Networking note

This repo still uses the custom Expo startup wrapper that prefers the Tailscale IP from `tailscale0` when available.

That is helpful on machines with multiple interfaces, but if Expo still advertises a path your phone cannot reach, use:

```bash
npm run start:tunnel
```

## What changed architecturally on this branch

Compared with the Firebase-backed branch:

- auth context is local and AsyncStorage-backed
- cards/brands/MCC mappings are read from bundled demo data
- wallet/profile/events are local services instead of Firestore services
- the app shell no longer depends on runtime Firebase initialization

This keeps the UX close to the real product flow while removing backend friction for testers.

## If you want the backend-backed flow instead

This branch is for demo/testing simplicity.

If you want the Firebase-backed setup path, use the branch/workflow documented in the repository-level Firebase setup docs instead of this branch.
