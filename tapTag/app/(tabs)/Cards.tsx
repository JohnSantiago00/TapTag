import { useEffect, useState } from "react";
import {
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../src/config/firebase";
import {
  Card,
  deleteUserCard,
  getUserCards,
} from "../../src/services/firestore/userCards";

export default function Cards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    loadCards();
  }, []);

  async function loadCards() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getUserCards(user.uid);
      setCards(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteUserCard(user!.uid, id);
    await loadCards();
  }

  return (
    <View style={styles.container}>
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
          Manual custom card creation has been removed so the app does not drift
          toward a fake build-your-own-card model. Wallet selection by real card
          products will come in a later phase.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Legacy Prototype Entries</Text>
      <Text style={styles.helperText}>
        Older test cards can still be removed here if they already exist in
        your account.
      </Text>

      {loading ? <ActivityIndicator color="#0af" style={styles.loader} /> : null}

      {!loading && !cards.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No legacy prototype cards are saved for this account.
          </Text>
        </View>
      ) : null}

      {!loading && cards.length ? (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.cardRow}>
              <View style={styles.cardCopy}>
                <Text style={styles.cardText}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  Legacy test entry from an earlier prototype
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id!)}>
                <Text style={styles.deleteText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : null}
    </View>
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
  deleteText: {
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
