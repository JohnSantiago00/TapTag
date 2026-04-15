import { readJson, writeJson } from '../../demo/storage';

/*
  File role:
  Encapsulates the user's wallet collection.

  In demo mode, wallet state lives in AsyncStorage so testers can use the app
  offline and without setting up Firestore.
*/

export interface WalletCardRef {
  id: string;
  enabled: boolean;
  nickname?: string;
  addedAt: string;
  updatedAt: string;
}

function walletKey(uid: string) {
  return `taptag.demo.wallet.${uid}`;
}

export async function getUserWallet(uid: string): Promise<WalletCardRef[]> {
  return readJson<WalletCardRef[]>(walletKey(uid), []);
}

export async function addWalletCard(
  uid: string,
  cardProductId: string,
  nickname?: string
) {
  const wallet = await getUserWallet(uid);
  const now = new Date().toISOString();
  const existing = wallet.find((item) => item.id === cardProductId);

  const nextWallet = existing
    ? wallet.map((item) =>
        item.id === cardProductId
          ? {
              ...item,
              enabled: true,
              nickname: nickname ?? item.nickname,
              updatedAt: now,
            }
          : item
      )
    : [
        ...wallet,
        {
          id: cardProductId,
          enabled: true,
          nickname,
          addedAt: now,
          updatedAt: now,
        },
      ];

  await writeJson(walletKey(uid), nextWallet);
}

export async function removeWalletCard(uid: string, cardProductId: string) {
  const wallet = await getUserWallet(uid);
  await writeJson(
    walletKey(uid),
    wallet.filter((item) => item.id !== cardProductId)
  );
}
