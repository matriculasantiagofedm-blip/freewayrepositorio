'use client';

import { useWindowManager } from '@/contexts/window-manager-context';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WindowTaskbar() {
  const { windows, restoreWindow, closeWindow } = useWindowManager();

  const minimized = windows.filter(w => w.isMinimized);
  const active = windows.filter(w => !w.isMinimized);

  if (windows.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] print:hidden">
      <div className="flex items-center gap-1 px-3 py-1.5 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 shadow-lg overflow-x-auto">
        {/* Label */}
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 mr-2">
          Ventanas
        </span>

        {/* Active windows (not minimized) */}
        {active.map(win => (
          <button
            key={win.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0',
              'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            )}
            title={win.title}
          >
            {win.icon && <span>{win.icon}</span>}
            <span className="max-w-[120px] truncate">{win.title}</span>
            <span
              className="ml-1 opacity-50 hover:opacity-100 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}

        {/* Minimized windows */}
        {minimized.map(win => (
          <button
            key={win.id}
            onClick={() => restoreWindow(win.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0',
              'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
            )}
            title={`Restaurar: ${win.title}`}
          >
            {win.icon && <span>{win.icon}</span>}
            <span className="max-w-[120px] truncate">{win.title}</span>
            <span className="ml-1 text-[10px] opacity-40">📥</span>
          </button>
        ))}
      </div>
    </div>
  );
}
