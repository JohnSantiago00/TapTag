import { apiRequest } from "../api";

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
  void uid;
  return apiRequest<WalletCardRef[]>("/api/users/me/wallet", {
    authRequired: true,
  });
}

// We preserve the original addedAt when a user re-adds a card so the wallet can
// behave like a stable list over time.
export async function addWalletCard(
  uid: string,
  cardProductId: string,
  nickname?: string
) {
  void uid;
  await apiRequest<void>(`/api/users/me/wallet/${cardProductId}`, {
    method: "PUT",
    authRequired: true,
    body: { nickname: nickname ?? null },
  });
}

// Deleting the doc keeps the current thin slice simple. A future version could
// soft-disable instead if history becomes important.
export async function removeWalletCard(uid: string, cardProductId: string) {
  void uid;
  await apiRequest<void>(`/api/users/me/wallet/${cardProductId}`, {
    method: "DELETE",
    authRequired: true,
  });
}
