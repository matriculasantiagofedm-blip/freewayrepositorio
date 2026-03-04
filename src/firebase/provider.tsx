'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

const roleMapping: { [key: string]: string } = {
  'ventas123': 'Ventas',
  'ventasext123': 'Ventas Externas',
  'Ayax/2022': 'Administrador',
};

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  role: string | null;
  setRole: (roleKey: string) => void;
  logout: () => Promise<void>;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [role, setRoleState] = useState<string | null>(null);

  useEffect(() => {
    // 1. Recuperar rol de persistencia
    if (typeof window !== 'undefined') {
      const storedRoleKey = window.localStorage.getItem('userRoleKey');
      if (storedRoleKey && roleMapping[storedRoleKey]) {
        setRoleState(roleMapping[storedRoleKey]);
        if (!auth.currentUser) {
          signInAnonymously(auth).catch(console.error);
        }
      }
    }

    // 2. Escuchar cambios de autenticación
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsUserLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  // 3. EFECTO CRÍTICO: Sincronizar perfil en Firestore para el CHAT
  useEffect(() => {
    if (user && role && !isUserLoading) {
      const userRef = doc(firestore, 'users', user.uid);
      setDoc(userRef, {
        uid: user.uid,
        role: role,
        name: role, // Nombre por defecto es el rol para identificar al personal
        lastActive: serverTimestamp(),
      }, { merge: true }).catch(err => console.error("Error al sincronizar perfil de chat:", err));
    }
  }, [user, role, isUserLoading, firestore]);

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
    } catch (e) {
      console.error("Error signing out:", e);
    }
    setUser(null);
    setRoleState(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('userRoleKey');
    }
  };

  const contextValue = useMemo(() => ({
    firebaseApp,
    firestore,
    auth,
    user,
    isUserLoading,
    role,
    setRole,
    logout
  }), [firebaseApp, firestore, auth, user, isUserLoading, role]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase debe usarse dentro de un FirebaseProvider.');
  }
  return context;
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
export const useDb = () => useFirebase().firestore; // Alias para compatibilidad
export const useFirebaseApp = () => useFirebase().firebaseApp;

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & {__memo?: boolean} {
  const memoized = useMemo(factory, deps) as any;
  if (memoized && typeof memoized === 'object') {
    memoized.__memo = true;
  }
  return memoized;
}

export const useUser = () => {
  const { user, isUserLoading } = useFirebase();
  return { user, isUserLoading };
};
