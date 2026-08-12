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
  // El rol se inicializa de forma SÍNCRONA desde localStorage usando un inicializador lazy.
  // Esto evita la condición de carrera donde onAuthStateChanged ponía isUserLoading=false
  // antes de que el rol del localStorage fuera leído, causando una redirección incorrecta al login.
  const [role, setRoleState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const storedRoleKey = window.localStorage.getItem('userRoleKey');
      if (storedRoleKey && roleMapping[storedRoleKey]) {
        return roleMapping[storedRoleKey];
      }
    }
    return null;
  });
  // isUserLoading se inicia en true. Se pone en false cuando onAuthStateChanged responde.
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    // Esperamos a que onAuthStateChanged confirme el estado inicial antes de actuar.
    // CRÍTICO: No llamar signInAnonymously() antes de saber si ya hay un usuario
    // restaurado desde IndexedDB — hacerlo crea dos procesos de auth simultáneos
    // que ponen al SDK de Firestore en un estado inconsistente → permission denied.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Forzar token y esperar a que el SDK de Firestore procese la conexión autenticada
        try { await firebaseUser.getIdToken(true); } catch {}
        // Pequeño delay para que el SDK de Firestore complete el handshake con el nuevo token
        await new Promise(r => setTimeout(r, 300));
        setUser(firebaseUser);
        setIsUserLoading(false);
      } else {
        // No hay usuario — si tenemos rol, iniciar sesión anónima y ESPERAR
        if (role) {
          try {
            const cred = await signInAnonymously(auth);
            // Forzar token y dar tiempo al SDK de Firestore
            try { await cred.user.getIdToken(true); } catch {}
            await new Promise(r => setTimeout(r, 300));
            setUser(cred.user);
          } catch (e) {
            console.error('Error en signInAnonymously:', e);
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setIsUserLoading(false);
      }
    });
    return () => unsubscribe();
  }, [auth, role]);

  // 3. EFECTO CRÍTICO: Sincronizar perfil en Firestore para el CHAT
  // Solo se ejecuta cuando tenemos un usuario confirmado y válido.
  useEffect(() => {
    if (!user || !role || isUserLoading) return;

    let cancelled = false;
    const syncProfile = async () => {
      try {
        // Forzar refresco del token para garantizar que el SDK de Firestore lo recibe
        await user.getIdToken(true);
        if (cancelled) return;
        const userRef = doc(firestore, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          role: role,
          name: role,
          lastActive: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        // Error no crítico — el chat puede funcionar sin este perfil
        if (!cancelled) console.warn('Perfil de chat no sincronizado (no crítico):', err);
      }
    };

    syncProfile();
    return () => { cancelled = true; };
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
