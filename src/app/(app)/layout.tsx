'use client';
import { GanttChart, Menu, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '@/components/user-nav';
import { MainNav } from '@/components/main-nav';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/components/firebase-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useFirebase();
  const router = useRouter();

  /**
   * GUARDIA DE SEGURIDAD (OTRA SECCIÓN)
   * Si el usuario no tiene un rol administrativo asignado, se le deniega el acceso
   * a las rutas internas y se le envía al portal de inicio.
   */
  useEffect(() => {
    if (!isLoading && !role) {
      router.push('/');
    }
  }, [role, isLoading, router]);

  if (isLoading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verificando Credenciales de Acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 print-hide">
        <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <GanttChart className="h-6 w-6 text-primary" />
            <span className="font-headline">ContractTime</span>
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
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
              <nav className="grid gap-6 text-lg font-medium p-6">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <GanttChart className="h-6 w-6 text-primary" />
                  <span className="font-headline">ContractTime</span>
                </Link>
                <MainNav isMobile={true} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>

      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
