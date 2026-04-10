import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTag</Text>
      <Text style={styles.subtitle}>
        A privacy-first rewards assistant for the cards you already carry.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What TapTag will do</Text>
        <Text style={styles.cardText}>
          TapTag is being built to notice the merchant or category around you
          and suggest the best card product in your wallet for better rewards.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What works now</Text>
        <Text style={styles.cardText}>
          The app can sign users in and read the seeded Firestore knowledge
          layer for cards, brands, and MCC mappings.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What is next</Text>
        <Text style={styles.cardText}>
          Recommendation flow, wallet card-product selection, merchant
          simulation, and live nudges are still coming in later phases.
        </Text>
      </View>

      <Text style={styles.footer}>
        Open the Lab tab to verify the current knowledge-layer foundation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#0af",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#ddd",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#0af",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});
