import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// --- Initialize Firebase ---
const hasApp = getApps().length > 0;
const app = hasApp ? getApp() : initializeApp(firebaseConfig);

function createReactNativePersistence(storage: typeof AsyncStorage) {
  return class {
    static type = "LOCAL";
    readonly type = "LOCAL";

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
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      const json = await storage.getItem(key);
      return json ? (JSON.parse(json) as T) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {
      return;
    }

    _removeListener() {
      return;
    }
  };
}

// --- Initialize Auth ---
const auth = hasApp
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: createReactNativePersistence(AsyncStorage) as never,
    });

// --- Initialize Firestore ---
const db = getFirestore(app);

// --- Exports ---
export { app, auth, db };
