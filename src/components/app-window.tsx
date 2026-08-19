'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Minus, Maximize2, X, ArrowLeft } from 'lucide-react';
import { AppWindowState, useWindowManager } from '@/contexts/window-manager-context';
import { cn } from '@/lib/utils';

interface AppWindowProps {
  window: AppWindowState;
}

export function AppWindow({ window: win }: AppWindowProps) {
  const { closeWindow, minimizeWindow, focusWindow, updatePosition, updateSize } = useWindowManager();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const winRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const preMaxState = useRef({ position: win.position, size: win.size });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const showOverlay = () => { if (overlayRef.current) overlayRef.current.style.display = 'block'; };
  const hideOverlay = () => { if (overlayRef.current) overlayRef.current.style.display = 'none'; };

  // ── DRAG ──────────────────────────────────────────────────────────────────
  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized || isMobile) return;
    focusWindow(win.id);
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
  }, [win.id, win.position, isMaximized, isMobile, focusWindow, updatePosition]);

  // ── RESIZE ────────────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.stopPropagation();
    showOverlay();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = win.size.width;
    const startH = win.size.height;

    const onMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(320, startW + ev.clientX - startMouseX);
      const newH = Math.max(300, startH + ev.clientY - startMouseY);
      if (winRef.current) {
        winRef.current.style.width = `${newW}px`;
        winRef.current.style.height = `${newH}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      hideOverlay();
      const newW = Math.max(320, startW + ev.clientX - startMouseX);
      const newH = Math.max(300, startH + ev.clientY - startMouseY);
      updateSize(win.id, { width: newW, height: newH });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [win.id, win.size, isMobile, updateSize]);

  // ── MAXIMIZE ──────────────────────────────────────────────────────────────
  const toggleMaximize = useCallback(() => {
    if (isMobile) return;
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
  }, [isMaximized, isMobile, win.id, win.position, win.size, updatePosition, updateSize]);

  if (win.isMinimized) return null;

  // On mobile (< 768px), window is ALWAYS 100% full screen inset-0
  const style: React.CSSProperties = isMobile
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', zIndex: 9999, borderRadius: 0, pointerEvents: 'all' }
    : isMaximized
    ? { position: 'fixed', top: 56, left: 0, width: '100vw', height: 'calc(100vh - 56px - 48px)', zIndex: win.zIndex, borderRadius: 0, pointerEvents: 'all' }
    : { position: 'fixed', top: win.position.y, left: win.position.x, width: Math.min(win.size.width, typeof window !== 'undefined' ? window.innerWidth - 20 : 900), height: win.size.height, zIndex: win.zIndex, pointerEvents: 'all' };

  return (
    <div
      ref={winRef}
      style={style}
      className={cn(
        'flex flex-col shadow-2xl border border-slate-200 overflow-hidden bg-white',
        !isMaximized && !isMobile && 'rounded-xl',
        isMobile && 'rounded-none border-0'
      )}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Title bar — drag handle */}
      <div
        className={cn(
          "bg-slate-800 flex items-center px-3 shrink-0 select-none text-white",
          isMobile ? "h-12" : "h-9 cursor-grab"
        )}
        onMouseDown={onDragMouseDown}
        onDoubleClick={toggleMaximize}
      >
        {/* Title */}
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          {isMobile && (
            <button
              onClick={() => closeWindow(win.id)}
              className="mr-1 p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-transform"
              title="Volver"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {win.icon && <span className="text-sm">{win.icon}</span>}
          <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">{win.title}</span>
        </div>

        {/* Windows-style control buttons */}
        <div className="flex items-stretch h-full" onMouseDown={e => e.stopPropagation()}>
          {!isMobile && (
            <>
              <button
                className="flex items-center justify-center w-11 h-full text-slate-300 hover:bg-slate-700 transition-colors text-sm font-bold"
                onClick={() => minimizeWindow(win.id)}
                title="Minimizar"
              >
                &#x2212;
              </button>
              <button
                className="flex items-center justify-center w-11 h-full text-slate-300 hover:bg-slate-700 transition-colors text-xs"
                onClick={toggleMaximize}
                title="Maximizar / Restaurar"
              >
                &#x25A1;
              </button>
            </>
          )}
          <button
            className={cn(
              "flex items-center justify-center text-white transition-colors font-bold",
              isMobile 
                ? "h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-xs gap-1 self-center" 
                : "w-11 h-full text-slate-300 hover:bg-red-500 hover:text-white text-base"
            )}
            onClick={() => closeWindow(win.id)}
            title="Cerrar"
          >
            <X className="w-4 h-4" />
            {isMobile && <span>Cerrar</span>}
          </button>
        </div>
      </div>

      {/* iframe + instant overlay */}
      <div className="flex-1 relative overflow-hidden bg-slate-100">
        <iframe src={win.url} className="w-full h-full border-0 block" title={win.title} />
        <div
          ref={overlayRef}
          style={{ display: 'none', position: 'absolute', inset: 0, zIndex: 10 }}
        />
      </div>

      {/* Resize handle (desktop only) */}
      {!isMaximized && !isMobile && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 z-20 cursor-se-resize"
          onMouseDown={onResizeMouseDown}
          style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.4) 50%)' }}
        />
      )}
    </div>
  );
}
