import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getAllBrands, Brand } from "../../src/services/firestore/brands";
import { getAllCards, KnowledgeCard } from "../../src/services/firestore/cards";
import {
  getAllMccMappings,
  MccMapping,
} from "../../src/services/firestore/mccMap";

export default function Lab() {
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [mccMappings, setMccMappings] = useState<MccMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKnowledgeLayer();
  }, []);

  async function loadKnowledgeLayer() {
    try {
      setLoading(true);
      setError(null);

      const [loadedCards, loadedBrands, loadedMccMappings] = await Promise.all([
        getAllCards(),
        getAllBrands(),
        getAllMccMappings(),
      ]);

      setCards(loadedCards);
      setBrands(loadedBrands);
      setMccMappings(loadedMccMappings);
    } catch (err) {
      console.error("Error loading knowledge layer:", err);
      setError("Could not load Firestore knowledge-layer data.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color="#0af" />
        <Text style={styles.stateText}>Loading TapTag knowledge layer...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorTitle}>Lab Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TapTag Lab</Text>
      <Text style={styles.subtitle}>
        Firestore knowledge-layer debug screen
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cards ({cards.length})</Text>
        {cards.map((card) => (
          <View key={card.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>
              {card.name} ({card.id})
            </Text>
            <Text style={styles.itemMeta}>
              {card.issuer} • {card.network} • Annual Fee: $
              {card.annualFee ?? 0}
            </Text>
            <Text style={styles.itemBody}>
              Rewards:{" "}
              {card.rewardRules.length
                ? card.rewardRules
                    .map((rule) => `${rule.category} ${rule.rate}x`)
                    .join(" | ")
                : "No reward rules"}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Brands ({brands.length})</Text>
        {brands.map((brand) => (
          <View key={brand.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>
              {brand.name} ({brand.id})
            </Text>
            <Text style={styles.itemBody}>Category: {brand.category}</Text>
            <Text style={styles.itemBody}>MCC: {brand.mcc}</Text>
            <Text style={styles.itemBody}>
              Coordinates:{" "}
              {brand.coordinates
                ? `${brand.coordinates.lat}, ${brand.coordinates.lng}`
                : "None"}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          MCC Mappings ({mccMappings.length})
        </Text>
        {mccMappings.map((mapping) => (
          <View key={mapping.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>MCC {mapping.id}</Text>
            <Text style={styles.itemBody}>Category: {mapping.category}</Text>
            <Text style={styles.itemBody}>
              Description: {mapping.description || "None"}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
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
  stateContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  stateText: {
    color: "#aaa",
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  errorTitle: {
    color: "#f55",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#aaa",
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#0af",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  itemTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  itemMeta: {
    color: "#0af",
    fontSize: 13,
    marginBottom: 6,
  },
  itemBody: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },
});
