import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "../../config/firebase";

export interface Card {
  id?: string;
  name: string;
  categoryRewards: Record<string, number>;
  createdAt: string;
}

// Add a new card
export async function addUserCard(uid: string, card: Omit<Card, "id">) {
  const ref = collection(db, `users/${uid}/cards`);
  await addDoc(ref, card);
}

// Get all user cards
export async function getUserCards(uid: string): Promise<Card[]> {
  const ref = collection(db, `users/${uid}/cards`);
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Card[];
}

// Delete a card
export async function deleteUserCard(uid: string, cardId: string) {
  const ref = doc(db, `users/${uid}/cards/${cardId}`);
  await deleteDoc(ref);
}
