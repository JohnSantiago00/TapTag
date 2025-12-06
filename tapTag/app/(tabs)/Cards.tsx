import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../src/config/firebase";
import {
  addUserCard,
  Card,
  deleteUserCard,
  getUserCards,
} from "../../src/services/firestore/userCards";

export default function CardsScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    loadCards();
  }, []);

  async function loadCards() {
    setLoading(true);
    const data = await getUserCards(user!.uid);
    setCards(data);
    setLoading(false);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    await addUserCard(user!.uid, {
      name,
      categoryRewards: {
        Dining: 3,
        Groceries: 2,
        Gas: 1,
      },
      createdAt: new Date().toISOString(),
    });
    setName("");
    await loadCards();
  }

  async function handleDelete(id: string) {
    await deleteUserCard(user!.uid, id);
    await loadCards();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Cards</Text>

      <View style={styles.addRow}>
        <TextInput
          placeholder="Card Name"
          placeholderTextColor="#aaa"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={{ color: "#fff" }}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={{ color: "#aaa", marginTop: 20 }}>Loading...</Text>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.cardRow}>
              <Text style={styles.cardText}>{item.name}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id!)}>
                <Text style={{ color: "#f55" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 80 },
  title: { color: "#0af", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  addRow: { flexDirection: "row", marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: "#111",
    color: "#fff",
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: "#0af",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  cardText: { color: "#fff", fontSize: 16 },
});
