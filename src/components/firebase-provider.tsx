'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import { Auth, getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseErrorListener } from './FirebaseErrorListener';

// --- Module-level Firebase Initialization ---
// This ensures Firebase is initialized once when the module is first loaded,
// before any component rendering. This is a robust pattern for Next.js.
const firebaseConfig = {
  "projectId": "contracttime2-17074294-10501",
  "appId": "1:476712003174:web:03e38926e2fa2a86552fa7",
  "apiKey": "AIzaSyAj3J74A5AJ-tZYyJMncrszV6I5yF_0ohQ",
  "authDomain": "contracttime2-17074294-10501.firebaseapp.com",
  "storageBucket": "contracttime2-17074294-10501.appspot.com",
  "messagingSenderId": "476712003174"
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// --- React Context and Provider ---

interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  user: User | null;
  isLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Now we use the module-scoped `auth` instance.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({
    app,
    auth,
    db,
    user,
    isLoading,
  }), [user, isLoading]);

  return (
    <FirebaseContext.Provider value={value}>
      <FirebaseErrorListener />
      {/* We no longer need to wait for app initialization here, only auth state */}
      {!isLoading && children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useAuth() {
  return useFirebase().auth;
}

export function useDb() {
    return useFirebase().db;
}

export function useUser() {
    const { user, isLoading } = useFirebase();
    return { user, isUserLoading: isLoading };
}
