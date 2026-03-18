import { StyleSheet, Text, View } from "react-native";

export default function Nearby() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Later roadmap phase</Text>
        <Text style={styles.status}>
          Live foreground location detection and nearby merchant nudges are not
          active yet in this build.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Planned behavior</Text>
        <Text style={styles.status}>
          TapTag will eventually notice nearby merchants, map them to a category
          or brand, and suggest the best saved card product without storing
          sensitive payment details.
        </Text>
      </View>

      <Text style={styles.footer}>
        For now, use the Lab tab to verify the Firestore knowledge layer that
        will support this flow later.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  status: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});
