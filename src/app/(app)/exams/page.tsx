'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EXAMS } from '@/lib/exams-data';
import { FileText, Printer, Download, ChevronLeft, Dices, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ExamsListPage() {
  const { role } = useCurrentRole();
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState(1);

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

  const handleGenerateBatch = () => {
    // Crear una copia de los IDs de exámenes disponibles
    const allIds = EXAMS.map(e => e.id);
    const selectedIds: string[] = [];
    
    // Cantidad real (máximo disponible)
    const count = Math.min(batchQuantity, allIds.length);
    
    // Selección aleatoria sin repetición
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * allIds.length);
        selectedIds.push(allIds.splice(randomIndex, 1)[0]);
    }

    // Abrir la ventana de impresión masiva
    if (selectedIds.length > 0) {
        window.open(`/print-exam/batch?ids=${selectedIds.join(',')}`, '_blank');
        setIsBatchModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

        {/* BOTÓN DE GENERACIÓN ALEATORIA */}
        <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
            <DialogTrigger asChild>
                <Button className="h-12 px-6 font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-700 shadow-lg border-b-4 border-violet-900 active:border-b-0 active:translate-y-1">
                    <Dices className="mr-2 h-5 w-5" />
                    Generación Aleatoria
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Generar Exámenes al Azar</DialogTitle>
                    <DialogDescription className="font-medium">
                        Indica cuántos exámenes diferentes deseas generar. El sistema seleccionará modelos distintos automáticamente.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="quantity" className="text-xs font-black uppercase text-slate-500">Cantidad de Exámenes (1 - 5)</Label>
                        <Input 
                            id="quantity" 
                            type="number" 
                            min="1" 
                            max="5" 
                            value={batchQuantity} 
                            onChange={(e) => setBatchQuantity(parseInt(e.target.value) || 1)}
                            className="h-12 text-2xl font-black text-center"
                        />
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                        <Loader2 className="h-4 w-4 text-blue-600 mt-0.5" />
                        <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
                            Se abrirá una sola ventana de impresión con {batchQuantity} examen(es) seleccionados aleatoriamente de los 5 modelos oficiales.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleGenerateBatch} className="w-full h-12 font-black uppercase tracking-widest bg-slate-900">
                        <Printer className="mr-2 h-5 w-5" />
                        Preparar Impresión
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
