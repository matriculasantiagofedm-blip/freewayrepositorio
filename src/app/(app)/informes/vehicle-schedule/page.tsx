'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp, doc, runTransaction, updateDoc } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { 
  format, 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSunday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download, 
  User,
  Car,
  Bike,
  Info,
  ExternalLink,
  Settings2,
  Fuel,
  XCircle,
  Clock,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import type { ClassStatus } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';

const TIME_SLOTS = [
  { id: '8am-10am', label: '08:00 - 10:00' },
  { id: '10am-12pm', label: '10:00 - 12:00' },
  { id: '1pm-3pm', label: '13:00 - 15:00' },
  { id: '3pm-5pm', label: '15:00 - 17:00' },
];

const TIME_STRING_MAP: Record<string, string> = {
  '08:00am a 10:00am': '8am-10am',
  '10:00am a 12:00pm': '10am-12pm',
  '01:00pm a 03:00pm': '1pm-3pm',
  '03:00pm a 05:00pm': '3pm-5pm',
  '8:00am a 10:00am': '8am-10am',
  '1:00pm a 3:00pm': '1pm-3pm',
};

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); 
    if (day === 0) return 0; 
    if (slotId === '8am-10am') {
        if (day === 1) return 3;
        if (day >= 2 && day <= 5) return 2;
    }
    if (day === 6 && slotId === '3pm-5pm') return 2;
    return 3;
};

const getVehicleColor = (vehicleName: string = '', status?: ClassStatus) => {
    // REGLA PRIORITARIA: Si no asistió, la tarjeta es ROJO INTENSO
    if (status === 'missed') {
        return 'border-red-900 bg-red-600 text-white shadow-xl scale-[1.02] z-10';
    }

    const v = vehicleName.toUpperCase();
    let base = 'border-amber-500 bg-amber-50 text-amber-900'; 
    
    if (v.includes('MOTO NEGRA')) base = 'border-slate-500 bg-slate-50 text-slate-900';
    else if (v.includes('MOTO')) base = 'border-red-500 bg-red-50 text-red-900';
    else if (v.includes('BLANCO')) base = 'border-emerald-500 bg-emerald-50 text-emerald-900';
    else if (v.includes('BRONCE')) base = 'border-blue-500 bg-blue-50 text-blue-900';
    else if (v.includes('PICK UP') || v.includes('PICKUP')) base = 'border-orange-500 bg-orange-50 text-orange-900';

    // Estados de atenuación para cancelaciones o reprogramaciones que NO sean inasistencia
    if (status === 'cancelled_vehicle' || status === 'rescheduled') {
        return cn(base, "opacity-40 grayscale-[0.5] border-dashed");
    }
    
    return base;
};

