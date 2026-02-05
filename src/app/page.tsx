'use client';

import { analyzeContract } from '@/ai/flows/analyze-contract';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileText, ShieldAlert, Calendar, LayoutDashboard, GanttChart } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleAction() {
    setIsLoading(true);
    try {
      const response = await analyzeContract({ 
        text: "Contrato de servicios en Freeway Escuela de Manejo. El curso de manejo incluye 20 horas teóricas y 12 prácticas. Vigencia de 3 meses. Penalización por inasistencia de B/. 20.00." 
      });
      setResult(response);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero Section */}
      <section className="bg-white dark:bg-slate-900 border-b shadow-sm py-16 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <GanttChart className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="font-headline text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            Contract<span className="text-primary">Time</span>
          </h1>
          <p className="text-xl text-muted-foreground font-body max-w-2xl mx-auto">
            Plataforma integral para Freeway Escuela de Manejo. Gestiona contratos, pagos y análisis inteligente en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Button asChild size="lg" className="font-semibold text-lg px-8">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 h-5 w-5" />
                Ingresar al Sistema
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="font-semibold text-lg px-8" onClick={() => document.getElementById('ai-section')?.scrollIntoView({ behavior: 'smooth' })}>
              Probar Analizador IA
            </Button>
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section id="ai-section" className="py-20 px-6 max-w-4xl mx-auto flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h2 className="font-headline text-3xl font-bold">Analizador de Contratos</h2>
          <p className="text-muted-foreground">Extrae información clave de documentos legales con Gemini 1.5 Flash.</p>
        </div>

        <div className="w-full flex flex-col gap-6">
          <Button 
            onClick={handleAction} 
            disabled={isLoading}
            size="lg"
            className="w-full font-semibold shadow-md"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando con IA...</>
            ) : (
              'Analizar Contrato de Prueba'
            )}
          </Button>

          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-primary/20 shadow-lg bg-white dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-primary font-headline">
                    <FileText className="h-5 w-5" />
                    Resumen Ejecutivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed font-body">{result.summary}</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-destructive/20 shadow-md bg-white dark:bg-slate-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-destructive text-base font-headline">
                      <ShieldAlert className="h-4 w-4" />
                      Riesgos Detectados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside text-sm space-y-1 font-body">
                      {result.risks.map((risk: string, i: number) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 shadow-md bg-white dark:bg-slate-900">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-blue-600 text-base font-headline">
                      <Calendar className="h-4 w-4" />
                      Vencimiento Estimado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-semibold font-body">{result.expirationDate || 'No identificada'}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="py-12 border-t text-center text-muted-foreground text-sm">
        <p>© 2024 Freeway Escuela de Manejo, S.A. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
