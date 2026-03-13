
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Printer, ClipboardCheck, User, ArrowRight, FileText, Repeat, Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ATTampliacionTemplate } from '@/components/att-ampliacion-template';
import { ATTstandardTemplate } from '@/components/att-standard-template';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfWeek, endOfWeek, isWithinInterval, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toDate } from '@/lib/utils';

type TemplateType = 'standard' | 'ampliacion';

function ATTEvaluationsContent() {
  const db = useDb();
  const { toast } = useToast();
  const { role } = useCurrentRole();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>('standard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Rango semanal (Lunes a Domingo)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Consulta global de contratos (filtrado lógico para evitar índices complejos)
  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), orderBy('folioNumber', 'desc')) : null), [db]);
  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  // Filtrar por el PRIMER DÍA DE TEORÍA dentro de la semana seleccionada
  const studentsInWeek = useMemo(() => {
    if (!contracts) return [];
    
    return contracts
      .filter(c => c.status === 'active' || c.status === 'completed')
      .map(c => {
        let firstTheoryDay: Date | null = null;

        if (c.type === 'Ampliaciones') {
            firstTheoryDay = toDate(c.ampliacionesDetails?.theoreticalClassDate);
        } else {
            const theoryDates = c.autoMotoDetails?.theoreticalClassDates || c.deluxeDetails?.theoreticalClasses || [];
            if (theoryDates.length > 0) {
                firstTheoryDay = toDate(theoryDates[0]);
            }
        }

        if (!firstTheoryDay || isNaN(firstTheoryDay.getTime())) return null;

        if (isWithinInterval(firstTheoryDay, { start: weekStart, end: weekEnd })) {
          return { contract: c, firstTheoryDay };
        }
        return null;
      })
      .filter((item): item is { contract: Contract, firstTheoryDay: Date } => item !== null)
      .sort((a, b) => a.firstTheoryDay.getTime() - b.firstTheoryDay.getTime());
  }, [contracts, weekStart, weekEnd]);

  // Sincronizar plantilla según el tipo de contrato seleccionado
  useEffect(() => {
    if (selectedContract) {
        if (selectedContract.type === 'Ampliaciones') setActiveTemplate('ampliacion');
        else setActiveTemplate('standard');
    }
  }, [selectedContract]);

  const handlePrevWeek = () => {
    setSelectedContract(null);
    setCurrentDate(subDays(currentDate, 7));
  };
  
  const handleNextWeek = () => {
    setSelectedContract(null);
    setCurrentDate(addDays(currentDate, 7));
  };
  
  const handleGoToday = () => {
    setSelectedContract(null);
    setCurrentDate(new Date());
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    const element = document.getElementById('evaluation-print-area');
    if (!element || !selectedContract) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const fileName = `Evaluacion_ATTT_${selectedContract.clientName.replace(/\s+/g, '_')}.pdf`;
      
      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true, 
            backgroundColor: '#ffffff',
            logging: false,
            scrollY: 0,
            scrollX: 0
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "La evaluación se ha descargado correctamente." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 pb-20">
        {/* Cabecera con Navegación Semanal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-lg">
                    <ClipboardCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="font-headline text-2xl font-bold uppercase tracking-tight text-slate-900">Evaluaciones ATTT</h1>
                    <p className="text-muted-foreground text-xs font-medium">Listado semanal por inicio de capacitación teórica.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button>
                <div className="px-4 text-center min-w-[180px]">
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Inicios de Teoría:</p>
                    <p className="text-xs font-bold uppercase text-slate-700">
                        {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM", { locale: es })}
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button>
                <div className="border-l h-6 mx-1"></div>
                <Button variant="ghost" size="sm" onClick={handleGoToday} className="h-9 px-3 text-[10px] font-black uppercase text-slate-500 hover:text-primary transition-colors">
                    Hoy
                </Button>
            </div>
        </div>

        {!selectedContract ? (
            /* LISTADO DE ESTUDIANTES QUE INICIAN TEORÍA */
            <Card className="max-w-4xl mx-auto w-full shadow-sm border-slate-200 print:hidden overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b py-4">
                    <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-primary" />
                        Alumnos citados para su primera clase teórica
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin h-8 w-8 text-slate-200" />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Consultando base de datos...</p>
                        </div>
                    ) : studentsInWeek.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {studentsInWeek.map(({ contract: c, firstTheoryDay }) => (
                                <div 
                                    key={c.id} 
                                    className="p-4 hover:bg-slate-50 transition-all cursor-pointer group flex items-center justify-between"
                                    onClick={() => setSelectedContract(c)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <User className="h-5 w-5 text-slate-400 group-hover:text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm uppercase text-slate-900 leading-none">{c.clientName}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{c.type}</span>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                                                    Inicia: {format(firstTheoryDay, "EEEE d", { locale: es })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-300 group-hover:text-primary transition-all">
                                        <span className="text-[9px] font-black uppercase opacity-0 group-hover:opacity-100">Generar Constancia</span>
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-24 text-center flex flex-col items-center gap-4 opacity-30">
                            <div className="bg-slate-100 p-6 rounded-full">
                                <Calendar className="h-12 w-12 text-slate-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-black uppercase tracking-[0.2em]">Sin nuevos inicios de teoría</p>
                                <p className="text-[10px] font-medium text-slate-500">No se detectan alumnos cuya primera sesión teórica inicie en este rango.</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        ) : (
            /* VISTA DE LA CONSTANCIA SELECCIONADA */
            <div className="flex flex-col items-center gap-4 animate-in fade-in-50 duration-500">
                <div className="flex flex-col gap-4 print:hidden w-full max-w-3xl">
                    <div className="bg-slate-100 p-1 rounded-xl flex justify-center">
                        <Tabs value={activeTemplate} onValueChange={(v: any) => setActiveTemplate(v)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-10 bg-transparent">
                                <TabsTrigger value="ampliacion" className="gap-2 font-bold uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <Repeat className="h-3.5 w-3.5" /> Evaluación Ampliaciones
                                </TabsTrigger>
                                <TabsTrigger value="standard" className="gap-2 font-bold uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <FileText className="h-3.5 w-3.5" /> Evaluación Estándar
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <Button 
                            onClick={handlePrint} 
                            variant="default" 
                            size="lg" 
                            className="flex-1 h-12 font-black uppercase tracking-widest border-2 border-slate-800"
                        >
                            <Printer className="mr-2 h-4 w-4" /> Imprimir Evaluación
                        </Button>
                        <Button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloading}
                            variant="outline" 
                            size="lg" 
                            className="flex-1 h-12 font-black uppercase tracking-widest border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Descargar PDF
                        </Button>
                        <Button 
                            onClick={() => setSelectedContract(null)} 
                            variant="ghost" 
                            size="lg" 
                            className="h-12 px-6 font-bold uppercase text-[10px] hover:bg-slate-100"
                        >
                            Volver al Listado
                        </Button>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 border rounded-lg border-dashed print:hidden flex items-center gap-2 mb-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <p className="text-[10px] font-bold uppercase text-slate-500">Vista Previa: {selectedContract.clientName}</p>
                </div>

                <div id="evaluation-print-area" className="bg-white shadow-2xl rounded-sm" style={{ width: '8.5in', height: '11in', minWidth: '8.5in', minHeight: '11in', backgroundColor: '#ffffff' }}>
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
                header, footer, nav, aside, .print-hide, button, .tabs-list, .print-hidden { display: none !important; }
                body { background: white !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; height: auto !important; }
                #evaluation-print-area { 
                    border: none !important; 
                    box-shadow: none !important; 
                    margin: 0 !important;
                    display: block !important;
                    width: 8.5in !important;
                    height: 11in !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    z-index: 9999 !important;
                }
            }
        `}</style>
    </div>
  );
}

export default function ATTEvaluationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>}>
      <ATTEvaluationsContent />
    </Suspense>
  );
}
