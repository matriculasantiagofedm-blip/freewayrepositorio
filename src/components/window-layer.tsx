'use client';

import { useWindowManager } from '@/contexts/window-manager-context';
import { AppWindow } from './app-window';

export function WindowLayer() {
  const { windows } = useWindowManager();

  // Each AppWindow is position:fixed — no wrapper needed.
  // Avoid pointer-events-none containers which block mouse events.
  return (
    <>
      {windows.map(win => (
        <AppWindow key={win.id} window={win} />
      ))}
    </>
  );
}
