import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../src/config/firebase";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import {
  buildPaymentPromptHref,
  configurePaymentPromptNotifications,
  isPaymentPromptNotificationData,
  openNativeWallet,
  PAYMENT_PROMPT_ACTION_OPEN_WALLET,
  PAYMENT_PROMPT_ACTION_USED_CARD,
} from "../src/services/paymentPrompt";

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
  const router = useRouter();
  useAuthRedirect();

  useEffect(() => {
    configurePaymentPromptNotifications().catch((error) => {
      console.error("Error configuring payment prompt notifications:", error);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;

        if (!isPaymentPromptNotificationData(data)) {
          return;
        }

        const shouldOpenWallet =
          response.actionIdentifier === PAYMENT_PROMPT_ACTION_OPEN_WALLET ||
          response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;
        const shouldConfirmUsed =
          response.actionIdentifier === PAYMENT_PROMPT_ACTION_USED_CARD;

        if (shouldOpenWallet) {
          const result = await openNativeWallet();
          if (!result.opened) {
            console.warn(
              "Could not open the native wallet from the notification:",
              result.reason
            );
          }
          return;
        }

        router.push(
          buildPaymentPromptHref({
            source: "notification",
            confirmUsed: shouldConfirmUsed,
            merchantName: data.merchantName,
            merchantMcc: Number(data.merchantMcc) || undefined,
            normalizedCategory: data.normalizedCategory,
            recommendedCardProductId: data.recommendedCardProductId,
            recommendedCardName: data.recommendedCardName,
            rewardRate: Number(data.rewardRate) || undefined,
            reason: data.reason,
          })
        );
      }
    );

    return () => subscription.remove();
  }, [router]);

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
// product logic to screen-level code and data services.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
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
