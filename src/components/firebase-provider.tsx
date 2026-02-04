'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { FirebaseApp, initializeApp, getApps, getApp } from 'firebase/app';
import { Auth, getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseErrorListener } from './FirebaseErrorListener';
import { firebaseConfig } from '@/firebase/config';

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

  const { app, auth, db } = useMemo(() => {
    if (Object.values(firebaseConfig).some(value => !value)) {
      console.error("Firebase configuration is incomplete. Please check your config file.");
      return { app: null, auth: null, db: null };
    }
    
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { app, auth, db };
  }, []);

  useEffect(() => {
    if (!auth) {
        setIsLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const value = useMemo(() => ({
    app,
    auth,
    db,
    user,
    isLoading,
  }), [app, auth, db, user, isLoading]);

  if (!app) {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <h3 className="text-lg font-semibold text-destructive">Error de Configuración</h3>
                <p className="text-sm text-muted-foreground mt-2">
                    La configuración de Firebase no está disponible. Asegúrate de que las variables de entorno estén configuradas correctamente.
                </p>
            </div>
        </div>
    );
  }

  return (
    <FirebaseContext.Provider value={value}>
      <FirebaseErrorListener />
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
