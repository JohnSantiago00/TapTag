import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { getRecentUserEvents, TapTagEvent } from "../../src/services/data/events";
import { getUserProfile } from "../../src/services/data/userProfile";
import { getUserWallet } from "../../src/services/data/wallet";
import { buildPaymentPromptHref } from "../../src/services/paymentPrompt";
import { getTabScrollContentStyle } from "../../src/styles/layout";

/*
  File role:
  Home is the orientation screen for the whole app.

  It does not perform core recommendation logic itself. Instead, it greets the
  user, shows live setup progress derived from real account state, and routes
  toward the screens that prove the main loop: Wallet, Lab, Nearby, Profile.
*/

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [walletCount, setWalletCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<TapTagEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadHomeState = useCallback(async () => {
    if (!user) return;

    try {
      const [profile, wallet, events] = await Promise.all([
        getUserProfile(user.uid),
        getUserWallet(user.uid),
        getRecentUserEvents(user.uid, 50),
      ]);

      setDisplayName(profile?.displayName ?? null);
      setWalletCount(wallet.filter((item) => item.enabled).length);
      setRecentEvents(events);
    } catch (error) {
      // Home should stay usable even when the API is briefly unreachable; the
      // checklist simply reflects what is known.
      console.error("Error loading home state:", error);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHomeState();
    }, [loadHomeState])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHomeState();
    setRefreshing(false);
  }, [loadHomeState]);

  // Each checklist item is derived from real account state, so this doubles as
  // a live setup progress view instead of a manual to-do list.
  const hasEvent = (predicate: (event: TapTagEvent) => boolean) =>
    recentEvents.some(predicate);

  const checklist = [
    { label: "Signed in", done: Boolean(user) },
    { label: "Wallet configured", done: walletCount > 0 },
    {
      label: "Lab recommendation tested",
      done: hasEvent((event) => event.source === "lab"),
    },
    {
      label: "Nearby nudge tested",
      done: hasEvent((event) => event.source === "nearby"),
    },
    { label: "Activity tracking verified", done: recentEvents.length > 0 },
  ];
  const completedCount = checklist.filter((item) => item.done).length;
  const setupComplete = completedCount === checklist.length;
  const latestRecommendation = recentEvents.find(
    (event) => event.recommendedCardName
  );

  const greeting = displayName ? `Welcome back, ${displayName}` : "Welcome to TapTag";

  function handleOpenPayPrompt() {
    if (!latestRecommendation?.recommendedCardName) {
      router.push("/(tabs)/Lab");
      return;
    }

    router.push(
      buildPaymentPromptHref({
        source: latestRecommendation.source === "nearby" ? "nearby" : "lab",
        merchantName: latestRecommendation.brandName,
        merchantMcc: latestRecommendation.merchantMcc,
        normalizedCategory: latestRecommendation.normalizedCategory,
        recommendedCardProductId: latestRecommendation.recommendedCardProductId,
        recommendedCardName: latestRecommendation.recommendedCardName,
        rewardRate:
          typeof latestRecommendation.metadata?.rewardRate === "number"
            ? latestRecommendation.metadata.rewardRate
            : undefined,
      })
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={getTabScrollContentStyle(width, insets)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0af"
          />
        }
      >
        <Text style={styles.title}>TapTag</Text>
        <Text style={styles.subtitle}>{greeting}</Text>
        <Text style={styles.tagline}>
          The right card from your wallet, for every merchant — without storing
          card numbers, CVV, or bank credentials.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {setupComplete ? "You're all set" : `Setup progress (${completedCount}/${checklist.length})`}
          </Text>
          {checklist.map((item) => (
            <View key={item.label} style={styles.checklistRow}>
              <Text style={[styles.checklistIcon, item.done && styles.checklistIconDone]}>
                {item.done ? "✓" : "○"}
              </Text>
              <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>
                {item.label}
              </Text>
            </View>
          ))}
          {loaded && !setupComplete ? (
            <Text style={styles.helperNote}>
              {walletCount === 0
                ? "Start by adding the cards you own in Wallet."
                : "Try a recommendation in Lab, then test a live nudge in Nearby."}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          {/* These buttons are explicit instead of relying on the tab bar alone,
              because first-run clarity matters more than avoiding duplicate nav. */}
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Cards")}>
            <Text style={styles.actionButtonText}>Open Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenPayPrompt}>
            <Text style={styles.actionButtonText}>Pay Prompt</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Lab")}>
            <Text style={styles.actionButtonText}>Open Lab</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Nearby")}>
            <Text style={styles.actionButtonText}>Open Nearby</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Profile")}>
            <Text style={styles.actionButtonText}>Open Profile</Text>
          </TouchableOpacity>
          <View style={styles.actionSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How TapTag works</Text>
          <Text style={styles.cardText}>1. Add the cards you own in Wallet.</Text>
          <Text style={styles.cardText}>2. Lab shows the best card for a chosen merchant.</Text>
          <Text style={styles.cardText}>3. Nearby suggests the best card when you are close to a merchant.</Text>
          <Text style={styles.cardText}>4. Profile shows your settings and recent activity.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy first</Text>
          <Text style={styles.cardText}>
            TapTag stores card-product references only. It never stores card
            numbers, CVV, expiration dates, billing addresses, or bank
            credentials, and it never keeps a history of your exact location.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  tagline: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#0af",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#00131f",
    fontSize: 15,
    fontWeight: "700",
  },
  actionSpacer: {
    flex: 1,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checklistIcon: {
    color: "#666",
    fontSize: 16,
    width: 20,
  },
  checklistIconDone: {
    color: "#0af",
  },
  checklistText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  checklistTextDone: {
    color: "#8ecfff",
  },
  helperNote: {
    color: "#888",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  cardTitle: {
    color: "#0af",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
});
