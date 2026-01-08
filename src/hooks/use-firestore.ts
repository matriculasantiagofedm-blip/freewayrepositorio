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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
      async (err) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
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
      async (err) => {
        let path = 'unknown';
        if (q instanceof CollectionReference) {
          path = q.path;
        } else if (q instanceof Query) {
          // This is a simplified way; getting the exact path from a query client-side is complex.
          // We assume the first part of the path is the collection name.
          // This may need adjustment based on query complexity.
          try {
             const querySnapshot = await getDocs(q);
             path = querySnapshot.query.path;
          } catch(e) {
            // if getDocs fails, we may not be able to get the path
            // this is a best-effort attempt.
          }
        }

        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
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
