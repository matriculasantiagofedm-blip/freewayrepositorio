'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';

export default function AppEntryPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // No hagas nada hasta que se haya determinado el estado de autenticación.
    if (isUserLoading) {
      return;
    }

    // Si el usuario está autenticado, redirige al panel de control.
    if (user) {
      router.push('/dashboard');
    } else {
      // Si no está autenticado, devuélvelo a la página de inicio.
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  // Muestra un estado de carga mientras se verifica la sesión.
  return <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4"><p>Cargando...</p></div>;
}
