import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseError, getApp, getApps, initializeApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getAuth, initializeAuth } from "firebase/auth";

// The React Native build of firebase/auth ships an official AsyncStorage
// persistence factory, but the published TypeScript types only describe the
// browser build, so it has to be pulled off the module object.
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
  }
).getReactNativePersistence;

/*
  File role:
  This module is the single runtime bootstrap for Firebase in the Expo app.

  Why it exists:
  - screens should not each initialize Firebase themselves
  - auth persistence should survive app restarts
  - Firebase Auth should persist across app restarts

  Architectural boundary:
  - this file is client-side only
  - app data now lives behind the MongoDB-backed backend API
*/

// Firebase config is sourced from Expo public env vars because the app runs on
// the client. Sensitive admin behavior lives only in the seed/cleanup scripts.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasApp = getApps().length > 0;
const app = hasApp ? getApp() : initializeApp(firebaseConfig);

// Expo + React Native persistence support can be messy across SDK versions.
// This local wrapper avoids depending on a package export that has shifted in
// the past and gives auth durable AsyncStorage-backed sessions.
function createReactNativePersistence(storage: typeof AsyncStorage) {
  return class {
    static type = "LOCAL";
    readonly type = "LOCAL";

    // Firebase calls this to decide whether persistence can be used on the
    // current platform/runtime. We probe AsyncStorage with a tiny write/remove.
    async _isAvailable() {
      try {
        if (!storage) {
          return false;
        }

        await storage.setItem("__sak", "1");
        await storage.removeItem("__sak");
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      // Firebase gives us arbitrary JSON-serializable auth state.
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      // Parse stored auth payload back into the shape Firebase expects.
      const json = await storage.getItem(key);
      return json ? (JSON.parse(json) as T) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    // These listener hooks exist on Firebase's persistence contract, but for
    // AsyncStorage-backed React Native auth we do not need cross-tab syncing.
    _addListener() {
      return;
    }

    _removeListener() {
      return;
    }
  };
}

// An existing Firebase app does not imply that Auth has been initialized.
// Calling getAuth() in that state is what triggers Firebase's React Native
// warning and creates memory-only auth, so always try persistence first. Hot
// reload can leave an already-configured Auth instance behind; only then is
// getAuth() safe because the provider is already initialized.
function getOrInitializeAuth() {
  try {
    return initializeAuth(app, {
      persistence: (getReactNativePersistence
        ? getReactNativePersistence(AsyncStorage)
        : createReactNativePersistence(AsyncStorage)) as never,
    });
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      error.code === "auth/already-initialized"
    ) {
      return getAuth(app);
    }

    throw error;
  }
}

const auth = getOrInitializeAuth();

export { app, auth };
