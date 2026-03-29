import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

export interface UserProfile {
  displayName?: string;
  privacyMode: "strict";
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function upsertUserProfile(
  uid: string,
  profile?: { displayName?: string }
) {
  const ref = doc(db, "users", uid);
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
      privacyMode:
        typeof existingData?.privacyMode === "string"
          ? existingData.privacyMode
          : "strict",
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
