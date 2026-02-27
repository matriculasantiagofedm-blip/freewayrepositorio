'use client';
import { useState, useEffect } from 'react';
import {
  onSnapshot,
  Query,
  DocumentReference,
  DocumentData,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

/**
 * Hook para suscribirse a un documento de Firestore en tiempo real.
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
        if (err.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: ref.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
        } else if (err.code !== 'cancelled') {
          setError(err);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading, error };
}

/**
 * Hook para suscribirse a una colección o query de Firestore en tiempo real.
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
        if (err.code === 'permission-denied') {
          let path = 'unknown_collection';
          if ('path' in q) {
            path = (q as CollectionReference).path;
          } else if ('_query' in q) {
            try {
              path = (q as any)._query.path.canonicalString();
            } catch {
              path = 'query_collection';
            }
          }

          const permissionError = new FirestorePermissionError({
            path: path,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
        } else if (err.code !== 'cancelled') {
          console.error("Firestore useCollection Error:", err);
          setError(err);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, isLoading, error };
}

export function useMemoQuery(factory: () => any, deps: any[]) {
    const [q, setQ] = useState<any>(null);
    useEffect(() => {
        setQ(factory());
    }, deps);
    return q;
}

export function useMemoDoc(factory: () => any, deps: any[]) {
    const [d, setD] = useState<any>(null);
    useEffect(() => {
        setD(factory());
    }, deps);
    return d;
}
