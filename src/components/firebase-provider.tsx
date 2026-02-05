'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseErrorListener } from './FirebaseErrorListener';

// Hardcoded config - this is safe for client-side Firebase keys.
const firebaseConfig = {
  "projectId": "contracttime2-17074294-10501",
  "appId": "1:476712003174:web:03e38926e2fa2a86552fa7",
  "apiKey": "AIzaSyAj3J74A5AJ-tZYyJMncrszV6I5yF_0ohQ",
  "authDomain": "contracttime2-17074294-10501.firebaseapp.com",
  "storageBucket": "contracttime2-17074294-10501.appspot.com",
  "messagingSenderId": "476712003174"
};

interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  user: User | null;
  isLoading: boolean; // Represents both Firebase init and auth state loading
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Effect for one-time Firebase initialization on the client side
  useEffect(() => {
    const appInstance = initializeApp(firebaseConfig);
    const authInstance = getAuth(appInstance);
    const dbInstance = getFirestore(appInstance);

    setApp(appInstance);
    setAuth(authInstance);
    setDb(dbInstance);
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect for handling authentication state changes, depends on auth being initialized
  useEffect(() => {
    if (!auth) {
      // Auth service is not initialized yet, wait for the first effect to run
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false); // App is ready only after auth state is determined
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth]);

  const value = React.useMemo(() => ({
    app,
    auth,
    db,
    user,
    isLoading,
  }), [app, auth, db, user, isLoading]);

  return (
    <FirebaseContext.Provider value={value}>
      <FirebaseErrorListener />
      {/* Show children only when Firebase and auth state are ready */}
      {!isLoading && children}
    </FirebaseContext.Provider>
  );
}

// --- Custom Hooks to access Firebase services ---

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useAuth() {
  // Returns the auth instance, which may be null during initial render.
  // Components using this should handle the null case.
  return useFirebase().auth;
}

export function useDb() {
  // Returns the Firestore instance, which may be null during initial render.
  // Components using this should handle the null case.
  return useFirebase().db;
}

export function useUser() {
  const { user, isLoading } = useFirebase();
  return { user, isUserLoading: isLoading };
}
