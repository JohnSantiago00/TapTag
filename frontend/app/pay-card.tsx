import { useAuth } from "@/src/context/AuthContext";
import {
  getCompanionPassInstallLink,
  updateCompanionPassRecommendation,
} from "@/src/services/data/companionPass";
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

  async function handleUpdateCompanionPass() {
    if (!user) {
      setStatus("Sign in is required before TapTag can update your companion pass.");
      return;
    }

    try {
      await updateCompanionPassRecommendation(user.uid, {
        source,
        merchantName,
        merchantMcc: Number.isFinite(merchantMcc) ? merchantMcc : null,
        normalizedCategory: normalizedCategory ?? "Other",
        recommendedCardProductId: recommendedCardProductId ?? null,
        recommendedCardName,
        rewardRate: Number.isFinite(rewardRate) ? rewardRate : null,
        reason: reason ?? null,
      });

      await trackUserEvent(user.uid, {
        eventType: "companion_pass_updated",
        source: source === "nearby" ? "nearby" : "lab",
        brandName: merchantName,
        recommendedCardProductId,
        recommendedCardName,
        normalizedCategory,
        merchantMcc: Number.isFinite(merchantMcc) ? merchantMcc : undefined,
        metadata: {
          rewardRate: Number.isFinite(rewardRate) ? rewardRate : null,
          promptSource: source,
        },
      });

      const installLink = await getCompanionPassInstallLink(user.uid).catch(
        () => null
      );
      setStatus(
        installLink?.configured
          ? "Companion pass updated. Open Wallet to view the latest recommendation."
          : "Companion pass preview updated. Apple/Google pass issuer credentials are still needed before TapTag can install a real Wallet pass."
      );
    } catch (error) {
      console.error("Error updating companion pass:", error);
      setStatus("Could not update the companion pass preview right now.");
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
        <Text style={styles.eyebrow}>TapTag Pay Prompt</Text>
        <Text style={styles.title}>Use {recommendedCardName}</Text>
        <Text style={styles.subtitle}>
          {merchantName} • {rewardSummary}
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Recommended Card</Text>
          <Text style={styles.cardName}>{recommendedCardName}</Text>
          <Text style={styles.heroReason}>
            {reason ?? `Best match for ${normalizedCategory ?? "this purchase"}.`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>At checkout</Text>
          <Text style={styles.bodyText}>
            {getWalletInstruction(recommendedCardName)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Companion Wallet Pass</Text>
          <Text style={styles.bodyText}>
            Update the TapTag pass preview with this merchant and card. Real
            Wallet installation turns on after Apple/Google issuer credentials
            are configured.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why this screen exists</Text>
          <Text style={styles.bodyText}>
            Apple and Google do not let TapTag preselect a payment card for
            in-store NFC. This prompt gets you as close as allowed: the right
            card, the reason, and the exact manual wallet step.
          </Text>
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
          <Ionicons name="wallet-outline" size={18} color="#00131f" />
          <Text style={styles.walletButtonText}>{getWalletOpenButtonLabel()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.passButton} onPress={handleUpdateCompanionPass}>
          <Ionicons name="ticket-outline" size={18} color="#8ecfff" />
          <Text style={styles.passButtonText}>Update Companion Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handlePaymentFeedback("used")}
        >
          <Text style={styles.primaryButtonText}>I Used This Card</Text>
        </TouchableOpacity>

        <View style={styles.feedbackRow}>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => handlePaymentFeedback("not_used")}
          >
            <Text style={styles.feedbackButtonText}>No</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => handlePaymentFeedback("wrong_card")}
          >
            <Text style={styles.feedbackButtonText}>Wrong Card</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back to TapTag</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  eyebrow: {
    color: "#8ecfff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
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
    backgroundColor: "#0af",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  heroLabel: {
    color: "#002133",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  cardName: {
    color: "#00131f",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    marginBottom: 10,
  },
  heroReason: {
    color: "#002133",
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  bodyText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: "#111822",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  statusText: {
    color: "#cfe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  confirmCard: {
    backgroundColor: "#071722",
    borderColor: "#0af",
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  confirmActions: {
    gap: 10,
  },
  confirmButtonPrimary: {
    backgroundColor: "#0af",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  confirmButtonPrimaryText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "800",
  },
  confirmButtonSecondary: {
    backgroundColor: "#151515",
    borderColor: "#2f4b5f",
    borderRadius: 8,
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
    backgroundColor: "#0af",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  walletButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  walletButtonText: {
    color: "#00131f",
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
    color: "#00131f",
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
    backgroundColor: "#151515",
    borderColor: "#333",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  feedbackButtonText: {
    color: "#ddd",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#ddd",
    fontSize: 15,
    fontWeight: "700",
  },
});
