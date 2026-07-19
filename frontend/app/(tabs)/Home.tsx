import { Ionicons } from "@expo/vector-icons";
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
import { BrandMark, SectionHeading } from "../../src/components/AppChrome";
import { useAuth } from "../../src/context/AuthContext";
import { getRecentUserEvents, TapTagEvent } from "../../src/services/data/events";
import { getUserProfile } from "../../src/services/data/userProfile";
import { getUserWallet } from "../../src/services/data/wallet";
import { buildPaymentPromptHref } from "../../src/services/paymentPrompt";
import { getTabScrollContentStyle } from "../../src/styles/layout";
import { colors, radii, shadows, spacing } from "../../src/styles/theme";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [walletCount, setWalletCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<TapTagEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadHomeState = useCallback(async () => {
    if (!user) return;
    try {
      setLoadFailed(false);
      const [profile, wallet, events] = await Promise.all([
        getUserProfile(user.uid),
        getUserWallet(user.uid),
        getRecentUserEvents(user.uid, 12),
      ]);
      setDisplayName(profile?.displayName ?? null);
      setWalletCount(wallet.filter((item) => item.enabled).length);
      setRecentEvents(events);
    } catch (error) {
      console.error("Error loading home state:", error);
      setLoadFailed(true);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadHomeState(); }, [loadHomeState]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHomeState();
    setRefreshing(false);
  }, [loadHomeState]);

  const latestRecommendation = recentEvents.find((event) => event.recommendedCardName);
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Good to see you, ${firstName}` : "Make every swipe count";

  function handleOpenPayPrompt() {
    if (!latestRecommendation?.recommendedCardName) {
      router.push("/(tabs)/Lab");
      return;
    }
    router.push(buildPaymentPromptHref({
      source: latestRecommendation.source === "nearby" ? "nearby" : "lab",
      merchantName: latestRecommendation.brandName,
      merchantMcc: latestRecommendation.merchantMcc,
      normalizedCategory: latestRecommendation.normalizedCategory,
      recommendedCardProductId: latestRecommendation.recommendedCardProductId,
      recommendedCardName: latestRecommendation.recommendedCardName,
      rewardRate: typeof latestRecommendation.metadata?.rewardRate === "number"
        ? latestRecommendation.metadata.rewardRate
        : undefined,
    }));
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={getTabScrollContentStyle(width, insets)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <BrandMark />
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/Profile")}
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText}>{firstName?.[0]?.toUpperCase() ?? "T"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.intro}>Your wallet, optimized for wherever you’re headed next.</Text>

        {walletCount === 0 ? (
          <View style={styles.onboardingHero}>
            <View style={styles.heroIcon}><Ionicons name="wallet-outline" size={27} color={colors.accentInk} /></View>
            <Text style={styles.onboardingTitle}>Build your smart wallet</Text>
            <Text style={styles.onboardingBody}>Add the cards you already carry. TapTag only saves the product and optional last four—never payment credentials.</Text>
            <TouchableOpacity style={styles.heroButton} onPress={() => router.push("/(tabs)/Cards")}>
              <Text style={styles.heroButtonText}>Add your cards</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.accentInk} />
            </TouchableOpacity>
          </View>
        ) : latestRecommendation?.recommendedCardName ? (
          <TouchableOpacity style={styles.recommendationHero} onPress={handleOpenPayPrompt} activeOpacity={0.9}>
            <View style={styles.recommendationTopRow}>
              <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Latest pick</Text></View>
              <Ionicons name="arrow-up-outline" size={20} color={colors.accent} style={styles.rotatedArrow} />
            </View>
            <Text style={styles.merchantName}>{latestRecommendation.brandName ?? "Your last merchant"}</Text>
            <Text style={styles.recommendedCard}>{latestRecommendation.recommendedCardName}</Text>
            <View style={styles.recommendationMeta}>
              {latestRecommendation.normalizedCategory ? <Text style={styles.metaPill}>{latestRecommendation.normalizedCategory}</Text> : null}
              {typeof latestRecommendation.metadata?.rewardRate === "number" ? <Text style={styles.rateText}>{latestRecommendation.metadata.rewardRate}x rewards</Text> : null}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.recommendationHero} onPress={() => router.push("/(tabs)/Lab")} activeOpacity={0.9}>
            <View style={styles.heroIconDark}><Ionicons name="sparkles-outline" size={25} color={colors.accent} /></View>
            <Text style={styles.merchantName}>Find your best card</Text>
            <Text style={styles.emptyRecommendationBody}>Choose a merchant and get a clear, wallet-specific recommendation in seconds.</Text>
            <Text style={styles.inlineAction}>Get a recommendation <Ionicons name="arrow-forward" size={14} color={colors.accent} /></Text>
          </TouchableOpacity>
        )}

        <SectionHeading title="Quick actions" />
        <View style={styles.actionGrid}>
          <QuickAction icon="search-outline" title="Find a card" subtitle="Search by merchant" color={colors.violet} onPress={() => router.push("/(tabs)/Lab")} />
          <QuickAction icon="navigate-outline" title="Nearby" subtitle="Location-aware picks" color={colors.blue} onPress={() => router.push("/(tabs)/Nearby")} />
          <QuickAction icon="card-outline" title="My wallet" subtitle={`${walletCount} ${walletCount === 1 ? "card" : "cards"}`} color={colors.accent} onPress={() => router.push("/(tabs)/Cards")} />
          <QuickAction icon="shield-checkmark-outline" title="Privacy" subtitle="Strict by default" color={colors.warning} onPress={() => router.push("/(tabs)/Profile")} />
        </View>

        {loadFailed ? (
          <TouchableOpacity style={styles.inlineError} onPress={loadHomeState}>
            <Ionicons name="cloud-offline-outline" size={19} color={colors.warning} />
            <Text style={styles.inlineErrorText}>Some account data is unavailable. Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        <SectionHeading title="Recent activity" action="See profile" onAction={() => router.push("/(tabs)/Profile")} />
        <View style={styles.activitySurface}>
          {recentEvents.filter(isUserFacingEvent).slice(0, 3).length ? (
            recentEvents.filter(isUserFacingEvent).slice(0, 3).map((event, index, visible) => (
              <View key={event.id ?? `${event.eventType}-${event.occurredAt}`} style={[styles.activityRow, index < visible.length - 1 && styles.activityRowBorder]}>
                <View style={styles.activityIcon}><Ionicons name={activityIcon(event)} size={18} color={colors.accent} /></View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>{activityTitle(event)}</Text>
                  <Text style={styles.activityMeta}>{formatRelativeActivityDate(event.occurredAt)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyActivity}>
              <Ionicons name="pulse-outline" size={21} color={colors.textMuted} />
              <Text style={styles.emptyActivityText}>Recommendations and wallet updates will appear here.</Text>
            </View>
          )}
        </View>

        <View style={styles.privacyStrip}>
          <Ionicons name="lock-closed" size={16} color={colors.accent} />
          <Text style={styles.privacyText}>No full card numbers. No bank credentials. No location history.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, title, subtitle, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={22} color={color} /></View>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function isUserFacingEvent(event: TapTagEvent) {
  return ["recommendation_opened", "recommendation_shown", "wallet_updated", "payment_prompt_confirmed"].includes(event.eventType);
}

function activityIcon(event: TapTagEvent): keyof typeof Ionicons.glyphMap {
  if (event.eventType === "wallet_updated") return "card-outline";
  if (event.eventType === "payment_prompt_confirmed") return "checkmark-circle-outline";
  return "sparkles-outline";
}

function activityTitle(event: TapTagEvent) {
  if (event.eventType === "wallet_updated") return "Wallet updated";
  if (event.eventType === "payment_prompt_confirmed") return `Used ${event.recommendedCardName ?? "recommended card"}`;
  return event.recommendedCardName ? `${event.recommendedCardName} recommended${event.brandName ? ` at ${event.brandName}` : ""}` : "New recommendation";
}

function formatRelativeActivityDate(value: string) {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xl },
  avatar: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  avatarText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  greeting: { color: colors.text, fontSize: 31, fontWeight: "900", letterSpacing: -1.2, lineHeight: 37 },
  intro: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg, marginTop: spacing.xs },
  onboardingHero: { backgroundColor: colors.accent, borderRadius: radii.xlarge, marginBottom: spacing.xl, padding: spacing.lg, ...shadows.soft },
  heroIcon: { alignItems: "center", backgroundColor: "rgba(5,41,29,0.1)", borderRadius: 16, height: 48, justifyContent: "center", marginBottom: spacing.md, width: 48 },
  onboardingTitle: { color: colors.accentInk, fontSize: 24, fontWeight: "900", letterSpacing: -0.7 },
  onboardingBody: { color: "#174A39", fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  heroButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.white, borderRadius: radii.medium, flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 13 },
  heroButtonText: { color: colors.accentInk, fontSize: 14, fontWeight: "900" },
  recommendationHero: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, marginBottom: spacing.xl, overflow: "hidden", padding: spacing.lg, ...shadows.soft },
  recommendationTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg },
  livePill: { alignItems: "center", backgroundColor: "#14382D", borderRadius: radii.pill, flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.accent, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  rotatedArrow: { transform: [{ rotate: "45deg" }] },
  merchantName: { color: colors.textSecondary, fontSize: 14, fontWeight: "700", marginBottom: 5 },
  recommendedCard: { color: colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.7, lineHeight: 31 },
  recommendationMeta: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  metaPill: { backgroundColor: colors.surfaceSoft, borderRadius: radii.pill, color: colors.blue, fontSize: 12, fontWeight: "800", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6 },
  rateText: { color: colors.accent, fontSize: 13, fontWeight: "900" },
  heroIconDark: { alignItems: "center", backgroundColor: "#18352D", borderRadius: 16, height: 48, justifyContent: "center", marginBottom: spacing.md, width: 48 },
  emptyRecommendationBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  inlineAction: { color: colors.accent, fontSize: 14, fontWeight: "900", marginTop: spacing.md },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  quickAction: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, minHeight: 142, padding: spacing.md, width: "48%" },
  quickActionIcon: { alignItems: "center", borderRadius: 13, height: 42, justifyContent: "center", marginBottom: spacing.md, width: 42 },
  quickActionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  quickActionSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  inlineError: { alignItems: "center", backgroundColor: colors.warningSurface, borderColor: "#4D3D18", borderRadius: radii.medium, borderWidth: 1, flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, padding: spacing.md },
  inlineErrorText: { color: "#F1DCA9", flex: 1, fontSize: 13, lineHeight: 18 },
  activitySurface: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, marginBottom: spacing.lg, overflow: "hidden" },
  activityRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, padding: spacing.md },
  activityRowBorder: { borderBottomColor: colors.borderSoft, borderBottomWidth: 1 },
  activityIcon: { alignItems: "center", backgroundColor: "#15352C", borderRadius: 13, height: 40, justifyContent: "center", width: 40 },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  activityMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  emptyActivity: { alignItems: "center", flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  emptyActivityText: { color: colors.textMuted, flex: 1, fontSize: 13, lineHeight: 19 },
  privacyStrip: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: radii.medium, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  privacyText: { color: colors.textSecondary, flex: 1, fontSize: 12, lineHeight: 17 },
});
