import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { auth } from "../../src/config/firebase";
import { getCategoryByMcc } from "../../src/services/firestore/mccMap";
import { getUserCards } from "../../src/services/firestore/userCards";
import { getBestCard } from "../../src/utils/recommendCard";

export default function HomeScreen() {
  const [best, setBest] = useState<{ name: string; reward: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const runLogic = async () => {
      const user = auth.currentUser;
      if (!user) {
        setMessage("User not logged in.");
        setLoading(false);
        return;
      }

      // 1. Mock merchant (Starbucks)
      const merchantMcc = 5814;
      const category = await getCategoryByMcc(merchantMcc);

      // 2. Fetch user's cards
      const cards = await getUserCards(user.uid);

      if (!cards.length) {
        setMessage("You have no saved cards yet. Add one to get started!");
        setLoading(false);
        return;
      }

      // 3. Compute best card
      const { bestCard, bestReward } = getBestCard(cards, category);
      if (!bestCard) {
        setMessage("No suitable card found for this merchant.");
      } else {
        setBest({ name: bestCard.name, reward: bestReward });
      }
      setLoading(false);
    };

    runLogic();
  }, []);

  if (loading)
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#0af" />
      </View>
    );

  if (message)
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{message}</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.text}>🧭 Merchant: Starbucks (Dining)</Text>
      <Text style={styles.result}>
        Best Card: {best?.name} ({best?.reward}% back)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#a1a1a1",
    justifyContent: "center",
    alignItems: "center",
  },
  text: { color: "#aaa", fontSize: 16, marginBottom: 10, textAlign: "center" },
  result: { color: "#0af", fontSize: 20, fontWeight: "700" },
});
