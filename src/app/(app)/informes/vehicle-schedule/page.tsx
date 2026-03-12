
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Loader2, ChevronLeft, Car, Bike, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';

const VEHICLES = [
  { id: 'Picanto Blanco', label: 'Picanto Blanco', icon: Car, color: 'text-blue-600' },
  { id: 'Picanto Bronce', label: 'Picanto Bronce', icon: Car, color: 'text-amber-600' },
  { id: 'Spark', label: 'Spark', icon: Car, color: 'text-slate-600' },
  { id: 'Auto Diesel', label: 'Auto Diesel', icon: Car, color: 'text-emerald-600' },
  { id: 'Moto Roja', label: 'Moto Roja', icon: Bike, color: 'text-red-600' },
  { id: 'Moto Negra', label: 'Moto Negra', icon: Bike, color: 'text-zinc-900' },
];

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
};

export default function VehicleScheduleReport() {
  const db = useDb();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null), [db]);
  const manualQuery = useMemoQuery(() => (db ? query(collection(db, 'manual_schedules')) : null), [db]);

  const { data: contracts, isLoading: loadingC } = useCollection(contractsQuery);
  const { data: manualEntries, isLoading: loadingM } = useCollection(manualQuery);

  const occupancy = useMemo(() => {
    const data: Record<string, any[]> = {};
    const addEntry = (v: string, slotId: string, student: string, isManual: boolean, status?: string) => {
      const key = `${v}|${slotId}`;
      if (!data[key]) data[key] = [];
      data[key].push({ student, isManual, status });
    };

    contracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails;
      const processSlots = (slots: any[]) => {
        slots?.forEach(s => {
          if (isSameDay(toDate(s.date), selectedDate)) {
            const slotId = TIME_STRING_MAP[s.time] || s.time;
            if (s.vehicle) addEntry(s.vehicle, slotId, c.clientName, false, s.status);
          }
        });
      };
      processSlots(c.autoMotoDetails?.practicalClassSchedules || []);
      processSlots(c.autoMotoDetails?.motoPracticalClassSchedules || []);
      processSlots(c.deluxeDetails?.classSchedules || []);
    });

    manualEntries?.forEach(e => {
      if (isSameDay(toDate(e.date), selectedDate)) {
        addEntry(e.vehicle, e.timeSlot, e.studentName, true, e.status);
      }
    });

    return data;
  }, [contracts, manualEntries, selectedDate]);

  const isLoading = loadingC || loadingM;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Ocupación de Flota</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Monitoreo de turnos por vehículo.</p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48 justify-start text-left font-bold uppercase text-[10px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="p-24 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto opacity-20" /></div>
      ) : (
        <Card className="border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-40 font-black uppercase text-[10px] border-r">Vehículo</TableHead>
                  {TIME_SLOTS.map(slot => (
                    <TableHead key={slot.id} className="text-center font-black uppercase text-[10px] min-w-[180px]">
                      {slot.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {VEHICLES.map(v => (
                  <TableRow key={v.id} className="h-24">
                    <TableCell className="font-black text-xs border-r bg-slate-50/30">
                      <div className="flex items-center gap-2">
                        <v.icon className={cn("h-4 w-4", v.color)} />
                        {v.label}
                      </div>
                    </TableCell>
                    {TIME_SLOTS.map(slot => {
                      const bookings = occupancy[`${v.id}|${slot.id}`] || [];
                      return (
                        <TableCell key={slot.id} className="p-2 border-r last:border-r-0">
                          {bookings.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {bookings.map((b, idx) => (
                                <div key={idx} className={cn(
                                  "p-2 rounded-lg text-[9px] font-black uppercase border leading-tight",
                                  b.isManual ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800",
                                  b.status === 'missed' && "bg-red-600 text-white border-red-700"
                                )}>
                                  <div className="flex justify-between items-start">
                                    <span className="truncate max-w-[120px]">{b.student}</span>
                                    {b.status === 'missed' && <span className="text-[7px] bg-white/20 px-1 rounded ml-1">FALTÓ</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center opacity-10">
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Vacío</span>
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl border border-dashed text-[9px] font-bold uppercase text-slate-500">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div> Inscripción Digital</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-50 border border-amber-200 rounded"></div> Cupo Manual</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded"></div> Inasistencia</div>
        <div className="ml-auto flex items-center gap-2"><Info className="h-3 w-3" /> Máximo 3 alumnos por turno global (Normativa Tránsito)</div>
      </div>
    </div>
  );
}
