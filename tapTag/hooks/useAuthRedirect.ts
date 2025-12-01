import { useRouter, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "../src/config/firebase";

export function useAuthRedirect() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const inAuthGroup = segments[0] === "(auth)";
      if (user && inAuthGroup) {
        router.replace("/(tabs)/Home");
      } else if (!user && !inAuthGroup) {
        router.replace("/(auth)/Login");
      }
    });
    return unsubscribe;
  }, [segments]);
}
