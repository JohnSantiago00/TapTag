import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../src/config/firebase";
import { getCategoryByMcc } from "../../src/services/firestore/mccMap";
import { getUserCards } from "../../src/services/firestore/userCards";
import { getBestCard } from "../../src/utils/recommendCard";

const mockMerchants = [
  { name: "Starbucks", mcc: 5814 },
  { name: "Shell Gas", mcc: 5541 },
  { name: "Whole Foods", mcc: 5411 },
  { name: "AMC Theatres", mcc: 7832 },
  { name: "Amazon", mcc: 5942 },
];

export default function Nearby() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  async function handleSelectMerchant(merchant: { name: string; mcc: number }) {
    if (!user) return;
    setLoading(true);
    const category = await getCategoryByMcc(merchant.mcc);
    const cards = await getUserCards(user.uid);
    const { bestCard, bestReward } = getBestCard(cards, category);
    setResult(
      `🛒 ${merchant.name} → ${category}\n💳 ${bestCard.name} (${bestReward}% back)`
    );
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📍 Nearby Test Merchants</Text>
      <FlatList
        data={mockMerchants}
        keyExtractor={(item) => item.mcc.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.merchantBox}
            onPress={() => handleSelectMerchant(item)}
          >
            <Text style={styles.merchantName}>{item.name}</Text>
            <Text style={styles.mccText}>MCC: {item.mcc}</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.resultBox}>
        <Text style={styles.resultText}>{loading ? "Checking..." : result}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 70 },
  title: { color: "#0af", fontSize: 22, fontWeight: "700", marginBottom: 20 },
  merchantBox: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  merchantName: { color: "#fff", fontSize: 18, fontWeight: "600" },
  mccText: { color: "#888", fontSize: 12, marginTop: 4 },
  resultBox: {
    marginTop: 20,
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 8,
  },
  resultText: { color: "#0af", fontSize: 16, textAlign: "center" },
});