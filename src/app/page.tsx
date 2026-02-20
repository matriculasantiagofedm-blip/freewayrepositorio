
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GanttChart, UserPlus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-body">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 shadow-sm">
              <GanttChart className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-slate-900">
            Contract<span className="text-primary">Time</span>
          </h1>
          <p className="text-lg font-medium text-slate-600 uppercase tracking-tighter">
            Freeway Escuela de Manejo, S.A.
          </p>
        </div>

        {/* PORTAL DEL ESTUDIANTE (ÚNICA SECCIÓN PÚBLICA VISIBLE) */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground font-black tracking-widest">Portal del Estudiante</span>
            </div>
          </div>
          
          <Card className="border-2 border-blue-600 bg-blue-50/30 overflow-hidden shadow-xl">
            <CardContent className="p-6 text-center space-y-4">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-blue-900 text-lg uppercase leading-tight tracking-tighter">¿Deseas Inscribirte?</h3>
                  <p className="text-xs text-blue-700 font-medium">Proceso 100% automático. Elige tu horario, paga y obtén tu folio al instante.</p>
                </div>
                <Button asChild className="w-full h-14 bg-blue-600 hover:bg-blue-700 font-black text-lg shadow-lg uppercase tracking-wider group text-white">
                    <Link href="/enroll">
                        Inscribirme Ahora
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-50">
          © {new Date().getFullYear()} Freeway Escuela de Manejo, S.A.
        </p>
      </div>
    </main>
  );
}
