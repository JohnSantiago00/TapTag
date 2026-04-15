import { readJson, writeJson } from '../../demo/storage';

/*
  File role:
  Owns the lightweight TapTag user profile document.

  In demo mode, profile data stays local so the app remains clone-and-run.
*/

export interface UserProfile {
  displayName?: string;
  privacyMode: 'strict';
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function profileKey(uid: string) {
  return `taptag.demo.profile.${uid}`;
}

function normalizeUserProfile(data: any): UserProfile {
  const now = new Date().toISOString();

  return {
    displayName:
      typeof data?.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
        : undefined,
    privacyMode: 'strict',
    notificationsEnabled:
      typeof data?.notificationsEnabled === 'boolean'
        ? data.notificationsEnabled
        : false,
    createdAt: typeof data?.createdAt === 'string' ? data.createdAt : now,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : now,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const stored = await readJson<Record<string, unknown> | null>(profileKey(uid), null);
  return stored ? normalizeUserProfile(stored) : null;
}

export async function upsertUserProfile(
  uid: string,
  profile?: { displayName?: string }
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  const now = new Date().toISOString();

  const nextProfile: UserProfile = {
    displayName: profile?.displayName ?? existing?.displayName,
    privacyMode: 'strict',
    notificationsEnabled: existing?.notificationsEnabled ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeJson(profileKey(uid), nextProfile);
  return nextProfile;
}

export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string }
) {
  const existingProfile = await getUserProfile(uid);

  const nextProfile: UserProfile = {
    displayName: updates.displayName?.trim() || undefined,
    privacyMode: 'strict',
    notificationsEnabled: existingProfile?.notificationsEnabled ?? false,
    createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeJson(profileKey(uid), nextProfile);
  return nextProfile;
}
