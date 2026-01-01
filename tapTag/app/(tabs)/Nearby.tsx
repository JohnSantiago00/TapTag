import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../src/config/firebase";
import { Brand, getAllBrands } from "../../src/services/firestore/brands";
import { getCategoryByMcc } from "../../src/services/firestore/mccMap";
import { getUserCards } from "../../src/services/firestore/userCards";
import { getBestCard } from "../../src/utils/recommendCard";

export default function Nearby() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
    const data = await getAllBrands();
    setBrands(data);
  }

  async function handleSelect(brand: Brand) {
    if (!user) return;
    setLoading(true);

    const category = await getCategoryByMcc(brand.mcc);
    const cards = await getUserCards(user.uid);
    const { bestCard, bestReward } = getBestCard(cards, category);

    setResult(
      `🛒 ${brand.name} (${category})\n💳 Best Card: ${bestCard.name} (${bestReward}% back)`
    );
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📍 Nearby Merchants (Live from Firestore)</Text>

      <FlatList
        data={brands}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.brandBox}
            onPress={() => handleSelect(item)}
          >
            <Text style={styles.brandName}>{item.name}</Text>
            <Text style={styles.brandDetails}>
              MCC: {item.mcc} • Category: {item.category}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>
          {loading ? "Analyzing..." : result}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 50 },
  title: { color: "#0af", fontSize: 22, fontWeight: "700", marginBottom: 20 },
  brandBox: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  brandName: { color: "#fff", fontSize: 18, fontWeight: "600" },
  brandDetails: { color: "#888", fontSize: 12, marginTop: 4 },
  resultBox: {
    marginTop: 20,
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 8,
  },
  resultText: { color: "#0af", fontSize: 16, textAlign: "center" },
});