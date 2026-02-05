'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { type FirebaseApp } from 'firebase/app';
import { type Auth, onAuthStateChanged, type User } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/firebase/client'; // Import the initialized instances
import { FirebaseErrorListener } from './FirebaseErrorListener';

// --- A flag to enable the mock user. IMPORTANT: This should be false in production.
const USE_MOCK_USER_IN_DEV = true;

// A mock user for development when Firebase Auth is blocked by the environment
const mockUser: User = {
  uid: 'dev-user-uid',
  email: 'dev-user@example.com',
  isAnonymous: true,
  // Cast to User to satisfy the type, as we don't need to mock all methods
} as User;


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
    // If we are in a development environment and the mock flag is enabled,
    // bypass real authentication and use the mock user.
    if (process.env.NODE_ENV === 'development' && USE_MOCK_USER_IN_DEV) {
      setUser(mockUser);
      setIsLoading(false);
      return; // Skip the real Firebase auth listener
    }

    // For production or when the mock flag is disabled, use the real auth listener.
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
  return useFirebase().auth;
}

export function useDb() {
  return useFirebase().db;
}

export function useUser() {
  const { user, isLoading } = useFirebase();
  return { user, isUserLoading: isLoading };
}
