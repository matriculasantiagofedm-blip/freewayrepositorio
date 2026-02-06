'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  query,
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
        if (err.code !== 'cancelled') {
          console.error(`Error fetching document at ${ref.path}:`, err);
          setError(err);
          setIsLoading(false);
          toast({
            variant: "destructive",
            title: "Error de Carga",
            description: `No se pudo cargar el documento: ${err.message}`,
          });
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
        if (err.code !== 'cancelled') {
          console.error("Error fetching collection:", err);
          setError(err);
          setIsLoading(false);
          toast({
            variant: "destructive",
            title: "Error de Carga",
            description: `No se pudo cargar la colección: ${err.message}`,
          });
        }
      }
    );

    return () => unsubscribe();
  }, [q, toast]);

  return { data, isLoading, error };
}


export function useMemoQuery(factory: () => Query<DocumentData> | CollectionReference<DocumentData> | null | undefined, deps: any[]) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(factory, deps);
}

export function useMemoDoc(factory: () => DocumentReference<DocumentData> | null | undefined, deps: any[]) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(factory, deps);
}