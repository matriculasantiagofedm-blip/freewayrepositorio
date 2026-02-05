'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  const setDevUser = (devUser: User) => {
    setUser(devUser);
    setIsLoading(false);
  }

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
    await auth.signOut();
    setUser(null);
    setRoleState(null);
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('userRoleKey');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && typeof window !== 'undefined') {
          const storedRoleKey = sessionStorage.getItem('userRoleKey');
          if (storedRoleKey && roleMapping[storedRoleKey]) {
              setRoleState(roleMapping[storedRoleKey]);
          }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = React.useMemo(() => ({
    app, auth, db, user, isLoading, setDevUser, role, setRole, logout
  }), [user, isLoading, role]);

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