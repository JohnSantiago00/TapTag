import { Stack } from "expo-router";

/*
  File role:
  Tiny stack wrapper for auth screens.

  We hide headers here because Login and Sign Up are designed as full-screen
  branded entry screens rather than nested pages.
*/

// Auth screens intentionally share a tiny layout. All navigation decisions are
// handled by the auth redirect hook so the auth group can stay presentation-only.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
