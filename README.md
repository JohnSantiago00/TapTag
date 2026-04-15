# TapTag

TapTag is a privacy-first wallet intelligence app.

On the `demo-mode` branch, the goal is simple:

**someone should be able to clone the repo, install dependencies, start Expo, and test the app without creating a Firebase project, touching Firestore, or seeding backend data.**

The real Expo app lives in `tapTag/`, but this repo exposes root-level commands so a tester can stay at the repo root.

## Demo branch promise

If you are on `demo-mode`, you should not need to deal with:

- Firebase project creation
- Firestore rules
- Firestore seeding
- service account keys
- `.env` setup just to test the app

Instead, this branch uses:

- local demo auth
- bundled demo cards, brands, and MCC mappings
- AsyncStorage for wallet, profile, and event history

## The fastest possible path

```bash
git clone <repo-url>
cd TapTag
git checkout demo-mode
npm install
npm start
```

That is the intended tester flow.

## What happens after `npm start`

Expo starts the app from the real project folder inside `tapTag/`.

From there, a tester can:

1. open the app in Expo Go, Android emulator, iOS simulator, or web
2. tap **Continue in Demo Mode** on the login screen
3. open **Wallet** and choose some seeded card products
4. open **Lab** to test merchant/category recommendations
5. open **Nearby** to test foreground location-based suggestions
6. open **Profile** to inspect saved profile state and event tracking

## Exact commands from the repo root

### Install dependencies

```bash
npm install
```

### Start the app normally

```bash
npm start
```

### Start with Expo tunnel mode

Use this if local LAN or Tailscale networking is flaky.

```bash
npm run start:tunnel
```

### Start the web build

```bash
npm run web
```

### Run lint

```bash
npm run lint
```

## Root command behavior

These commands proxy into the actual Expo app inside `tapTag/`:

- `npm start`
- `npm run web`
- `npm run android`
- `npm run ios`
- `npm run start:tunnel`
- `npm run lint`

There are also Firebase/bootstrap commands in this repo because other branches still use them, but **they are not part of the tester path on `demo-mode`**.

## What demo mode stores locally

Demo mode keeps state on the local device using AsyncStorage.

That includes:

- local demo account/session
- selected wallet cards
- lightweight user profile
- recent event history

So if a tester closes and reopens the app, their local demo state can still be there.

## Resetting demo data

In the app, open **Profile**.

You now have two reset options:

- **Reset My Demo Data**
  - clears the current demo user’s wallet, profile, and event history
  - signs that user out
- **Reset All Demo Data On This Device**
  - clears all TapTag demo data stored locally on that device
  - signs the tester out

This is useful when multiple testers share a device or when you want a true clean-slate run.

## Seeded demo data included on this branch

### Cards

- American Express Gold Card
- Chase Sapphire Preferred
- Citi Custom Cash Card

### Brands

- Amazon
- Starbucks
- Whole Foods Market
- Shell Gas Station

### MCC mappings

- Dining
- Groceries
- Gas
- Transportation
- Online Shopping

That is enough to test the core product loop without backend setup.

## Recommended tester flow

If you want a consistent walkthrough for someone evaluating the app, use this exact sequence:

1. launch the app
2. tap **Continue in Demo Mode**
3. open **Wallet**
4. add at least one or two cards
5. open **Lab**
6. switch between merchants and inspect the recommended card and explanation
7. open **Nearby**
8. allow foreground location if you want to test live location behavior
9. open **Profile**
10. confirm that recent event history reflects wallet updates and recommendation activity

## Platform notes

### Web

`npm run web` is the easiest way to let someone click around quickly.

### Phone with Expo Go

After `npm start`, scan the QR code from Expo.

If the phone cannot connect cleanly over LAN, use:

```bash
npm run start:tunnel
```

### Android emulator / iOS simulator

You can also use Expo’s usual local development flow if your environment is already set up for it.

## Troubleshooting

### `npm install` fails

Make sure you have a recent Node version installed. This repo is currently running well on Node 24 in this environment.

### Expo starts but the phone cannot connect

Try:

```bash
npm run start:tunnel
```

### The app opens but state feels stale

Open **Profile** and use one of the reset buttons.

### Nearby does not show a recommendation

That can be normal.

Nearby still depends on:

- granting foreground location permission
- being near one of the seeded merchant locations

If you just want to validate the recommendation engine quickly, use **Lab** first.

## Important branch note

This README describes the **demo branch experience**.

Other branches in this repo may still use Firebase-backed auth and Firestore-backed data. If someone is testing `demo-mode`, they should follow this README, not the backend setup docs.

## Where to read next

- `tapTag/README.md` for the app-level demo walkthrough
- `TAPTAG_CANONICAL_CONTEXT.md` for product intent
- `CODEBASE_GUIDE.md` for codebase structure
- `CONFIG_GUIDE.md` for config/tooling explanations
