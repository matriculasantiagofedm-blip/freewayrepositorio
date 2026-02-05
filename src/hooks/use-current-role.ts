'use client';
import { useFirebase } from '@/components/firebase-provider';

export function useCurrentRole() {
  const { role, isLoading } = useFirebase();
  return { role, isLoading };
}
