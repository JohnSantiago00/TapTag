import { useAuth } from '@/src/context/AuthContext';
import {
  getRecentUserEvents,
  TapTagEvent,
} from '@/src/services/firestore/events';
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from '@/src/services/firestore/userProfile';
import { getUserWallet } from '@/src/services/firestore/wallet';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const { user, signOut, refreshUser, resetCurrentDemoData, resetAllDemoData } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [walletCount, setWalletCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<TapTagEvent[]>([]);
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [resettingCurrent, setResettingCurrent] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);

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
      setDraftDisplayName(loadedProfile?.displayName ?? '');
      setWalletCount(wallet.filter((item) => item.enabled).length);
      setRecentEvents(events);
    } catch (error) {
      console.error('Error loading profile:', error);
      setStatus('Could not load your profile right now.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadProfile();
    }, [loadProfile, user])
  );

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setStatus(null);
      await updateUserProfile(user.uid, { displayName: draftDisplayName });
      await refreshUser();
      await loadProfile();
      setStatus('Profile saved.');
    } catch (error) {
      console.error('Error saving profile:', error);
      setStatus('Could not save your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCurrentDemoData = async () => {
    try {
      setResettingCurrent(true);
      setStatus('Resetting your local demo data...');
      await resetCurrentDemoData();
    } catch (error) {
      console.error('Error resetting current demo data:', error);
      setStatus('Could not reset your local demo data right now.');
    } finally {
      setResettingCurrent(false);
    }
  };

  const handleResetAllDemoData = async () => {
    try {
      setResettingAll(true);
      setStatus('Resetting all TapTag demo data on this device...');
      await resetAllDemoData();
    } catch (error) {
      console.error('Error resetting all demo data:', error);
      setStatus('Could not reset all local demo data right now.');
    } finally {
      setResettingAll(false);
    }
  };

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
    : 'Tracking active, but no events have been recorded yet.';

  function formatEventSummary(event: TapTagEvent) {
    switch (event.eventType) {
      case 'wallet_updated':
        return `Wallet ${event.action ?? 'updated'}${event.cardProductId ? `, ${event.cardProductId}` : ''}`;
      case 'recommendation_shown':
        return `Shown${event.brandName ? `, ${event.brandName}` : ''}${event.recommendedCardName ? `, ${event.recommendedCardName}` : ''}`;
      case 'recommendation_opened':
        return `Opened${event.brandName ? `, ${event.brandName}` : ''}`;
      case 'recommendation_dismissed':
        return `Dismissed${event.brandName ? `, ${event.brandName}` : ''}`;
      case 'brand_muted':
        return `Muted${event.brandName ? `, ${event.brandName}` : ''}`;
      default:
        return event.eventType;
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>Sign in to view your TapTag demo profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator color="#0af" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>
          Local demo profile, privacy-first by default and stored on-device.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email ?? 'Unknown'}</Text>

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
              {saving ? 'Saving...' : 'Save Display Name'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Demo Mode</Text>
          <Text style={styles.bodyText}>
            This branch runs without Firebase. Wallet state, profile details, and
            event history are stored locally on this device.
          </Text>
          <TouchableOpacity
            style={[styles.secondaryButton, resettingCurrent && styles.disabledButton]}
            onPress={handleResetCurrentDemoData}
            disabled={resettingCurrent || resettingAll}
          >
            <Text style={styles.secondaryButtonText}>
              {resettingCurrent ? 'Resetting Your Demo Data...' : 'Reset My Demo Data'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.warningButton, resettingAll && styles.disabledButton]}
            onPress={handleResetAllDemoData}
            disabled={resettingCurrent || resettingAll}
          >
            <Text style={styles.warningButtonText}>
              {resettingAll ? 'Resetting All Device Data...' : 'Reset All Demo Data On This Device'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Defaults</Text>
          <Text style={styles.label}>Privacy Mode</Text>
          <Text style={styles.value}>{profile?.privacyMode ?? 'strict'}</Text>

          <Text style={styles.label}>Notifications Enabled</Text>
          <Text style={styles.value}>{profile?.notificationsEnabled ? 'Yes' : 'No'}</Text>

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
          <Text style={styles.bodyText}>Last {recentEvents.length} tracked events for quick QA.</Text>
          <View style={styles.eventsList}>
            {recentEvents.length ? (
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

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 16,
  },
  title: {
    color: '#0af',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#0af',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  label: {
    color: '#888',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  bodyText: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 21,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  metricCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 72,
  },
  metricLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  eventsList: {
    marginTop: 12,
    gap: 10,
  },
  eventRow: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventMeta: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  eventBody: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#0af',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButton: {
    backgroundColor: '#111822',
    borderColor: '#0af',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  warningButton: {
    backgroundColor: '#221111',
    borderColor: '#663333',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#8ecfff',
    fontSize: 15,
    fontWeight: '600',
  },
  warningButtonText: {
    color: '#ffb3b3',
    fontSize: 15,
    fontWeight: '600',
  },
  status: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: '#221111',
    borderColor: '#663333',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ff8a8a',
    fontSize: 15,
    fontWeight: '600',
  },
});
