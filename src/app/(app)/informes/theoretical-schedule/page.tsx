
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
  eachDayOfInterval,
  isSunday,
  isSameDay
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
  Users,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import type { Contract } from '@/lib/types';

export default function TheoreticalSchedulePage() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null), [db]);
  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const scheduleData = useMemo(() => {
    const data: Record<string, { morning: any[], afternoon: any[] }> = {};

    contracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      
      // Procesar fechas teóricas (Auto/Moto/Deluxe)
      const theoryDates = c.autoMotoDetails?.theoreticalClassDates || c.deluxeDetails?.theoreticalClasses || [];
      const theorySchedule = c.autoMotoDetails?.theoreticalClassSchedule || c.deluxeDetails?.theoreticalClassSchedule || '';
      
      theoryDates.forEach(tDate => {
        const d = toDate(tDate);
        if (d >= weekStart && d <= weekEnd) {
          const dateKey = format(d, 'yyyy-MM-dd');
          if (!data[dateKey]) data[dateKey] = { morning: [], afternoon: [] };
          
          const entry = { id: c.id, name: c.clientName, type: c.type };
          if (theorySchedule.includes('3:00 pm')) {
            data[dateKey].afternoon.push(entry);
          } else {
            data[dateKey].morning.push(entry);
          }
        }
      });

      // Procesar Ampliaciones (Fecha única)
      if (c.ampliacionesDetails?.theoreticalClassDate) {
        const d = toDate(c.ampliacionesDetails.theoreticalClassDate);
        if (d >= weekStart && d <= weekEnd) {
          const dateKey = format(d, 'yyyy-MM-dd');
          if (!data[dateKey]) data[dateKey] = { morning: [], afternoon: [] };
          
          const entry = { id: c.id, name: c.clientName, type: 'Ampliación' };
          if (c.ampliacionesDetails.theoreticalClassTime?.includes('3:00 pm')) {
            data[dateKey].afternoon.push(entry);
          } else {
            data[dateKey].morning.push(entry);
          }
        }
      }
    });

    return data;
  }, [contracts, weekStart, weekEnd]);

  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const handleDownloadPdf = async () => {
    const element = document.getElementById('theory-agenda-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0.2,
        filename: `Agenda_Teorica_Freeway_${format(weekStart, 'ddMM')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
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
            <div className="bg-indigo-600 p-2 rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Agenda Teórica Semanal</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase">Control de capacitación presencial</p>
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

      <div id="theory-agenda-print" className="w-full overflow-x-auto pb-10">
        <div className="min-w-[1000px] bg-white border rounded-xl shadow-xl overflow-hidden m-2">
          <div className="grid grid-cols-6 border-b bg-slate-50/80">
            {weekDays.filter(d => !isSunday(d)).map(day => (
              <div key={day.toISOString()} className="p-4 border-r last:border-r-0 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{format(day, 'eeee', { locale: es })}</p>
                <p className="text-2xl font-black text-slate-800">{format(day, 'd')}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-6 min-h-[500px]">
            {weekDays.filter(d => !isSunday(d)).map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const data = scheduleData[dateKey] || { morning: [], afternoon: [] };

              return (
                <div key={dateKey} className="border-r last:border-r-0 p-3 space-y-6">
                  {/* GRUPO MAÑANA */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-1">
                        <span className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1"><Clock className="h-3 w-3" /> 8:00 - 10:00</span>
                        <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 rounded-full">{data.morning.length}</span>
                    </div>
                    <div className="space-y-1">
                        {data.morning.map((s, idx) => (
                            <div key={s.id || idx} className="p-2 bg-white border border-slate-100 rounded-lg shadow-sm">
                                <p className="text-[9px] font-black uppercase truncate leading-tight text-slate-800">{s.name}</p>
                                <p className="text-[7px] font-bold text-slate-400 uppercase truncate">{s.type}</p>
                            </div>
                        ))}
                        {data.morning.length === 0 && <p className="text-[8px] text-slate-300 italic text-center py-2">Sin citados</p>}
                    </div>
                  </div>

                  {/* GRUPO TARDE (SÁBADOS) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-1">
                        <span className="text-[9px] font-black uppercase text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3" /> 15:00 - 17:00</span>
                        <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 rounded-full">{data.afternoon.length}</span>
                    </div>
                    <div className="space-y-1">
                        {data.afternoon.map((s, idx) => (
                            <div key={s.id || idx} className="p-2 bg-white border border-slate-100 rounded-lg shadow-sm">
                                <p className="text-[9px] font-black uppercase truncate leading-tight text-slate-800">{s.name}</p>
                                <p className="text-[7px] font-bold text-slate-400 uppercase truncate">{s.type}</p>
                            </div>
                        ))}
                        {data.afternoon.length === 0 && <p className="text-[8px] text-slate-300 italic text-center py-2">Sin citados</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter landscape; margin: 0.2in; }
          body { background: white !important; }
          header, footer, nav, aside, .print-hidden, button { display: none !important; }
          #theory-agenda-print { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .min-w-[1000px] { min-width: 100% !important; border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
