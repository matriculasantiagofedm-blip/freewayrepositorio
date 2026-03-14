'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EXAMS } from '@/lib/exams-data';
import { FileText, Printer, Download, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ExamsListPage() {
  const { role } = useCurrentRole();

  // Restricción de seguridad
  if (role === 'Ventas') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <div className="bg-red-100 p-4 rounded-full mb-4">
            <FileText className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Acceso Restringido</h3>
        <p className="text-slate-600 mt-2 max-w-sm font-medium">Lo sentimos, el personal de Ventas no tiene permisos para gestionar exámenes teóricos.</p>
        <Button asChild className="mt-8 h-12 px-8 font-bold" variant="default">
            <Link href="/dashboard">Volver al Panel Principal</Link>
        </Button>
      </div>
    );
  }

  const handlePrint = (id: string) => {
    window.open(`/print-exam/${id}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl font-bold uppercase tracking-tight text-slate-900">Exámenes Teóricos</h1>
          <p className="text-muted-foreground font-medium">Modelos oficiales para evaluación de conocimientos viales.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {EXAMS.map((exam) => (
          <Card key={exam.id} className="transition-all hover:shadow-lg border-slate-200">
            <CardHeader className="pb-3">
              <div className="bg-violet-50 w-12 h-12 rounded-xl flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-violet-600" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">{exam.title}</CardTitle>
              <CardDescription className="text-xs font-medium">
                Contiene {exam.questions.length} preguntas de selección múltiple.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button 
                onClick={() => handlePrint(exam.id)} 
                className="flex-1 font-bold h-10 bg-slate-900 hover:bg-black"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handlePrint(exam.id)} 
                className="flex-1 font-bold h-10 border-2 border-violet-600 text-violet-600 hover:bg-violet-50"
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
