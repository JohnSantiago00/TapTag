import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "../src/config/firebase";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { AuthProvider } from "../src/context/AuthContext";

function RootNavigator() {
  useAuthRedirect();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
