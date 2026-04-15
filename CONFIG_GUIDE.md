# TapTag Config Guide

This guide explains the important config, manifest, and support files that cannot be safely documented with inline comments because they are JSON or otherwise tooling-sensitive.

## 1. `tapTag/package.json`

Purpose:
Defines the app package metadata, scripts, dependencies, and devDependencies.

Important scripts:
- `start`
  Runs `./scripts/start-expo.sh` instead of plain `expo start` so Expo prefers the Tailscale IP when available.
- `android`
  Native Android run command.
- `ios`
  Native iOS run command. On Linux this is not usable for simulator work, but it remains standard Expo config.
- `web`
  Also uses the custom start script, with `--web` passed through.
- `start:tunnel`
  Fallback when LAN or Tailscale routing is unreliable.
- `lint`
  Uses plain `eslint .` instead of `expo lint` because the repo no longer matches Expo starter assumptions.

Why the dependency mix looks broad:
Some Expo template dependencies still exist even though not every one is central to the current thin slice. The important active ones are:
- `expo`, `react`, `react-native`
- `expo-router`
- `expo-location`
- `@react-native-async-storage/async-storage`
- navigation and safe-area packages

## 2. `tapTag/app.json`

Purpose:
Expo app manifest.

Important fields:
- `name`, `slug`, `scheme`
  Standard app identity fields.
- `newArchEnabled: true`
  Uses Expo's newer architecture path.
- `ios.bundleIdentifier`
  iOS app identifier.
- `android.adaptiveIcon`
  Android launcher icon config.
- `plugins`
  Enables Expo Router and related Expo features like splash screen support.
- `experiments.typedRoutes`
  Enables Expo Router typed routes.
- `extra.eas.projectId`
  Connects the app to the EAS project.

Why this file matters:
It is the high-level app manifest that Expo reads before the JS app even runs.

## 3. `tapTag/eas.json`

Purpose:
Build/deployment configuration for Expo Application Services.

Current role in this repo:
Mostly future-facing unless you are doing cloud builds or submit flows. It is part of normal Expo project scaffolding but not central to the current local beta loop.

## 4. `tapTag/tsconfig.json`

Purpose:
TypeScript configuration.

Important choices:
- extends Expo base config
- `strict: true`
  This is useful because the app relies on many runtime documents from Firestore, and strict typing reduces silent mistakes.
- alias path `@/* -> ./*`
  Allows imports like `@/src/config/firebase`.

Why it matters:
Strict TypeScript is one reason the app stayed sane during cleanup and refactors.

## 5. `tapTag/eslint.config.js`

Purpose:
Lint configuration.

Important choice:
Uses `eslint-config-expo/flat`, but only as a base. The actual lint command is direct ESLint, not Expo's starter-specific wrapper.

Why this changed:
The repo removed many Expo starter files, and the Expo wrapper made assumptions that no longer fit the cleaned codebase.

## 6. `tapTag/babel.config.js`

Purpose:
Minimal Babel config for Expo.

Why it is small:
Nothing custom is needed yet. That is a good sign.

## 7. `tapTag/.env`

Purpose:
Local environment variables used only for developer-local overrides when needed.

On `demo-mode`, the app does not require Firebase env values to run.

## 8. `tapTag/expo-env.d.ts`

Purpose:
Expo TypeScript environment typing support.

Why it exists:
Keeps TypeScript happy around Expo-provided env/module behavior.

## 9. `tapTag/.gitignore`

Purpose:
Keeps local build/cache and secret-like files out of version control.

Why it matters here:
Especially important because `.env`, `.expo`, and other local-only artifacts should not pollute commits.

## 10. `tapTag/.vscode/extensions.json` and `tapTag/.vscode/settings.json`

Purpose:
Workspace editor convenience for VS Code users.

These are optional quality-of-life files, not product logic.

## 11. `tapTag/README.md`

Purpose:
Developer setup guide for the app folder.

What it currently documents well:
- product framing
- demo tester flow
- startup flow
- Tailscale/tunnel networking notes
- current feature set

Why it matters:
It is the first thing a fresh clone needs after dependencies are installed.

## 12. `tapTag/assets/images/*`

Purpose:
Application icons, splash imagery, and favicon.

Current role:
Mostly branding/packaging assets. They matter to Expo and app identity, but they do not affect the recommendation logic.

## 13. Root docs you should treat as the project-reading order

- `TAPTAG_CANONICAL_CONTEXT.md`
  Product source of truth.
- `CODEBASE_GUIDE.md`
  Architecture and code walkthrough.
- `CONFIG_GUIDE.md`
  Explanation of config/manifests/tooling files.
- `tapTag/README.md`
  Local app setup and current demo-mode workflow.

## 14. Files that intentionally stay minimal

Some files are short on purpose:
- `app/index.tsx` should stay almost empty because it is just a route handoff
- `app/(auth)/_layout.tsx` should stay tiny because auth policy lives elsewhere
- `babel.config.js` should stay tiny unless tooling truly requires more
- `validation.ts` should stay tiny unless auth complexity genuinely increases

Minimal files are not necessarily underbuilt. In this repo, several of them are
small because the responsibility has been intentionally centralized elsewhere.

## 15. The simplest mental split

Think of the project in four layers:

1. Product rules
- `TAPTAG_CANONICAL_CONTEXT.md`

2. Runtime code
- `tapTag/app/*`
- `tapTag/src/*`

3. Demo data and helper scripts
- `tapTag/src/demo/*`
- `tapTag/scripts/*`

4. Tooling/config
- `tapTag/package.json`
- `tapTag/app.json`
- `tapTag/tsconfig.json`
- `tapTag/eslint.config.js`
- `tapTag/babel.config.js`
- `tapTag/eas.json`

If you read the project in that order, it makes much more sense.

## 16. Best way to study the app end to end

If your goal is to understand the live runtime flow, follow this exact path:
- `app/_layout.tsx`
- `src/context/AuthContext.tsx`
- `hooks/useAuthRedirect.ts`
- `src/config/firebase.ts`
- `src/services/firestore/cards.ts`
- `src/services/firestore/brands.ts`
- `src/services/firestore/mccMap.ts`
- `src/services/firestore/wallet.ts`
- `src/services/firestore/userProfile.ts`
- `src/services/firestore/events.ts`
- `src/utils/recommendCard.ts`
- `app/(tabs)/Cards.tsx`
- `app/(tabs)/Lab.tsx`
- `app/(tabs)/Nearby.tsx`
- `app/(tabs)/Profile.tsx`
- `src/demo/knowledge.ts`
- `src/demo/storage.ts`

That path mirrors how the product actually functions at runtime on `demo-mode`.