export default function WeeklyScheduleReport() {
  const db = useDb();
  const { toast } = useToast();
  const { role } = useCurrentRole();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null), [db]);
  const manualQuery = useMemoQuery(() => (db ? query(collection(db, 'manual_schedules')) : null), [db]);

  const { data: contracts, isLoading: loadingC } = useCollection(contractsQuery);
  const { data: manualEntries, isLoading: loadingM } = useCollection(manualQuery);

  const scheduleData = useMemo(() => {
    const data: Record<string, any[]> = {};
    const seenSessions = new Set<string>(); 
    
    const addEntry = (date: Date, slotId: string, entry: any) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const key = `${dateStr}|${slotId}`;
      
      const sessionFingerprint = `${entry.student}|${dateStr}|${slotId}|${entry.vehicle}|${entry.sessionNum}`.toLowerCase();
      
      if (seenSessions.has(sessionFingerprint)) return;
      
      seenSessions.add(sessionFingerprint);
      if (!data[key]) data[key] = [];
      data[key].push(entry);
    };

    const uniqueContracts = new Map();
    contracts?.forEach(c => uniqueContracts.set(c.id, c));

    uniqueContracts.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      
      const processSlots = (slots: any[], typeLabel: string, fieldPath: string) => {
        slots?.forEach((s, idx) => {
          if (!s.date) return;
          const slotDate = toDate(s.date);
          if (slotDate >= weekStart && slotDate <= weekEnd) {
            const slotId = TIME_STRING_MAP[s.time] || s.time;
            if (!slotId) return;

            addEntry(slotDate, slotId, {
              id: `${c.id}-${typeLabel}-${idx}`,
              contractId: c.id,
              student: c.clientName,
              plan: (details as any)?.coursePlan || c.type,
              instructor: s.instructor || 'Sin asignar',
              vehicle: s.vehicle || 'Sin vehículo',
              sessionNum: idx + 1,
              isManual: false,
              status: s.status,
              refueled: s.refueled,
              fieldPath 
            });
          }
        });
      };

      if (c.autoMotoDetails?.practicalClassSchedules) {
        processSlots(c.autoMotoDetails.practicalClassSchedules, 'auto', 'autoMotoDetails.practicalClassSchedules');
      }
      if (c.autoMotoDetails?.motoPracticalClassSchedules) {
        processSlots(c.autoMotoDetails.motoPracticalClassSchedules, 'moto', 'autoMotoDetails.motoPracticalClassSchedules');
      }
      if (c.deluxeDetails?.classSchedules) {
        processSlots(c.deluxeDetails.classSchedules, 'deluxe', 'deluxeDetails.classSchedules');
      }
    });

    manualEntries?.forEach(e => {
      if (!e.date || !e.timeSlot) return;
      const slotDate = toDate(e.date);
      if (slotDate >= weekStart && slotDate <= weekEnd) {
        addEntry(slotDate, e.timeSlot, {
          id: e.id,
          manualId: e.id,
          student: e.studentName,
          plan: e.coursePlan || 'Plan no especificado',
          instructor: e.instructor,
          vehicle: e.vehicle,
          sessionNum: e.classNumber,
          isManual: true,
          status: e.status,
          refueled: e.refueled
        });
      }
    });

    return data;
  }, [contracts, manualEntries, weekStart, weekEnd]);

  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const updateSession = async (session: any, updates: { status?: ClassStatus, refueled?: boolean }) => {
    if (!db) return;
    setIsUpdating(session.id);
    try {
        if (session.isManual) {
            const ref = doc(db, 'manual_schedules', session.manualId);
            await updateDoc(ref, updates);
        } else {
            await runTransaction(db, async (transaction) => {
                const ref = doc(db, 'contracts', session.contractId);
                const snap = await transaction.get(ref);
                if (!snap.exists()) return;
                
                const data = snap.data();
                const pathParts = session.fieldPath.split('.');
                let currentArray = data;
                for (const part of pathParts) {
                    currentArray = currentArray?.[part];
                }

                if (Array.isArray(currentArray)) {
                    const newArray = [...currentArray];
                    const idx = session.sessionNum - 1;
                    if (newArray[idx]) {
                        newArray[idx] = { ...newArray[idx], ...updates };
                        transaction.update(ref, { [session.fieldPath]: newArray });
                    }
                }
            });
        }
        toast({ title: 'Estado actualizado', description: 'La agenda ha sido sincronizada correctamente.' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado.' });
    } finally {
        setIsUpdating(null);
    }
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('weekly-agenda-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0.2,
        filename: `Agenda_Semanal_Freeway_${format(weekStart, 'ddMM')}_al_${format(weekEnd, 'ddMM')}.pdf`,
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

  const isLoading = loadingC || loadingM;

  return (
    <div className="flex flex-col gap-6 min-h-screen bg-slate-50/50">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 print:hidden">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Agenda Práctica Semanal</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Control de flota y sesiones por vehículo</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border rounded-lg shadow-sm">
            <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-10 w-10"><ChevronLeft className="h-4 w-4" /></Button>
            <div className="px-4 font-black uppercase text-[10px] tracking-widest min-w-[200px] text-center">
              {format(weekStart, "d 'DE' MMM", { locale: es })} - {format(weekEnd, "d 'DE' MMM yyyy", { locale: es })}
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-10 w-10"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          
          <Button variant="outline" onClick={() => window.print()} className="font-bold h-10 border-2">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-blue-600 hover:bg-blue-700 h-10 font-bold shadow-lg">
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      <div className="w-full flex flex-col gap-2 px-2 md:hidden print:hidden">
        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
            <Info className="h-4 w-4" />
            <p className="text-[10px] font-bold uppercase">Desliza la tabla hacia la derecha para ver los fines de semana.</p>
        </div>
      </div>

      <div id="weekly-agenda-print" className="w-full overflow-x-auto pb-10 custom-scrollbar">
        <div className="min-w-[1400px] bg-white border rounded-xl shadow-xl overflow-hidden m-2">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/80 border-b">
                <th className="w-28 p-4 font-black uppercase text-[10px] text-slate-400 border-r tracking-widest bg-slate-50 sticky left-0 z-20">Turno</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className={cn(
                    "p-4 border-r last:border-r-0 text-center min-w-[160px]",
                    isSunday(day) ? "bg-red-50/30" : ""
                  )}>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{format(day, 'eee', { locale: es })}</p>
                    <p className="text-2xl font-black text-slate-800 leading-none">{format(day, 'd')}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map(slot => (
                <tr key={slot.id} className="border-b last:border-b-0 h-48">
                  <td className="p-4 border-r bg-slate-50 sticky left-0 z-20 text-center shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <span className="text-[10px] font-black text-slate-800 whitespace-nowrap leading-tight">
                      {slot.label.split('-')[0]}<br/>-<br/>{slot.label.split('-')[1]}
                    </span>
                  </td>
                  {weekDays.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const sessions = scheduleData[`${dateKey}|${slot.id}`] || [];
                    const capacity = getGlobalCapacity(day, slot.id);
                    const isClosed = isSunday(day);

                    return (
                      <td key={dateKey} className={cn(
                        "p-2 border-r last:border-r-0 align-top",
                        isClosed ? "bg-red-50/20" : ""
                      )}>
                        {isClosed ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-40">
                            <span className="text-[8px] font-black uppercase text-red-600 tracking-tighter">Cerrado</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {sessions.map((s, idx) => {
                              const SessionCard = (
                                <div className={cn(
                                  "relative p-3 rounded-lg border-l-4 shadow-sm flex flex-col gap-1 cursor-pointer transition-all hover:scale-[1.02] group",
                                  getVehicleColor(s.vehicle, s.status)
                                )}>
                                  <div className="absolute top-1 right-1.5 flex items-center gap-1">
                                      {s.refueled && <Fuel className={cn("h-2.5 w-2.5 animate-pulse", s.status === 'missed' ? 'text-white' : 'text-blue-600')} />}
                                      {idx === 0 && <span className="bg-white/80 text-[7pt] font-black px-1 rounded-sm border border-current/20 text-slate-900">{sessions.length}/{capacity}</span>}
                                  </div>
                                  
                                  <p className="text-[9px] font-black uppercase leading-tight truncate pr-6">{s.student}</p>
                                  <p className="text-[7px] font-bold opacity-70 uppercase truncate">{s.plan}</p>
                                  
                                  <div className="flex items-center gap-1 mt-1 opacity-80">
                                      <User className="h-2.5 w-2.5" />
                                      <span className="text-[7px] font-black uppercase truncate">{s.instructor}</span>
                                  </div>

                                  <div className="flex justify-between items-end mt-1 border-t border-current/10 pt-1">
                                      <div className="flex flex-col">
                                          <span className="text-[7.5px] font-black uppercase truncate max-w-[60px]">{s.vehicle}</span>
                                          {s.status && s.status !== 'scheduled' && (
                                              <span className={cn("text-[6px] font-black uppercase leading-none", s.status === 'missed' ? 'text-white' : 'text-red-600')}>
                                                {s.status === 'missed' ? 'Inasistencia' : s.status === 'cancelled_vehicle' ? 'Falló Vehículo' : 'Reagendada'}
                                              </span>
                                          )}
                                      </div>
                                      <span className={cn("text-[7px] font-black px-1 rounded-full h-3.5 min-w-[14px] flex items-center justify-center", s.status === 'missed' ? 'bg-white text-red-600' : 'bg-black text-white')}>#{s.sessionNum}</span>
                                  </div>
                                </div>
                              );

                              if (role === 'Ventas') {
                                return <div key={s.id || idx}>{SessionCard}</div>;
                              }

                              return (
                                <Popover key={s.id || idx}>
                                  <PopoverTrigger asChild>
                                    {SessionCard}
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[240px] p-0 overflow-hidden shadow-2xl border-slate-200" side="right" align="start">
                                    <div className="p-3 bg-slate-900 text-white">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gestión de Turno</p>
                                        <p className="text-sm font-black uppercase truncate">{s.student}</p>
                                    </div>
                                    <div className="p-2 grid grid-cols-1 gap-1 bg-white">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className={cn("justify-start h-9 text-[10px] font-black uppercase gap-3", s.refueled ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                                          onClick={() => updateSession(s, { refueled: !s.refueled })}
                                          disabled={!!isUpdating}
                                        >
                                            <Fuel className="h-4 w-4" /> {s.refueled ? 'Quitar Gasolina' : 'Marcó Gasolina'}
                                        </Button>
                                        
                                        <div className="h-px bg-slate-100 my-1"></div>

                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="justify-start h-9 text-[10px] font-black uppercase gap-3 text-red-600 hover:bg-red-50"
                                          onClick={() => updateSession(s, { status: 'cancelled_vehicle' })}
                                          disabled={!!isUpdating}
                                        >
                                            <XCircle className="h-4 w-4" /> Cancelada por Vehículo
                                        </Button>

                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="justify-start h-9 text-[10px] font-black uppercase gap-3 text-amber-600 hover:bg-amber-50"
                                          onClick={() => updateSession(s, { status: 'rescheduled' })}
                                          disabled={!!isUpdating}
                                        >
                                            <RotateCcw className="h-4 w-4" /> Reagendada
                                        </Button>

                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="justify-start h-9 text-[10px] font-black uppercase gap-3 text-red-800 hover:bg-red-100"
                                          onClick={() => updateSession(s, { status: 'missed' })}
                                          disabled={!!isUpdating}
                                        >
                                            <AlertCircle className="h-4 w-4" /> No Asistió
                                        </Button>

                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="justify-start h-9 text-[10px] font-black uppercase gap-3 text-green-600 hover:bg-green-50"
                                          onClick={() => updateSession(s, { status: 'scheduled' })}
                                          disabled={!!isUpdating}
                                        >
                                            <Clock className="h-4 w-4" /> Restablecer Programada
                                        </Button>

                                        <div className="h-px bg-slate-100 my-1"></div>

                                        <Link 
                                            href={s.contractId ? `/contracts/${s.contractId}` : `/manual-schedule`}
                                            className="text-[10px] font-black uppercase text-blue-700 hover:underline flex items-center gap-3 p-2 bg-blue-50 rounded-md border border-blue-100 print:hidden"
                                        >
                                            <Settings2 className="h-4 w-4" /> Ver Expediente Completo
                                        </Link>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )
                            })}
                            {sessions.length === 0 && (
                              <div className="h-full flex items-center justify-center opacity-5">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Libre</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 p-6 bg-white border-t sticky bottom-0 print:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-50 border-l-4 border-red-500 rounded"></div> <span className="text-[9px] font-black uppercase text-slate-500">Moto Roja</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-50 border-l-4 border-slate-500 rounded"></div> <span className="text-[9px] font-black uppercase text-slate-500">Moto Negra</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-50 border-l-4 border-emerald-500 rounded"></div> <span className="text-[9px] font-black uppercase text-slate-500">Picanto Blanco</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-50 border-l-4 border-blue-500 rounded"></div> <span className="text-[9px] font-black uppercase text-slate-500">Picanto Bronce</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-50 border-l-4 border-orange-500 rounded"></div> <span className="text-[9px] font-black uppercase text-slate-500">Pick up</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-50 border-l-4 border-amber-500 rounded"></div> <span className="text-[9px] font-black uppercase text-slate-500">Spark</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 border border-red-900 rounded"></div> <span className="text-[9px] font-black uppercase text-red-600">No Asistió</span></div>
        <div className="ml-auto flex items-center gap-2 text-slate-400"><Info className="h-3 w-3" /> <span className="text-[8px] font-bold uppercase tracking-widest italic">Capacidad regulada por ATTT según turnos</span></div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 10px;
          border: 3px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
        @media print {
          @page { size: letter landscape; margin: 0.2in; }
          body { background: white !important; }
          header, footer, nav, aside, .print-hidden, button { display: none !important; }
          #weekly-agenda-print { padding: 0 !important; margin: 0 !important; }
          .min-w-[1400px] { min-width: 100% !important; border: none !important; box-shadow: none !important; }
          .h-48 { height: auto !important; min-height: 1.5in; }
          .shadow-sm { box-shadow: none !important; border: 1px solid #ddd !important; }
          .sticky { position: static !important; }
        }
      `}</style>
    </div>
  );
}
