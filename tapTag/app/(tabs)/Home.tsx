import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

/*
  File role:
  Home is the orientation screen for the whole beta.

  It does not perform core recommendation logic itself. Instead, it explains the
  product clearly and routes the tester toward the screens that prove the main
  loop, Wallet, Lab, Nearby, and Profile.
*/

// Home is the product framing screen. It explains what TapTag is, what works
// now, and where a tester should go next.
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

  // The checklist is intentionally lightweight. Right now only auth state is
  // automatically known here, the rest remain manual tester prompts.
  const checklist = [
    { label: "Signed in", done: Boolean(user) },
    { label: "Wallet configured", done: false },
    { label: "Lab recommendation tested", done: false },
    { label: "Nearby nudge tested", done: false },
    { label: "Event tracking verified", done: false },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        <Text style={styles.cardTitle}>Quick Start</Text>
        <Text style={styles.cardText}>1. Open Wallet and select the cards you own.</Text>
        <Text style={styles.cardText}>2. Open Lab to test recommendations by merchant.</Text>
        <Text style={styles.cardText}>3. Open Nearby to test live foreground suggestions.</Text>
        <Text style={styles.cardText}>4. Open Profile to verify event tracking is working.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Beta Readiness Checklist</Text>
        {checklist.map((item) => (
          <View key={item.label} style={styles.checklistRow}>
            <Text style={[styles.checklistIcon, item.done && styles.checklistIconDone]}>
              {item.done ? "✓" : "○"}
            </Text>
            <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>
              {item.label}
            </Text>
          </View>
        ))}
        <Text style={styles.helperNote}>
          The first item updates automatically. The rest are your quick tester checklist for this beta slice.
        </Text>
      </View>

      <View style={styles.actionsRow}>
        {/* These buttons are explicit instead of relying on the tab bar alone,
            because first-run clarity matters more than avoiding duplicate nav. */}
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Cards")}>
          <Text style={styles.actionButtonText}>Open Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Lab")}>
          <Text style={styles.actionButtonText}>Open Lab</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Nearby")}>
          <Text style={styles.actionButtonText}>Open Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/Profile")}>
          <Text style={styles.actionButtonText}>Open Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What works now</Text>
        <Text style={styles.cardText}>
          The app supports sign-in, seeded Firestore knowledge data, wallet
          selection by card-product reference, Lab-based merchant testing,
          foreground nearby checks, in-app nudge actions, and lightweight event
          tracking.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Beta focus</Text>
        <Text style={styles.cardText}>
          The goal now is clarity and usefulness. TapTag should feel easy to
          understand, easy to test, and obviously privacy-first.
        </Text>
      </View>

      <Text style={styles.footer}>
        Use Wallet to choose your cards, Lab to inspect recommendations, Nearby
        to test location checks, and Profile to confirm recent events.
      </Text>
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#0af",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#00131f",
    fontSize: 15,
    fontWeight: "700",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checklistIcon: {
    color: "#666",
    fontSize: 16,
    width: 20,
  },
  checklistIconDone: {
    color: "#0af",
  },
  checklistText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  checklistTextDone: {
    color: "#8ecfff",
  },
  helperNote: {
    color: "#888",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
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
