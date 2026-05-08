"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

interface FirebaseAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  fetchAccessToken: (args: {
    forceRefreshToken: boolean;
  }) => Promise<string | null>;
}

/**
 * Convex's `ConvexProviderWithAuth` consumes a hook with this exact shape.
 * We bridge Firebase Auth's ID token in here so every Convex call is
 * authenticated with a fresh JWT.
 */
export function useFirebaseAuth(): FirebaseAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onIdTokenChanged(auth, (next) => {
      userRef.current = next;
      setUser(next);
      setIsLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const current = userRef.current;
      if (!current) return null;
      try {
        return await current.getIdToken(forceRefreshToken);
      } catch {
        return null;
      }
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: user !== null,
      user,
      fetchAccessToken,
    }),
    [isLoading, user, fetchAccessToken],
  );
}
