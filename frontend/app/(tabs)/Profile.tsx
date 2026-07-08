import { auth } from "@/src/config/firebase";
import { useAuth } from "@/src/context/AuthContext";
import {
  deleteUserAccount,
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from "@/src/services/data/userProfile";
import {
  getRecentUserEvents,
  TapTagEvent,
} from "@/src/services/data/events";
import { getUserWallet } from "@/src/services/data/wallet";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Profile data spans three sources, user profile doc, wallet refs, and recent
  // events. Loading them together keeps the screen coherent.
  const loadProfile = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user) {
        setProfile(null);
        setDraftDisplayName("");
        setNotificationsEnabled(false);
        setWalletCount(0);
        setRecentEvents([]);
        setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        setStatus(null);

        const [loadedProfile, wallet, events] = await Promise.all([
          getUserProfile(user.uid),
          getUserWallet(user.uid),
          getRecentUserEvents(user.uid, 8),
        ]);

        setProfile(loadedProfile);
        setDraftDisplayName(loadedProfile?.displayName ?? "");
        setNotificationsEnabled(Boolean(loadedProfile?.notificationsEnabled));
        setWalletCount(wallet.filter((item) => item.enabled).length);
        setRecentEvents(events);
      } catch (error) {
        console.error("Error loading profile:", error);
        setStatus("Could not load your profile right now.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      // Reload on focus so Wallet/Lab/Nearby activity shows up immediately when
      // the tester comes back here.
      loadProfile();
    }, [loadProfile, user])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile({ silent: true });
    setRefreshing(false);
  }, [loadProfile]);

  // Save is intentionally narrow, only displayName is editable today. The rest
  // of the profile shape is managed by product defaults.
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setStatus(null);
      const savedProfile = await updateUserProfile(user.uid, {
        displayName: draftDisplayName,
      });
      setProfile(savedProfile);
      setDraftDisplayName(savedProfile.displayName ?? "");
      setNotificationsEnabled(savedProfile.notificationsEnabled);
      setStatus("Profile saved.");
    } catch (error) {
      console.error("Error saving profile:", error);
      setStatus("Could not save your profile right now.");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!user || savingNotifications) return;

    const previousValue = notificationsEnabled;
    setNotificationsEnabled(enabled);
    setProfile((current) =>
      current
        ? {
            ...current,
            notificationsEnabled: enabled,
            updatedAt: new Date().toISOString(),
          }
        : current
    );

    try {
      setSavingNotifications(true);
      setStatus(null);
      const savedProfile = await updateUserProfile(user.uid, {
        notificationsEnabled: enabled,
      });
      setProfile(savedProfile);
      setNotificationsEnabled(savedProfile.notificationsEnabled);
      setStatus(
        savedProfile.notificationsEnabled
          ? "Nearby notifications enabled."
          : "Nearby notifications disabled."
      );
    } catch (error) {
      console.error("Error saving notification preference:", error);
      setNotificationsEnabled(previousValue);
      setProfile((current) =>
        current
          ? {
              ...current,
              notificationsEnabled: previousValue,
            }
          : current
      );
      setStatus("Could not save notification preference right now.");
    } finally {
      setSavingNotifications(false);
    }
  };

  const getDeleteErrorMessage = (code?: string, appDataDeleted = false) => {
    if (appDataDeleted) {
      return "TapTag app data was deleted, but the login account could not be removed. Sign out and back in, then try again.";
    }

    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Password did not match this account.";
      case "auth/too-many-requests":
        return "Too many delete attempts. Try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return "Could not delete your account right now.";
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleting) return;

    if (!user.email) {
      setStatus("Account deletion requires an email/password account in this build.");
      return;
    }

    if (!deletePassword.trim()) {
      setStatus("Enter your password before deleting your account.");
      return;
    }

    if (!deleteArmed) {
      setDeleteArmed(true);
      setStatus("Tap Delete Account again to permanently remove your TapTag account.");
      return;
    }

    let appDataDeleted = false;

    try {
      setDeleting(true);
      setStatus(null);

      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      await deleteUserAccount(user.uid);
      appDataDeleted = true;
      await deleteUser(user);
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (appDataDeleted) {
        setProfile(null);
        setWalletCount(0);
        setRecentEvents([]);
      }
      setStatus(getDeleteErrorMessage(error?.code, appDataDeleted));
    } finally {
      setDeleting(false);
      setDeleteArmed(false);
      setDeletePassword("");
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
      payment_prompt_opened: 0,
      payment_wallet_opened: 0,
      payment_prompt_confirmed: 0,
      payment_prompt_feedback: 0,
      companion_pass_updated: 0,
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
      case "payment_prompt_opened":
        return `Pay prompt opened${event.brandName ? `, ${event.brandName}` : ""}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ""}`;
      case "payment_wallet_opened":
        return `Wallet handoff${event.brandName ? `, ${event.brandName}` : ""}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ""}`;
      case "payment_prompt_confirmed":
        return `Used card${event.brandName ? `, ${event.brandName}` : ""}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ""}`;
      case "payment_prompt_feedback":
        return `Payment feedback${event.brandName ? `, ${event.brandName}` : ""}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ""}`;
      case "companion_pass_updated":
        return `Companion pass updated${event.brandName ? `, ${event.brandName}` : ""}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ""}`;
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0af"
          />
        }
      >
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
              {saving ? "Saving..." : "Save Profile"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy & Notifications</Text>
          <Text style={styles.label}>Privacy Mode</Text>
          <Text style={styles.value}>{profile?.privacyMode ?? "strict"}</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Nearby notifications</Text>
              <Text style={styles.settingBody}>
                Allow TapTag to schedule local payment prompts when Nearby finds
                a card recommendation. In-app nudges still work when this is off.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              disabled={savingNotifications}
              trackColor={{ false: "#333", true: "#075f8f" }}
              thumbColor={notificationsEnabled ? "#0af" : "#f4f4f4"}
              accessibilityLabel="Toggle nearby notifications"
            />
          </View>
          {savingNotifications ? (
            <Text style={styles.smallStatus}>Saving notification preference...</Text>
          ) : null}

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
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Prompt</Text>
              <Text style={styles.metricValue}>
                {eventCounts.payment_prompt_opened +
                  eventCounts.payment_wallet_opened +
                  eventCounts.payment_prompt_confirmed +
                  eventCounts.payment_prompt_feedback +
                  eventCounts.companion_pass_updated}
              </Text>
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

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Delete Account</Text>
          <Text style={styles.bodyText}>
            Permanently removes your TapTag profile, wallet refs, recent events,
            companion pass preview, and Firebase login.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor="#666"
            value={deletePassword}
            onChangeText={(value) => {
              setDeletePassword(value);
              if (deleteArmed) setDeleteArmed(false);
            }}
            secureTextEntry
            autoComplete="current-password"
          />
          <TouchableOpacity
            style={[
              styles.deleteButton,
              (deleting || !deletePassword.trim()) && styles.disabledButton,
            ]}
            onPress={handleDeleteAccount}
            disabled={deleting || !deletePassword.trim()}
          >
            <Text style={styles.deleteButtonText}>
              {deleting
                ? "Deleting..."
                : deleteArmed
                  ? "Confirm Delete Account"
                  : "Delete Account"}
            </Text>
          </TouchableOpacity>
          {deleteArmed ? (
            <TouchableOpacity
              style={styles.cancelDeleteButton}
              onPress={() => {
                setDeleteArmed(false);
                setStatus(null);
              }}
            >
              <Text style={styles.cancelDeleteText}>Cancel deletion</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {status ? (
          <View style={styles.statusCard}>
            <Text style={styles.status}>{status}</Text>
            {status.startsWith("Could not load") ? (
              <TouchableOpacity style={styles.retryButton} onPress={() => loadProfile()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

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
    borderRadius: 8,
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
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingBody: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
  },
  smallStatus: {
    color: "#8ecfff",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
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
  dangerCard: {
    backgroundColor: "#160d0d",
    borderColor: "#4d2424",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  dangerTitle: {
    color: "#ff8a8a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: "#b83333",
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelDeleteButton: {
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 8,
  },
  cancelDeleteText: {
    color: "#ffb0b0",
    fontSize: 14,
    fontWeight: "600",
  },
  statusCard: {
    backgroundColor: "#111822",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  status: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0af",
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "700",
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
