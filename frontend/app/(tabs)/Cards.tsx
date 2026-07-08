import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { getAllCards, KnowledgeCard } from "../../src/services/data/cards";
import { trackUserEvent } from "../../src/services/data/events";
import {
  addWalletCard,
  getUserWallet,
  removeWalletCard,
  WalletCardRef,
} from "../../src/services/data/wallet";

const CARD_COLORS = ["#00AAFF", "#7C5CFF", "#13C27A", "#FFB020", "#FF5A5F"];

type WalletDraft = {
  nickname: string;
  last4: string;
  color: string;
};

/*
  File role:
  Wallet is the setup step that makes the rest of TapTag meaningful.

  Mental model:
  global card products live in the knowledge layer, but this screen stores which
  of those products the current user actually has access to.
*/

// Wallet is where the user tells TapTag which card products they actually own.
// The screen intentionally works with seeded product refs only, not real card
// credentials.
export default function Cards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [wallet, setWallet] = useState<WalletCardRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [walletDrafts, setWalletDrafts] = useState<Record<string, WalletDraft>>({});
  const [error, setError] = useState<string | null>(null);

  // This loader combines global knowledge cards with user-specific wallet refs
  // so the UI can show both the available catalog and the selected subset.
  const loadWalletScreen = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [availableCards, selectedWallet] = await Promise.all([
        getAllCards(),
        getUserWallet(user.uid),
      ]);
      setCards(availableCards);
      setWallet(selectedWallet.filter((item) => item.enabled));
      setWalletDrafts((current) => {
        const next = { ...current };
        selectedWallet.forEach((item) => {
          next[item.id] = {
            nickname: item.nickname ?? "",
            last4: item.last4 ?? "",
            color: item.color ?? "#00AAFF",
          };
        });
        return next;
      });
    } catch (loadError) {
      console.error("Error loading wallet screen:", loadError);
      setError("Could not load wallet data from the TapTag API.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      // Refresh on focus so a tester coming back from another tab sees the
      // latest wallet state without needing a manual reload button.
      loadWalletScreen();
    }, [loadWalletScreen, user])
  );

  // We derive a Set first because membership checks happen repeatedly while
  // rendering the list and summary.
  const selectedIds = useMemo(
    () => new Set(wallet.map((item) => item.id)),
    [wallet]
  );

  // selectedCards lets the summary show friendly names instead of raw ids.
  const selectedCards = useMemo(
    () => cards.filter((card) => selectedIds.has(card.id)),
    [cards, selectedIds]
  );
  const walletById = useMemo(
    () => new Map(wallet.map((item) => [item.id, item])),
    [wallet]
  );

  function updateWalletDraft(cardId: string, patch: Partial<WalletDraft>) {
    setWalletDrafts((current) => ({
      ...current,
      [cardId]: {
        nickname: current[cardId]?.nickname ?? "",
        last4: current[cardId]?.last4 ?? "",
        color: current[cardId]?.color ?? "#00AAFF",
        ...patch,
      },
    }));
  }

  // Toggling a wallet card updates the backend first, then records a lightweight
  // event so Profile can show recent activity and QA can verify behavior.
  async function handleToggleWalletCard(cardId: string, isSelected: boolean) {
    if (!user) return;

    setSavingCardId(cardId);
    setError(null);
    try {
      if (isSelected) {
        await removeWalletCard(user.uid, cardId);
      } else {
        const card = cards.find((item) => item.id === cardId);
        const draft = walletDrafts[cardId];
        await addWalletCard(user.uid, cardId, {
          nickname: draft?.nickname || card?.name || null,
          last4: draft?.last4 || null,
          color: draft?.color || "#00AAFF",
        });
      }

      const nextSelectedIds = isSelected
        ? wallet.filter((item) => item.id !== cardId).map((item) => item.id)
        : [...wallet.map((item) => item.id), cardId];

      await trackUserEvent(user.uid, {
        eventType: "wallet_updated",
        source: "wallet",
        cardProductId: cardId,
        cardProductIds: nextSelectedIds,
        action: isSelected ? "removed" : "added",
        metadata: {
          selectedCount: nextSelectedIds.length,
        },
      });

      await loadWalletScreen();
    } catch (saveError) {
      console.error("Error updating wallet card:", saveError);
      setError("Could not update your wallet. Check the API connection and try again.");
    } finally {
      setSavingCardId(null);
    }
  }

  async function handleSaveWalletDetails(cardId: string) {
    if (!user) return;

    const draft = walletDrafts[cardId];
    setSavingCardId(cardId);
    setError(null);

    try {
      await addWalletCard(user.uid, cardId, {
        nickname: draft?.nickname || null,
        last4: draft?.last4 || null,
        color: draft?.color || "#00AAFF",
      });

      await trackUserEvent(user.uid, {
        eventType: "wallet_updated",
        source: "wallet",
        cardProductId: cardId,
        cardProductIds: wallet.map((item) => item.id),
        action: "details_updated",
        metadata: {
          hasNickname: Boolean(draft?.nickname),
          hasLast4: /^\d{4}$/.test(draft?.last4 ?? ""),
        },
      });

      await loadWalletScreen();
    } catch (saveError) {
      console.error("Error saving wallet card details:", saveError);
      setError("Could not save card details. Use a 4-digit last 4 and try again.");
    } finally {
      setSavingCardId(null);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Wallet</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Sign in to choose the card products you already own.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Wallet</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Privacy-first wallet</Text>
        <Text style={styles.infoText}>
          TapTag uses card-product references only, without storing card
          numbers, CVV, expiration dates, or billing details.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>This phase</Text>
        <Text style={styles.infoText}>
          Choose from seeded card products only. TapTag stores lightweight card
          product references in your wallet, not sensitive payment details.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Selected Wallet Cards ({wallet.length})</Text>
      <Text style={styles.helperText}>
        Your Lab and Nearby recommendations will use these selected card
        products.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current wallet</Text>
        <Text style={styles.summaryText}>
          {selectedCards.length
            ? selectedCards
                .map((card) => walletById.get(card.id)?.nickname || card.name)
                .join(", ")
            : "No wallet cards selected yet."}
        </Text>
      </View>

      {loading ? <ActivityIndicator color="#0af" style={styles.loader} /> : null}

      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadWalletScreen}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !error && !cards.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No seeded card products are available yet.
          </Text>
        </View>
      ) : null}

      {!loading && !error && cards.length ? (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          // FlatList is used because this screen is conceptually a catalog of
          // card products, and it scales better than mapping a raw array.
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            const walletRef = walletById.get(item.id);
            const draft = walletDrafts[item.id] ?? {
              nickname: walletRef?.nickname ?? "",
              last4: walletRef?.last4 ?? "",
              color: walletRef?.color ?? "#00AAFF",
            };

            return (
              <View style={styles.cardRow}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardCopy}>
                    <View style={styles.cardTitleRow}>
                      {isSelected ? (
                        <View
                          style={[
                            styles.cardColorDot,
                            { backgroundColor: draft.color || "#00AAFF" },
                          ]}
                        />
                      ) : null}
                      <Text style={styles.cardText}>{item.name}</Text>
                    </View>
                    <Text style={styles.cardMeta}>
                      {item.issuer} • {item.network}
                      {walletRef?.last4 ? ` • **** ${walletRef.last4}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      handleToggleWalletCard(item.id, selectedIds.has(item.id))
                    }
                    disabled={savingCardId === item.id}
                  >
                    <Text style={isSelected ? styles.removeText : styles.addText}>
                      {savingCardId === item.id
                        ? "Saving..."
                        : isSelected
                          ? "Remove"
                          : "Add"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isSelected ? (
                  <View style={styles.detailsPanel}>
                    <Text style={styles.detailsLabel}>Card Nickname</Text>
                    <TextInput
                      style={styles.detailsInput}
                      placeholder={item.name}
                      placeholderTextColor="#666"
                      value={draft.nickname}
                      onChangeText={(value) =>
                        updateWalletDraft(item.id, { nickname: value })
                      }
                    />
                    <Text style={styles.detailsLabel}>Last 4</Text>
                    <TextInput
                      style={styles.detailsInput}
                      placeholder="Optional"
                      placeholderTextColor="#666"
                      keyboardType="number-pad"
                      maxLength={4}
                      value={draft.last4}
                      onChangeText={(value) =>
                        updateWalletDraft(item.id, {
                          last4: value.replace(/\D/g, "").slice(0, 4),
                        })
                      }
                    />
                    <Text style={styles.detailsLabel}>Color</Text>
                    <View style={styles.swatchRow}>
                      {CARD_COLORS.map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.swatch,
                            { backgroundColor: color },
                            draft.color === color && styles.swatchActive,
                          ]}
                          onPress={() => updateWalletDraft(item.id, { color })}
                        />
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.saveDetailsButton}
                      onPress={() => handleSaveWalletDetails(item.id)}
                      disabled={savingCardId === item.id}
                    >
                      <Text style={styles.saveDetailsText}>Save Details</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 24,
  },
  title: {
    color: "#0af",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 14,
  },
  infoCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoTitle: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 21,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 6,
  },
  helperText: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  loader: {
    marginTop: 16,
  },
  cardRow: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardCopy: {
    flex: 1,
    marginRight: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardText: { color: "#fff", fontSize: 16 },
  cardMeta: {
    color: "#888",
    fontSize: 13,
    marginTop: 4,
  },
  addText: {
    color: "#0af",
    fontSize: 14,
    fontWeight: "600",
  },
  removeText: {
    color: "#f55",
    fontSize: 14,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: "#111822",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  summaryTitle: {
    color: "#8ecfff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  summaryText: {
    color: "#cfe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 16,
  },
  errorCard: {
    backgroundColor: "#241111",
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  errorText: {
    color: "#ffb3b3",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0af",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    color: "#aaa",
    fontSize: 15,
    lineHeight: 21,
  },
  detailsPanel: {
    borderTopColor: "#242424",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  detailsLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  detailsInput: {
    backgroundColor: "#080808",
    borderColor: "#2a2a2a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#fff",
    fontSize: 15,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: "#111",
    borderWidth: 2,
  },
  swatchActive: {
    borderColor: "#fff",
  },
  saveDetailsButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0af",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveDetailsText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "800",
  },
});
