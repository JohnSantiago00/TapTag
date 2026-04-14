import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

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
  const ref = doc(db, "users", uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeUserProfile(snapshot.data());
}

// Upsert is called from auth flows so profile creation is safe to repeat.
export async function upsertUserProfile(
  uid: string,
  profile?: { displayName?: string }
) {
  const ref = doc(db, "users", uid);

  // The auth flow may call this many times over the lifetime of the account,
  // so it is careful to preserve existing fields unless it must fill defaults.
  const existing = await getDoc(ref);
  const now = new Date().toISOString();

  const existingData = existing.exists() ? existing.data() : null;

  await setDoc(
    ref,
    {
      displayName:
        profile?.displayName ??
        (typeof existingData?.displayName === "string"
          ? existingData.displayName
          : null),
      privacyMode: "strict",
      notificationsEnabled:
        typeof existingData?.notificationsEnabled === "boolean"
          ? existingData.notificationsEnabled
          : false,
      createdAt:
        typeof existingData?.createdAt === "string"
          ? existingData.createdAt
          : now,
      updatedAt: now,
    },
    { merge: true }
  );
}

// Explicit profile updates are separate from auth-time upserts so Profile.tsx
// can save user edits without needing to know the full Firestore shape.
export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string }
) {
  // Re-read the existing profile so partial UI updates do not accidentally wipe
  // out fields that the screen is not editing.
  const existingProfile = await getUserProfile(uid);

  await setDoc(
    doc(db, "users", uid),
    {
      displayName: updates.displayName?.trim() || null,
      privacyMode: "strict",
      notificationsEnabled: existingProfile?.notificationsEnabled ?? false,
      createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
