import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../src/context/AuthContext";

/*
  File role:
  Keeps routing policy separate from screen UI.

  Key idea:
  auth state answers "who can be where?", so redirect logic belongs in one
  shared hook instead of scattered across many components.
*/

// This hook centralizes auth-based routing so screens do not each need their
// own auth listener or redirect logic.
export function useAuthRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      // Do nothing until Firebase has resolved whether we have a session.
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    // Logged-in users should live in the tab group, logged-out users should be
    // pushed back to auth screens.
    if (user && inAuthGroup) {
      router.replace("/(tabs)/Home");
    } else if (!user && !inAuthGroup) {
      router.replace("/(auth)/Login");
    }
  }, [loading, router, segments, user]);
}
