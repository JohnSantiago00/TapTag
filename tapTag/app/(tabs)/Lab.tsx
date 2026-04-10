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
import { getAllCards, KnowledgeCard } from "../../src/services/firestore/cards";
import {
  getAllMccMappings,
  MccMapping,
} from "../../src/services/firestore/mccMap";
import { trackUserEvent } from "../../src/services/firestore/events";
import { getUserWallet, WalletCardRef } from "../../src/services/firestore/wallet";
import { recommendBestCardForCategory } from "../../src/utils/recommendCard";

export default function Lab() {
  const { user } = useAuth();
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [mccMappings, setMccMappings] = useState<MccMapping[]>([]);
  const [wallet, setWallet] = useState<WalletCardRef[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastTrackedRecommendationKey = useRef<string | null>(null);

  const loadKnowledgeLayer = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const [loadedCards, loadedBrands, loadedMccMappings, loadedWallet] =
        await Promise.all([
          getAllCards(),
          getAllBrands(),
          getAllMccMappings(),
          getUserWallet(user.uid),
        ]);

      setCards(loadedCards);
      setBrands(loadedBrands);
      setMccMappings(loadedMccMappings);
      setWallet(loadedWallet.filter((item) => item.enabled));
      setSelectedBrandId((current) => current ?? loadedBrands[0]?.id ?? null);
    } catch (err) {
      console.error("Error loading knowledge layer:", err);
      setError("Could not load Firestore knowledge-layer data.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadKnowledgeLayer();
  }, [loadKnowledgeLayer, user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadKnowledgeLayer();
    }, [loadKnowledgeLayer, user])
  );

  const walletCardIds = new Set(wallet.map((item) => item.id));
  const walletCards = cards.filter((card) => walletCardIds.has(card.id));
  const selectedBrand =
    brands.find((brand) => brand.id === selectedBrandId) ?? brands[0] ?? null;
  const selectedMccMapping =
    mccMappings.find((mapping) => mapping.mcc === selectedBrand?.mcc) ?? null;
  const normalizedCategory = selectedMccMapping?.normalizedCategory ?? "Other";
  const recommendation = selectedBrand
    ? recommendBestCardForCategory(walletCards, normalizedCategory)
    : null;

  const walletSummary = walletCards.length
    ? walletCards.map((card) => card.name).join(", ")
    : "No cards selected yet";
  const hasWalletCards = walletCards.length > 0;
  const recommendationKey = [
    selectedBrand?.id ?? "none",
    normalizedCategory,
    recommendation?.bestCard?.id ?? "none",
    walletCards.map((card) => card.id).sort().join(","),
  ].join("|");

  useEffect(() => {
    if (!user || !selectedBrand || !recommendation?.bestCard || !hasWalletCards) {
      return;
    }

    if (lastTrackedRecommendationKey.current === recommendationKey) {
      return;
    }

    lastTrackedRecommendationKey.current = recommendationKey;

    trackUserEvent(user.uid, {
      eventType: "recommendation_shown",
      source: "lab",
      brandId: selectedBrand.id,
      brandName: selectedBrand.name,
      cardProductIds: walletCards.map((card) => card.id),
      recommendedCardProductId: recommendation.bestCard.id,
      recommendedCardName: recommendation.bestCard.name,
      normalizedCategory,
      merchantMcc: selectedBrand.mcc,
      metadata: {
        rewardRate: recommendation.bestRate,
      },
    }).catch((trackingError) => {
      console.error("Error tracking lab recommendation event:", trackingError);
    });
  }, [
    hasWalletCards,
    normalizedCategory,
    recommendation?.bestCard,
    recommendation?.bestRate,
    recommendationKey,
    selectedBrand,
    user,
    walletCards,
  ]);

  if (!user) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Lab</Text>
        <Text style={styles.errorText}>
          Sign in and select wallet cards to test recommendations.
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <ActivityIndicator color="#0af" />
        <Text style={styles.stateText}>Loading TapTag knowledge layer...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Lab Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>TapTag Lab</Text>
        <Text style={styles.subtitle}>
          Guided merchant testing for the recommendation engine.
        </Text>

        <View style={styles.calloutCard}>
          <Text style={styles.calloutTitle}>How to use this screen</Text>
          <Text style={styles.calloutText}>1. Make sure your Wallet has at least one selected card.</Text>
          <Text style={styles.calloutText}>2. Tap a merchant below.</Text>
          <Text style={styles.calloutText}>3. Confirm the recommended card and explanation make sense.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendation Check</Text>
          <Text style={styles.helperText}>Wallet: {walletSummary}</Text>

          <View style={styles.pickerRow}>
            {brands.map((brand) => {
              const isSelected = brand.id === selectedBrand?.id;

              return (
                <TouchableOpacity
                  key={brand.id}
                  style={[styles.pill, isSelected && styles.pillActive]}
                  onPress={() => setSelectedBrandId(brand.id)}
                >
                  <Text
                    style={[styles.pillText, isSelected && styles.pillTextActive]}
                  >
                    {brand.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Merchant</Text>
            <Text style={styles.resultValue}>{selectedBrand?.name ?? "None"}</Text>
            <Text style={styles.resultLabel}>Best Card</Text>
            <Text style={styles.resultValue}>{recommendation?.bestCard?.name ?? "None"}</Text>
            <Text style={styles.resultLabel}>Why</Text>
            <Text style={styles.resultReason}>
              {recommendation?.reason ?? "No recommendation available."}
            </Text>
            <Text style={styles.resultMeta}>
              MCC {selectedBrand?.mcc ?? "None"} • Category {selectedMccMapping?.normalizedCategory ?? "None"}
            </Text>
          </View>

          {!hasWalletCards ? (
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Add wallet cards first</Text>
              <Text style={styles.tipText}>
                TapTag&apos;s recommendation engine is ready, but it needs at
                least one selected wallet card before it can choose a best
                match.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Knowledge Layer Snapshot</Text>
          <Text style={styles.helperText}>
            This is still available for debugging, but the primary tester flow is the recommendation result above.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cards ({cards.length})</Text>
          {cards.map((card) => (
            <View key={card.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>
                {card.name} ({card.id})
              </Text>
              <Text style={styles.itemMeta}>
                {card.issuer} • {card.network} • Annual Fee: $
                {card.annualFee ?? 0}
              </Text>
              <Text style={styles.itemBody}>
                Rewards:{" "}
                {card.rewardRules.length
                  ? card.rewardRules
                      .map((rule) => `${rule.category} ${rule.rate}x`)
                      .join(" | ")
                  : "No reward rules"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brands ({brands.length})</Text>
          {brands.map((brand) => (
            <View key={brand.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>
                {brand.name} ({brand.id})
              </Text>
              <Text style={styles.itemBody}>Category: {brand.category}</Text>
              <Text style={styles.itemBody}>MCC: {brand.mcc}</Text>
              <Text style={styles.itemBody}>
                Common Locations: {brand.commonLocations.length}
              </Text>
              <Text style={styles.itemBody}>
                Sample Location:{" "}
                {brand.commonLocations[0]
                  ? `${brand.commonLocations[0].lat}, ${brand.commonLocations[0].lon}`
                  : "None"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            MCC Mappings ({mccMappings.length})
          </Text>
          {mccMappings.map((mapping) => (
            <View key={mapping.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>MCC {mapping.id}</Text>
              <Text style={styles.itemBody}>Category: {mapping.category}</Text>
              <Text style={styles.itemBody}>
                Normalized Category: {mapping.normalizedCategory}
              </Text>
              <Text style={styles.itemBody}>
                Description: {mapping.description || "None"}
              </Text>
            </View>
          ))}
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
  stateText: {
    color: "#aaa",
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  errorTitle: {
    color: "#f55",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#aaa",
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20,
  },
  helperText: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#0af",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  pillActive: {
    backgroundColor: "#0af",
    borderColor: "#0af",
  },
  pillText: {
    color: "#ddd",
    fontSize: 14,
    fontWeight: "500",
  },
  pillTextActive: {
    color: "#000",
  },
  calloutCard: {
    backgroundColor: "#111822",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  calloutTitle: {
    color: "#8ecfff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  calloutText: {
    color: "#cfe9ff",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  resultCard: {
    backgroundColor: "#0f1620",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  resultLabel: {
    color: "#8ecfff",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resultValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  resultReason: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  resultMeta: {
    color: "#888",
    fontSize: 13,
    lineHeight: 18,
  },
  itemCard: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  tipCard: {
    backgroundColor: "#111822",
    borderRadius: 10,
    padding: 14,
    marginTop: 2,
  },
  tipTitle: {
    color: "#8ecfff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  tipText: {
    color: "#cfe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  itemTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  itemMeta: {
    color: "#0af",
    fontSize: 13,
    marginBottom: 6,
  },
  itemBody: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },
});
