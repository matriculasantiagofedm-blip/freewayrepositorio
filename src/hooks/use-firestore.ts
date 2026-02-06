'use client';
import { useState, useEffect } from 'react';
import {
  onSnapshot,
  Query,
  DocumentReference,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore';
import { useToast } from './use-toast';

// Type to add an 'id' to a document's data
export type WithId<T> = T & { id: string };

/**
 * Hook to fetch a single document from Firestore in real-time.
 */
export function useDoc<T>(ref: DocumentReference<DocumentData> | null | undefined) {
  const { toast } = useToast();
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
      setIsLoading(false);
      setData(null);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as WithId<T>);
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        // Solo mostrar error si no es una cancelación normal
        if (err.code !== 'cancelled' && err.code !== 'permission-denied') {
          console.error(`Error fetching document:`, err);
          setError(err);
          setIsLoading(false);
          toast({
            variant: "destructive",
            title: "Error de Carga",
            description: `No se pudo cargar el documento. Verifica los permisos.`,
          });
        } else if (err.code === 'permission-denied') {
            setIsLoading(false);
            setError(err);
        }
      }
    );

    return () => unsubscribe();
  }, [ref, toast]);

  return { data, isLoading, error };
}


/**
 * Hook to fetch a collection of documents from Firestore in real-time.
 */
export function useCollection<T>(q: Query<DocumentData> | CollectionReference<DocumentData> | null | undefined) {
  const { toast } = useToast();
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
      setIsLoading(false);
      setData(null);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WithId<T>[];
        setData(documents);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        if (err.code !== 'cancelled' && err.code !== 'permission-denied') {
          console.error("Error fetching collection:", err);
          setError(err);
          setIsLoading(false);
          toast({
            variant: "destructive",
            title: "Error de Carga",
            description: `No se pudo cargar la colección.`,
          });
        } else if (err.code === 'permission-denied') {
            setIsLoading(false);
            setError(err);
        }
      }
    );

    return () => unsubscribe();
  }, [q, toast]);

  return { data, isLoading, error };
}

export function useMemoQuery(factory: () => any, deps: any[]) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const [q, setQ] = useState<any>(null);
    useEffect(() => {
        setQ(factory());
    }, deps);
    return q;
}

export function useMemoDoc(factory: () => any, deps: any[]) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const [d, setD] = useState<any>(null);
    useEffect(() => {
        setD(factory());
    }, deps);
    return d;
}