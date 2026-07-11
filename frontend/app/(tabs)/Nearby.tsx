import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { getAllBrands, Brand } from "../../src/services/data/brands";
import { getAllCards } from "../../src/services/data/cards";
import { updateCompanionPassRecommendation } from "../../src/services/data/companionPass";
import { trackUserEvent } from "../../src/services/data/events";
import { getAllMccMappings } from "../../src/services/data/mccMap";
import { getUserProfile } from "../../src/services/data/userProfile";
import { getUserWallet } from "../../src/services/data/wallet";
import { configureArrivalGeofencing } from "../../src/services/arrivalMonitoring";
import { getPaymentLearningSignals } from "../../src/services/paymentLearning";
import {
  buildPaymentPromptHref,
  PaymentPromptInput,
  schedulePaymentPromptNotification,
} from "../../src/services/paymentPrompt";
import {
  createArrivalDetectionState,
  evaluateArrivalDetection,
  type ArrivalDetectionState,
  type ArrivalPlace,
} from "../../src/utils/arrivalDetection";
import { recommendBestCardForCategory } from "../../src/utils/recommendCard";
import { getTabScrollContentStyle } from "../../src/styles/layout";

/*
  File role:
  Nearby is the live contextual recommendation loop.

  Mental model:
  get location -> find nearest seeded merchant -> resolve category -> recommend
  from wallet -> show nudge -> track whether the user opened or dismissed it.

  Foreground dwell detection drives the current UX. Background geofencing is
  registered behind a disabled guard for native builds that opt into it later.
*/

const NEARBY_RADIUS_METERS = 150;
const ARRIVAL_DWELL_MS = 60_000;
const ARRIVAL_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const ARRIVAL_PLACE_ID_SEPARATOR = "::";

// Fixed radius keeps the behavior easy to explain during beta testing. A future
// version might tune this dynamically or per merchant density.

type NearbyMatch = {
  brand: Brand;
  distanceMeters: number;
  normalizedCategory: string;
  recommendation: ReturnType<typeof recommendBestCardForCategory>;
};

function getArrivalPlaces(brands: Brand[]): ArrivalPlace[] {
  return brands.flatMap((brand) =>
    brand.commonLocations.map((location, index) => ({
      id: `${brand.id}${ARRIVAL_PLACE_ID_SEPARATOR}${index}`,
      name: brand.name,
      lat: location.lat,
      lon: location.lon,
      radiusMeters: NEARBY_RADIUS_METERS,
    }))
  );
}

function getBrandIdFromPlaceId(placeId: string) {
  return placeId.split(ARRIVAL_PLACE_ID_SEPARATOR)[0];
}

