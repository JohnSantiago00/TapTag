import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { getAllCards, KnowledgeCard } from "../../src/services/firestore/cards";
import {
  addWalletCard,
  getUserWallet,
  removeWalletCard,
  WalletCardRef,
} from "../../src/services/firestore/wallet";

export default function Cards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [wallet, setWallet] = useState<WalletCardRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);

  const loadWalletScreen = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [availableCards, selectedWallet] = await Promise.all([
        getAllCards(),
        getUserWallet(user.uid),
      ]);
      setCards(availableCards);
      setWallet(selectedWallet.filter((item) => item.enabled));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadWalletScreen();
  }, [loadWalletScreen, user]);

  const selectedIds = new Set(wallet.map((item) => item.id));

  async function handleToggleWalletCard(cardId: string, isSelected: boolean) {
    if (!user) return;

    setSavingCardId(cardId);
    try {
      if (isSelected) {
        await removeWalletCard(user.uid, cardId);
      } else {
        await addWalletCard(user.uid, cardId);
      }
      await loadWalletScreen();
    } finally {
      setSavingCardId(null);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Wallet</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Sign in to choose the card products you already own.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Wallet</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Privacy-first direction</Text>
        <Text style={styles.infoText}>
          TapTag is moving toward wallet selection by card product reference
          only, without storing card numbers, CVV, expiration dates, or billing
          details.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>This phase</Text>
        <Text style={styles.infoText}>
          Choose from seeded card products only. TapTag stores lightweight card
          product references in your wallet, not sensitive payment details.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Selected Cards ({wallet.length})
      </Text>
      <Text style={styles.helperText}>
        Your Lab recommendations will use these selected card products.
      </Text>

      {loading ? <ActivityIndicator color="#0af" style={styles.loader} /> : null}

      {!loading && !cards.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No seeded card products are available yet.
          </Text>
        </View>
      ) : null}

      {!loading && cards.length ? (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardRow}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardText}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.issuer} • {item.network}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  handleToggleWalletCard(item.id, selectedIds.has(item.id))
                }
                disabled={savingCardId === item.id}
              >
                <Text
                  style={
                    selectedIds.has(item.id) ? styles.removeText : styles.addText
                  }
                >
                  {savingCardId === item.id
                    ? "Saving..."
                    : selectedIds.has(item.id)
                      ? "Remove"
                      : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 24,
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 14,
  },
  infoCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoTitle: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 6,
  },
  helperText: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  loader: {
    marginTop: 16,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardCopy: {
    flex: 1,
    marginRight: 12,
  },
  cardText: { color: "#fff", fontSize: 16 },
  cardMeta: {
    color: "#888",
    fontSize: 13,
    marginTop: 4,
  },
  addText: {
    color: "#0af",
    fontSize: 14,
    fontWeight: "600",
  },
  removeText: {
    color: "#f55",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 16,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
    lineHeight: 21,
  },
});
