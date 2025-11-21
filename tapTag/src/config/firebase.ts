import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVBYXhGZ_KchTWS8KxK0nUaKbI42G5Ic0",
  authDomain: "taptag-c05f0.firebaseapp.com",
  projectId: "taptag-c05f0",
  storageBucket: "taptag-c05f0.firebasestorage.app",
  messagingSenderId: "674855826456",
  appId: "1:674855826456:web:20d090e02ff0c70cdfff6d",
  measurementId: "G-SFDC8PP4MR",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Try to get an existing Auth instance; if none, initialize with persistence
let auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}
export { auth };

// Analytics only in browsers
if (typeof window !== "undefined") {
  isSupported().then((ok) => {
    if (ok) getAnalytics(app);
  });
}

export default {};
