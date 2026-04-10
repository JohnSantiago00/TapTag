import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTag</Text>
      <Text style={styles.subtitle}>
        A privacy-first wallet intelligence app for the cards you already own.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What TapTag is</Text>
        <Text style={styles.cardText}>
          TapTag helps you choose the best card product from your selected
          wallet based on merchant and category context, without storing card
          numbers, CVV, expiration dates, or bank credentials.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What works now</Text>
        <Text style={styles.cardText}>
          The app supports sign-in, seeded Firestore knowledge data, wallet
          selection by card-product reference, Lab-based merchant testing,
          foreground nearby checks, and an in-app nudge banner.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What comes next</Text>
        <Text style={styles.cardText}>
          Future slices may add muting, suppression, and richer user controls,
          but background notifications, geofencing, analytics, and complex
          reward-state logic are still intentionally deferred.
        </Text>
      </View>

      <Text style={styles.footer}>
        Use Wallet to choose your cards, Lab to inspect recommendations, and
        Nearby to test foreground location checks.
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
