'use client';

import { useCallback, useRef, useState } from 'react';
import { Minus, Maximize2, X } from 'lucide-react';
import { AppWindowState, useWindowManager } from '@/contexts/window-manager-context';
import { cn } from '@/lib/utils';

interface AppWindowProps {
  window: AppWindowState;
}

export function AppWindow({ window: win }: AppWindowProps) {
  const { closeWindow, minimizeWindow, focusWindow, updatePosition, updateSize } = useWindowManager();
  const [isMaximized, setIsMaximized] = useState(false);
  const winRef = useRef<HTMLDivElement>(null);
  // The overlay is always in the DOM — we toggle it via direct style manipulation
  // (no React setState) so it appears INSTANTLY on mousedown, before the cursor
  // can enter the iframe and steal subsequent mouse events.
  const overlayRef = useRef<HTMLDivElement>(null);
  const preMaxState = useRef({ position: win.position, size: win.size });

  const showOverlay = () => { if (overlayRef.current) overlayRef.current.style.display = 'block'; };
  const hideOverlay = () => { if (overlayRef.current) overlayRef.current.style.display = 'none'; };

  // ── DRAG ──────────────────────────────────────────────────────────────────
  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    focusWindow(win.id);

    // Immediately block the iframe so it can't steal mousemove events
    showOverlay();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWinX = win.position.x;
    const startWinY = win.position.y;

    const onMouseMove = (ev: MouseEvent) => {
      const newX = Math.max(0, startWinX + ev.clientX - startMouseX);
      const newY = Math.max(0, startWinY + ev.clientY - startMouseY);
      if (winRef.current) {
        winRef.current.style.left = `${newX}px`;
        winRef.current.style.top = `${newY}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      hideOverlay();
      const newX = Math.max(0, startWinX + ev.clientX - startMouseX);
      const newY = Math.max(0, startWinY + ev.clientY - startMouseY);
      updatePosition(win.id, { x: newX, y: newY });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [win.id, win.position, isMaximized, focusWindow, updatePosition]);

  // ── RESIZE ────────────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    showOverlay();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = win.size.width;
    const startH = win.size.height;

    const onMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(420, startW + ev.clientX - startMouseX);
      const newH = Math.max(300, startH + ev.clientY - startMouseY);
      if (winRef.current) {
        winRef.current.style.width = `${newW}px`;
        winRef.current.style.height = `${newH}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      hideOverlay();
      const newW = Math.max(420, startW + ev.clientX - startMouseX);
      const newH = Math.max(300, startH + ev.clientY - startMouseY);
      updateSize(win.id, { width: newW, height: newH });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [win.id, win.size, updateSize]);

  // ── MAXIMIZE ──────────────────────────────────────────────────────────────
  const toggleMaximize = useCallback(() => {
    if (!isMaximized) {
      preMaxState.current = { position: win.position, size: win.size };
      updatePosition(win.id, { x: 0, y: 0 });
      updateSize(win.id, { width: globalThis.innerWidth, height: globalThis.innerHeight - 56 - 48 });
      setIsMaximized(true);
    } else {
      updatePosition(win.id, preMaxState.current.position);
      updateSize(win.id, preMaxState.current.size);
      setIsMaximized(false);
    }
  }, [isMaximized, win.id, win.position, win.size, updatePosition, updateSize]);

  if (win.isMinimized) return null;

  const style: React.CSSProperties = isMaximized
    ? { position: 'fixed', top: 56, left: 0, width: '100vw', height: 'calc(100vh - 56px - 48px)', zIndex: win.zIndex, borderRadius: 0, pointerEvents: 'all' }
    : { position: 'fixed', top: win.position.y, left: win.position.x, width: win.size.width, height: win.size.height, zIndex: win.zIndex, pointerEvents: 'all' };

  return (
    <div
      ref={winRef}
      style={style}
      className={cn('flex flex-col shadow-2xl border border-slate-200 overflow-hidden bg-white', !isMaximized && 'rounded-xl')}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Title bar — drag handle */}
      <div
        className="bg-slate-700 flex items-center px-3 shrink-0"
        style={{ userSelect: 'none', cursor: 'grab', height: 36 }}
        onMouseDown={onDragMouseDown}
        onDoubleClick={toggleMaximize}
      >
        {/* Title */}
        <div className="flex-1 flex items-center gap-2 pointer-events-none overflow-hidden">
          {win.icon && <span className="text-sm">{win.icon}</span>}
          <span className="text-xs font-medium text-slate-200 truncate">{win.title}</span>
        </div>

        {/* Windows-style control buttons — always visible, clear labels */}
        <div className="flex items-stretch h-full" onMouseDown={e => e.stopPropagation()}>
          <button
            className="flex items-center justify-center w-11 h-full text-slate-300 hover:bg-slate-600 transition-colors text-sm font-bold"
            onClick={() => minimizeWindow(win.id)}
            title="Minimizar"
          >
            &#x2212;
          </button>
          <button
            className="flex items-center justify-center w-11 h-full text-slate-300 hover:bg-slate-600 transition-colors text-xs"
            onClick={toggleMaximize}
            title="Maximizar / Restaurar"
          >
            &#x25A1;
          </button>
          <button
            className="flex items-center justify-center w-11 h-full text-slate-300 hover:bg-red-500 hover:text-white transition-colors font-bold text-base"
            onClick={() => closeWindow(win.id)}
            title="Cerrar"
          >
            &#x2715;
          </button>
        </div>
      </div>

      {/* iframe + instant overlay */}
      <div className="flex-1 relative overflow-hidden">
        <iframe src={win.url} className="w-full h-full border-0 block" title={win.title} />

        {/* 
          Always in DOM, initially hidden.
          Shown via direct DOM ref (no React setState) the INSTANT mousedown fires,
          so the iframe never gets a chance to steal mousemove events during drag.
        */}
        <div
          ref={overlayRef}
          style={{ display: 'none', position: 'absolute', inset: 0, zIndex: 10 }}
        />
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 z-20 cursor-se-resize"
          onMouseDown={onResizeMouseDown}
          style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.4) 50%)' }}
        />
      )}
    </div>
  );
}
