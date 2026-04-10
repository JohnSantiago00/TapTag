import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { getAllBrands, Brand } from "../../src/services/firestore/brands";
import { getAllCards } from "../../src/services/firestore/cards";
import { trackUserEvent } from "../../src/services/firestore/events";
import { getAllMccMappings } from "../../src/services/firestore/mccMap";
import { getUserWallet } from "../../src/services/firestore/wallet";
import { getDistance } from "../../src/utils/distance";
import { recommendBestCardForCategory } from "../../src/utils/recommendCard";

const NEARBY_RADIUS_METERS = 500;

type NearbyMatch = {
  brand: Brand;
  distanceMeters: number;
  normalizedCategory: string;
  recommendation: ReturnType<typeof recommendBestCardForCategory>;
};

export default function Nearby() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking your current location...");
  const [match, setMatch] = useState<NearbyMatch | null>(null);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [dismissedRecommendationKey, setDismissedRecommendationKey] =
    useState<string | null>(null);
  const lastTrackedRecommendationKey = useRef<string | null>(null);

  const loadNearbyRecommendation = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      setMatch(null);
      setStatus("Checking your current location...");

      const [permission, brands, cards, mccMappings, wallet] =
        await Promise.all([
          Location.requestForegroundPermissionsAsync(),
          getAllBrands(),
          getAllCards(),
          getAllMccMappings(),
          getUserWallet(user.uid),
        ]);

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

      const evaluateNearbyLocation = (location: Location.LocationObject) => {
        let nearestBrand: Brand | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const brand of brands) {
          for (const merchantLocation of brand.commonLocations) {
            const distanceMeters = getDistance(
              location.coords.latitude,
              location.coords.longitude,
              merchantLocation.lat,
              merchantLocation.lon
            );

            if (distanceMeters < nearestDistance) {
              nearestBrand = brand;
              nearestDistance = distanceMeters;
            }
          }
        }

        if (!nearestBrand || !Number.isFinite(nearestDistance)) {
          setMatch(null);
          setStatus("No seeded merchant locations are available yet.");
          return;
        }

        if (nearestDistance > NEARBY_RADIUS_METERS) {
          setMatch(null);
          setStatus(
            `No seeded merchants found within ${NEARBY_RADIUS_METERS}m. Nearest known merchant: ${nearestBrand.name} at ${Math.round(
              nearestDistance
            )}m.`
          );
          return;
        }

        const mapping =
          mccMappings.find((item) => item.mcc === nearestBrand.mcc) ?? null;
        const normalizedCategory = mapping?.normalizedCategory ?? "Other";
        const recommendation = recommendBestCardForCategory(
          walletCards,
          normalizedCategory
        );

        setMatch({
          brand: nearestBrand,
          distanceMeters: nearestDistance,
          normalizedCategory,
          recommendation,
        });
        setStatus("Nearby recommendation ready.");
      };

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      evaluateNearbyLocation(location);

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 1,
          timeInterval: 1000,
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

      let locationSubscription: Location.LocationSubscription | undefined;

      (async () => {
        locationSubscription = await loadNearbyRecommendation();
      })();

      return () => {
        locationSubscription?.remove();
      };
    }, [loadNearbyRecommendation, user])
  );

  const recommendationKey = match
    ? [
        match.brand.id,
        match.normalizedCategory,
        match.recommendation.bestCard?.id ?? "none",
        Math.round(match.distanceMeters),
      ].join("|")
    : null;

  const nudgeText =
    match?.recommendation.bestCard && match.normalizedCategory
      ? `Use ${match.recommendation.bestCard.name} here for better ${match.normalizedCategory} rewards.`
      : null;
  const isDismissed =
    recommendationKey !== null && dismissedRecommendationKey === recommendationKey;

  useEffect(() => {
    if (!recommendationKey) {
      setIsRecommendationOpen(false);
      return;
    }

    setIsRecommendationOpen(false);
  }, [recommendationKey]);

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
  }, [match, recommendationKey, user]);

  async function handleOpenRecommendation() {
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
      console.error("Error tracking nearby recommendation open:", trackingError);
    }
  }

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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nearby</Text>
        <Text style={styles.subtitle}>
          Foreground location checks using seeded merchant locations.
        </Text>

        {nudgeText && !isDismissed ? (
          <View style={styles.nudgeCard}>
            <Text style={styles.nudgeLabel}>TapTag Nudge</Text>
            <Text style={styles.nudgeText}>{nudgeText}</Text>
            <View style={styles.nudgeActions}>
              <TouchableOpacity
                style={styles.nudgeButtonPrimary}
                onPress={handleOpenRecommendation}
              >
                <Text style={styles.nudgeButtonPrimaryText}>Open</Text>
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
  content: {
    padding: 24,
    paddingBottom: 40,
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
    gap: 10,
    marginTop: 14,
  },
  nudgeButtonPrimary: {
    backgroundColor: "#00131f",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  status: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
});
