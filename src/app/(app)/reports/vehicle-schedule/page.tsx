'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Printer, CalendarIcon, Car, ChevronLeft, User, Clock } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';

const VEHICLES = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel', 'Moto Roja', 'Moto Negra'];
const TIME_SLOTS = ['08:00am a 10:00am', '10:00am a 12:00pm', '01:00pm a 03:00pm', '03:00pm a 05:00pm'];

export default function VehicleScheduleReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [scheduledClasses, setScheduledScheduled] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchSchedule = async (date: Date) => {
    if (!db || !user) return;
    setIsLoading(true);
    try {
      const results: any[] = [];
      const q = query(collection(db, 'contracts'), where('status', '==', 'active'));
      const snap = await getDocs(q);

      snap.forEach(doc => {
        const d = doc.data();
        const proc = (arr: any[], type: string) => {
          arr?.forEach(s => {
            if (isSameDay(toDate(s.date), date)) {
              results.push({ student: d.clientName, vehicle: s.vehicle, time: s.time, type, instructor: s.instructor });
            }
          });
        };
        if (d.autoMotoDetails?.practicalClassSchedules) proc(d.autoMotoDetails.practicalClassSchedules, 'Auto');
        if (d.autoMotoDetails?.motoPracticalClassSchedules) proc(d.autoMotoDetails.motoPracticalClassSchedules, 'Moto');
        if (d.deluxeDetails?.classSchedules) proc(d.deluxeDetails.classSchedules, 'Deluxe');
      });

      const qManual = query(collection(db, 'manual_schedules'));
      const snapManual = await getDocs(qManual);
      snapManual.forEach(doc => {
        const d = doc.data();
        if (isSameDay(toDate(d.date), date)) {
          results.push({ student: d.studentName, vehicle: d.vehicle, time: d.timeSlot, type: 'Manual', instructor: d.instructor });
        }
      });

      setScheduledScheduled(results);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (mounted) fetchSchedule(selectedDate); }, [selectedDate, db, user, mounted]);

  const grid = useMemo(() => {
    const res: Record<string, any> = {};
    VEHICLES.forEach(v => {
      res[v] = {};
      TIME_SLOTS.forEach(t => {
        res[v][t] = scheduledClasses.find(c => c.vehicle === v && (c.time === t || c.time?.includes(t.split(' ')[0])));
      });
    });
    return res;
  }, [scheduledClasses]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/reports"><ChevronLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="font-headline text-3xl font-bold uppercase">Agenda por Vehículo</h1>
                    <p className="text-muted-foreground text-xs">Ocupación de flota por turnos.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Popover><PopoverTrigger asChild><Button variant="outline" className="font-bold"><CalendarIcon className="mr-2 h-4 w-4" />{format(selectedDate, "PPP", { locale: es })}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus /></PopoverContent></Popover>
                <Button onClick={() => window.print()} variant="secondary" className="font-bold"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
            {VEHICLES.map(v => (
                <Card key={v} className="shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white py-2 px-4 flex flex-row items-center gap-2">
                        <Car className="h-4 w-4" />
                        <CardTitle className="text-xs font-black uppercase tracking-widest">{v}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {TIME_SLOTS.map(t => {
                            const session = grid[v][t];
                            return (
                                <div key={t} className={cn("border-b last:border-0 p-3 flex flex-col gap-1", session ? "bg-blue-50/50" : "bg-white opacity-40")}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> {t}</span>
                                        {session && <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded">{session.type}</span>}
                                    </div>
                                    {session ? (
                                        <div className="flex flex-col">
                                            <p className="text-xs font-black uppercase text-slate-900 leading-tight">{session.student}</p>
                                            <p className="text-[9px] font-bold text-blue-700 uppercase flex items-center gap-1"><User className="h-2.5 w-2.5" /> {session.instructor || 'Sin asignar'}</p>
                                        </div>
                                    ) : <p className="text-[10px] font-bold text-slate-300 italic uppercase">Disponible</p>}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            ))}
        </div>

        <style jsx global>{`
            @media print {
                @page { size: letter portrait; margin: 0.5in; }
                header, nav, .print-hidden, button { display: none !important; }
                body { background: white !important; }
                .card { break-inside: avoid; }
            }
        `}</style>
    </div>
  );
}
