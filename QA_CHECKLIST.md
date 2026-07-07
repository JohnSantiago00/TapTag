# TapTag Real-Device QA Checklist

## Setup

- Backend API is running on `0.0.0.0:4000`.
- `frontend/.env` points `EXPO_PUBLIC_TAPTAG_API_BASE_URL` to the machine LAN or Tailscale IP.
- Phone can open `/health` from that API URL.
- Expo is running with `npm start`.

## Auth

- Create a new account.
- Log out.
- Log back in.
- Restart the app and confirm auth persists.

## Wallet

- Open Wallet.
- Confirm seeded card products load.
- Add at least three cards with different reward strengths.
- Remove one card.
- Confirm the wallet summary updates after each action.
- Temporarily stop the API and confirm Wallet shows a retryable error state.

## Lab

- Open Lab with no wallet cards and confirm the empty-wallet guidance.
- Select several merchants across Dining, Groceries, Gas, Travel, Transportation, Entertainment, and Online Shopping.
- Confirm the recommended card and explanation match the reward rules.
- Return to Wallet, change selected cards, then return to Lab and confirm the recommendation refreshes.

## Nearby

- Open Nearby and allow foreground location permission.
- Confirm the screen shows useful status when no seeded merchant is nearby.
- Test Refresh Nearby Check after changing wallet state.
- Deny location permission on a fresh install or OS settings reset and confirm the screen explains the blocked state.
- Confirm Open and Dismiss both work when a nudge appears.

## Profile

- Save a display name.
- Confirm selected wallet count is accurate.
- Confirm recent events appear after Wallet, Lab, and Nearby actions.
- Temporarily stop the API and confirm Profile shows a retryable load error.

## Privacy Boundary

Confirm the app never asks for or stores:

- card numbers
- CVV
- expiration dates
- billing address
- bank login credentials
- payment credentials

## Smoke Commands

```bash
npm run first-run
npm run lint
npm run test
npm run smoke:api
```
