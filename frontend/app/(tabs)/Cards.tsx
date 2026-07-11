import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardDoneBar,
  KeyboardDoneInline,
  NUMERIC_INPUT_ACCESSORY_ID,
  dismissKeyboard,
} from "../../src/components/KeyboardDoneBar";
import { useAuth } from "../../src/context/AuthContext";
import { getAllCards, KnowledgeCard } from "../../src/services/data/cards";
import { trackUserEvent } from "../../src/services/data/events";
import {
  addWalletCard,
  getUserWallet,
  removeWalletCard,
  WalletCardRef,
} from "../../src/services/data/wallet";
import { getTabScrollContentStyle } from "../../src/styles/layout";

const CARD_COLORS = ["#00AAFF", "#7C5CFF", "#13C27A", "#FFB020", "#FF5A5F"];

type WalletDraft = {
  nickname: string;
  last4: string;
  color: string;
};

type SelectedWalletCard = {
  card: KnowledgeCard;
  walletRef: WalletCardRef;
};

/*
  File role:
  Wallet is the setup step that makes the rest of TapTag meaningful.

  Mental model:
  global card products live in the knowledge layer, but this screen stores which
  of those products the current user actually has access to.
*/

// Wallet is where the user tells TapTag which card products they actually own.
// The screen intentionally works with seeded product refs or custom metadata,
// not real card credentials.
export default function Cards() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [wallet, setWallet] = useState<WalletCardRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [walletDrafts, setWalletDrafts] = useState<Record<string, WalletDraft>>({});
  const [error, setError] = useState<string | null>(null);

  const loadWalletScreen = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [availableCards, selectedWallet] = await Promise.all([
          getAllCards(),
          getUserWallet(user.uid),
        ]);
        const enabledWallet = selectedWallet.filter((item) => item.enabled);
        setCards(availableCards);
        setWallet(enabledWallet);
        setWalletDrafts((current) => {
          const next = { ...current };
          enabledWallet.forEach((item) => {
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
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadWalletScreen();
    }, [loadWalletScreen, user])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWalletScreen({ silent: true });
    setRefreshing(false);
  }, [loadWalletScreen]);

  const selectedIds = useMemo(
    () => new Set(wallet.map((item) => item.id)),
    [wallet]
  );
  const walletById = useMemo(
    () => new Map(wallet.map((item) => [item.id, item])),
    [wallet]
  );
  const cardsById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );
  const selectedCards = useMemo<SelectedWalletCard[]>(
    () =>
      wallet
        .map((walletRef) => {
          const card = cardsById.get(walletRef.id) ?? cardFromWalletRef(walletRef);
          return card ? { card, walletRef } : null;
        })
        .filter((item): item is SelectedWalletCard => Boolean(item)),
    [cardsById, wallet]
  );
  const catalogCards = useMemo(
    () => cards.filter((card) => !card.isCustom),
    [cards]
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

  async function handleToggleWalletCard(cardId: string, isSelected: boolean) {
    if (!user) return;

    setSavingCardId(cardId);
    setError(null);
    try {
      if (isSelected) {
        await removeWalletCard(user.uid, cardId);
        if (editingCardId === cardId) setEditingCardId(null);
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

      setEditingCardId(null);
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
        <View style={getTabScrollContentStyle(width, insets)}>
          <Text style={styles.title}>Wallet</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Sign in to choose the card products you already own.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Wallet</Text>
          <Text style={styles.subtitle}>
            Card metadata only. No full numbers, CVV, expiration, or billing data.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={() => router.push("/add-card" as never)}
          accessibilityLabel="Add custom card"
        >
          <Ionicons name="add" size={22} color="#00131f" />
        </TouchableOpacity>
      </View>

      {selectedCards.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.walletTilesRow}
          keyboardShouldPersistTaps="handled"
        >
          {selectedCards.map(({ card, walletRef }) => {
            const draft = walletDrafts[walletRef.id] ?? {
              nickname: walletRef.nickname ?? "",
              last4: walletRef.last4 ?? "",
              color: walletRef.color ?? "#00AAFF",
            };
            return (
              <TouchableOpacity
                key={walletRef.id}
                style={[styles.walletTile, { backgroundColor: draft.color || "#00AAFF" }]}
                onPress={() =>
                  setEditingCardId((current) =>
                    current === walletRef.id ? null : walletRef.id
                  )
                }
                activeOpacity={0.88}
              >
                <View style={styles.walletTileTopRow}>
                  <Text style={styles.walletTileNetwork}>{networkGlyph(card.network)}</Text>
                  <Ionicons name="create-outline" size={18} color="#00131f" />
                </View>
                <View>
                  <Text style={styles.walletTileName} numberOfLines={2}>
                    {draft.nickname || card.name}
                  </Text>
                  <Text style={styles.walletTileIssuer} numberOfLines={1}>
                    {card.issuer}
                  </Text>
                </View>
                <Text style={styles.walletTileLast4}>
                  {draft.last4 ? `•••• ${draft.last4}` : "Tap to edit"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyWalletCard}>
          <Text style={styles.emptyTitle}>Add your first card</Text>
          <Text style={styles.emptyText}>
            Recommendations start once TapTag knows the cards in your wallet.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/add-card" as never)}
          >
            <Ionicons name="add-circle-outline" size={18} color="#00131f" />
            <Text style={styles.primaryButtonText}>Add Card</Text>
          </TouchableOpacity>
        </View>
      )}

      {editingCardId ? renderEditPanel(editingCardId) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/add-card" as never)}
        >
          <Ionicons name="create-outline" size={18} color="#00131f" />
          <Text style={styles.primaryButtonText}>Add your own</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Card catalog</Text>
        <Text style={styles.infoText}>
          Add known card products here, or create a custom card for products not
          listed yet.
        </Text>
      </View>

      {loading ? <ActivityIndicator color="#0af" style={styles.loader} /> : null}

      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadWalletScreen()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!loading && !error && !catalogCards.length ? (
        <View style={styles.emptyCatalogCard}>
          <Text style={styles.emptyText}>No catalog card products are available yet.</Text>
        </View>
      ) : null}
    </View>
  );

  function renderEditPanel(cardId: string) {
    const walletRef = walletById.get(cardId);
    const card = cardsById.get(cardId) ?? (walletRef ? cardFromWalletRef(walletRef) : null);
    if (!walletRef || !card) return null;

    const draft = walletDrafts[cardId] ?? {
      nickname: walletRef.nickname ?? "",
      last4: walletRef.last4 ?? "",
      color: walletRef.color ?? "#00AAFF",
    };

    return (
      <View style={styles.detailsPanel}>
        <View style={styles.detailsHeaderRow}>
          <View style={styles.detailsHeaderCopy}>
            <Text style={styles.detailsTitle}>{draft.nickname || card.name}</Text>
            <Text style={styles.detailsMeta}>
              {card.issuer} • {card.network}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconOnlyButton}
            onPress={() => {
              Keyboard.dismiss();
              setEditingCardId(null);
            }}
            accessibilityLabel="Close card details"
          >
            <Ionicons name="close" size={20} color="#aaa" />
          </TouchableOpacity>
        </View>

        <Text style={styles.detailsLabel}>Card Nickname</Text>
        <TextInput
          style={styles.detailsInput}
          placeholder={card.name}
          placeholderTextColor="#666"
          value={draft.nickname}
          onChangeText={(value) => updateWalletDraft(cardId, { nickname: value })}
          returnKeyType="done"
          onSubmitEditing={dismissKeyboard}
        />
        <View style={styles.detailsLabelRow}>
          <Text style={styles.detailsLabel}>Last 4</Text>
          <KeyboardDoneInline />
        </View>
        <TextInput
          style={styles.detailsInput}
          placeholder="Optional"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          inputAccessoryViewID={NUMERIC_INPUT_ACCESSORY_ID}
          maxLength={4}
          returnKeyType="done"
          value={draft.last4}
          onChangeText={(value) =>
            updateWalletDraft(cardId, {
              last4: value.replace(/\D/g, "").slice(0, 4),
            })
          }
          onSubmitEditing={dismissKeyboard}
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
              onPress={() => updateWalletDraft(cardId, { color })}
              accessibilityLabel={`Use color ${color}`}
            />
          ))}
        </View>
        <View style={styles.detailsButtonRow}>
          <TouchableOpacity
            style={styles.saveDetailsButton}
            onPress={() => {
              Keyboard.dismiss();
              handleSaveWalletDetails(cardId);
            }}
            disabled={savingCardId === cardId}
          >
            <Text style={styles.saveDetailsText}>
              {savingCardId === cardId ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.disableButton}
            onPress={() => handleToggleWalletCard(cardId, true)}
            disabled={savingCardId === cardId}
          >
            <Text style={styles.disableButtonText}>Disable</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={loading || error ? [] : catalogCards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={getTabScrollContentStyle(width, insets)}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0af"
          />
        }
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          const walletRef = walletById.get(item.id);
          const draft = walletDrafts[item.id] ?? {
            nickname: walletRef?.nickname ?? "",
            last4: walletRef?.last4 ?? "",
            color: walletRef?.color ?? "#00AAFF",
          };

          return (
            <View style={styles.catalogRow}>
              <View style={[styles.catalogCardPreview, { backgroundColor: draft.color }]}>
                <Text style={styles.catalogPreviewNetwork}>{networkGlyph(item.network)}</Text>
                <Text style={styles.catalogPreviewLast4}>
                  {draft.last4 ? `••${draft.last4}` : "••••"}
                </Text>
              </View>
              <View style={styles.catalogCopy}>
                <Text style={styles.catalogTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.catalogMeta} numberOfLines={1}>
                  {item.issuer} • {item.network}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.catalogActionButton,
                  isSelected && styles.catalogActionButtonSelected,
                ]}
                onPress={() =>
                  isSelected
                    ? setEditingCardId(item.id)
                    : handleToggleWalletCard(item.id, false)
                }
                disabled={savingCardId === item.id}
              >
                <Text
                  style={[
                    styles.catalogActionText,
                    isSelected && styles.catalogActionTextSelected,
                  ]}
                >
                  {savingCardId === item.id ? "Saving" : isSelected ? "Edit" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}

function cardFromWalletRef(walletRef: WalletCardRef): KnowledgeCard | null {
  if (!walletRef.custom) return null;

  return {
    id: walletRef.id,
    name: walletRef.custom.name,
    issuer: walletRef.custom.issuer || "Custom",
    network: walletRef.custom.network || "Other",
    rewardRules: walletRef.custom.rewardRules,
    annualFee: null,
    isCustom: true,
  };
}

function networkGlyph(network: string) {
  if (network === "Amex") return "AMEX";
  if (network === "Mastercard") return "MC";
  if (network === "Discover") return "DISC";
  if (network === "Visa") return "VISA";
  return "CARD";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
  },
  headerAddButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 10,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  walletTilesRow: {
    gap: 12,
    paddingBottom: 14,
  },
  walletTile: {
    borderRadius: 16,
    height: 178,
    justifyContent: "space-between",
    padding: 16,
    width: 282,
  },
  walletTileTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  walletTileNetwork: {
    color: "rgba(0, 19, 31, 0.78)",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
  },
  walletTileName: {
    color: "#00131f",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
  },
  walletTileIssuer: {
    color: "rgba(0, 19, 31, 0.68)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  walletTileLast4: {
    color: "#00131f",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyWalletCard: {
    backgroundColor: "#111822",
    borderColor: "#26384a",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyText: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionRow: {
    alignItems: "flex-start",
    marginBottom: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "800",
  },
  infoCard: {
    backgroundColor: "#111",
    borderRadius: 10,
    marginBottom: 12,
    padding: 14,
  },
  infoTitle: {
    color: "#0af",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  infoText: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },
  loader: {
    marginTop: 16,
  },
  emptyCatalogCard: {
    backgroundColor: "#111",
    borderRadius: 10,
    marginBottom: 12,
    padding: 16,
  },
  errorCard: {
    backgroundColor: "#241111",
    borderRadius: 10,
    marginBottom: 14,
    padding: 16,
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
  detailsPanel: {
    backgroundColor: "#101010",
    borderColor: "#242424",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  detailsHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  detailsHeaderCopy: {
    flex: 1,
  },
  detailsTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  detailsMeta: {
    color: "#888",
    fontSize: 13,
    marginTop: 4,
  },
  iconOnlyButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  detailsLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  detailsLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
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
    marginBottom: 14,
  },
  swatch: {
    borderColor: "#111",
    borderRadius: 15,
    borderWidth: 2,
    height: 30,
    width: 30,
  },
  swatchActive: {
    borderColor: "#fff",
  },
  detailsButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  saveDetailsButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 11,
  },
  saveDetailsText: {
    color: "#00131f",
    fontSize: 14,
    fontWeight: "800",
  },
  disableButton: {
    alignItems: "center",
    backgroundColor: "#211111",
    borderColor: "#5a2222",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  disableButtonText: {
    color: "#ff8f8f",
    fontSize: 14,
    fontWeight: "800",
  },
  catalogRow: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    padding: 12,
  },
  catalogCardPreview: {
    borderRadius: 8,
    height: 54,
    justifyContent: "space-between",
    padding: 8,
    width: 82,
  },
  catalogPreviewNetwork: {
    color: "rgba(0, 19, 31, 0.78)",
    fontSize: 11,
    fontWeight: "900",
  },
  catalogPreviewLast4: {
    color: "#00131f",
    fontSize: 12,
    fontWeight: "800",
  },
  catalogCopy: {
    flex: 1,
  },
  catalogTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  catalogMeta: {
    color: "#888",
    fontSize: 13,
    marginTop: 3,
  },
  catalogActionButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 8,
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catalogActionButtonSelected: {
    backgroundColor: "#151515",
    borderColor: "#333",
    borderWidth: 1,
  },
  catalogActionText: {
    color: "#00131f",
    fontSize: 13,
    fontWeight: "800",
  },
  catalogActionTextSelected: {
    color: "#8ecfff",
  },
});
