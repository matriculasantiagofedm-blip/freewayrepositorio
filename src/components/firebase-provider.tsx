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
  setDevUser: (user: User) => void;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setDevUser = (devUser: User) => {
    console.log("DEV MODE: Manually setting mock user for development.");
    setUser(devUser);
    setIsLoading(false);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = React.useMemo(() => ({
    app,
    auth,
    db,
    user,
    isLoading,
    setDevUser,
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
  const { user, isLoading, setDevUser } = useFirebase();
  return { user, isUserLoading: isLoading, setDevUser };
}
