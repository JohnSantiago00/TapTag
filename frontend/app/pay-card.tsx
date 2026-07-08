import { useAuth } from "@/src/context/AuthContext";
import { trackUserEvent } from "@/src/services/data/events";
import { getWalletInstruction } from "@/src/services/paymentPrompt";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PayCardPrompt() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<string | null>(null);

  const recommendedCardName =
    paramValue(params.recommendedCardName) ?? "recommended card";
  const recommendedCardProductId = paramValue(params.recommendedCardProductId);
  const merchantName = paramValue(params.merchantName) ?? "this merchant";
  const normalizedCategory = paramValue(params.normalizedCategory);
  const reason = paramValue(params.reason);
  const rewardRate = Number(paramValue(params.rewardRate));
  const merchantMcc = Number(paramValue(params.merchantMcc));
  const source = paramValue(params.source) ?? "payment_prompt";
  const rewardSummary =
    Number.isFinite(rewardRate) && normalizedCategory
      ? `${rewardRate}x ${normalizedCategory}`
      : normalizedCategory ?? "best available rewards";

  async function handleUsedCard() {
    if (!user) {
      setStatus("Sign in is required before TapTag can save this event.");
      return;
    }

    try {
      await trackUserEvent(user.uid, {
        eventType: "payment_prompt_confirmed",
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
      setStatus("Saved. TapTag recorded that you used this recommendation.");
    } catch (error) {
      console.error("Error tracking payment prompt confirmation:", error);
      setStatus("Could not save the event, but the recommendation is still valid.");
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
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

        <TouchableOpacity style={styles.primaryButton} onPress={handleUsedCard}>
          <Text style={styles.primaryButtonText}>I Used This Card</Text>
        </TouchableOpacity>

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
  content: {
    padding: 24,
    paddingBottom: 40,
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
  primaryButton: {
    backgroundColor: "#0af",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
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
  secondaryButtonText: {
    color: "#ddd",
    fontSize: 15,
    fontWeight: "700",
  },
});
