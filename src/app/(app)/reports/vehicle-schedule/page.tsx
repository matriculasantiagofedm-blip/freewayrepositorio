'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { Contract, TimeSlot, ManualSchedule } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, User, Car, Bike, ShieldCheck, Timer, Landmark, Ban } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Separator } from '@/components/ui/separator';
import { isPanamaHoliday } from '@/lib/holidays';

const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
    { id: '8am-10am', label: '08:00 - 10:00' },
    { id: '10am-12pm', label: '10:00 - 12:00' },
    { id: '1pm-3pm', label: '13:00 - 15:00' },
    { id: '3pm-5pm', label: '15:00 - 17:00' },
];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: TimeSlot } = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
};

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
    if (day === 0) return 0; // Domingo capacidad 0
    
    // Lógica: 8-10am -> Lunes 3, Martes-Viernes 2.
    if (slotId === '8am-10am') {
        if (day === 1) return 3;
        if (day >= 2 && day <= 5) return 2;
    }
    
    // Sábados 3-5pm -> 2 vehículos
    if (day === 6 && slotId === '3pm-5pm') return 2;
    
    return 3;
};

const vehicleColors: Record<string, string> = {
    'Picanto Blanco': 'bg-blue-50 border-blue-300 text-blue-800',
    'Picanto Bronce': 'bg-amber-50 border-amber-400 text-amber-900',
    'Spark': 'bg-green-50 border-green-300 text-green-800',
    'Auto Diesel': 'bg-indigo-50 border-indigo-300 text-indigo-800',
    'Moto Roja': 'bg-red-50 border-red-300 text-red-800',
    'Moto Negra': 'bg-stone-50 border-stone-400 text-stone-800',
};

export default function VehicleScheduleReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, any[]>>(new Map());

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', '==', 'active'));
  }, [db, user]);

  const manualEntriesQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return collection(db, 'manual_schedules');
  }, [db, user]);

  const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsQuery);
  const { data: manualEntries, isLoading: isLoadingManual } = useCollection<ManualSchedule>(manualEntriesQuery);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!contracts && !manualEntries) return;
    const weekInterval = { start: startOfDay(weekStart), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    const newWeeklyAssignments = new Map<string, any[]>();

    const add = (name: string, date: any, slot: TimeSlot, vehicle: string, instructor: string, isEval = false, num = 1) => {
        if (!date) return;
        const d = toDate(date);
        if (isNaN(d.getTime()) || !isWithinInterval(d, weekInterval)) return;
        const key = format(d, 'yyyy-MM-dd');
        const dayArr = newWeeklyAssignments.get(key) || [];
        dayArr.push({ name, slot, vehicle, instructor, isEval, num });
        newWeeklyAssignments.set(key, dayArr);
    };

    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        const isEval = (d?.coursePlan === 'evaluacion-estacionamiento' || d?.coursePlan === 'moto-evaluacion-estacionamiento');
        
        const proc = (arr: any[]) => arr.forEach((s, i) => {
            const slotId = TIME_STRING_TO_SLOT_MAP[s.time] || s.time;
            add(c.clientName, s.date, slotId, s.vehicle, s.instructor, isEval, i + 1);
        });

        if (c.autoMotoDetails?.practicalClassSchedules) proc(c.autoMotoDetails.practicalClassSchedules);
        if (c.autoMotoDetails?.motoPracticalClassSchedules) proc(c.autoMotoDetails.motoPracticalClassSchedules);
        if (c.deluxeDetails?.classSchedules) proc(c.deluxeDetails.classSchedules);
    });

    manualEntries?.forEach(e => {
        if (e.classType === 'Práctica') {
            add(e.studentName, e.date, e.timeSlot, e.vehicle, e.instructor, false, e.classNumber);
        }
    });

    setWeeklyAssignments(newWeeklyAssignments);
  }, [contracts, manualEntries, weekStart, currentDate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">Agenda Práctica Semanal</h1>
        <div className="flex items-center gap-2 bg-background border p-1 rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-bold text-[10px] uppercase w-44 text-center">{format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[1000px] border-collapse table-fixed w-full">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[100px] border text-center text-[10px] font-bold">TURNO</TableHead>
                        {days.map(day => {
                            const holiday = isPanamaHoliday(day);
                            const isSunday = day.getDay() === 0;
                            return (
                            <TableHead key={day.toISOString()} className={cn("text-center border p-2", isSunday && "bg-red-50", holiday && !isSunday && "bg-amber-50")}>
                                <div className="text-[10px] font-bold uppercase">{format(day, 'eee', { locale: es })}</div>
                                <div className="text-xl font-black">{format(day, 'd')}</div>
                                {isSunday && <div className="text-[8px] font-black text-red-600 uppercase mt-1">CERRADO</div>}
                                {holiday && !isSunday && <div className="text-[8px] font-black text-amber-700 uppercase mt-1">{holiday.name}</div>}
                            </TableHead>
                            )
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody>
                {TIME_SLOTS.map(slot => (
                    <TableRow key={slot.id} className="h-44 group">
                    <TableCell className="border bg-muted/10 text-center text-[10px] font-bold">{slot.label}</TableCell>
                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const holiday = isPanamaHoliday(day);
                        const isSunday = day.getDay() === 0;
                        const assignments = weeklyAssignments.get(dateKey)?.filter(a => a.slot === slot.id) || [];
                        
                        const cap = getGlobalCapacity(day, slot.id);
                        const count = new Set(assignments.map(a => a.vehicle)).size;

                        return (
                        <TableCell key={day.toISOString()} className={cn("border p-1.5 align-top relative", isSunday && "bg-red-50/20", holiday && !isSunday && "bg-amber-50/20")}>
                            {cap > 0 && (
                                <div className="absolute top-1 right-1 z-10">
                                    <div className={cn("px-1 py-0.5 rounded text-[9px] font-black border bg-white", count >= cap ? "text-red-600 border-red-200" : "text-slate-500")}>
                                        <ShieldCheck className="h-2.5 w-2.5 inline mr-1" /> {count}/{cap}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5 h-full pt-5">
                                {assignments.map((a, i) => (
                                    <div key={i} className={cn("p-2 rounded border text-[10px] shadow-sm leading-tight", a.isEval ? "bg-purple-50 border-purple-200" : (vehicleColors[a.vehicle] || 'bg-gray-100 border-gray-200'))}>
                                        <p className="truncate font-black uppercase mb-0.5">{a.name}</p>
                                        <p className="truncate text-[8px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                                            <User className="h-2.5 w-2.5" /> {a.instructor || 'SIN ASIGNAR'}
                                        </p>
                                        <div className="flex justify-between font-bold text-[9px] opacity-80 border-t border-black/10 pt-1 mt-1">
                                            <span>{a.vehicle}</span>
                                            <span>{a.isEval ? '10m' : `#${a.num}`}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TableCell>
                        );
                    })}
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
