'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { 
  format, 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  isWithinInterval
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download, 
  BookOpen,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import type { Contract } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function TheoreticalSchedulePage() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Consulta global de contratos activos/completados
  const activeQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null), [db]);
  const { data: contracts, isLoading } = useCollection<Contract>(activeQuery);

  // Unificar y aplanar todas las citaciones teóricas de la semana
  const weeklyCitations = useMemo(() => {
    const list: any[] = [];

    contracts?.forEach(c => {
      // 1. Procesar fechas teóricas de cursos estándar (Auto/Moto/Deluxe)
      const theoryDates = c.autoMotoDetails?.theoreticalClassDates || c.deluxeDetails?.theoreticalClasses || [];
      const theorySchedule = c.autoMotoDetails?.theoreticalClassSchedule || c.deluxeDetails?.theoreticalClassSchedule || 'Pendiente';
      
      theoryDates.forEach(tDate => {
        const d = toDate(tDate);
        if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
          list.push({
            id: `${c.id}-theory-${d.getTime()}`,
            contractId: c.id,
            name: c.clientName,
            type: c.type,
            date: d,
            time: theorySchedule,
            folio: c.folioNumber
          });
        }
      });

      // 2. Procesar sesiones únicas de Ampliaciones
      if (c.ampliacionesDetails?.theoreticalClassDate) {
        const d = toDate(c.ampliacionesDetails.theoreticalClassDate);
        if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
          list.push({
            id: `${c.id}-ampliacion`,
            contractId: c.id,
            name: c.clientName,
            type: 'Ampliación',
            date: d,
            time: c.ampliacionesDetails.theoreticalClassTime || 'Pendiente',
            folio: c.folioNumber
          });
        }
      }
    });

    // Ordenar cronológicamente por día y luego por horario
    return list.sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
    });
  }, [contracts, weekStart, weekEnd]);

  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const handleDownloadPdf = async () => {
    const element = document.getElementById('theory-report-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0.5,
        filename: `Agenda_Teorica_Freeway_Semana_${format(weekStart, 'ddMM')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 bg-slate-50/50 min-h-screen">
      {/* Cabecera de Control */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 print:hidden">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Agenda Teórica Semanal</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase">Listado consolidado de capacitación presencial</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border rounded-lg shadow-sm">
            <Button variant="ghost" size="icon" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="px-4 font-black uppercase text-[10px] tracking-widest min-w-[180px] text-center">
              {format(weekStart, "d 'DE' MMM", { locale: es })} - {format(weekEnd, "d 'DE' MMM", { locale: es })}
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          
          <Button variant="outline" onClick={() => window.print()} className="font-bold border-2"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg">
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      {/* Reporte de un solo listado */}
      <Card id="theory-report-print" className="shadow-xl border-none m-2 overflow-hidden">
        <CardHeader className="bg-slate-900 text-white py-6">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-widest">Listado de Citaciones Teóricas</CardTitle>
                    <p className="text-xs font-bold text-indigo-400 mt-1 uppercase">
                        Semana del {format(weekStart, 'PP', { locale: es })} al {format(weekEnd, 'PP', { locale: es })}
                    </p>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Alumnos</p>
                    <p className="text-2xl font-black text-indigo-400 leading-none">{weeklyCitations.length}</p>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-24 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-slate-200" /></div>
          ) : weeklyCitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b-2">
                  <TableHead className="font-black text-[10px] uppercase">Día y Fecha</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Estudiante</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Tipo de Trámite</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Horario Citación</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right print:hidden">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyCitations.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900">{format(item.date, 'EEEE d', { locale: es }).toUpperCase()}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{format(item.date, 'MMMM', { locale: es })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase text-slate-800">{item.name}</span>
                          <span className="text-[9px] font-black text-primary">FOLIO {String(item.folio).padStart(6, '0')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 bg-white text-slate-500">
                          {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-indigo-600" />
                          <span className="text-[10px] font-black uppercase text-slate-600">{item.time}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600">
                          <Link href={`/contracts/${item.contractId}`}><ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-32 text-center flex flex-col items-center gap-4 opacity-30">
                <BookOpen className="h-16 w-16 text-slate-400" />
                <p className="font-black uppercase text-xs tracking-widest text-slate-500">No hay clases teóricas programadas para esta semana</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="p-6 text-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] print:block hidden">
        Reporte Generado por Sistema ContractTime • Freeway Escuela de Manejo S.A.
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; }
          header, footer, nav, aside, .print-hidden, button { display: none !important; }
          #theory-report-print { border: none !important; box-shadow: none !important; width: 100% !important; margin: 0 !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
          .text-indigo-400 { color: #818cf8 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
