import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  clearAllDemoStorage,
  clearDemoStorageForUser,
  readJson,
  removeKey,
  writeJson,
} from '../demo/storage';
import { upsertUserProfile } from '../services/firestore/userProfile';

export type AuthUser = {
  uid: string;
  email: string;
  displayName?: string | null;
  isDemo?: boolean;
};

type StoredAuthUser = AuthUser & {
  password: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueInDemoMode: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resetCurrentDemoData: () => Promise<void>;
  resetAllDemoData: () => Promise<void>;
};

const AUTH_USERS_KEY = 'taptag.demo.auth.users';
const CURRENT_USER_KEY = 'taptag.demo.auth.currentUser';

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => undefined,
  signUp: async () => undefined,
  signOut: async () => undefined,
  continueInDemoMode: async () => undefined,
  refreshUser: async () => undefined,
  resetCurrentDemoData: async () => undefined,
  resetAllDemoData: async () => undefined,
});

async function getStoredUsers() {
  return readJson<StoredAuthUser[]>(AUTH_USERS_KEY, []);
}

async function setStoredUsers(users: StoredAuthUser[]) {
  await writeJson(AUTH_USERS_KEY, users);
}

async function setCurrentUser(user: AuthUser | null) {
  if (!user) {
    await removeKey(CURRENT_USER_KEY);
    return;
  }

  await writeJson(CURRENT_USER_KEY, user);
}

async function buildLiveUser(user: AuthUser): Promise<AuthUser> {
  const profile = await upsertUserProfile(user.uid, {
    displayName: user.displayName ?? undefined,
  });

  return {
    ...user,
    displayName: profile.displayName ?? user.displayName ?? null,
  };
}

function createDemoUid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const currentUser = await readJson<AuthUser | null>(CURRENT_USER_KEY, null);

    if (!currentUser) {
      setUser(null);
      return;
    }

    const hydratedUser = await buildLiveUser(currentUser);
    await setCurrentUser(hydratedUser);
    setUser(hydratedUser);
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await getStoredUsers();
    const match = users.find(
      (entry) => entry.email.toLowerCase() === normalizedEmail && entry.password === password
    );

    if (!match) {
      const error = new Error('Incorrect email or password.');
      (error as Error & { code?: string }).code = 'auth/invalid-credential';
      throw error;
    }

    const liveUser = await buildLiveUser(match);
    await setCurrentUser(liveUser);
    setUser(liveUser);
  }

  async function signUp(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await getStoredUsers();

    if (users.some((entry) => entry.email.toLowerCase() === normalizedEmail)) {
      const error = new Error('This email is already registered.');
      (error as Error & { code?: string }).code = 'auth/email-already-in-use';
      throw error;
    }

    const newUser: StoredAuthUser = {
      uid: createDemoUid('demo-user'),
      email: normalizedEmail,
      password,
      displayName: null,
      isDemo: true,
    };

    await setStoredUsers([...users, newUser]);
    const liveUser = await buildLiveUser(newUser);
    await setCurrentUser(liveUser);
    setUser(liveUser);
  }

  async function continueInDemoMode() {
    const demoUser: AuthUser = {
      uid: 'demo-guest',
      email: 'demo@taptag.local',
      displayName: 'Demo Tester',
      isDemo: true,
    };

    const liveUser = await buildLiveUser(demoUser);
    await setCurrentUser(liveUser);
    setUser(liveUser);
  }

  async function signOut() {
    await setCurrentUser(null);
    setUser(null);
  }

  async function resetCurrentDemoData() {
    if (!user) {
      return;
    }

    await clearDemoStorageForUser(user.uid);
    await signOut();
  }

  async function resetAllDemoData() {
    await clearAllDemoStorage();
    await signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        continueInDemoMode,
        refreshUser,
        resetCurrentDemoData,
        resetAllDemoData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
