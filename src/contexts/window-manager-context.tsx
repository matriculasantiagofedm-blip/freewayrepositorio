'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface AppWindowState {
  id: string;
  title: string;
  url: string;
  icon?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  zIndex: number;
}

interface WindowManagerContextType {
  windows: AppWindowState[];
  openWindow: (url: string, title: string, icon?: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updatePosition: (id: string, position: { x: number; y: number }) => void;
  updateSize: (id: string, size: { width: number; height: number }) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null);

let zCounter = 100;

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<AppWindowState[]>([]);
  const idCounter = useRef(0);

  const openWindow = useCallback((url: string, title: string, icon?: string) => {
    // Build embed URL with a unique timestamp so every window open bypasses
    // ALL layers of caching (browser, CDN, service worker) unconditionally.
    const sep = url.includes('?') ? '&' : '?';
    const embedUrl = `${url}${sep}embed=1&_ts=${Date.now()}`;

    // Base path used for window-reuse check (ignore query params)
    const basePath = url.split('?')[0];

    // Si ya existe una ventana con esa ruta base, solo la enfoca/restaura
    setWindows(prev => {
      const existing = prev.find(w => w.url.split('?')[0] === basePath);
      if (existing) {
        zCounter++;
        return prev.map(w =>
          w.id === existing.id
            ? { ...w, isMinimized: false, zIndex: zCounter }
            : w
        );
      }
      // Escalonar posición inicial para que no se sobrepongan
      const offset = (prev.length % 6) * 30;
      zCounter++;
      const newWin: AppWindowState = {
        id: `win-${++idCounter.current}`,
        title,
        url: embedUrl,
        icon,
        position: { x: 80 + offset, y: 80 + offset },
        size: { width: 900, height: 580 },
        isMinimized: false,
        zIndex: zCounter,
      };
      return [...prev, newWin];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    zCounter++;
    setWindows(prev =>
      prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: zCounter } : w)
    );
  }, []);

  const focusWindow = useCallback((id: string) => {
    zCounter++;
    setWindows(prev =>
      prev.map(w => w.id === id ? { ...w, zIndex: zCounter } : w)
    );
  }, []);

  const updatePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, position } : w));
  }, []);

  const updateSize = useCallback((id: string, size: { width: number; height: number }) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, size } : w));
  }, []);

  return (
    <WindowManagerContext.Provider value={{
      windows, openWindow, closeWindow, minimizeWindow,
      restoreWindow, focusWindow, updatePosition, updateSize,
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error('useWindowManager must be used inside WindowManagerProvider');
  return ctx;
}
