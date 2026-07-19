import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, ScreenHeader } from "../../src/components/AppChrome";
import { useAuth } from "../../src/context/AuthContext";
import { getAllBrands, Brand } from "../../src/services/data/brands";
import { getAllCards, KnowledgeCard } from "../../src/services/data/cards";
import { updateCompanionPassRecommendation } from "../../src/services/data/companionPass";
import { getAllMccMappings, MccMapping } from "../../src/services/data/mccMap";
import { trackUserEvent } from "../../src/services/data/events";
import { getUserWallet, WalletCardRef } from "../../src/services/data/wallet";
import { buildPaymentPromptHref, PaymentPromptInput } from "../../src/services/paymentPrompt";
import { getPaymentLearningSignals } from "../../src/services/paymentLearning";
import { recommendBestCardForCategory, type PaymentLearningSignals } from "../../src/utils/recommendCard";
import { getTabScrollContentStyle } from "../../src/styles/layout";
import { colors, radii, shadows, spacing } from "../../src/styles/theme";

export default function CardFinder() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [mccMappings, setMccMappings] = useState<MccMapping[]>([]);
  const [wallet, setWallet] = useState<WalletCardRef[]>([]);
  const [learningSignals, setLearningSignals] = useState<PaymentLearningSignals | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTrackedRecommendationKey = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const [loadedCards, loadedBrands, loadedMccMappings, loadedWallet, loadedLearningSignals] = await Promise.all([
        getAllCards(),
        getAllBrands(),
        getAllMccMappings(),
        getUserWallet(user.uid),
        getPaymentLearningSignals(user.uid),
      ]);
      setCards(loadedCards);
      setBrands(loadedBrands);
      setMccMappings(loadedMccMappings);
      setWallet(loadedWallet.filter((item) => item.enabled));
      setLearningSignals(loadedLearningSignals);
    } catch (loadError) {
      console.error("Error loading card finder:", loadError);
      setError("TapTag couldn’t load merchants and wallet cards right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { if (user) loadData(); }, [loadData, user]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredBrands = brands
    .filter((brand) => !query.trim() || brand.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);
  const walletIds = new Set(wallet.map((item) => item.id));
  const walletCards = cards.filter((card) => walletIds.has(card.id));
  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const selectedMapping = mccMappings.find((mapping) => mapping.mcc === selectedBrand?.mcc) ?? null;
  const category = selectedMapping?.normalizedCategory ?? "Other";
  const recommendation = selectedBrand
    ? recommendBestCardForCategory(walletCards, category, { merchantName: selectedBrand.name, learningSignals })
    : null;

  const recommendationKey = [selectedBrand?.id, category, recommendation?.bestCard?.id, ...walletIds].join("|");

  useEffect(() => {
    if (!user || !selectedBrand || !recommendation?.bestCard || lastTrackedRecommendationKey.current === recommendationKey) return;
    lastTrackedRecommendationKey.current = recommendationKey;
    trackUserEvent(user.uid, {
      eventType: "recommendation_shown",
      source: "lab",
      brandId: selectedBrand.id,
      brandName: selectedBrand.name,
      cardProductIds: walletCards.map((card) => card.id),
      recommendedCardProductId: recommendation.bestCard.id,
      recommendedCardName: recommendation.bestCard.name,
      normalizedCategory: category,
      merchantMcc: selectedBrand.mcc,
      metadata: { rewardRate: recommendation.bestRate },
    }).catch((trackingError) => console.error("Error tracking finder recommendation:", trackingError));
    updateCompanionPassRecommendation(user.uid, {
      source: "lab",
      merchantName: selectedBrand.name,
      merchantMcc: selectedBrand.mcc,
      normalizedCategory: category,
      recommendedCardProductId: recommendation.bestCard.id,
      recommendedCardName: recommendation.bestCard.name,
      rewardRate: recommendation.bestRate,
      reason: recommendation.reason,
    }).catch((passError) => console.error("Error updating recommendation state:", passError));
  }, [category, recommendation?.bestCard, recommendation?.bestRate, recommendation?.reason, recommendationKey, selectedBrand, user, walletCards]);

  async function handleContinue() {
    if (!user || !selectedBrand || !recommendation?.bestCard) return;
    const input: PaymentPromptInput = {
      source: "lab",
      merchantName: selectedBrand.name,
      merchantMcc: selectedBrand.mcc,
      normalizedCategory: category,
      recommendedCardProductId: recommendation.bestCard.id,
      recommendedCardName: recommendation.bestCard.name,
      rewardRate: recommendation.bestRate,
      reason: recommendation.reason,
    };
    await trackUserEvent(user.uid, {
      eventType: "payment_prompt_opened",
      source: "lab",
      brandId: selectedBrand.id,
      brandName: selectedBrand.name,
      recommendedCardProductId: recommendation.bestCard.id,
      recommendedCardName: recommendation.bestCard.name,
      normalizedCategory: category,
      merchantMcc: selectedBrand.mcc,
      metadata: { rewardRate: recommendation.bestRate, openMethod: "merchant_finder" },
    }).catch(() => {});
    router.push(buildPaymentPromptHref(input));
  }

  if (!user) return <SafeAreaView style={styles.state}><Text style={styles.stateTitle}>Sign in to find your best card.</Text></SafeAreaView>;
  if (loading) return <SafeAreaView style={styles.state}><ActivityIndicator color={colors.accent} /><Text style={styles.stateText}>Loading your wallet…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.state}><Ionicons name="cloud-offline-outline" size={28} color={colors.warning} /><Text style={styles.stateTitle}>Card finder is unavailable</Text><Text style={styles.stateText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={loadData}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={getTabScrollContentStyle(width, insets)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Merchant search" title="Find the right card" subtitle="Choose where you’re shopping and compare the cards already in your wallet." right={<IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close card finder" />} />

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search merchants" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} autoFocus={false} />
          {query ? <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>

        {!walletCards.length ? (
          <View style={styles.walletPrompt}><Ionicons name="wallet-outline" size={23} color={colors.warning} /><View style={styles.walletPromptCopy}><Text style={styles.walletPromptTitle}>Add cards before comparing</Text><Text style={styles.walletPromptBody}>Recommendations are personalized to the cards in your wallet.</Text></View><TouchableOpacity onPress={() => router.push("/(tabs)/Cards")}><Text style={styles.walletPromptAction}>Open wallet</Text></TouchableOpacity></View>
        ) : null}

        <Text style={styles.sectionLabel}>{query ? "Search results" : "Popular merchants"}</Text>
        <View style={styles.merchantList}>
          {filteredBrands.map((brand) => {
            const active = brand.id === selectedBrandId;
            return (
              <TouchableOpacity key={brand.id} style={[styles.merchantRow, active && styles.merchantRowActive]} onPress={() => setSelectedBrandId(brand.id)}>
                <View style={[styles.merchantIcon, active && styles.merchantIconActive]}><Text style={[styles.merchantInitial, active && styles.merchantInitialActive]}>{brand.name[0]}</Text></View>
                <View style={styles.merchantCopy}><Text style={styles.merchantName}>{brand.name}</Text><Text style={styles.merchantCategory}>{brand.category}</Text></View>
                <Ionicons name={active ? "checkmark-circle" : "chevron-forward"} size={20} color={active ? colors.accent : colors.textMuted} />
              </TouchableOpacity>
            );
          })}
          {!filteredBrands.length ? <View style={styles.noResults}><Text style={styles.noResultsText}>No supported merchants match “{query}”.</Text></View> : null}
        </View>

        {selectedBrand ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTopRow}><View style={styles.matchPill}><Ionicons name="sparkles" size={14} color={colors.accent} /><Text style={styles.matchText}>Best match</Text></View><Text style={styles.categoryPill}>{category}</Text></View>
            {recommendation?.bestCard ? (
              <>
                <Text style={styles.resultMerchant}>At {selectedBrand.name}, use</Text>
                <Text style={styles.resultCardName}>{recommendation.bestCard.name}</Text>
                <View style={styles.rateRow}><Text style={styles.rateValue}>{recommendation.bestRate}x</Text><Text style={styles.rateLabel}>{category} rewards</Text></View>
                <Text style={styles.reason}>{recommendation.reason}</Text>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}><Ionicons name="wallet-outline" size={18} color={colors.accentInk} /><Text style={styles.continueText}>Use this card</Text><Ionicons name="arrow-forward" size={18} color={colors.accentInk} /></TouchableOpacity>
              </>
            ) : (
              <><Text style={styles.resultCardName}>No eligible wallet card</Text><Text style={styles.reason}>Add at least one card to get a recommendation for {selectedBrand.name}.</Text></>
            )}
          </View>
        ) : (
          <View style={styles.chooseState}><Ionicons name="storefront-outline" size={28} color={colors.violet} /><Text style={styles.chooseTitle}>Choose a merchant</Text><Text style={styles.chooseBody}>Tap a merchant above to see which card earns the most.</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  state: { alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center", padding: spacing.xl },
  stateTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: spacing.md, textAlign: "center" },
  stateText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.sm, textAlign: "center" },
  retry: { backgroundColor: colors.accent, borderRadius: radii.medium, marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  retryText: { color: colors.accentInk, fontSize: 14, fontWeight: "900" },
  searchBar: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 54, paddingHorizontal: spacing.md },
  searchInput: { color: colors.text, flex: 1, fontSize: 15, minHeight: 52 },
  walletPrompt: { alignItems: "center", backgroundColor: colors.warningSurface, borderColor: "#4D3D18", borderRadius: radii.medium, borderWidth: 1, flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  walletPromptCopy: { flex: 1 },
  walletPromptTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  walletPromptBody: { color: "#D5C39A", fontSize: 11, lineHeight: 16, marginTop: 2 },
  walletPromptAction: { color: colors.warning, fontSize: 12, fontWeight: "900" },
  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm, marginTop: spacing.lg },
  merchantList: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, overflow: "hidden" },
  merchantRow: { alignItems: "center", borderBottomColor: colors.borderSoft, borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 66, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  merchantRowActive: { backgroundColor: "#10271F" },
  merchantIcon: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  merchantIconActive: { backgroundColor: colors.accent },
  merchantInitial: { color: colors.textSecondary, fontSize: 15, fontWeight: "900" },
  merchantInitialActive: { color: colors.accentInk },
  merchantCopy: { flex: 1 },
  merchantName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  merchantCategory: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  noResults: { padding: spacing.lg },
  noResultsText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  resultCard: { backgroundColor: colors.surfaceRaised, borderColor: "#315644", borderRadius: radii.xlarge, borderWidth: 1, marginTop: spacing.lg, padding: spacing.lg, ...shadows.soft },
  resultTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg },
  matchPill: { alignItems: "center", backgroundColor: "#15372C", borderRadius: radii.pill, flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingVertical: 6 },
  matchText: { color: colors.accent, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  categoryPill: { backgroundColor: colors.surfaceSoft, borderRadius: radii.pill, color: colors.blue, fontSize: 11, fontWeight: "800", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 },
  resultMerchant: { color: colors.textSecondary, fontSize: 14, marginBottom: 5 },
  resultCardName: { color: colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.7, lineHeight: 31 },
  rateRow: { alignItems: "baseline", flexDirection: "row", gap: 7, marginTop: spacing.md },
  rateValue: { color: colors.accent, fontSize: 23, fontWeight: "900" },
  rateLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  reason: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  continueButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: radii.medium, flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.lg, minHeight: 50, paddingHorizontal: spacing.md },
  continueText: { color: colors.accentInk, flex: 1, fontSize: 14, fontWeight: "900", textAlign: "center" },
  chooseState: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: radii.large, marginTop: spacing.lg, padding: spacing.xl },
  chooseTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: spacing.sm },
  chooseBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 5, textAlign: "center" },
});
