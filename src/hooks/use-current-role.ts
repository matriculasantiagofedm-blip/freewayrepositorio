'use client';
import { useFirebase } from '@/firebase';

export function useCurrentRole() {
  const { role, isUserLoading } = useFirebase();
  return { role, isLoading: isUserLoading };
}
