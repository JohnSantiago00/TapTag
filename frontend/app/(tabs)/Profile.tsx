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
import { Ionicons } from "@expo/vector-icons";
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
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getTabScrollContentStyle } from "@/src/styles/layout";
import { ScreenHeader } from "@/src/components/AppChrome";
import { colors, radii, spacing } from "@/src/styles/theme";
import { requestPaymentPromptNotificationPermissions } from "@/src/services/paymentPrompt";

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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
      if (enabled) {
        const granted = await requestPaymentPromptNotificationPermissions();
        if (!granted) {
          throw new Error("Notification permission was not granted.");
        }
      }
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

  function formatEventSummary(event: TapTagEvent) {
    switch (event.eventType) {
      case "wallet_updated":
        return "Wallet updated";
      case "recommendation_shown":
        return `${event.recommendedCardName ?? "A card"} recommended${event.brandName ? ` at ${event.brandName}` : ""}`;
      case "recommendation_opened":
        return `Viewed recommendation${event.brandName ? ` for ${event.brandName}` : ""}`;
      case "recommendation_dismissed":
        return `Dismissed recommendation${event.brandName ? ` for ${event.brandName}` : ""}`;
      case "payment_prompt_opened":
        return `Opened ${event.recommendedCardName ?? "card"}${event.brandName ? ` for ${event.brandName}` : ""}`;
      case "payment_wallet_opened":
        return `Opened device wallet${event.recommendedCardName ? ` for ${event.recommendedCardName}` : ""}`;
      case "payment_prompt_confirmed":
        return `Used ${event.recommendedCardName ?? "recommended card"}${event.brandName ? ` at ${event.brandName}` : ""}`;
      case "payment_prompt_feedback":
        return `Updated a card recommendation${event.brandName ? ` for ${event.brandName}` : ""}`;
      case "companion_pass_updated":
        return "Wallet recommendation updated";
      case "brand_muted":
        return `Muted ${event.brandName ?? "merchant"}`;
      default:
        return "Account activity updated";
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
        contentContainerStyle={getTabScrollContentStyle(width, insets)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0af"
          />
        }
      >
        <ScreenHeader eyebrow="Account" title="Your profile" subtitle="Manage your identity, preferences, and privacy controls." />

        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(draftDisplayName || user.email || "T")[0].toUpperCase()}</Text></View>
          <View style={styles.profileHeroCopy}>
            <Text style={styles.profileName}>{draftDisplayName || "TapTag member"}</Text>
            <Text style={styles.profileEmail}>{user.email ?? "Email unavailable"}</Text>
          </View>
          <View style={styles.walletCountPill}><Text style={styles.walletCountValue}>{walletCount}</Text><Text style={styles.walletCountLabel}>cards</Text></View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}><View style={styles.sectionIcon}><Ionicons name="person-outline" size={18} color={colors.violet} /></View><Text style={styles.sectionTitle}>Personal details</Text></View>

          <Text style={styles.label}>Display name</Text>
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
              {saving ? "Saving…" : "Save changes"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}><View style={styles.sectionIcon}><Ionicons name="notifications-outline" size={18} color={colors.blue} /></View><Text style={styles.sectionTitle}>Preferences</Text></View>

          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Nearby notifications</Text>
              <Text style={styles.settingBody}>
                Receive a local alert when Nearby has a card recommendation ready.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              disabled={savingNotifications}
              trackColor={{ false: colors.border, true: "#245B49" }}
              thumbColor={notificationsEnabled ? colors.accent : colors.textSecondary}
              accessibilityLabel="Toggle nearby notifications"
            />
          </View>
          {savingNotifications ? (
            <Text style={styles.smallStatus}>Saving notification preference...</Text>
          ) : null}

          <View style={styles.preferenceDivider} />
          <View style={styles.staticSettingRow}>
            <View style={styles.settingCopy}><Text style={styles.settingTitle}>Privacy mode</Text><Text style={styles.settingBody}>Strict mode minimizes retained account and location data.</Text></View>
            <View style={styles.strictPill}><Ionicons name="shield-checkmark" size={14} color={colors.accent} /><Text style={styles.strictText}>{profile?.privacyMode ?? "strict"}</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}><View style={styles.sectionIcon}><Ionicons name="time-outline" size={18} color={colors.accent} /></View><Text style={styles.sectionTitle}>Recent activity</Text></View>
          <View style={styles.eventsList}>
            {recentEvents.length ? (
              recentEvents.slice(0, 5).map((event) => (
                <View key={event.id ?? `${event.eventType}-${event.occurredAt}`} style={styles.eventRow}>
                  <View style={styles.eventDot} />
                  <View style={styles.eventCopy}><Text style={styles.eventTitle}>{formatEventSummary(event)}</Text><Text style={styles.eventMeta}>{new Date(event.occurredAt).toLocaleString()}</Text></View>
                </View>
              ))
            ) : (
              <Text style={styles.bodyText}>Your wallet and recommendation activity will appear here.</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}><View style={styles.sectionIcon}><Ionicons name="lock-closed-outline" size={18} color={colors.warning} /></View><Text style={styles.sectionTitle}>Your data</Text></View>
          <View style={styles.dataRow}><Ionicons name="checkmark-circle" size={17} color={colors.accent} /><Text style={styles.bodyText}>Only card product references and optional last four</Text></View>
          <View style={styles.dataRow}><Ionicons name="checkmark-circle" size={17} color={colors.accent} /><Text style={styles.bodyText}>No CVV, expiration, billing address, or bank credentials</Text></View>
          <View style={styles.dataRow}><Ionicons name="checkmark-circle" size={17} color={colors.accent} /><Text style={styles.bodyText}>No history of your precise locations</Text></View>
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.bodyText}>
            Permanently remove your profile, wallet references, activity, and login.
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
          <Ionicons name="log-out-outline" size={18} color={colors.text} /><Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 16,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.large,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  profileHero: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg, padding: spacing.md },
  profileAvatar: { alignItems: "center", backgroundColor: colors.violet, borderRadius: 22, height: 48, justifyContent: "center", width: 48 },
  profileAvatarText: { color: colors.white, fontSize: 18, fontWeight: "900" },
  profileHeroCopy: { flex: 1 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: "900", marginBottom: 3 },
  profileEmail: { color: colors.textMuted, fontSize: 12 },
  walletCountPill: { alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: radii.medium, minWidth: 56, paddingHorizontal: 10, paddingVertical: 8 },
  walletCountValue: { color: colors.accent, fontSize: 17, fontWeight: "900" },
  walletCountLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  sectionHeaderRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionIcon: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: 10, height: 34, justifyContent: "center", width: 34 },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: {
    color: colors.text,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  settingBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  smallStatus: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  bodyText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  preferenceDivider: { backgroundColor: colors.borderSoft, height: 1, marginVertical: spacing.md },
  staticSettingRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  strictPill: { alignItems: "center", backgroundColor: "#15352C", borderRadius: radii.pill, flexDirection: "row", gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  strictText: { color: colors.accent, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
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
    gap: 2,
  },
  eventRow: {
    alignItems: "flex-start",
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  eventDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, marginTop: 6, width: 7 },
  eventCopy: { flex: 1 },
  eventTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  eventMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  dataRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radii.medium,
    borderWidth: 1,
    color: colors.text,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.medium,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.accentInk,
    fontSize: 15,
    fontWeight: "600",
  },
  dangerCard: {
    backgroundColor: colors.dangerSurface,
    borderColor: "#59303A",
    borderRadius: radii.large,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  dangerTitle: {
    color: colors.danger,
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
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    padding: 14,
    marginBottom: 12,
  },
  status: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: "700",
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: 12,
  },
  logoutText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
