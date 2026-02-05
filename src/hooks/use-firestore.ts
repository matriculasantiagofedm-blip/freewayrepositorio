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
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { useDb } from '@/components/firebase-provider';

// Type to add an 'id' to a document's data
export type WithId<T> = T & { id: string };

/**
 * Hook to fetch a single document from Firestore in real-time.
 * @param ref The DocumentReference to the document.
 */
export function useDoc<T>(ref: DocumentReference<DocumentData> | null | undefined) {
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
        console.error(`Error fetching document at ${ref.path}:`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading, error };
}


/**
 * Hook to fetch a collection of documents from Firestore in real-time.
 * @param q The Query or CollectionReference to the collection.
 */
export function useCollection<T>(q: Query<DocumentData> | CollectionReference<DocumentData> | null | undefined) {
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
        let path = 'unknown path';
        try {
          if (q instanceof CollectionReference) {
            path = q.path;
          } else if (q instanceof Query) {
            // This is a private property but often the only way to get path from a query
            path = (q as any)._query.path.segments.join('/');
          }
        } catch (e) {
          console.warn("Could not determine query path for error reporting.", e);
        }
        console.error(`Error fetching collection at ${path}:`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q]);

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
