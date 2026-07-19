import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { getAllCards } from "../../src/services/data/cards";
import { updateCompanionPassRecommendation } from "../../src/services/data/companionPass";
import { trackUserEvent } from "../../src/services/data/events";
import { getNearbyMerchants, NearbyMerchant } from "../../src/services/data/places";
import { getUserProfile } from "../../src/services/data/userProfile";
import { getUserWallet } from "../../src/services/data/wallet";
import { getPaymentLearningSignals } from "../../src/services/paymentLearning";
import {
  buildPaymentPromptHref,
  cancelPaymentPromptNotification,
  PaymentPromptInput,
  schedulePaymentPromptNotification,
} from "../../src/services/paymentPrompt";
import { getDistance } from "../../src/utils/distance";
import {
  NEARBY_AUTO_REFRESH_MS,
  shouldRefreshNearby,
} from "../../src/utils/nearbyRefresh";
import type { NearbyLookupLocation } from "../../src/utils/nearbyRefresh";
import {
  BACKGROUND_NOTIFICATION_COOLDOWN_MS,
  BACKGROUND_NOTIFICATION_DELAY_SECONDS,
} from "../../src/utils/notificationPolicy";
import { recommendBestCardForCategory } from "../../src/utils/recommendCard";
import { getTabScrollContentStyle } from "../../src/styles/layout";
import { ScreenHeader } from "../../src/components/AppChrome";
import { colors, radii, shadows, spacing } from "../../src/styles/theme";

/*
  File role:
  Nearby is the live contextual recommendation loop.

  Mental model:
  get location -> query live nearby merchants -> resolve category -> recommend
  from wallet -> show nudge -> track whether the user opened or dismissed it.

  Location is sent to the backend only for this user-initiated foreground lookup.
  It is not persisted and no background watcher runs from this screen.
*/

const NEARBY_RADIUS_METERS = 300;

type NearbyMatch = {
  brand: NearbyMerchant;
  distanceMeters: number;
  normalizedCategory: string;
  recommendation: ReturnType<typeof recommendBestCardForCategory>;
};

type NearbyLoadOptions = {
  showFullScreenLoader?: boolean;
  manualRefresh?: boolean;
};

