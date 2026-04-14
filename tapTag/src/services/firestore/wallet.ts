import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";

/*
  File role:
  Encapsulates the user's wallet collection.

  Key product rule:
  A wallet entry represents ownership/selection of a card product reference,
  not a full payment instrument.
*/

export interface WalletCardRef {
  id: string;
  enabled: boolean;
  nickname?: string;
  addedAt: string;
  updatedAt: string;
}

// The wallet stores references to card products only. This is the core privacy
// boundary, no real card credentials live here.
export async function getUserWallet(uid: string): Promise<WalletCardRef[]> {
  const ref = collection(db, `users/${uid}/wallet`);
  const snapshot = await getDocs(ref);

  return snapshot.docs.map((walletDoc) => {
    const data = walletDoc.data();

    return {
      // The document id is the card product id. That keeps reads simple and
      // avoids storing duplicate id fields in the doc body.
      id: walletDoc.id,
      enabled: data.enabled !== false,
      nickname:
        typeof data.nickname === "string" ? data.nickname : undefined,
      addedAt:
        typeof data.addedAt === "string" ? data.addedAt : new Date().toISOString(),
      updatedAt:
        typeof data.updatedAt === "string"
          ? data.updatedAt
          : new Date().toISOString(),
    };
  });
}

// We preserve the original addedAt when a user re-adds a card so the wallet can
// behave like a stable list over time.
export async function addWalletCard(
  uid: string,
  cardProductId: string,
  nickname?: string
) {
  const ref = doc(db, `users/${uid}/wallet/${cardProductId}`);

  // We read once first so re-adding a previously selected card preserves its
  // original creation time instead of making it look brand new every time.
  const existing = await getDoc(ref);
  const now = new Date().toISOString();

  await setDoc(ref, {
    enabled: true,
    nickname: nickname ?? null,
    addedAt:
      existing.exists() && typeof existing.data().addedAt === "string"
        ? existing.data().addedAt
        : now,
    updatedAt: now,
  });
}

// Deleting the doc keeps the current thin slice simple. A future version could
// soft-disable instead if history becomes important.
export async function removeWalletCard(uid: string, cardProductId: string) {
  const ref = doc(db, `users/${uid}/wallet/${cardProductId}`);
  await deleteDoc(ref);
}
