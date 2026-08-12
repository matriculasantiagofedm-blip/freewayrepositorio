'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * Logs errors to console without crashing the React tree.
 * NOTE: throwing here crashed the entire app ("This page couldn't load").
 * The hooks (useCollection, useDoc) already handle errors gracefully via their local error state.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Log the permission error for debugging without crashing the app.
      console.warn('[FirebaseErrorListener] Firestore permission denied:', error.message);
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // This component renders nothing.
  return null;
}
