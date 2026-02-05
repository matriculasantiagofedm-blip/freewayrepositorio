'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { type FirebaseApp } from 'firebase/app';
import { type Auth, onAuthStateChanged, type User } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/firebase/client'; // Import the initialized instances
import { FirebaseErrorListener } from './FirebaseErrorListener';

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

  // Effect for handling authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false); // Auth state is determined, app is ready
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const value = React.useMemo(() => ({
    app,
    auth,
    db,
    user,
    isLoading,
  }), [user, isLoading]);

  return (
    <FirebaseContext.Provider value={value}>
      <FirebaseErrorListener />
      {children}
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
