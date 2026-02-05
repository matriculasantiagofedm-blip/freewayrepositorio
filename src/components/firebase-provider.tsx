'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { type FirebaseApp } from 'firebase/app';
import { type Auth, onAuthStateChanged, type User } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/firebase/client';

const roleMapping: { [key: string]: string } = {
  'ventas123': 'Ventas',
  'ventasext123': 'Ventas Externas',
  'Ayax/2022': 'Administrador',
};

interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  user: User | null;
  isLoading: boolean;
  setDevUser: (user: User) => void;
  role: string | null;
  setRole: (roleKey: string) => void;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRoleState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Recuperar rol de la sesión
    const storedRoleKey = typeof window !== 'undefined' ? sessionStorage.getItem('userRoleKey') : null;
    if (storedRoleKey && roleMapping[storedRoleKey]) {
      setRoleState(roleMapping[storedRoleKey]);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setDevUser = (devUser: User) => {
    setUser(devUser);
    setIsLoading(false);
  };

  const setRole = (roleKey: string) => {
    const assignedRole = roleMapping[roleKey] || null;
    setRoleState(assignedRole);
    if (typeof window !== 'undefined') {
      if (assignedRole) {
        sessionStorage.setItem('userRoleKey', roleKey);
      } else {
        sessionStorage.removeItem('userRoleKey');
      }
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error during sign out:", error);
    }
    setUser(null);
    setRoleState(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('userRoleKey');
    }
  };

  const value = useMemo(() => ({
    app, auth, db, user, isLoading: !mounted || isLoading, setDevUser, role, setRole, logout
  }), [user, isLoading, role, mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-headline font-bold text-xl">
        Iniciando ContractTime...
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider');
  return context;
}

export function useAuth() { return useFirebase().auth; }
export function useDb() { return useFirebase().db; }
export function useUser() {
  const { user, isLoading, setDevUser } = useFirebase();
  return { user, isUserLoading: isLoading, setDevUser };
}