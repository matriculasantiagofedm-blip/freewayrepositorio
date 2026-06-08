'use client';

import { useEffect } from 'react';

/**
 * Desregistra automáticamente cualquier service worker antiguo que pueda estar
 * interceptando la navegación y causando redirecciones incorrectas (ej: /dashboard → /leads).
 * Esto es necesario cuando la app fue instalada como PWA con una versión anterior.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((success) => {
            if (success) {
              console.log('[SW] Service worker desregistrado:', registration.scope);
            }
          });
        }
      });
    }
  }, []);

  return null;
}
