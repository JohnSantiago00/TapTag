import { Redirect } from "expo-router";

/*
  File role:
  Required root index route for Expo Router.

  This file intentionally does almost nothing because the real auth-aware
  routing policy lives in the root layout + auth redirect hook.
*/

// Expo Router requires an index route. We immediately redirect to Login because
// auth redirect logic is handled globally in app/_layout.tsx.
export default function Index() {
  return <Redirect href="/(auth)/Login" />;
}
