import { auth } from "@/src/config/firebase";
import { useAuth } from "@/src/context/AuthContext";
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from "@/src/services/firestore/userProfile";
import {
  getRecentUserEvents,
  TapTagEvent,
} from "@/src/services/firestore/events";
import { getUserWallet } from "@/src/services/firestore/wallet";
import { signOut } from "firebase/auth";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/*
  File role:
  This screen combines user-facing profile information with an internal-style QA
  surface for verifying event tracking and recent app behavior.

  Why that blend is okay right now:
  The product is still in beta, so giving testers visibility into what the app
  just recorded is more useful than hiding everything behind external tooling.
*/

// Profile is the lightweight user/settings and QA verification screen. It lets
// a tester confirm saved profile state, wallet count, and recent tracked events
// without opening Firebase.
export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [walletCount, setWalletCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<TapTagEvent[]>([]);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Profile data spans three sources, user profile doc, wallet refs, and recent
  // events. Loading them together keeps the screen coherent.
  const loadProfile = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setStatus(null);

      const [loadedProfile, wallet, events] = await Promise.all([
        getUserProfile(user.uid),
        getUserWallet(user.uid),
        getRecentUserEvents(user.uid, 8),
      ]);

      setProfile(loadedProfile);
      setDraftDisplayName(loadedProfile?.displayName ?? "");
      setWalletCount(wallet.filter((item) => item.enabled).length);
      setRecentEvents(events);
    } catch (error) {
      console.error("Error loading profile:", error);
      setStatus("Could not load your profile right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      // Reload on focus so Wallet/Lab/Nearby activity shows up immediately when
      // the tester comes back here.
      loadProfile();
    }, [loadProfile, user])
  );

  // Save is intentionally narrow, only displayName is editable today. The rest
  // of the profile shape is managed by product defaults.
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setStatus(null);
      await updateUserProfile(user.uid, { displayName: draftDisplayName });
      await loadProfile();
      setStatus("Profile saved.");
    } catch (error) {
      console.error("Error saving profile:", error);
      setStatus("Could not save your profile right now.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // These counts are intentionally derived on the client because this is a tiny
  // beta QA surface, not a dashboard backed by aggregate analytics.
  const eventCounts = recentEvents.reduce(
    (counts, event) => {
      counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
      return counts;
    },
    {
      recommendation_shown: 0,
      recommendation_opened: 0,
      recommendation_dismissed: 0,
      wallet_updated: 0,
      brand_muted: 0,
    } as Record<string, number>
  );
  const latestEvent = recentEvents[0] ?? null;
  const trackingHealthText = latestEvent
    ? `Tracking active. Last event: ${latestEvent.eventType} from ${latestEvent.source}.`
    : "Tracking active, but no events have been recorded yet.";

  // This formatter turns raw event docs into short human-readable summaries.
  function formatEventSummary(event: TapTagEvent) {
    switch (event.eventType) {
      case "wallet_updated":
        return `Wallet ${event.action ?? "updated"}${event.cardProductId ? `, ${event.cardProductId}` : ""}`;
      case "recommendation_shown":
        return `Shown${event.brandName ? `, ${event.brandName}` : ""}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ""}`;
      case "recommendation_opened":
        return `Opened${event.brandName ? `, ${event.brandName}` : ""}`;
      case "recommendation_dismissed":
        return `Dismissed${event.brandName ? `, ${event.brandName}` : ""}`;
      case "brand_muted":
        return `Muted${event.brandName ? `, ${event.brandName}` : ""}`;
      default:
        return event.eventType;
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>
            Sign in to view your privacy-first TapTag profile.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <ActivityIndicator color="#0af" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>
          Lightweight user settings, privacy-first by default.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email ?? "Unknown"}</Text>

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional display name"
            placeholderTextColor="#666"
            value={draftDisplayName}
            onChangeText={setDraftDisplayName}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? "Saving..." : "Save Display Name"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Defaults</Text>
          <Text style={styles.label}>Privacy Mode</Text>
          <Text style={styles.value}>{profile?.privacyMode ?? "strict"}</Text>

          <Text style={styles.label}>Notifications Enabled</Text>
          <Text style={styles.value}>
            {profile?.notificationsEnabled ? "Yes" : "No"}
          </Text>

          <Text style={styles.label}>Selected Wallet Cards</Text>
          <Text style={styles.value}>{walletCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Event Tracking Health</Text>
          <Text style={styles.bodyText}>{trackingHealthText}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Shown</Text>
              <Text style={styles.metricValue}>{eventCounts.recommendation_shown}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Opened</Text>
              <Text style={styles.metricValue}>{eventCounts.recommendation_opened}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Dismissed</Text>
              <Text style={styles.metricValue}>{eventCounts.recommendation_dismissed}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Wallet</Text>
              <Text style={styles.metricValue}>{eventCounts.wallet_updated}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Event Activity</Text>
          <Text style={styles.bodyText}>
            Last {recentEvents.length} tracked events for quick Level 8 QA.
          </Text>
          <View style={styles.eventsList}>
            {recentEvents.length ? (
              // This is intentionally chronological QA feedback, not a deeply
              // modeled audit log UI.
              recentEvents.map((event) => (
                <View key={event.id ?? `${event.eventType}-${event.occurredAt}`} style={styles.eventRow}>
                  <Text style={styles.eventTitle}>{event.eventType}</Text>
                  <Text style={styles.eventMeta}>
                    {event.source} • {new Date(event.occurredAt).toLocaleString()}
                  </Text>
                  <Text style={styles.eventBody}>{formatEventSummary(event)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyText}>No recent events yet.</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Project Scope Today</Text>
          <Text style={styles.bodyText}>
            TapTag stores lightweight profile and wallet-reference data only. It
            does not store card numbers, CVV, expiration dates, billing
            addresses, or bank credentials.
          </Text>
        </View>

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#aaa",
    marginTop: 12,
    fontSize: 16,
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#888",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  label: {
    color: "#888",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 21,
  },
  bodyText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  metricCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 72,
  },
  metricLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  eventsList: {
    marginTop: 12,
    gap: 10,
  },
  eventRow: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
  },
  eventTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  eventMeta: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  eventBody: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: "#0af",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  status: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: "#221111",
    borderColor: "#663333",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "#ff8a8a",
    fontSize: 15,
    fontWeight: "600",
  },
});
