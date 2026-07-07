import { apiRequest } from "../api";

/*
  File role:
  Owns the lightweight TapTag user profile document.

  Current product stance:
  The profile is intentionally tiny, enough for identity-adjacent app settings
  without becoming a large settings surface.
*/

export interface UserProfile {
  displayName?: string;
  privacyMode: "strict";
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Privacy mode is forced to strict because that is the current product rule,
// not a user-configurable setting yet.
function normalizeUserProfile(data: any): UserProfile {
  const now = new Date().toISOString();

  return {
    displayName:
      typeof data?.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : undefined,
    privacyMode: "strict",
    notificationsEnabled:
      typeof data?.notificationsEnabled === "boolean"
        ? data.notificationsEnabled
        : false,
    createdAt: typeof data?.createdAt === "string" ? data.createdAt : now,
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : now,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  void uid;
  const profile = await apiRequest<UserProfile | null>("/api/users/me/profile", {
    authRequired: true,
  });
  return profile ? normalizeUserProfile(profile) : null;
}

// Upsert is called from auth flows so profile creation is safe to repeat.
export async function upsertUserProfile(
  uid: string,
  profile?: { displayName?: string }
) {
  void uid;
  await apiRequest<UserProfile>("/api/users/me/profile", {
    method: "PUT",
    authRequired: true,
    body: { displayName: profile?.displayName ?? null },
  });
}

// Explicit profile updates are separate from auth-time upserts so Profile.tsx
// can save user edits without needing to know the full backend persistence shape.
export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string }
) {
  void uid;
  await apiRequest<UserProfile>("/api/users/me/profile", {
    method: "PUT",
    authRequired: true,
    body: { displayName: updates.displayName?.trim() || null },
  });
}