// Nearby is the live version of the Lab loop. Instead of a manually selected
// brand, it picks the nearest seeded merchant based on current foreground
// location and then runs the same recommendation engine.
export default function Nearby() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking your current location...");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [match, setMatch] = useState<NearbyMatch | null>(null);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [dismissedRecommendationKey, setDismissedRecommendationKey] =
    useState<string | null>(null);
  const lastTrackedRecommendationKey = useRef<string | null>(null);
  const lastScheduledPaymentPromptKey = useRef<string | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );
  const arrivalDetectionStateRef = useRef<ArrivalDetectionState>(
    createArrivalDetectionState()
  );

  // This loader asks for location, pulls the knowledge layer, derives the
  // nearest seeded merchant, and computes the best wallet card for it.
  const loadNearbyRecommendation = useCallback(async () => {
    if (!user) return;

    try {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      setLoading(true);
      setError(null);
      setMatch(null);
      setStatus("Checking your current location...");

      const [
        permission,
        brands,
        cards,
        mccMappings,
        wallet,
        profile,
        loadedLearningSignals,
      ] =
        await Promise.all([
          Location.requestForegroundPermissionsAsync(),
          getAllBrands(),
          getAllCards(),
          getAllMccMappings(),
          getUserWallet(user.uid),
          getUserProfile(user.uid).catch(() => null),
          getPaymentLearningSignals(user.uid),
        ]);

      setNotificationsEnabled(Boolean(profile?.notificationsEnabled));
      arrivalDetectionStateRef.current = createArrivalDetectionState();

      if (permission.status !== "granted") {
        setStatus("Location permission was not granted.");
        return;
      }

      const walletCardIds = new Set(
        wallet.filter((item) => item.enabled).map((item) => item.id)
      );
      const walletCards = cards.filter((card) => walletCardIds.has(card.id));

      if (!walletCards.length) {
        setStatus("No wallet cards selected yet. Add cards in Wallet first.");
        return;
      }

      const arrivalPlaces = getArrivalPlaces(brands);
      const brandByArrivalPlaceId = new Map(
        arrivalPlaces.map((place) => [place.id, getBrandIdFromPlaceId(place.id)])
      );
      configureArrivalGeofencing(arrivalPlaces).catch((geofenceError) => {
        console.warn("Arrival geofencing is unavailable:", geofenceError);
      });

      const evaluateNearbyLocation = (location: Location.LocationObject) => {
        const detectionResult = evaluateArrivalDetection(
          arrivalPlaces,
          {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            timestampMs: location.timestamp || Date.now(),
          },
          arrivalDetectionStateRef.current,
          {
            dwellMs: ARRIVAL_DWELL_MS,
            cooldownMs: ARRIVAL_COOLDOWN_MS,
          }
        );
        arrivalDetectionStateRef.current = detectionResult.state;

        if (!detectionResult.nearestPlace) {
          setMatch(null);
          setStatus("No seeded merchant locations are available yet.");
          return;
        }

        const nearestBrandId = getBrandIdFromPlaceId(
          detectionResult.nearestPlace.place.id
        );
        const nearestBrand =
          brands.find((brand) => brand.id === nearestBrandId) ?? null;

        if (!detectionResult.nearestPlace.isInsideRadius) {
          setMatch(null);
          setStatus(
            `No seeded merchants found within ${NEARBY_RADIUS_METERS}m. Nearest known merchant: ${nearestBrand?.name ?? "Unknown"} at ${Math.round(
              detectionResult.nearestPlace.distanceMeters
            )}m.`
          );
          return;
        }

        if (!detectionResult.arrivals.length) {
          setStatus(
            `Near ${nearestBrand?.name ?? "a seeded merchant"}. Waiting for a ${Math.round(
              ARRIVAL_DWELL_MS / 1000
            )}s dwell before nudging.`
          );
          return;
        }

        const arrival = detectionResult.arrivals[0];
        const arrivedBrandId = brandByArrivalPlaceId.get(arrival.place.id);
        const arrivedBrand =
          brands.find((brand) => brand.id === arrivedBrandId) ?? null;

        if (!arrivedBrand) {
          setStatus("Arrival detected, but the merchant could not be resolved.");
          return;
        }

        const mapping =
          mccMappings.find((item) => item.mcc === arrivedBrand.mcc) ?? null;
        const normalizedCategory = mapping?.normalizedCategory ?? "Other";
        const recommendation = recommendBestCardForCategory(
          walletCards,
          normalizedCategory,
          {
            merchantName: arrivedBrand.name,
            learningSignals: loadedLearningSignals,
          }
        );

        setMatch({
          brand: arrivedBrand,
          distanceMeters: arrival.distanceMeters,
          normalizedCategory,
          recommendation,
        });
        setStatus("Arrival confirmed. Nearby recommendation ready.");
      };

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      evaluateNearbyLocation(location);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 15_000,
        },
        evaluateNearbyLocation
      );
    } catch (err) {
      console.error("Error loading nearby recommendation:", err);
      setError("Could not load nearby recommendation.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      // Start the watcher only while this screen is focused. That keeps the app
      // simple and avoids pretending we have a background location system.
      loadNearbyRecommendation();

      return () => {
        locationSubscriptionRef.current?.remove();
        locationSubscriptionRef.current = null;
      };
    }, [loadNearbyRecommendation, user])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNearbyRecommendation();
    setRefreshing(false);
  }, [loadNearbyRecommendation]);

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
      merchantMcc: match.brand.mcc,
      normalizedCategory: match.normalizedCategory,
      recommendedCardProductId: match.recommendation.bestCard.id,
      recommendedCardName: match.recommendation.bestCard.name,
      rewardRate: match.recommendation.bestRate,
      reason: match.recommendation.reason,
    };
  }, [match]);

  // A new recommendation closes the expanded details view so the screen does not
  // show stale detail content for a prior merchant.
  useEffect(() => {
    if (!recommendationKey) {
      setIsRecommendationOpen(false);
      return;
    }

    setIsRecommendationOpen(false);
  }, [recommendationKey]);

  // Like Lab, Nearby dedupes shown events so the position watcher can update
  // state without spamming analytics for the same recommendation.
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
      merchantMcc: match.brand.mcc,
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
      merchantMcc: match.brand.mcc,
      normalizedCategory: match.normalizedCategory,
      recommendedCardProductId: match.recommendation.bestCard.id,
      recommendedCardName: match.recommendation.bestCard.name,
      rewardRate: match.recommendation.bestRate,
      reason: match.recommendation.reason,
    }).catch((passError) => {
      console.error("Error updating nearby companion pass preview:", passError);
    });

    // Automatic notifications are an opt-in: the user turns them on from
    // Profile. Without that consent the nudge stays in-app only.
    if (notificationsEnabled && lastScheduledPaymentPromptKey.current !== recommendationKey) {
      lastScheduledPaymentPromptKey.current = recommendationKey;
      if (paymentPromptInput) {
        schedulePaymentPromptNotification(paymentPromptInput).catch((notificationError) => {
          console.error("Error scheduling nearby payment prompt notification:", notificationError);
        });
      }
    }
  }, [match, notificationsEnabled, paymentPromptInput, recommendationKey, user]);

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
        merchantMcc: match.brand.mcc,
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
        merchantMcc: match.brand.mcc,
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
        merchantMcc: match.brand.mcc,
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
          Sign in and choose wallet cards before testing nearby recommendations.
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <ActivityIndicator color="#0af" />
        <Text style={styles.status}>Loading nearby merchant check...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Nearby Error</Text>
        <Text style={styles.status}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadNearbyRecommendation}>
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
        <Text style={styles.title}>Nearby</Text>
        <Text style={styles.subtitle}>
          Dwell-based location checks using seeded merchant locations.
        </Text>

        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>How to test Nearby</Text>
          <Text style={styles.guidanceText}>1. Make sure your Wallet has at least one selected card.</Text>
          <Text style={styles.guidanceText}>2. Allow location permission when asked.</Text>
          <Text style={styles.guidanceText}>3. Stay inside a seeded merchant radius for about a minute.</Text>
        </View>

        {nudgeText && !isDismissed ? (
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeLabel}>TapTag Nudge</Text>
            <Text style={styles.nudgeText}>{nudgeText}</Text>
            <View style={styles.nudgeActions}>
              {/* Open reveals the fuller explanation and records explicit user
                  engagement instead of assuming the shown state was enough. */}
              <TouchableOpacity
                style={styles.nudgeButtonPrimary}
                onPress={handleOpenPaymentPrompt}
              >
                <Text style={styles.nudgeButtonPrimaryText}>Show Card</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeButtonSecondary}
                onPress={handleOpenRecommendationDetails}
              >
                <Text style={styles.nudgeButtonSecondaryText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nudgeButtonSecondary}
                onPress={handleDismissRecommendation}
              >
                <Text style={styles.nudgeButtonSecondaryText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.status}>{status}</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadNearbyRecommendation}
          >
            <Text style={styles.refreshButtonText}>Refresh Nearby Check</Text>
          </TouchableOpacity>
        </View>

        {showGuidanceCard ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What to do next</Text>
          <Text style={styles.status}>
              {isDismissed
                ? "You dismissed the current nudge. Refresh Nearby Check to generate a fresh recommendation."
                : "Nearby will notify after you dwell at a seeded merchant long enough to count as an arrival."}
            </Text>
          </View>
        ) : null}

        {match && (!nudgeText || isRecommendationOpen) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nearby Recommendation</Text>
            <Text style={styles.status}>Merchant: {match.brand.name}</Text>
            <Text style={styles.status}>
              Distance: {Math.round(match.distanceMeters)}m
            </Text>
            <Text style={styles.status}>MCC: {match.brand.mcc}</Text>
            <Text style={styles.status}>
              Normalized Category: {match.normalizedCategory}
            </Text>
            <Text style={styles.status}>
              Best Card: {match.recommendation.bestCard?.name ?? "None"}
            </Text>
            <Text style={styles.status}>
              Reason: {match.recommendation.reason}
            </Text>
            {match.recommendation.bestCard ? (
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleOpenPaymentPrompt}
              >
                <Text style={styles.refreshButtonText}>Show Pay Prompt</Text>
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
    backgroundColor: "#000",
  },
  stateContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#888",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  errorTitle: {
    color: "#f55",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  guidanceCard: {
    backgroundColor: "#111822",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  guidanceTitle: {
    color: "#8ecfff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  guidanceText: {
    color: "#cfe9ff",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nudgeCard: {
    backgroundColor: "#0af",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nudgeLabel: {
    color: "#002133",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  nudgeText: {
    color: "#00131f",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  nudgeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  nudgeButtonPrimary: {
    backgroundColor: "#00131f",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 96,
  },
  nudgeButtonPrimaryText: {
    color: "#8ecfff",
    fontSize: 14,
    fontWeight: "600",
  },
  nudgeButtonSecondary: {
    backgroundColor: "#d9eefc",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 88,
  },
  nudgeButtonSecondaryText: {
    color: "#24506b",
    fontSize: 14,
    fontWeight: "600",
  },
  cardTitle: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  refreshButton: {
    marginTop: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#8ecfff",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#0af",
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "700",
  },
  status: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
});
