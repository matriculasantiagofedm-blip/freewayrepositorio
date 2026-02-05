'use client';

import { analyzeContract } from '@/lib/contracts-flow';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, ShieldAlert, Calendar } from 'lucide-react';

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleAction() {
    setIsLoading(true);
    try {
      const response = await analyzeContract({ 
        text: "Contrato de servicios profesionales entre Freeway Escuela de Manejo y el Consultor Externo. El contrato tiene una duración de 12 meses a partir del 1 de enero de 2024. El consultor se compromete a no divulgar información confidencial bajo penalización de B/. 5,000.00. El pago se realizará en cuotas mensuales vencidas." 
      });
      setResult(response);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-24 bg-background flex flex-col items-center gap-8">
      <div className="max-w-2xl w-full text-center space-y-4">
        <h1 className="font-headline text-4xl font-bold tracking-tight">Analizador de Contratos</h1>
        <p className="text-muted-foreground font-body">Utiliza Inteligencia Artificial para extraer información clave de tus documentos legales.</p>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        <Button 
          onClick={handleAction} 
          disabled={isLoading}
          size="lg"
          className="w-full font-semibold shadow-md"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analizando contrato...</>
          ) : (
            'Analizar Contrato de Prueba'
          )}
        </Button>

        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-primary/20 shadow-lg">
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
              <Card className="border-destructive/20 shadow-md">
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

              <Card className="border-accent/20 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-accent-foreground text-base font-headline">
                    <Calendar className="h-4 w-4" />
                    Vencimiento
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
    </main>
  );
}