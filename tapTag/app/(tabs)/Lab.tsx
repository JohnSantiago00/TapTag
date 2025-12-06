import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../src/config/firebase";
import { getCategoryByMcc } from "../../src/services/firestore/mccMap";
import {
  addUserCard,
  Card,
  deleteUserCard,
  getUserCards,
} from "../../src/services/firestore/userCards";
import { getBestCard } from "../../src/utils/recommendCard";

export default function LabScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [name, setName] = useState("");
  const [merchantMcc, setMerchantMcc] = useState("5814"); // Default: Starbucks (Dining)
  const [bestCard, setBestCard] = useState<string>("");
  const [category, setCategory] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    loadCards();
  }, []);

  async function loadCards() {
    const data = await getUserCards(user!.uid);
    setCards(data);
  }

  function generateRandomRewards() {
    const categories = [
      "Dining",
      "Groceries",
      "Gas",
      "Travel",
      "Entertainment",
      "Online Shopping",
    ];
    const rewards: Record<string, number> = {};

    categories.forEach((cat) => {
      // Random reward between 1% and 5%
      rewards[cat] = Math.floor(Math.random() * 5) + 1;
    });

    return rewards;
  }

  async function handleAddCard() {
    if (!name.trim()) return;
    await addUserCard(user!.uid, {
      name,
      categoryRewards: generateRandomRewards(),
      createdAt: new Date().toISOString(),
    });
    setName("");
    await loadCards();
  }

  async function handleDelete(id: string) {
    await deleteUserCard(user!.uid, id);
    await loadCards();
  }

  async function handleTestLogic() {
    if (!cards.length) {
      setBestCard("No cards found!");
      return;
    }

    const categoryName = await getCategoryByMcc(Number(merchantMcc));
    const { bestCard, bestReward } = getBestCard(cards, categoryName);

    setCategory(categoryName);
    setBestCard(`${bestCard.name} (${bestReward}% back)`);
    setLog((prev) => [
      `${new Date().toLocaleTimeString()} → MCC ${merchantMcc} (${categoryName}) → ${
        bestCard.name
      } (${bestReward}%)`,
      ...prev,
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧠 TapTag Lab (Testing)</Text>

      {/* Add Cards */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Card Name"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
          <Text style={{ color: "#fff" }}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Card List */}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id!}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.rewardText}>
              {Object.entries(item.categoryRewards)
                .map(([cat, val]) => `${cat}: ${val}%`)
                .join(" | ")}
            </Text>
            <TouchableOpacity onPress={() => handleDelete(item.id!)}>
              <Text style={{ color: "#f55" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Merchant Simulator */}
      <Text style={styles.sectionTitle}>🛒 Test Merchant</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter MCC (e.g. 5814)"
        placeholderTextColor="#aaa"
        value={merchantMcc}
        onChangeText={setMerchantMcc}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.testButton} onPress={handleTestLogic}>
        <Text style={styles.testText}>Run Recommendation</Text>
      </TouchableOpacity>

      {bestCard ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>Category: {category}</Text>
          <Text style={styles.resultText}>Best Card: {bestCard}</Text>
        </View>
      ) : null}

      {/* Log */}
      <Text style={styles.sectionTitle}>🧾 Logs</Text>
      {log.map((entry, i) => (
        <Text key={i} style={styles.logText}>
          {entry}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 30 },
  title: { color: "#0af", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  addRow: { flexDirection: "row", marginBottom: 10 },
  input: {
    flex: 1,
    backgroundColor: "#111",
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: "#0af",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardName: { color: "#fff", fontSize: 10 },
  sectionTitle: {
    color: "#0af",
    marginTop: 20,
    fontSize: 18,
    fontWeight: "600",
  },
  testButton: {
    backgroundColor: "#0af",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  testText: { color: "#fff", fontWeight: "600" },
  resultBox: {
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  resultText: { color: "#fff", fontSize: 16 },
  rewardText: { color: "#0af", fontSize: 10, marginTop: 4 },

  logText: { color: "#888", fontSize: 10, marginTop: 5 },
});
