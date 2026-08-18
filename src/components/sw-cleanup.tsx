'use client';

import { useEffect } from 'react';

const APP_CACHE_VERSION = 'v17_official_yappy_and_cubo_links_restored_2026';

/**
 * Desregistra automáticamente cualquier service worker antiguo Y limpia todo
 * el Cache Storage para garantizar que el navegador siempre cargue la versión
 * más reciente de la app — especialmente crítico en PWA o después de un deploy.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Desregistrar todos los service workers activos
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          reg.unregister().then((ok) => {
            if (ok) console.log('[SW] Desregistrado:', reg.scope);
          });
        });
      });
    }

    // 2. Borrar TODAS las entradas de Cache Storage
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name).then((ok) => {
            if (ok) console.log('[SW] Cache eliminado:', name);
          });
        });
      });
    }

    // 3. Forzar recarga una sola vez para romper el caché del PWA de Chrome
    const currentVersion = sessionStorage.getItem('ct_app_version');
    if (currentVersion !== APP_CACHE_VERSION) {
      sessionStorage.setItem('ct_app_version', APP_CACHE_VERSION);
      window.location.reload();
    }
  }, []);

  return null;
}
