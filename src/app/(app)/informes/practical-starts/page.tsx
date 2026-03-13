'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
  Car,
  Bike,
  ClipboardList,
  User,
  ArrowRight
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import type { Contract } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function PracticalStartsReport() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Consulta simplificada para evitar errores de índices. El filtrado se hace en JS.
  const activeQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), orderBy('folioNumber', 'desc')) : null), [db]);
  const { data: contracts, isLoading } = useCollection<Contract>(activeQuery);

  const weeklyStarts = useMemo(() => {
    if (!contracts) return [];
    
    return contracts
      .filter(c => c.status === 'active' || c.status === 'completed')
      .map(c => {
        const details = c.autoMotoDetails || c.deluxeDetails;
        const schedules = details?.practicalClassSchedules || details?.motoPracticalClassSchedules || (details as any)?.classSchedules || [];
        
        if (schedules.length === 0) return null;

        const firstClassDate = toDate(schedules[0].date);
        if (isNaN(firstClassDate.getTime())) return null;

        if (isWithinInterval(firstClassDate, { start: weekStart, end: weekEnd })) {
          return {
            contract: c,
            firstDay: firstClassDate,
            instructor: schedules[0].instructor || 'Pendiente',
            vehicle: schedules[0].vehicle || 'Pendiente'
          };
        }
        return null;
      })
      .filter((item): item is any => item !== null)
      .sort((a, b) => a.firstDay.getTime() - b.firstDay.getTime());
  }, [contracts, weekStart, weekEnd]);

  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0.5,
        filename: `Inicios_Practicos_Freeway_${format(weekStart, 'ddMM')}.pdf`,
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
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 print:hidden">
        <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
                <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Inicios de Clases Prácticas</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase">Listado semanal de primeros días</p>
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
          <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg">
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      <Card id="report-to-print" className="shadow-xl border-none m-2">
        <CardHeader className="bg-slate-900 text-white py-6">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-widest">Listado Semanal de Inicios</CardTitle>
                    <p className="text-xs font-bold text-emerald-400 mt-1 uppercase">
                        Semana: {format(weekStart, 'PP', { locale: es })} al {format(weekEnd, 'PP', { locale: es })}
                    </p>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Inicios</p>
                    <p className="text-2xl font-black text-emerald-400 leading-none">{weeklyStarts.length}</p>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-24 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-slate-200" /></div>
          ) : weeklyStarts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b-2">
                  <TableHead className="font-black text-[10px] uppercase">Fecha Inicio</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Estudiante</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Tipo de Curso</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Instructor</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Vehículo</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right print:hidden">Expediente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyStarts.map((item, idx) => {
                  const isMoto = item.contract.type === 'Curso Moto';
                  return (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">{format(item.firstDay, 'EEEE d', { locale: es }).toUpperCase()}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{format(item.firstDay, 'MMMM', { locale: es })}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold uppercase text-slate-800">{item.contract.clientName}</span>
                            <span className="text-[9px] font-black text-primary">FOLIO {String(item.contract.folioNumber).padStart(6, '0')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                            {isMoto ? <Bike className="h-3.5 w-3.5 text-orange-600" /> : <Car className="h-3.5 w-3.5 text-blue-600" />}
                            <span className="text-[10px] font-bold uppercase text-slate-500">{item.contract.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] font-black uppercase text-slate-600">{item.instructor}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 bg-white">
                            {item.vehicle}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600">
                            <Link href={`/contracts/${item.contract.id}`}><ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-32 text-center flex flex-col items-center gap-4 opacity-30">
                <ClipboardList className="h-16 w-16 text-slate-400" />
                <p className="font-black uppercase text-xs tracking-widest text-slate-500">No se detectan nuevos inicios para esta semana</p>
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
          #report-to-print { border: none !important; box-shadow: none !important; width: 100% !important; margin: 0 !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
          .text-emerald-400 { color: #34d399 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
