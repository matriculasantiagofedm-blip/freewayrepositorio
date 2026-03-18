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
  isWithinInterval,
  isSaturday,
  isSunday,
  getDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download, 
  BookOpen,
  Clock,
  ArrowRight,
  UserCheck,
  LayoutGrid
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import type { Contract } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

type GroupFilter = 'all' | 'semana' | 'sabatino';

export default function TheoreticalSchedulePage() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Consulta global de contratos activos/completados
  const activeQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null), [db]);
  const { data: contracts, isLoading } = useCollection<Contract>(activeQuery);

  // Unificar alumnos de la semana (Sin duplicados por contrato) con filtros de modalidad
  const weeklyCitations = useMemo(() => {
    const studentMap = new Map<string, any>();

    contracts?.forEach(c => {
      let earliestDateInWeek: Date | null = null;
      let scheduleTime = 'Pendiente';

      // 1. Revisar fechas teóricas de cursos estándar (Auto/Moto/Deluxe)
      const theoryDates = c.autoMotoDetails?.theoreticalClassDates || c.deluxeDetails?.theoreticalClasses || [];
      const theorySchedule = c.autoMotoDetails?.theoreticalClassSchedule || c.deluxeDetails?.theoreticalClassSchedule || 'Pendiente';
      
      theoryDates.forEach(tDate => {
        const d = toDate(tDate);
        if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
          if (!earliestDateInWeek || d < earliestDateInWeek) {
            earliestDateInWeek = d;
            scheduleTime = theorySchedule;
          }
        }
      });

      // 2. Revisar sesiones únicas de Ampliaciones
      if (c.ampliacionesDetails?.theoreticalClassDate) {
        const d = toDate(c.ampliacionesDetails.theoreticalClassDate);
        if (isWithinInterval(d, { start: weekStart, end: weekEnd })) {
          if (!earliestDateInWeek || d < earliestDateInWeek) {
            earliestDateInWeek = d;
            scheduleTime = c.ampliacionesDetails.theoreticalClassTime || 'Pendiente';
          }
        }
      }

      // Si el alumno tiene al menos una cita esta semana, añadirlo una sola vez aplicando el filtro
      if (earliestDateInWeek) {
        const dayNum = getDay(earliestDateInWeek); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
        const isSabatino = isSaturday(earliestDateInWeek) || isSunday(earliestDateInWeek);
        const isSemanal = dayNum >= 2 && dayNum <= 5; // Martes a Viernes como pidió el usuario

        let itemModality: GroupFilter = 'all';
        if (isSabatino) itemModality = 'sabatino';
        else if (isSemanal) itemModality = 'semana';
        else itemModality = 'all'; // Lunes u otros caen en "all" pero no en los filtros específicos

        // Aplicar filtro de modalidad
        if (groupFilter !== 'all') {
            if (groupFilter === 'semana' && !isSemanal) return;
            if (groupFilter === 'sabatino' && !isSabatino) return;
        }

        studentMap.set(c.id, {
          id: c.id,
          name: c.clientName,
          type: c.type,
          date: earliestDateInWeek,
          time: scheduleTime,
          folio: c.folioNumber,
          modality: isSabatino ? 'Sabatino' : (isSemanal ? 'Semanal' : 'Otro')
        });
      }
    });

    // Ordenar cronológicamente por el primer día de asistencia de la semana
    return Array.from(studentMap.values()).sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
    });
  }, [contracts, weekStart, weekEnd, groupFilter]);

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
        filename: `Agenda_Teorica_Freeway_${groupFilter}_${format(weekStart, 'ddMM')}.pdf`,
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
      <div className="flex flex-col gap-6 px-2 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
                    <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Agenda Teórica Semanal</h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase">Listado consolidado de alumnos por semana</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white border rounded-lg shadow-sm">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-10 w-10"><ChevronLeft className="h-4 w-4" /></Button>
                <div className="px-4 font-black uppercase text-[10px] tracking-widest min-w-[180px] text-center">
                  {format(weekStart, "d 'DE' MMM", { locale: es })} - {format(weekEnd, "d 'DE' MMM", { locale: es })}
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-10 w-10"><ChevronRight className="h-4 w-4" /></Button>
              </div>
              
              <Button variant="outline" onClick={() => window.print()} className="font-bold h-10 border-2 border-slate-800">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
              <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-indigo-600 hover:bg-indigo-700 h-10 font-bold shadow-lg">
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} PDF
              </Button>
            </div>
        </div>

        {/* Filtros de Modalidad */}
        <div className="flex flex-col gap-3">
            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                <LayoutGrid className="h-3 w-3" /> Filtrar por Modalidad de Teoría:
            </Label>
            <Tabs value={groupFilter} onValueChange={(v: any) => setGroupFilter(v)} className="w-full max-w-lg">
                <TabsList className="grid w-full grid-cols-3 h-11 bg-white border rounded-xl p-1 shadow-sm">
                    <TabsTrigger value="all" className="rounded-lg font-bold text-[10px] uppercase">Todos los días</TabsTrigger>
                    <TabsTrigger value="semana" className="rounded-lg font-bold text-[10px] uppercase">Semanal (Mar-Vie)</TabsTrigger>
                    <TabsTrigger value="sabatino" className="rounded-lg font-bold text-[10px] uppercase">Sabatinos</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
      </div>

      {/* Reporte de un solo listado */}
      <Card id="theory-report-print" className="shadow-xl border-none m-2 overflow-hidden">
        <CardHeader className="bg-slate-900 text-white py-6">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-widest">
                        Citaciones Teóricas: {groupFilter === 'all' ? 'Semana Completa' : groupFilter === 'semana' ? 'Grupo Semanal' : 'Grupo Sabatino'}
                    </CardTitle>
                    <p className="text-xs font-bold text-indigo-400 mt-1 uppercase">
                        Periodo: {format(weekStart, 'PP', { locale: es })} al {format(weekEnd, 'PP', { locale: es })}
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
                <TableRow className="bg-slate-50 border-b-2 border-slate-200">
                  <TableHead className="font-black text-[10px] uppercase text-slate-500">Primer Día Asistencia</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500">Estudiante</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500">Tipo de Trámite</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500">Horario Citación</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right print:hidden text-slate-500">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyCitations.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900">{format(item.date, 'EEEE d', { locale: es }).toUpperCase()}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{format(item.date, 'MMMM', { locale: es })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase text-slate-800 leading-tight">{item.name}</span>
                          <span className="text-[9px] font-black text-primary">FOLIO {String(item.folio).padStart(6, '0')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 bg-white text-slate-500 py-0 h-5 w-fit">
                            {item.type}
                        </Badge>
                        <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 rounded w-fit",
                            item.modality === 'Sabatino' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                            Grupo: {item.modality}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-indigo-600" />
                          <span className="text-[10px] font-black uppercase text-slate-600">{item.time}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600 rounded-full">
                          <Link href={`/contracts/${item.id}`}><ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-32 text-center flex flex-col items-center gap-4 opacity-30">
                <div className="bg-slate-100 p-6 rounded-full">
                    <UserCheck className="h-12 w-12 text-slate-400" />
                </div>
                <p className="font-black uppercase text-xs tracking-widest text-slate-500">No hay citaciones registradas para este filtro</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="p-6 text-center text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] print:block hidden">
        Reporte Generado por Sistema ContractTime • Freeway Escuela de Manejo S.A.
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter portrait; margin: 0; }
          body { background: white !important; }
          header, footer, nav, aside, .print-hidden, button { display: none !important; }
          #theory-report-print { border: none !important; box-shadow: none !important; width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
          .text-indigo-400 { color: #818cf8 !important; -webkit-print-color-adjust: exact; }
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
