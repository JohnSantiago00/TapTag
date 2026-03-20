import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";

export interface WalletCardRef {
  id: string;
  enabled: boolean;
  nickname?: string;
  addedAt: string;
  updatedAt: string;
}

export async function getUserWallet(uid: string): Promise<WalletCardRef[]> {
  const ref = collection(db, `users/${uid}/wallet`);
  const snapshot = await getDocs(ref);

  return snapshot.docs.map((walletDoc) => {
    const data = walletDoc.data();

    return {
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

export async function addWalletCard(
  uid: string,
  cardProductId: string,
  nickname?: string
) {
  const ref = doc(db, `users/${uid}/wallet/${cardProductId}`);
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

export async function removeWalletCard(uid: string, cardProductId: string) {
  const ref = doc(db, `users/${uid}/wallet/${cardProductId}`);
  await deleteDoc(ref);
}
