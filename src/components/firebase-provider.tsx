'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { type FirebaseApp } from 'firebase/app';
import { type Auth, onAuthStateChanged, type User, signInAnonymously } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { app, auth, db } from '@/firebase/client';
import { FirebaseErrorListener } from './FirebaseErrorListener';

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
    
    // Persistencia del rol para mantener acceso tras recargar o abrir pestañas
    if (typeof window !== 'undefined') {
      const storedRoleKey = window.localStorage.getItem('userRoleKey');
      if (storedRoleKey && roleMapping[storedRoleKey]) {
        setRoleState(roleMapping[storedRoleKey]);
        
        // Asegurar que exista una sesión anónima si hay un rol pero no hay usuario
        if (!auth.currentUser) {
          signInAnonymously(auth).catch(err => console.error("Error en auto-login:", err));
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setRole = (roleKey: string) => {
    const assignedRole = roleMapping[roleKey] || null;
    setRoleState(assignedRole);
    if (assignedRole && typeof window !== 'undefined') {
      window.localStorage.setItem('userRoleKey', roleKey);
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setUser(null);
    setRoleState(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('userRoleKey');
    }
  };

  const value = useMemo(() => ({
    app, auth, db, user, isLoading: !mounted || isLoading, role, setRole, logout
  }), [user, isLoading, role, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <FirebaseContext.Provider value={value}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase debe usarse dentro de un FirebaseProvider');
  return context;
}

export function useAuth() { return useFirebase().auth; }
export function useDb() { return useFirebase().db; }
export function useUser() {
  const { user, isLoading } = useFirebase();
  return { user, isUserLoading: isLoading };
}
