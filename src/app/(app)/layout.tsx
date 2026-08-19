'use client';
import { Menu, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { UserNav } from '@/components/user-nav';
import { MainNav } from '@/components/main-nav';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LiveAvailabilityWidget } from '@/components/live-availability-widget';
import { WindowManagerProvider } from '@/contexts/window-manager-context';
import { WindowLayer } from '@/components/window-layer';
import { WindowTaskbar } from '@/components/window-taskbar';


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, isUserLoading } = useFirebase();
  const router = useRouter();
  const [isEmbedded, setIsEmbedded] = useState(false);

  /**
   * GUARDIA DE SEGURIDAD ADMINISTRATIVA
   * Este efecto protege todas las rutas internas de la carpeta (app).
   * Si no hay un rol detectado (clave de acceso), redirige al inicio público.
   */
  useEffect(() => {
    if (!isUserLoading && !role) {
      console.warn("Acceso no autorizado detectado. Redirigiendo al portal público.");
      router.push('/');
    }
  }, [role, isUserLoading, router]);

  // Detect if this page is running inside a floating window (iframe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsEmbedded(params.get('embed') === '1');
  }, []);

  // NOTA: WindowManagerProvider siempre envuelve el contenido, incluso durante
  // la pantalla de carga, para que useWindowManager() nunca falle en páginas
  // como el dashboard que lo usan incondicionalmente.

  if (isUserLoading || !role) {
    return (
      <WindowManagerProvider>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verificando Credenciales de Acceso...</p>
          </div>
        </div>
      </WindowManagerProvider>
    );
  }

  // When embedded inside a floating window (iframe), skip the full shell (header/nav)
  // but still mount LiveAvailabilityWidget so the Libreta button works inside the iframe
  if (isEmbedded) {
    return (
      <WindowManagerProvider>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 print:p-0 print:m-0 print:block min-h-screen bg-[#eef2f6]">
          {children}
        </main>
        {/* Widget de disponibilidad — necesario aquí porque el iframe tiene su propio window */}
        <LiveAvailabilityWidget />
      </WindowManagerProvider>
    );
  }

  return (
    <WindowManagerProvider>
    <div className="flex min-h-screen w-full flex-col relative bg-[#eef2f6] selection:bg-primary/20">
      {/* --- EL FONDO INCREÍBLE ANIMADO (IMPRESSIVE ANIMATED MESH BACKGROUND) --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50">
        {/* Orbe Azul Principal (Arriba) */}
        <div className="absolute -top-[30%] -right-[10%] w-[80vw] h-[80vh] rounded-[100%] bg-blue-500/[0.12] blur-[100px] animate-mesh-1 mix-blend-multiply" />
        
        {/* Orbe Esmeralda (Abajo Izquierda) */}
        <div className="absolute -bottom-[20%] -left-[10%] w-[70vw] h-[70vh] rounded-[100%] bg-emerald-400/[0.15] blur-[120px] animate-mesh-2 mix-blend-multiply" />
        
        {/* Orbe Índigo Profundo (Medio) */}
        <div className="absolute top-[20%] left-[20%] w-[60vw] h-[60vh] rounded-[100%] bg-indigo-500/[0.1] blur-[110px] animate-mesh-3 mix-blend-multiply" />
        
        {/* Textura de Cristal (Ruido Sutil) */}
        <div className="absolute inset-0 bg-[url('https://i.imgur.com/3F9j5V1.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
      
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl px-4 md:px-6 print:hidden shadow-sm">
        <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <Image src="/logo.png" alt="ContractTime Logo" width={40} height={40} className="rounded-lg shadow-sm" />
            <span className="font-headline text-base">ContractTime</span>
        </Link>
        <nav className="hidden md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 ml-6">
          <MainNav />
        </nav>
        
        <div className="ml-auto flex items-center gap-2">
          <UserNav />
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden cursor-pointer"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú de navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-[340px] p-0 flex flex-col h-full max-h-[100dvh] bg-white shadow-2xl">
              <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-slate-50">
                <Image src="/logo.png" alt="ContractTime Logo" width={36} height={36} className="rounded-lg shadow-sm" />
                <div>
                  <span className="font-headline text-base font-bold text-slate-900 block">ContractTime</span>
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Menú Principal</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-16">
                <MainNav isMobile={true} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 print:p-0 print:m-0 print:block pb-16">
        {children}
      </main>
      
      {/* Widget Global Flotante de Disponibilidad (Option 1) */}
      <LiveAvailabilityWidget />
      
      </div>

      {/* Sistema de Ventanas Flotantes */}
      <WindowLayer />
      <WindowTaskbar />
    </div>
    </WindowManagerProvider>
  );

}
