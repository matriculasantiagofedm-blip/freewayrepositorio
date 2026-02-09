
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { Contract, VehicleName, TimeSlot, InstructorName, ManualSchedule } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, User, BookOpen, GraduationCap } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Separator } from '@/components/ui/separator';

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

const timeStringToTimeSlot = (timeString: string): TimeSlot | null => {
    return TIME_STRING_TO_SLOT_MAP[timeString] || null;
}

const vehicleColors: Record<string, string> = {
    'Picanto Blanco': 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
    'Picanto Bronce': 'bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300',
    'Spark': 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
    'Moto Roja': 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
    'Moto Negra': 'bg-[#efebe9] border-[#a1887f] text-[#4e342e] dark:bg-stone-900/40 dark:border-stone-800 dark:text-stone-300', // Chocolate/Marrón
    'Teórica': 'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200',
};

interface LocalAssignment {
    studentName: string;
    instructor: string;
    vehicle: string;
    timeSlot: TimeSlot;
    classNumber: number;
    classType: 'Práctica' | 'Teórica';
}

export default function VehicleScheduleReportPage() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, LocalAssignment[]>>(new Map());

  const contractsQuery = useMemoQuery(() => {
    if (!db) return null;
    return query(collection(db, 'contracts'), where('status', '==', 'active'));
  }, [db]);

  const manualEntriesQuery = useMemoQuery(() => {
    if (!db) return null;
    return collection(db, 'manual_schedules');
  }, [db]);

  const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsQuery);
  const { data: manualEntries, isLoading: isLoadingManual } = useCollection<ManualSchedule>(manualEntriesQuery);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!contracts && !manualEntries) return;

    const weekInterval = { start: startOfDay(weekStart), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    const newWeeklyAssignments = new Map<string, LocalAssignment[]>();

    // 1. Procesar Asignaciones de Contratos
    contracts?.forEach(contract => {
        const details = contract.autoMotoDetails || contract.deluxeDetails;

        const addAssignment = (date: any, timeSlot: TimeSlot | null, type: 'Práctica' | 'Teórica', index: number, vehicleLabel?: string, instructorLabel?: string) => {
            if (!date) return;
            const classDate = toDate(date);
            if (isNaN(classDate.getTime()) || !isWithinInterval(classDate, weekInterval)) return;

            const dateKey = format(classDate, 'yyyy-MM-dd');
            const slot = timeSlot || '8am-10am';

            const assignment: LocalAssignment = {
                studentName: contract.clientName,
                instructor: instructorLabel || 'Sin Instructor',
                vehicle: vehicleLabel || 'Sin Vehículo',
                timeSlot: slot,
                classNumber: index + 1,
                classType: type,
            };

            const dayAssignments = newWeeklyAssignments.get(dateKey) || [];
            dayAssignments.push(assignment);
            newWeeklyAssignments.set(dateKey, dayAssignments);
        };

        const autoSchedules = contract.autoMotoDetails?.practicalClassSchedules || [];
        const motoSchedules = contract.autoMotoDetails?.motoPracticalClassSchedules || [];
        const deluxeSchedules = contract.deluxeDetails?.classSchedules || [];

        autoSchedules.forEach((s, i) => addAssignment(s.date, timeStringToTimeSlot(s.time || ''), 'Práctica', i, s.vehicle, s.instructor));
        motoSchedules.forEach((s, i) => addAssignment(s.date, timeStringToTimeSlot(s.time || ''), 'Práctica', i, s.vehicle, s.instructor));
        deluxeSchedules.forEach((s, i) => addAssignment(s.date, timeStringToTimeSlot(s.time || ''), 'Práctica', i, s.vehicle, s.instructor));

        const theoreticalDates = contract.autoMotoDetails?.theoreticalClassDates || contract.deluxeDetails?.theoreticalClasses || [];
        theoreticalDates.forEach((d, i) => addAssignment(d, '8am-10am', 'Teórica', i, 'Teórica', 'Sede Central'));
    });

    // 2. Procesar Asignaciones Manuales
    manualEntries?.forEach(entry => {
        const classDate = toDate(entry.date);
        if (isNaN(classDate.getTime()) || !isWithinInterval(classDate, weekInterval)) return;

        const dateKey = format(classDate, 'yyyy-MM-dd');
        const assignment: LocalAssignment = {
            studentName: entry.studentName,
            instructor: entry.instructor,
            vehicle: entry.vehicle,
            timeSlot: entry.timeSlot,
            classNumber: entry.classNumber || 1,
            classType: entry.classType || 'Práctica',
        };

        const dayAssignments = newWeeklyAssignments.get(dateKey) || [];
        dayAssignments.push(assignment);
        newWeeklyAssignments.set(dateKey, dayAssignments);
    });

    setWeeklyAssignments(newWeeklyAssignments);

  }, [contracts, manualEntries, currentDate, weekStart]);

  const handlePrevWeek = () => setCurrentDate(subDays(currentDate, 7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const handleToday = () => setCurrentDate(new Date());

  const renderContent = () => {
    if (isLoadingContracts || isLoadingManual) {
      return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground font-medium animate-pulse">Sincronizando agenda...</p>
        </div>
      );
    }

    return (
       <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0 overflow-x-auto">
                <Table className="border-collapse min-w-[1000px] table-fixed w-full">
                    <TableHeader>
                        <TableRow className="bg-muted/50 border-b-2">
                            <TableHead className="w-[120px] border p-2 text-center text-[10px] uppercase font-bold">Turno</TableHead>
                            {days.map(day => (
                            <TableHead key={day.toISOString()} className={cn("text-center border p-2", format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && "bg-primary/5")}>
                                <div className="font-bold text-xs uppercase opacity-70">{format(day, 'eee', { locale: es })}</div>
                                <div className="text-xl font-black">{format(day, 'd')}</div>
                            </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {TIME_SLOTS.map(timeSlot => (
                        <TableRow key={timeSlot.id} className="h-44 group">
                        <TableCell className="font-bold border bg-muted/10 text-center text-[10px] p-2 transition-colors group-hover:bg-muted/20">
                            {timeSlot.label}
                        </TableCell>
                        {days.map(day => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const assignments = weeklyAssignments.get(dayKey)?.filter(a => a.timeSlot === timeSlot.id) || [];
                            
                            return (
                            <TableCell key={day.toISOString()} className={cn("border p-1.5 align-top transition-colors", format(new Date(), 'yyyy-MM-dd') === dayKey && "bg-primary/[0.02]")}>
                                <div className="flex flex-col gap-1.5 h-full">
                                    {assignments.map((assignment, index) => (
                                    <div key={index} className={cn(
                                        "p-2 rounded border text-[10px] shadow-sm leading-tight relative overflow-hidden transition-all hover:scale-[1.02]",
                                        vehicleColors[assignment.vehicle] || 'bg-gray-100 border-gray-300'
                                    )}>
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-black truncate uppercase flex-1 pr-1">{assignment.studentName}</p>
                                            {assignment.classType === 'Teórica' ? <GraduationCap className="h-3 w-3 shrink-0" /> : <BookOpen className="h-3 w-3 shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-75 mb-1">
                                            <User className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate">{assignment.instructor}</span>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-current/10 flex justify-between font-bold">
                                            <span className="truncate">{assignment.vehicle}</span>
                                            <span className="bg-white/40 px-1 rounded">#{assignment.classNumber}</span>
                                        </div>
                                    </div>
                                    ))}
                                    {assignments.length === 0 && (
                                        <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-5 transition-opacity">
                                            <div className="w-full h-full border-2 border-dashed border-primary rounded-lg"></div>
                                        </div>
                                    )}
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
    );
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="font-headline text-3xl font-bold">Agenda Semanal</h1>
            <p className="text-muted-foreground">Gestión de turnos teóricos y prácticos de la escuela.</p>
        </div>
        <div className="flex items-center gap-2 bg-background border p-1 rounded-md shadow-sm">
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs h-8">Hoy</Button>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-bold text-[10px] uppercase w-44 text-center">
                {format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}
            </span>
             <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
