'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, Download, ClipboardSignature, AlertCircle } from 'lucide-react';
import { SurveyTemplate } from '@/components/survey-template';

export default function SurveysPage() {
  const db = useDb();
  const { toast } = useToast();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [foundContract, setFoundContract] = useState<Contract | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Introduce una cédula para buscar.' });
      return;
    }

    setIsLoading(true);
    setSearched(true);
    setFoundContract(null);

    try {
      const contractsRef = collection(db, 'contracts');
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber.trim()));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber.trim()));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber.trim()));

      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      
      let contractData: Contract | null = null;
      [snapshot1, snapshot2, snapshot3].forEach(snapshot => {
          if (!snapshot.empty && !contractData) {
              const doc = snapshot.docs[0];
              contractData = { id: doc.id, ...doc.data() } as Contract;
          }
      });

      setFoundContract(contractData);
      if (!contractData) {
          toast({ variant: 'destructive', title: 'No Encontrado', description: 'No se halló un contrato activo para esta cédula. Generando formulario genérico.' });
      } else {
          toast({ title: 'Datos Cargados', description: `Se importó la información de ${contractData.clientName}` });
      }
    } catch (error) {
      console.error("Error searching student:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('survey-to-print');
    if (!element) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const fileName = foundContract 
        ? `Encuesta_${foundContract.clientName.replace(/\s+/g, '_')}.pdf` 
        : 'Encuesta_Evaluacion_Instructor.pdf';
      
      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true, 
            backgroundColor: '#ffffff',
            width: 816 // 8.5in * 96dpi
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "La encuesta se ha descargado correctamente en tamaño carta." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
        <div className="flex items-center gap-3">
            <ClipboardSignature className="h-8 w-8 text-primary" />
            <div>
                <h1 className="font-headline text-3xl font-bold uppercase tracking-tight">Encuesta de Evaluación</h1>
                <p className="text-muted-foreground font-medium">Genera el formato físico de evaluación al instructor.</p>
            </div>
        </div>

        <Card className="max-w-2xl mx-auto w-full shadow-md border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Buscador de Alumnos
                </CardTitle>
                <CardDescription>Carga el nombre del estudiante para personalizar su encuesta antes de imprimir.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <Input 
                        placeholder="Cédula (Ej: 8-000-000)" 
                        value={studentIdNumber} 
                        onChange={(e) => setStudentIdNumber(e.target.value)} 
                        className="h-11 font-bold tracking-widest bg-white uppercase"
                    />
                    <Button type="submit" disabled={isLoading} className="h-11 px-8 font-bold">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Cargar Alumno
                    </Button>
                </form>
            </CardContent>
        </Card>

        {searched && (
            <div className="flex flex-col items-center gap-6 animate-in fade-in-50 duration-500">
                <div className="flex flex-col sm:flex-row gap-4 print-hide w-full max-w-2xl">
                    <Button 
                        onClick={() => window.print()} 
                        variant="outline" 
                        size="lg" 
                        className="flex-1 h-14 font-black uppercase tracking-widest border-2 border-slate-800"
                    >
                        <Printer className="mr-2 h-5 w-5" /> Imprimir Directo
                    </Button>
                    <Button 
                        onClick={handleDownloadPdf} 
                        disabled={isDownloading} 
                        size="lg" 
                        className="flex-1 h-14 font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-xl"
                    >
                        {isDownloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
                        Descargar PDF Carta
                    </Button>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800 max-w-2xl w-full">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-xs font-bold uppercase">Formato optimizado para papel Carta (8.5" x 11"). Listo para completado físico.</p>
                </div>

                <div id="survey-to-print" className="bg-white shadow-2xl border-2 border-slate-200 rounded-sm">
                    <SurveyTemplate contract={foundContract} />
                </div>
            </div>
        )}

        <style jsx global>{`
            @media print {
                @page {
                    size: letter portrait;
                    margin: 0;
                }
                header, footer, nav, aside, .print-hide, button, .card-header, .card, .alert { display: none !important; }
                body { background: white !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
                #survey-to-print { 
                    border: none !important; 
                    box-shadow: none !important; 
                    margin: 0 !important;
                    display: block !important;
                    width: 8.5in !important;
                    height: 11in !important;
                }
            }
        `}</style>
    </div>
  );
}