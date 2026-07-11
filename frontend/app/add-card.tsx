import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardDoneBar,
  KeyboardDoneInline,
  NUMERIC_INPUT_ACCESSORY_ID,
  dismissKeyboard,
} from "@/src/components/KeyboardDoneBar";
import { useAuth } from "@/src/context/AuthContext";
import { addWalletCard } from "@/src/services/data/wallet";
import { trackUserEvent } from "@/src/services/data/events";
import { getStackScrollContentStyle } from "@/src/styles/layout";
import { CustomCardNetwork, isCardScanAvailable } from "@/src/utils/cardScan";

const NETWORKS: CustomCardNetwork[] = [
  "Visa",
  "Mastercard",
  "Amex",
  "Discover",
  "Other",
];
const CARD_COLORS = ["#00AAFF", "#7C5CFF", "#13C27A", "#FFB020", "#FF5A5F"];
const MAX_REWARD_RULES = 8;

type RewardRuleDraft = {
  category: string;
  rate: string;
};

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AddCard() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [network, setNetwork] = useState<CustomCardNetwork>("Visa");
  const [last4, setLast4] = useState("");
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [rewardRules, setRewardRules] = useState<RewardRuleDraft[]>([
    { category: "Other", rate: "1" },
  ]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanAvailable = useMemo(() => isCardScanAvailable(), []);

  useEffect(() => {
    const scanLast4 = paramValue(params.scanLast4);
    const scanNetwork = paramValue(params.scanNetwork) as CustomCardNetwork | undefined;
    const scanIssuer = paramValue(params.scanIssuer);
    const scanName = paramValue(params.scanName);

    if (scanLast4) setLast4(scanLast4.replace(/\D/g, "").slice(0, 4));
    if (scanNetwork && NETWORKS.includes(scanNetwork)) setNetwork(scanNetwork);
    if (scanIssuer) setIssuer(scanIssuer);
    if (scanName && !name) setName(scanName);
  }, [name, params.scanIssuer, params.scanLast4, params.scanName, params.scanNetwork]);

  function updateRewardRule(index: number, patch: Partial<RewardRuleDraft>) {
    setRewardRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule
      )
    );
  }

  function addRewardRule() {
    setRewardRules((current) =>
      current.length >= MAX_REWARD_RULES
        ? current
        : [...current, { category: "", rate: "" }]
    );
  }

  function removeRewardRule(index: number) {
    setRewardRules((current) =>
      current.length === 1 ? current : current.filter((_, ruleIndex) => ruleIndex !== index)
    );
  }

  async function handleSave() {
    if (!user) {
      setStatus("Sign in before adding a card.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus("Name your card before saving.");
      return;
    }

    const cleanedRules = rewardRules
      .map((rule) => ({
        category: rule.category.trim(),
        rate: Number(rule.rate),
      }))
      .filter((rule) => rule.category && Number.isFinite(rule.rate) && rule.rate > 0)
      .slice(0, MAX_REWARD_RULES);

    if (!cleanedRules.length) {
      setStatus("Add at least one reward rule.");
      return;
    }

    try {
      setSaving(true);
      setStatus("Saving card...");
      const cardId = `custom-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      await addWalletCard(user.uid, cardId, {
        nickname: trimmedName,
        last4: last4 || null,
        color,
        custom: {
          name: trimmedName,
          issuer: issuer.trim() || undefined,
          network,
          rewardRules: cleanedRules,
        },
      });

      await trackUserEvent(user.uid, {
        eventType: "wallet_updated",
        source: "wallet",
        cardProductId: cardId,
        cardProductIds: [cardId],
        action: "custom_added",
        metadata: {
          rewardRuleCount: cleanedRules.length,
          hasLast4: /^\d{4}$/.test(last4),
        },
      });

      router.replace("/(tabs)/Cards");
    } catch (error) {
      console.error("Error saving custom card:", error);
      setStatus("Could not save the card. Check the API connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={getStackScrollContentStyle(width, insets)}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Add your own card</Text>
          </View>

          <View style={styles.privacyCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#8ecfff" />
            <Text style={styles.privacyText}>
              TapTag keeps only card metadata. Full card numbers, CVV, expiration,
              and billing details are never stored or uploaded.
            </Text>
          </View>

          {scanAvailable ? (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => router.push("/scan-card" as never)}
            >
              <Ionicons name="camera-outline" size={18} color="#00131f" />
              <Text style={styles.scanButtonText}>Scan card</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.label}>Card Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Custom Rewards Card"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={dismissKeyboard}
          />

          <Text style={styles.label}>Issuer</Text>
          <TextInput
            style={styles.input}
            placeholder="Bank or credit union"
            placeholderTextColor="#666"
            value={issuer}
            onChangeText={setIssuer}
            returnKeyType="done"
            onSubmitEditing={dismissKeyboard}
          />

          <Text style={styles.label}>Network</Text>
          <View style={styles.segmentRow}>
            {NETWORKS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.segment, network === item && styles.segmentActive]}
                onPress={() => setNetwork(item)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    network === item && styles.segmentTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>Last 4</Text>
            <KeyboardDoneInline />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            inputAccessoryViewID={NUMERIC_INPUT_ACCESSORY_ID}
            maxLength={4}
            returnKeyType="done"
            value={last4}
            onChangeText={(value) => setLast4(value.replace(/\D/g, "").slice(0, 4))}
            onSubmitEditing={dismissKeyboard}
          />

          <Text style={styles.label}>Card Color</Text>
          <View style={styles.swatchRow}>
            {CARD_COLORS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.swatch,
                  { backgroundColor: item },
                  color === item && styles.swatchActive,
                ]}
                onPress={() => setColor(item)}
                accessibilityLabel={`Use color ${item}`}
              />
            ))}
          </View>

          <View style={styles.rewardHeaderRow}>
            <Text style={styles.sectionTitle}>Reward Rules</Text>
            <KeyboardDoneInline />
            <TouchableOpacity
              style={[
                styles.smallButton,
                rewardRules.length >= MAX_REWARD_RULES && styles.smallButtonDisabled,
              ]}
              onPress={addRewardRule}
              disabled={rewardRules.length >= MAX_REWARD_RULES}
            >
              <Ionicons name="add" size={16} color="#00131f" />
              <Text style={styles.smallButtonText}>Rule</Text>
            </TouchableOpacity>
          </View>

          {rewardRules.map((rule, index) => (
            <View key={index} style={styles.ruleRow}>
              <TextInput
                style={[styles.input, styles.ruleCategoryInput]}
                placeholder={index === 0 ? "Other" : "Dining"}
                placeholderTextColor="#666"
                value={rule.category}
                onChangeText={(value) => updateRewardRule(index, { category: value })}
                returnKeyType="done"
                onSubmitEditing={dismissKeyboard}
              />
              <TextInput
                style={[styles.input, styles.ruleRateInput]}
                placeholder="1"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
                inputAccessoryViewID={NUMERIC_INPUT_ACCESSORY_ID}
                returnKeyType="done"
                value={rule.rate}
                onChangeText={(value) =>
                  updateRewardRule(index, {
                    rate: value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"),
                  })
                }
                onSubmitEditing={dismissKeyboard}
              />
              <TouchableOpacity
                style={styles.removeRuleButton}
                onPress={() => removeRewardRule(index)}
                disabled={rewardRules.length === 1}
                accessibilityLabel="Remove reward rule"
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={rewardRules.length === 1 ? "#444" : "#ff8f8f"}
                />
              </TouchableOpacity>
            </View>
          ))}

          {status ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => {
              Keyboard.dismiss();
              handleSave();
            }}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#00131f" />
            ) : (
              <Text style={styles.saveButtonText}>Save Card</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#111",
    borderColor: "#2a2a2a",
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  title: {
    color: "#fff",
    flex: 1,
    fontSize: 26,
    fontWeight: "800",
  },
  privacyCard: {
    alignItems: "flex-start",
    backgroundColor: "#111822",
    borderRadius: 10,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    padding: 14,
  },
  privacyText: {
    color: "#cfe9ff",
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  scanButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 18,
    paddingVertical: 14,
  },
  scanButtonText: {
    color: "#00131f",
    fontSize: 15,
    fontWeight: "800",
  },
  label: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  input: {
    backgroundColor: "#111",
    borderColor: "#2a2a2a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  segment: {
    backgroundColor: "#111",
    borderColor: "#2a2a2a",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#0af",
    borderColor: "#0af",
  },
  segmentText: {
    color: "#ddd",
    fontSize: 14,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#00131f",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  swatch: {
    borderColor: "#111",
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    width: 32,
  },
  swatchActive: {
    borderColor: "#fff",
  },
  rewardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonDisabled: {
    opacity: 0.45,
  },
  smallButtonText: {
    color: "#00131f",
    fontSize: 13,
    fontWeight: "800",
  },
  ruleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  ruleCategoryInput: {
    flex: 1,
  },
  ruleRateInput: {
    width: 78,
  },
  removeRuleButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    marginBottom: 12,
    width: 36,
  },
  statusCard: {
    backgroundColor: "#111822",
    borderRadius: 10,
    marginBottom: 12,
    padding: 14,
  },
  statusText: {
    color: "#cfe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 10,
    marginTop: 4,
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#00131f",
    fontSize: 15,
    fontWeight: "800",
  },
});
