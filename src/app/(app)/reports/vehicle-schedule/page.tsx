'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import type { Contract, TimeSlot, ManualSchedule, ClassStatus } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, User, AlertCircle, Fuel, MessageSquare, Timer, Landmark, Ban, RefreshCw, Minus, Printer, ClipboardList, Download, Bike } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { isPanamaHoliday } from '@/lib/holidays';
import { useCurrentRole } from '@/hooks/use-current-role';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
    { id: '8am-10am', label: '08:00 - 10:00' },
    { id: '10am-12pm', label: '10:00 - 12:00' },
    { id: '1pm-3pm', label: '13:00 - 15:00' },
    { id: '3pm-5pm', label: '15:00 - 17:00' },
];

const SLOT_ORDER: Record<string, number> = {
    '8am-10am': 1,
    '10am-12pm': 2,
    '1pm-3pm': 3,
    '3pm-5pm': 4,
};

const TIME_STRING_TO_SLOT_MAP: { [key: string]: TimeSlot } = {
    '08:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '01:00pm a 03:00pm': '1pm-3pm',
    '03:00pm a 05:00pm': '3pm-5pm',
    '8am-10am': '8am-10am',
    '10am-12pm': '10am-12pm',
    '1pm-3pm': '1pm-3pm',
    '3pm-5pm': '3pm-5pm'
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

const vehicleColors: Record<string, string> = {
    'Picanto Blanco': 'bg-blue-50 border-blue-300 text-blue-800',
    'Picanto Bronce': 'bg-amber-50 border-amber-400 text-amber-900',
    'Spark': 'bg-green-50 border-green-300 text-green-800',
    'Auto Diesel': 'bg-indigo-50 border-indigo-300 text-indigo-800',
    'Moto Roja': 'bg-red-50 border-red-300 text-red-800',
    'Moto Negra': 'bg-stone-50 border-stone-400 text-stone-800',
};

const vehicleStatusColors: Record<string, string> = {
    'Picanto Blanco': 'bg-blue-600',
    'Picanto Bronce': 'bg-amber-700',
    'Spark': 'bg-green-600',
    'Auto Diesel': 'bg-indigo-600',
    'Moto Roja': 'bg-red-600',
    'Moto Negra': 'bg-stone-700',
};

export default function VehicleScheduleReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();
  const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, any[]>>(new Map());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentDate(new Date());
  }, []);

  const isAdmin = role === 'Administrador';
  const isVentas = role === 'Ventas';

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']));
  }, [db, user]);

  const manualEntriesQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return collection(db, 'manual_schedules');
  }, [db, user]);

  const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsQuery);
  const { data: manualEntries, isLoading: isLoadingManual } = useCollection<ManualSchedule>(manualEntriesQuery);

  const weekStart = useMemo(() => currentDate ? startOfWeek(currentDate, { weekStartsOn: 1 }) : null, [currentDate]);
  const days = useMemo(() => weekStart ? Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)) : [], [weekStart]);

  useEffect(() => {
    if (!contracts && !manualEntries || !weekStart || !currentDate) return;
    const weekInterval = { start: startOfDay(weekStart), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    
    const allSessionsFlat: any[] = [];

    const processAny = (
        id: string, 
        name: string, 
        date: any, 
        slotString: string, 
        vehicle: string, 
        instructor: string, 
        status: ClassStatus = 'scheduled', 
        refueled = false,
        isEval = false, 
        type: 'contract' | 'manual' = 'contract', 
        displayClassNumber: number | string, 
        slotIndex?: number, 
        subType?: 'auto' | 'moto',
        plan?: string,
        studentIdNumber?: string
    ) => {
        if (!date || !vehicle) return;
        const d = toDate(date);
        if (isNaN(d.getTime())) return;
        const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString as TimeSlot;
        
        allSessionsFlat.push({ 
            id, name, date: d, slot: slotId, vehicle, instructor, status, refueled, isEval, type, displayClassNumber, slotIndex, subType, plan: plan || 'Plan no especificado', studentIdNumber: studentIdNumber || ''
        });
    };

    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        const plan = d?.coursePlan || c.type;
        const isEval = (d?.coursePlan === 'evaluacion-estacionamiento' || d?.coursePlan === 'moto-evaluacion-estacionamiento');
        const sid = d?.studentIdNumber || c.studentIdNumber || '';
        
        const proc = (arr: any[], subType: 'auto' | 'moto' = 'auto') => {
            arr?.forEach((s, i) => {
                processAny(c.id, c.clientName, s.date, s.time, s.vehicle, s.instructor, s.status || 'scheduled', !!s.refueled, isEval, 'contract', i + 1, i, subType, plan, sid);
            });
        };

        if (c.type === 'Curso Deluxe') {
            proc(c.deluxeDetails?.classSchedules || [], 'auto');
        } else {
            if (c.autoMotoDetails?.practicalClassSchedules) proc(c.autoMotoDetails.practicalClassSchedules, 'auto');
            if (c.autoMotoDetails?.motoPracticalClassSchedules) proc(c.autoMotoDetails.motoPracticalClassSchedules, 'moto');
        }
    });

    manualEntries?.forEach(e => {
        if (e.classType === 'Práctica') {
            processAny(e.id, e.studentName, e.date, e.timeSlot, e.vehicle, e.instructor, e.status || 'scheduled', !!e.refueled, false, 'manual', e.classNumber, undefined, undefined, e.coursePlan, '');
        }
    });

    const newWeeklyAssignments = new Map<string, any[]>();
    allSessionsFlat.forEach(s => {
        if (isWithinInterval(s.date, weekInterval)) {
            const key = format(s.date, 'yyyy-MM-dd');
            const dayArr = newWeeklyAssignments.get(key) || [];
            dayArr.push(s);
            newWeeklyAssignments.set(key, dayArr);
        }
    });

    setWeeklyAssignments(newWeeklyAssignments);
  }, [contracts, manualEntries, weekStart, currentDate]);

  const handlePrintLog = (item: any) => {
    const contract = contracts?.find(c => c.id === item.id);
    if (!contract) return;
    window.open(`/print-log/${contract.id}?name=${encodeURIComponent(contract.clientName)}&id=${item.studentIdNumber}&instructor=${encodeURIComponent(item.instructor)}`, '_blank');
  };

  const handleUpdateStatus = (item: any, newStatus: ClassStatus) => {
    if (!db || isUpdating) return;
    setIsUpdating(true);
    // Lógica simplificada para ejemplo
    setIsUpdating(false);
  };

  if (!mounted || !currentDate || !weekStart) return null;

  return (
    <div className="flex flex-col gap-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: letter landscape; margin: 0; }
          header, footer, nav, aside, .print-hide, button, .popover-trigger { display: none !important; }
          body { background: white !important; padding: 0 !important; overflow: hidden !important; height: auto !important; }
          .print-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 3mm !important; display: block !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 5pt !important; border: 1px solid black !important; table-layout: fixed !important; }
          th, td { border: 1px solid black !important; padding: 0.5px !important; }
          .h-40 { height: 5.5rem !important; }
        }
      `}} />

      <div className="flex justify-between items-center print-hide">
        <h1 className="font-headline text-3xl font-bold">Agenda Práctica Semanal</h1>
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft /></Button>
            <span className="font-bold text-[10px] uppercase w-44 text-center">{format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight /></Button>
            <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
      </div>

      <Card id="practical-schedule-content" className="border-none shadow-none bg-transparent print-container">
        <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[1000px] border-collapse table-fixed w-full print:min-w-full">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[80px] border text-center text-[10px] font-bold">TURNO</TableHead>
                        {days.map(day => (
                            <TableHead key={day.toISOString()} className="text-center border p-1">
                                <div className="text-[9px] font-bold uppercase">{format(day, 'eee', { locale: es })}</div>
                                <div className="text-lg font-black">{format(day, 'd')}</div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                {TIME_SLOTS.map(slot => (
                    <TableRow key={slot.id} className="h-40 print:h-32">
                    <TableCell className="border bg-muted/10 text-center text-[9px] font-bold">{slot.label}</TableCell>
                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const assignments = weeklyAssignments.get(dateKey)?.filter(a => a.slot === slot.id) || [];
                        return (
                        <TableCell key={day.toISOString()} className="border p-1 align-top">
                            <div className="flex flex-col gap-1 h-full pt-1">
                                {assignments.map((a, i) => (
                                    <div key={i} className={cn("p-1 rounded border text-[8px] font-bold uppercase", vehicleColors[a.vehicle] || 'bg-slate-50')}>
                                        {a.name}
                                        <div className="text-[7px] opacity-70">{a.vehicle}</div>
                                    </div>
                                ))}
                            </div>
                        </TableCell>
                        )
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
