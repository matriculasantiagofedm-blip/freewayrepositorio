'use client';

import { Button } from '@/components/ui/button';
import { LayoutDashboard, GanttChart, ChevronRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-32 lg:pb-28">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <GanttChart className="h-16 w-16 text-primary" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="font-headline text-5xl lg:text-7xl font-bold tracking-tight text-slate-900">
                Contract<span className="text-primary">Time</span>
              </h1>
              <p className="text-2xl font-medium text-slate-600">
                Freeway Escuela de Manejo, S.A.
              </p>
              <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto leading-relaxed">
                Gestión integral de contratos, pagos y control de flota. 
                Todo lo que tu escuela necesita en una plataforma moderna y segura.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
              <Button asChild size="lg" className="h-14 px-10 text-lg font-semibold shadow-xl shadow-primary/20 hover:shadow-2xl transition-all">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-6 w-6" />
                  Ingresar al Sistema
                </Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-0 opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]" />
        </div>
      </section>

      {/* Features Simple Grid */}
      <section className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-headline">Contratos Digitales</h3>
              <p className="text-muted-foreground font-body">Generación y firma de contratos para cursos de auto, moto, mixto y ampliaciones.</p>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-headline">Control de Pagos</h3>
              <p className="text-muted-foreground font-body">Gestión de saldos, abonos, cancelaciones y reportes de caja diario detallados.</p>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-headline">Gestión de Flota</h3>
              <p className="text-muted-foreground font-body">Control estricto de kilometraje diario y registros de mantenimiento de vehículos.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center border-t border-slate-100">
        <div className="container mx-auto px-6">
          <p className="text-muted-foreground font-body">
            © {new Date().getFullYear()} Freeway Escuela de Manejo, S.A. | Vía Interamericana, Costa Verde.
          </p>
        </div>
      </footer>
    </main>
  );
}