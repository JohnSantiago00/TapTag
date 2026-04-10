import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../src/context/AuthContext";

export function useAuthRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    if (user && inAuthGroup) {
      router.replace("/(tabs)/Home");
    } else if (!user && !inAuthGroup) {
      router.replace("/(auth)/Login");
    }
  }, [loading, router, segments, user]);
}
