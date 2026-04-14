import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import "../src/config/firebase";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

/*
  File role:
  Root app shell for Expo Router.

  It is responsible for three global concerns only:
  - initializing Firebase side effects
  - providing auth context
  - preventing route rendering until auth state is known
*/

// RootNavigator exists so auth state can be resolved before Expo Router renders
// screens. That prevents the common flash where a logged-in user briefly sees
// the auth stack, or a logged-out user briefly sees the app tabs.
function RootNavigator() {
  const { loading } = useAuth();
  useAuthRedirect();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {/* This spinner is not just cosmetic, it prevents route flicker while
            Firebase restores persisted auth state from AsyncStorage. */}
        <ActivityIndicator color="#0af" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

// RootLayout is intentionally thin. It only wires global providers and leaves
// product logic to screen-level code and Firestore services.
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
});
