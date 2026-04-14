import { User, onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../config/firebase";
import { upsertUserProfile } from "../services/firestore/userProfile";

/*
  File role:
  Holds the app-wide auth state and the loading flag that tells routing when it
  is safe to render protected screens.

  Why this matters:
  Without a shared auth context, screens would each subscribe to Firebase auth,
  which causes duplicated listeners, harder reasoning, and redirect flicker.
*/

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

// AuthProvider owns the single source of truth for Firebase auth state. The
// rest of the app consumes this context instead of registering duplicate
// onAuthStateChanged listeners.
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase is the source of truth. Every sign-in, sign-out, or restored
    // session flows through this single callback.
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      setUser(usr);

      if (usr) {
        try {
          // TapTag keeps a matching user profile document for lightweight app
          // preferences and metadata. Upsert makes sign-in idempotent.
          await upsertUserProfile(usr.uid, {
            displayName: usr.displayName ?? undefined,
          });
        } catch (error) {
          console.error("Error ensuring user profile:", error);
        }
      }

      // loading flips to false after the first auth resolution, not only after
      // a successful sign-in. Logged-out is still a resolved state.
      setLoading(false);
    });

    // Clean up the auth subscription when the provider unmounts, mainly useful
    // during dev reloads and test harness lifecycles.
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