// Nearby is the live version of the Lab loop. Instead of a manually selected
// merchant, it queries live place data from the backend and then runs the same
// recommendation engine.
export default function Nearby() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lookupInProgress, setLookupInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking your current location...");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [match, setMatch] = useState<NearbyMatch | null>(null);
  const [nearbyMerchants, setNearbyMerchants] = useState<NearbyMatch[]>([]);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [dismissedRecommendationKey, setDismissedRecommendationKey] =
    useState<string | null>(null);
  const lastTrackedRecommendationKey = useRef<string | null>(null);
  const pendingBackgroundNotification = useRef<string | null>(null);
  const lastBackgroundNotification = useRef<{ key: string; scheduledAtMs: number } | null>(null);
  const appState = useRef(AppState.currentState);
  const requestSequence = useRef(0);
  const lookupInProgressRef = useRef(false);
  const lastSuccessfulLookup = useRef<NearbyLookupLocation | null>(null);

  useEffect(() => () => {
    requestSequence.current += 1;
  }, []);

  // This loader asks for location, makes one live merchant lookup, and computes
  // recommendations locally without storing the user's coordinates.
  const loadNearbyRecommendation = useCallback(async ({
    showFullScreenLoader = true,
    manualRefresh = false,
  }: NearbyLoadOptions = {}) => {
    if (!user) return;
    if (lookupInProgressRef.current) {
      setStatus("A nearby check is already in progress.");
      return;
    }

    lookupInProgressRef.current = true;
    setLookupInProgress(true);
    const requestId = ++requestSequence.current;
    const isCurrentRequest = () => requestSequence.current === requestId;

    try {
      if (showFullScreenLoader && !lastSuccessfulLookup.current) {
        setLoading(true);
        setMatch(null);
        setNearbyMerchants([]);
      }
      setError(null);
      setStatus("Checking your current location...");

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!isCurrentRequest()) return;

      if (permission.status !== "granted") {
        setStatus(
          permission.canAskAgain
            ? "Location permission is needed to find nearby merchants."
            : "Location access is off. Enable it in device settings to use Nearby."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!isCurrentRequest()) return;

      const refreshDecision = shouldRefreshNearby({
        previous: lastSuccessfulLookup.current,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracyMeters: location.coords.accuracy,
        nowMs: Date.now(),
        manual: manualRefresh,
      });
      if (!refreshDecision.refresh) {
        const ageSeconds = Math.max(1, Math.round(refreshDecision.ageMs / 1000));
        setStatus(
          refreshDecision.reason === "manual_cooldown"
            ? `Nearby was just updated ${ageSeconds}s ago. Try again shortly.`
            : `Nearby results are current · checked ${ageSeconds}s ago.`
        );
        return;
      }

      const [cards, wallet, profile, loadedLearningSignals] = await Promise.all([
        getAllCards(),
        getUserWallet(user.uid),
        getUserProfile(user.uid).catch(() => null),
        getPaymentLearningSignals(user.uid),
      ]);
      if (!isCurrentRequest()) return;

      setNotificationsEnabled(Boolean(profile?.notificationsEnabled));

      const walletCardIds = new Set(
        wallet.filter((item) => item.enabled).map((item) => item.id)
      );
      const walletCards = cards.filter((card) => walletCardIds.has(card.id));

      if (!walletCards.length) {
        setStatus("Add at least one card to your wallet to get nearby picks.");
        return;
      }

      // Do not spend a billable Places request until the user has wallet cards
      // that can actually produce a recommendation.
      const places = await getNearbyMerchants(
        location.coords.latitude,
        location.coords.longitude,
        NEARBY_RADIUS_METERS
      );
      if (!isCurrentRequest()) return;

      lastSuccessfulLookup.current = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        completedAtMs: Date.now(),
      };

      const matches = places
        .map((place) => ({
          brand: place,
          distanceMeters: getDistance(
            location.coords.latitude,
            location.coords.longitude,
            place.latitude,
            place.longitude
          ),
          normalizedCategory: place.normalizedCategory,
          recommendation: recommendBestCardForCategory(walletCards, place.normalizedCategory, {
            merchantName: place.name,
            learningSignals: loadedLearningSignals,
          }),
        }))
        .sort((left, right) => left.distanceMeters - right.distanceMeters);

      setNearbyMerchants(matches);
      setMatch(matches[0] ?? null);
      setStatus(
        matches.length
          ? `Updated now · ${matches.length} supported merchant${matches.length === 1 ? "" : "s"} within ${NEARBY_RADIUS_METERS}m.`
          : "No supported merchants were found within a short walk."
      );
    } catch (err) {
      if (!isCurrentRequest()) return;
      console.error("Error loading nearby recommendation:", err);
      setError("TapTag couldn’t check nearby merchants right now.");
    } finally {
      lookupInProgressRef.current = false;
      if (isCurrentRequest()) {
        setLookupInProgress(false);
        setLoading(false);
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      void loadNearbyRecommendation();
    }, [loadNearbyRecommendation, user])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNearbyRecommendation({
        showFullScreenLoader: false,
        manualRefresh: true,
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadNearbyRecommendation]);

  const providerAttribution = useMemo(() => {
    const providers = new Set(
      nearbyMerchants
        .slice(0, 6)
        .flatMap((merchantMatch) => merchantMatch.brand.attributions)
        .map((attribution) => attribution.provider)
        .filter((provider) => provider !== "Google")
    );
    return providers.size
      ? `Google Maps · Data: ${Array.from(providers).join(", ")}`
      : "Google Maps";
  }, [nearbyMerchants]);

  const recommendationKey = match
    ? [
        match.brand.id,
        match.normalizedCategory,
        match.recommendation.bestCard?.id ?? "none",
        Math.round(match.distanceMeters),
      ].join("|")
    : null;

  // This text is the compact nudge version of the full recommendation detail.
  const nudgeText =
    match?.recommendation.bestCard && match.normalizedCategory
      ? `Use ${match.recommendation.bestCard.name} here for better ${match.normalizedCategory} rewards.`
      : null;
  const isDismissed =
    recommendationKey !== null && dismissedRecommendationKey === recommendationKey;
  const showGuidanceCard = !match || isDismissed;

  const paymentPromptInput = useMemo<PaymentPromptInput | null>(() => {
    if (!match?.recommendation.bestCard) {
      return null;
    }

    return {
      source: "nearby",
      merchantName: match.brand.name,
      normalizedCategory: match.normalizedCategory,
      recommendedCardProductId: match.recommendation.bestCard.id,
      recommendedCardName: match.recommendation.bestCard.name,
      rewardRate: match.recommendation.bestRate,
      reason: match.recommendation.reason,
    };
  }, [match]);

  // The in-app nudge is enough while TapTag is active. Schedule the native
  // notification only as the user leaves the app, cancel it if they return
  // before delivery, and require a recent location result for accuracy.
  useEffect(() => {
    let disposed = false;

    const cancelPending = () => {
      const identifier = pendingBackgroundNotification.current;
      pendingBackgroundNotification.current = null;
      void cancelPaymentPromptNotification(identifier);
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (nextState === "active") {
        cancelPending();
        return;
      }

      if (
        previousState !== "active" ||
        !notificationsEnabled ||
        !paymentPromptInput ||
        !recommendationKey
      ) {
        return;
      }

      const now = Date.now();
      const lookupAge = now - (lastSuccessfulLookup.current?.completedAtMs ?? 0);
      if (lookupAge > NEARBY_AUTO_REFRESH_MS) return;

      const lastNotification = lastBackgroundNotification.current;
      if (
        lastNotification?.key === recommendationKey &&
        now - lastNotification.scheduledAtMs < BACKGROUND_NOTIFICATION_COOLDOWN_MS
      ) {
        return;
      }

      schedulePaymentPromptNotification(
        paymentPromptInput,
        BACKGROUND_NOTIFICATION_DELAY_SECONDS
      ).then((identifier) => {
        if (!identifier) return;
        if (disposed || AppState.currentState === "active") {
          void cancelPaymentPromptNotification(identifier);
          return;
        }

        pendingBackgroundNotification.current = identifier;
        lastBackgroundNotification.current = {
          key: recommendationKey,
          scheduledAtMs: Date.now(),
        };
      }).catch((notificationError) => {
        console.error("Error scheduling background payment prompt:", notificationError);
      });
    });

    return () => {
      disposed = true;
      subscription.remove();
      cancelPending();
    };
  }, [notificationsEnabled, paymentPromptInput, recommendationKey]);

  // A new recommendation closes the expanded details view so the screen does not
  // show stale detail content for a prior merchant.
  useEffect(() => {
    if (!recommendationKey) {
      setIsRecommendationOpen(false);
      return;
    }

    setIsRecommendationOpen(false);
  }, [recommendationKey]);

  // Dedupe shown events so refreshing or selecting the same merchant does not
  // spam analytics for an unchanged recommendation.
  useEffect(() => {
    if (!user || !match?.recommendation.bestCard || !recommendationKey) {
      return;
    }

    if (lastTrackedRecommendationKey.current === recommendationKey) {
      return;
    }

    lastTrackedRecommendationKey.current = recommendationKey;

    trackUserEvent(user.uid, {
      eventType: "recommendation_shown",
      source: "nearby",
      brandId: match.brand.id,
      brandName: match.brand.name,
      recommendedCardProductId: match.recommendation.bestCard.id,
      recommendedCardName: match.recommendation.bestCard.name,
      normalizedCategory: match.normalizedCategory,
      distanceMeters: Math.round(match.distanceMeters),
      metadata: {
        rewardRate: match.recommendation.bestRate,
      },
    }).catch((trackingError) => {
      console.error("Error tracking nearby recommendation event:", trackingError);
    });

    updateCompanionPassRecommendation(user.uid, {
      source: "nearby",
      merchantName: match.brand.name,
      normalizedCategory: match.normalizedCategory,
      recommendedCardProductId: match.recommendation.bestCard.id,
      recommendedCardName: match.recommendation.bestCard.name,
      rewardRate: match.recommendation.bestRate,
      reason: match.recommendation.reason,
    }).catch((passError) => {
      console.error("Error updating nearby companion pass preview:", passError);
    });

  }, [match, recommendationKey, user]);

  // Open is a meaningful interaction, it tells us the nudge was interesting
  // enough for the user to inspect further.
  async function handleOpenPaymentPrompt() {
    if (!user || !match?.recommendation.bestCard) {
      return;
    }

    const input = paymentPromptInput;
    if (!input) return;

    try {
      await trackUserEvent(user.uid, {
        eventType: "payment_prompt_opened",
        source: "nearby",
        brandId: match.brand.id,
        brandName: match.brand.name,
        recommendedCardProductId: match.recommendation.bestCard.id,
        recommendedCardName: match.recommendation.bestCard.name,
        normalizedCategory: match.normalizedCategory,
        distanceMeters: Math.round(match.distanceMeters),
        metadata: {
          rewardRate: match.recommendation.bestRate,
          openMethod: "nearby_nudge",
        },
      });
    } catch (trackingError) {
      console.error("Error tracking nearby payment prompt open:", trackingError);
    }

    router.push(buildPaymentPromptHref(input));
  }

  async function handleOpenRecommendationDetails() {
    if (!user || !match?.recommendation.bestCard) {
      return;
    }

    setIsRecommendationOpen(true);

    try {
      await trackUserEvent(user.uid, {
        eventType: "recommendation_opened",
        source: "nearby",
        brandId: match.brand.id,
        brandName: match.brand.name,
        recommendedCardProductId: match.recommendation.bestCard.id,
        recommendedCardName: match.recommendation.bestCard.name,
        normalizedCategory: match.normalizedCategory,
        distanceMeters: Math.round(match.distanceMeters),
      });
    } catch (trackingError) {
      console.error("Error tracking nearby recommendation details open:", trackingError);
    }
  }

  // Dismiss is equally useful because it helps distinguish ignored vs examined
  // recommendations in this thin event model.
  async function handleDismissRecommendation() {
    if (!user || !match?.recommendation.bestCard || !recommendationKey) {
      return;
    }

    setDismissedRecommendationKey(recommendationKey);
    setIsRecommendationOpen(false);

    try {
      await trackUserEvent(user.uid, {
        eventType: "recommendation_dismissed",
        source: "nearby",
        brandId: match.brand.id,
        brandName: match.brand.name,
        recommendedCardProductId: match.recommendation.bestCard.id,
        recommendedCardName: match.recommendation.bestCard.name,
        normalizedCategory: match.normalizedCategory,
        distanceMeters: Math.round(match.distanceMeters),
      });
    } catch (trackingError) {
      console.error("Error tracking nearby recommendation dismiss:", trackingError);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <Text style={styles.title}>Nearby</Text>
        <Text style={styles.status}>
          Sign in and add wallet cards to use nearby recommendations.
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <ActivityIndicator color="#0af" />
        <Text style={styles.status}>Finding merchants around you…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Nearby is unavailable</Text>
        <Text style={styles.status}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => void loadNearbyRecommendation({ manualRefresh: true })}
          disabled={lookupInProgress}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
        <ScreenHeader
          eyebrow="Location intelligence"
          title="Around you"
          subtitle="Find real merchants nearby and see the best card already in your wallet."
          right={
            <View style={[styles.notificationPill, notificationsEnabled && styles.notificationPillActive]}>
              <Ionicons name={notificationsEnabled ? "notifications" : "notifications-off-outline"} size={16} color={notificationsEnabled ? colors.accent : colors.textMuted} />
            </View>
          }
        />

        {nudgeText && !isDismissed ? (
          <View style={styles.nudgeCard}>
            <View style={styles.nudgeTopRow}>
              <View style={styles.readyPill}><View style={styles.readyDot} /><Text style={styles.readyText}>Ready to use</Text></View>
              <Text style={styles.distanceText}>{match ? `${Math.round(match.distanceMeters)}m away` : "Nearby"}</Text>
            </View>
            <Text style={styles.nudgeMerchant}>{match?.brand.name}</Text>
            <Text style={styles.nudgeCardName}>{match?.recommendation.bestCard?.name}</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardRate}>{match?.recommendation.bestRate}x</Text>
              <Text style={styles.rewardCategory}>{match?.normalizedCategory}</Text>
            </View>
            <View style={styles.nudgeActions}>
              <TouchableOpacity
                style={styles.nudgeButtonPrimary}
                onPress={handleOpenPaymentPrompt}
              >
                <Ionicons name="wallet-outline" size={18} color={colors.accentInk} />
                <Text style={styles.nudgeButtonPrimaryText}>Use this card</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeButtonSecondary}
                onPress={handleOpenRecommendationDetails}
              >
                <Text style={styles.nudgeButtonSecondaryText}>Why this card</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.dismissLink} onPress={handleDismissRecommendation}><Text style={styles.dismissText}>Not now</Text></TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.locationCard}>
          <View style={styles.radarWrap}>
            <View style={styles.radarOuter}><View style={styles.radarInner}><View style={styles.radarCore} /></View></View>
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.cardTitle}>Nearby status</Text>
            <Text style={styles.status}>{status}</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, lookupInProgress && styles.refreshButtonDisabled]}
            onPress={() => void loadNearbyRecommendation({
              showFullScreenLoader: false,
              manualRefresh: true,
            })}
            disabled={lookupInProgress}
            accessibilityLabel="Refresh nearby merchants"
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {nearbyMerchants.length ? (
          <View style={styles.merchantCard}>
            <Text style={[styles.cardTitle, styles.merchantTitle]}>Places near you</Text>
            <Text style={styles.merchantHelp}>Choose the place you’re paying at.</Text>
            {nearbyMerchants.slice(0, 6).map((merchantMatch) => {
              const selected = merchantMatch.brand.id === match?.brand.id;
              return (
                <TouchableOpacity
                  key={merchantMatch.brand.id}
                  style={[styles.merchantRow, selected && styles.merchantRowSelected]}
                  onPress={() => {
                    setDismissedRecommendationKey(null);
                    setMatch(merchantMatch);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.merchantRowCopy}>
                    <Text style={styles.merchantRowName}>{merchantMatch.brand.name}</Text>
                    <Text style={styles.merchantRowMeta}>
                      {merchantMatch.normalizedCategory} · {Math.round(merchantMatch.distanceMeters)}m
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "chevron-forward"}
                    size={20}
                    color={selected ? colors.accent : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
            <Text style={styles.googleAttribution}>{providerAttribution}</Text>
          </View>
        ) : null}

        {showGuidanceCard ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="walk-outline" size={25} color={colors.blue} />
            <View style={styles.emptyStateCopy}>
              <Text style={styles.emptyStateTitle}>{isDismissed ? "Recommendation dismissed" : "Check again when you change locations"}</Text>
              <Text style={styles.status}>
              {isDismissed
                ? "Refresh when you want another nearby recommendation."
                : "TapTag checks only when you open or refresh this screen. Your coordinates are not saved."}
              </Text>
            </View>
          </View>
        ) : null}

        {match && (!nudgeText || isRecommendationOpen) ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}><Ionicons name="sparkles" size={19} color={colors.accent} /><Text style={styles.cardTitle}>Why it wins</Text></View>
            <Text style={styles.detailReason}>{match.recommendation.reason}</Text>
            <View style={styles.detailMetaRow}>
              <View style={styles.detailMeta}><Text style={styles.detailMetaLabel}>Merchant</Text><Text style={styles.detailMetaValue}>{match.brand.name}</Text></View>
              <View style={styles.detailMeta}><Text style={styles.detailMetaLabel}>Category</Text><Text style={styles.detailMetaValue}>{match.normalizedCategory}</Text></View>
            </View>
            {match.recommendation.bestCard ? (
              <TouchableOpacity
                style={styles.detailButton}
                onPress={handleOpenPaymentPrompt}
              >
                <Text style={styles.detailButtonText}>Continue with {match.recommendation.bestCard.name}</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.accentInk} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  notificationPill: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  notificationPillActive: { backgroundColor: "#123229", borderColor: "#245B49" },
  nudgeCard: {
    backgroundColor: colors.surfaceRaised, borderColor: "#315644", borderRadius: radii.xlarge, borderWidth: 1, marginBottom: spacing.lg, padding: spacing.lg, ...shadows.soft,
  },
  nudgeTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg },
  readyPill: { alignItems: "center", backgroundColor: "#15372C", borderRadius: radii.pill, flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingVertical: 6 },
  readyDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  readyText: { color: colors.accent, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  distanceText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  nudgeMerchant: { color: colors.textSecondary, fontSize: 14, fontWeight: "700", marginBottom: 5 },
  nudgeCardName: { color: colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.7, lineHeight: 31 },
  rewardRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  rewardRate: { color: colors.accent, fontSize: 22, fontWeight: "900" },
  rewardCategory: { backgroundColor: colors.surfaceSoft, borderRadius: radii.pill, color: colors.blue, fontSize: 12, fontWeight: "800", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6 },
  nudgeActions: {
    flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg,
  },
  nudgeButtonPrimary: {
    alignItems: "center", backgroundColor: colors.accent, borderRadius: radii.medium, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48,
  },
  nudgeButtonPrimaryText: {
    color: colors.accentInk, fontSize: 14, fontWeight: "900",
  },
  nudgeButtonSecondary: {
    alignItems: "center", backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48,
  },
  nudgeButtonSecondaryText: {
    color: colors.text, fontSize: 13, fontWeight: "800",
  },
  dismissLink: { alignSelf: "center", marginTop: spacing.md, padding: 6 },
  dismissText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  locationCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  radarWrap: { alignItems: "center", height: 48, justifyContent: "center", width: 48 },
  radarOuter: { alignItems: "center", borderColor: "#2A5C70", borderRadius: 22, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  radarInner: { alignItems: "center", borderColor: colors.blue, borderRadius: 14, borderWidth: 1, height: 28, justifyContent: "center", width: 28 },
  radarCore: { backgroundColor: colors.blue, borderRadius: 5, height: 9, width: 9 },
  locationCopy: { flex: 1 },
  merchantCard: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden", paddingTop: spacing.md },
  merchantTitle: { paddingHorizontal: spacing.md },
  merchantHelp: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  merchantRow: { alignItems: "center", borderTopColor: colors.borderSoft, borderTopWidth: 1, flexDirection: "row", minHeight: 58, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  merchantRowSelected: { backgroundColor: "#10271F" },
  merchantRowCopy: { flex: 1, paddingRight: spacing.sm },
  merchantRowName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  merchantRowMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  googleAttribution: { borderTopColor: colors.borderSoft, borderTopWidth: 1, color: colors.textSecondary, fontSize: 12, fontWeight: "400", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: "right" },
  cardTitle: {
    color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 5, paddingHorizontal: 0,
  },
  refreshButton: {
    alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: 13, height: 40, justifyContent: "center", width: 40,
  },
  refreshButtonDisabled: { opacity: 0.5 },
  emptyStateCard: { alignItems: "flex-start", backgroundColor: colors.surfaceSoft, borderRadius: radii.large, flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  emptyStateCopy: { flex: 1 },
  emptyStateTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 5 },
  detailCard: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  detailHeader: { alignItems: "center", flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  detailReason: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  detailMetaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  detailMeta: { backgroundColor: colors.surfaceSoft, borderRadius: radii.small, flex: 1, padding: spacing.sm },
  detailMetaLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", marginBottom: 4, textTransform: "uppercase" },
  detailMetaValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  detailButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: radii.medium, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: spacing.md, minHeight: 48, paddingHorizontal: spacing.md },
  detailButtonText: { color: colors.accentInk, flexShrink: 1, fontSize: 13, fontWeight: "900" },
  retryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: "700",
  },
  status: {
    color: colors.textSecondary, fontSize: 13, lineHeight: 19,
  },
});
