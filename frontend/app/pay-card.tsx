import { useAuth } from "@/src/context/AuthContext";
import { trackUserEvent } from "@/src/services/data/events";
import {
  getWalletInstruction,
  getWalletOpenButtonLabel,
  openNativeWallet,
} from "@/src/services/paymentPrompt";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getStackScrollContentStyle } from "@/src/styles/layout";
import { recordPaymentConfirmation } from "@/src/services/paymentLearning";
import { IconButton } from "@/src/components/AppChrome";
import { colors, radii, shadows, spacing } from "@/src/styles/theme";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PayCardPrompt() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const handledRouteIntent = useRef(false);
  const awaitingWalletReturn = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const recommendedCardName =
    paramValue(params.recommendedCardName) ?? "recommended card";
  const recommendedCardProductId = paramValue(params.recommendedCardProductId);
  const merchantName = paramValue(params.merchantName) ?? "this merchant";
  const normalizedCategory = paramValue(params.normalizedCategory);
  const reason = paramValue(params.reason);
  const rewardRate = Number(paramValue(params.rewardRate));
  const merchantMcc = Number(paramValue(params.merchantMcc));
  const source = paramValue(params.source) ?? "payment_prompt";
  const autoOpenWallet = paramValue(params.autoOpenWallet) === "1";
  const confirmUsed = paramValue(params.confirmUsed) === "1";
  const rewardSummary =
    Number.isFinite(rewardRate) && normalizedCategory
      ? `${rewardRate}x ${normalizedCategory}`
      : normalizedCategory ?? "best available rewards";

  async function handlePaymentFeedback(
    outcome: "used" | "not_used" | "wrong_card"
  ) {
    if (!user) {
      setStatus("Sign in is required before TapTag can save this event.");
      return;
    }

    try {
      await recordPaymentConfirmation(user.uid, {
        outcome:
          outcome === "used"
            ? "used_recommended"
            : outcome === "wrong_card"
              ? "used_other"
              : "did_not_pay",
        source,
        merchantName,
        merchantMcc: Number.isFinite(merchantMcc) ? merchantMcc : undefined,
        normalizedCategory,
        recommendedCardProductId,
        recommendedCardName,
        rewardRate: Number.isFinite(rewardRate) ? rewardRate : undefined,
      });

      await trackUserEvent(user.uid, {
        eventType:
          outcome === "used"
            ? "payment_prompt_confirmed"
            : "payment_prompt_feedback",
        source: source === "nearby" ? "nearby" : "lab",
        brandName: merchantName,
        recommendedCardProductId,
        recommendedCardName,
        normalizedCategory,
        merchantMcc: Number.isFinite(merchantMcc) ? merchantMcc : undefined,
        metadata: {
          rewardRate: Number.isFinite(rewardRate) ? rewardRate : null,
          promptSource: source,
          outcome,
        },
      });
      setShowPaymentConfirm(false);
      if (outcome === "used") {
        setStatus("Saved. TapTag recorded that you used this recommendation.");
      } else if (outcome === "wrong_card") {
        setStatus("Saved. TapTag recorded that a different card was used.");
      } else {
        setStatus("Saved. TapTag recorded that this recommendation was not used.");
      }
    } catch (error) {
      console.error("Error tracking payment prompt feedback:", error);
      setStatus("Could not save the event, but the recommendation is still valid.");
    }
  }

  async function handleOpenWallet() {
    const result = await openNativeWallet();

    if (user) {
      try {
        await trackUserEvent(user.uid, {
          eventType: "payment_wallet_opened",
          source: source === "nearby" ? "nearby" : "lab",
          brandName: merchantName,
          recommendedCardProductId,
          recommendedCardName,
          normalizedCategory,
          merchantMcc: Number.isFinite(merchantMcc) ? merchantMcc : undefined,
          metadata: {
            platform: result.platform,
            walletOpenResult: result.opened ? result.target : result.reason,
            promptSource: source,
          },
        });
      } catch (error) {
        console.error("Error tracking wallet handoff:", error);
      }
    }

    if (result.opened) {
      awaitingWalletReturn.current = true;
      const walletName =
        result.target === "apple_wallet"
          ? "Apple Wallet"
          : result.target === "google_wallet"
            ? "Google Wallet"
            : "Google Wallet install page";
      setStatus(
        `${walletName} opened. Choose ${recommendedCardName}, then continue at the reader.`
      );
      return;
    }

    if (result.reason === "unsupported_platform") {
      setStatus("Wallet handoff is only available from the iOS or Android app.");
      return;
    }

    setStatus(
      `Could not open the wallet app automatically. Manually open Wallet, choose ${recommendedCardName}, then continue at the reader.`
    );
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasAway =
        appState.current === "inactive" || appState.current === "background";

      if (
        awaitingWalletReturn.current &&
        wasAway &&
        nextAppState === "active"
      ) {
        awaitingWalletReturn.current = false;
        setShowPaymentConfirm(true);
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (handledRouteIntent.current) return;
    handledRouteIntent.current = true;

    if (autoOpenWallet) {
      handleOpenWallet();
      return;
    }

    if (confirmUsed) {
      handlePaymentFeedback("used");
    }
    // Route intent params should fire once for the opened notification, not
    // re-fire as local callback identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenWallet, confirmUsed]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={getStackScrollContentStyle(width, insets)}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}><IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" /><View style={styles.topBarCopy}><Text style={styles.eyebrow}>Your best card</Text><Text style={styles.merchantTitle}>{merchantName}</Text></View></View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}><View style={styles.readyPill}><Ionicons name="sparkles" size={14} color={colors.accent} /><Text style={styles.readyText}>Recommended</Text></View><Text style={styles.rewardBadge}>{rewardSummary}</Text></View>
          <Text style={styles.cardName}>{recommendedCardName}</Text>
          <Text style={styles.heroReason}>
            {reason ?? `Best match for ${normalizedCategory ?? "this purchase"}.`}
          </Text>
        </View>

        <View style={styles.checkoutCard}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
          <View style={styles.checkoutCopy}><Text style={styles.sectionTitle}>Open your device wallet</Text><Text style={styles.bodyText}>{getWalletInstruction(recommendedCardName)}</Text></View>
        </View>

        {status ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {showPaymentConfirm ? (
          <View style={styles.confirmCard}>
            <Text style={styles.sectionTitle}>
              Did you pay with {recommendedCardName}?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmButtonPrimary}
                onPress={() => handlePaymentFeedback("used")}
              >
                <Text style={styles.confirmButtonPrimaryText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonSecondary}
                onPress={() => handlePaymentFeedback("wrong_card")}
              >
                <Text style={styles.confirmButtonSecondaryText}>
                  Used another card
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonSecondary}
                onPress={() => handlePaymentFeedback("not_used")}
              >
                <Text style={styles.confirmButtonSecondaryText}>Did not pay</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <TouchableOpacity style={styles.walletButton} onPress={handleOpenWallet}>
          <Ionicons name="wallet-outline" size={19} color={colors.accentInk} />
          <Text style={styles.walletButtonText}>{getWalletOpenButtonLabel()}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.accentInk} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handlePaymentFeedback("used")}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} /><Text style={styles.primaryButtonText}>I used this card</Text>
        </TouchableOpacity>

        <View style={styles.feedbackRow}>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => handlePaymentFeedback("not_used")}
          >
            <Text style={styles.feedbackButtonText}>Didn’t pay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => handlePaymentFeedback("wrong_card")}
          >
            <Text style={styles.feedbackButtonText}>Used another card</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: { alignItems: "center", flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  topBarCopy: { flex: 1 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  merchantTitle: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
  },
  heroCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: "#315644",
    borderRadius: radii.xlarge,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  heroTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg },
  readyPill: { alignItems: "center", backgroundColor: "#15372C", borderRadius: radii.pill, flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingVertical: 6 },
  readyText: { color: colors.accent, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  rewardBadge: { backgroundColor: colors.surfaceSoft, borderRadius: radii.pill, color: colors.blue, fontSize: 11, fontWeight: "800", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 },
  heroLabel: {
    color: "#002133",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  cardName: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 33,
    marginBottom: 10,
  },
  heroReason: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  checkoutCard: { alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.large, borderWidth: 1, flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  stepNumber: { alignItems: "center", backgroundColor: "#18352D", borderRadius: 13, height: 38, justifyContent: "center", width: 38 },
  stepNumberText: { color: colors.accent, fontSize: 15, fontWeight: "900" },
  checkoutCopy: { flex: 1 },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  statusCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.medium,
    padding: 14,
    marginBottom: 14,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderRadius: radii.large,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  confirmActions: {
    gap: 10,
  },
  confirmButtonPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radii.medium,
    paddingVertical: 11,
    alignItems: "center",
  },
  confirmButtonPrimaryText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: "800",
  },
  confirmButtonSecondary: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radii.medium,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: "center",
  },
  confirmButtonSecondaryText: {
    color: "#cfe9ff",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  walletButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.medium,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  walletButtonText: {
    color: colors.accentInk,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  passButton: {
    backgroundColor: "#151515",
    borderColor: "#2f4b5f",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  passButtonText: {
    color: "#8ecfff",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#151515",
    borderColor: "#333",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  feedbackRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  feedbackButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.medium,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  feedbackButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#ddd",
    fontSize: 15,
    fontWeight: "700",
  },
});
