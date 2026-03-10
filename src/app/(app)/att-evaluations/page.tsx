'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, ClipboardCheck, User, ArrowRight, FileText, Repeat, Download } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ATTampliacionTemplate } from '@/components/att-ampliacion-template';
import { ATTstandardTemplate } from '@/components/att-standard-template';

type TemplateType = 'standard' | 'ampliacion';

function ATTEvaluationsContent() {
  const db = useDb();
  const { toast } = useToast();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>('ampliacion');

  const performSearch = async (id: string) => {
    if (!id.trim() || !db) return;

    setIsLoading(true);
    setSearched(true);
    setFoundContracts([]);
    setSelectedContract(null);

    try {
      const contractsRef = collection(db, 'contracts');
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', id.trim()));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', id.trim()));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', id.trim()));

      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      
      const results: Contract[] = [];
      [snapshot1, snapshot2, snapshot3].forEach(snapshot => {
          snapshot.forEach(doc => {
              const data = doc.data() as Contract;
              if (data.status !== 'expired') {
                results.push({ id: doc.id, ...data } as Contract);
              }
          });
      });

      setFoundContracts(results);
      if (results.length === 0) {
          toast({ variant: 'destructive', title: 'No Encontrado', description: 'No se hallaron contratos activos para esta cédula.' });
      } else {
          // Auto-seleccionar tipo de plantilla según el contrato
          if (results[0].type === 'Ampliaciones') {
              setActiveTemplate('ampliacion');
          } else {
              setActiveTemplate('standard');
          }
          
          // Si solo hay uno, seleccionarlo automáticamente
          if (results.length === 1) {
            setSelectedContract(results[0]);
          }
      }
    } catch (error) {
      console.error("Error searching student:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo en la búsqueda.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl && db) {
      setStudentIdNumber(idFromUrl);
      performSearch(idFromUrl);
    }
  }, [searchParams, db]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Introduce una cédula para buscar.' });
      return;
    }
    performSearch(studentIdNumber);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('evaluation-print-area');
    if (!element || !selectedContract) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const fileName = activeTemplate === 'ampliacion' 
        ? `Evaluacion_ATTT_Ampliacion_${selectedContract.clientName.replace(/\s+/g, '_')}.pdf`
        : `Evaluacion_ATTT_Estandar_${selectedContract.clientName.replace(/\s+/g, '_')}.pdf`;

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 816 // 8.5in * 96dpi
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "La evaluación se ha descargado correctamente." });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
        <div className="flex items-center gap-3 print:hidden">
            <div className="bg-primary p-2 rounded-lg">
                <ClipboardCheck className="h-8 w-8 text-white" />
            </div>
            <div>
                <h1 className="font-headline text-3xl font-bold uppercase tracking-tight">Evaluaciones ATTT</h1>
                <p className="text-muted-foreground font-medium">Genera las constancias de evaluación oficiales para la ATTT.</p>
            </div>
        </div>

        <Card className="max-w-2xl mx-auto w-full shadow-md border-primary/20 bg-primary/5 print:hidden">
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Buscador de Alumnos
                </CardTitle>
                <CardDescription>Carga un alumno para generar su constancia de evaluación.</CardDescription>
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
                        Buscar
                    </Button>
                </form>
            </CardContent>
        </Card>

        {searched && !selectedContract && foundContracts.length > 0 && (
            <div className="grid gap-4 max-w-4xl mx-auto w-full print:hidden">
                <h2 className="text-xl font-black uppercase text-slate-800">Selecciona el Trámite</h2>
                {foundContracts.map(c => (
                    <Card key={c.id} className="hover:border-primary transition-all cursor-pointer group" onClick={() => setSelectedContract(c)}>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-slate-100 p-3 rounded-full group-hover:bg-primary/10 transition-colors">
                                    <User className="h-6 w-6 text-slate-600 group-hover:text-primary" />
                                </div>
                                <div>
                                    <p className="font-black text-lg uppercase tracking-tight">{c.clientName}</p>
                                    <p className="text-xs font-bold text-muted-foreground uppercase">{c.type} — FOLIO {String(c.folioNumber).padStart(6, '0')}</p>
                                </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        {selectedContract && (
            <div className="flex flex-col items-center gap-8 animate-in fade-in-50 duration-500">
                <div className="flex flex-col gap-6 print:hidden w-full max-w-3xl">
                    <div className="bg-slate-100 p-1 rounded-xl flex justify-center">
                        <Tabs value={activeTemplate} onValueChange={(v: any) => setActiveTemplate(v)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-12 bg-transparent">
                                <TabsTrigger value="ampliacion" className="gap-2 font-bold uppercase text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <Repeat className="h-4 w-4" /> Evaluación Ampliaciones
                                </TabsTrigger>
                                <TabsTrigger value="standard" className="gap-2 font-bold uppercase text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <FileText className="h-4 w-4" /> Evaluación Estándar
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                        <Button 
                            onClick={handlePrint} 
                            variant="outline" 
                            size="lg" 
                            className="flex-1 h-14 font-black uppercase tracking-widest border-2 border-slate-800"
                        >
                            <Printer className="mr-2 h-5 w-5" /> Imprimir Pantalla
                        </Button>
                        <Button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloading}
                            variant="default" 
                            size="lg" 
                            className="flex-1 h-14 font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-xl border-2 border-blue-400"
                        >
                            {isDownloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />} 
                            Descargar PDF
                        </Button>
                        <Button 
                            onClick={() => { setSelectedContract(null); setSearched(false); setFoundContracts([]); setStudentIdNumber(''); }} 
                            variant="ghost" 
                            size="lg" 
                            className="h-14 px-8 font-bold uppercase"
                        >
                            Nueva Búsqueda
                        </Button>
                    </div>
                </div>

                <div id="evaluation-print-area" className="bg-white shadow-2xl border-2 border-slate-200 rounded-sm">
                    {activeTemplate === 'ampliacion' ? (
                        <ATTampliacionTemplate contract={selectedContract} />
                    ) : (
                        <ATTstandardTemplate contract={selectedContract} />
                    )}
                </div>
            </div>
        )}

        <style jsx global>{`
            @media print {
                @page {
                    size: letter portrait;
                    margin: 0;
                }
                header, footer, nav, aside, .print-hide, button, .card-header, .card, .tabs-list { display: none !important; }
                body { background: white !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
                #evaluation-print-area { 
                    border: none !important; 
                    box-shadow: none !important; 
                    margin: 0 !important;
                    display: block !important;
                    width: 8.5in !important;
                    height: 11in !important;
                    overflow: hidden !important;
                    page-break-after: avoid !important;
                }
            }
        `}</style>
    </div>
  );
}

export default function ATTEvaluationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>}>
      <ATTEvaluationsContent />
    </Suspense>
  );
}
