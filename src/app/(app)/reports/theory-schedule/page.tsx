
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb } from '@/components/firebase-provider';
import type { Contract, ManualSchedule } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, GraduationCap, BookOpen } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Separator } from '@/components/ui/separator';

interface TheoryAssignment {
    studentName: string;
    courseType: string;
    schedule: string;
    classNumber: number;
}

export default function TheoryScheduleReportPage() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, TheoryAssignment[]>>(new Map());

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
    const newWeeklyAssignments = new Map<string, TheoryAssignment[]>();

    // 1. Procesar Fechas Teóricas de Contratos
    contracts?.forEach(contract => {
        const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
        if (!details) return;

        const theoreticalDates = (details as any).theoreticalClassDates || (details as any).theoreticalClasses || [];
        const singleDate = (details as any).theoreticalClassDate;
        
        const scheduleLabel = (details as any).theoreticalClassSchedule || (details as any).theoreticalClassTime || 'Teoría';

        const addTheory = (date: any, index: number) => {
            if (!date) return;
            const classDate = toDate(date);
            if (isNaN(classDate.getTime()) || !isWithinInterval(classDate, weekInterval)) return;

            const dateKey = format(classDate, 'yyyy-MM-dd');
            const assignment: TheoryAssignment = {
                studentName: contract.clientName,
                courseType: contract.type,
                schedule: scheduleLabel,
                classNumber: index + 1,
            };

            const dayAssignments = newWeeklyAssignments.get(dateKey) || [];
            dayAssignments.push(assignment);
            newWeeklyAssignments.set(dateKey, dayAssignments);
        };

        theoreticalDates.forEach((d: any, i: number) => addTheory(d, i));
        if (singleDate) addTheory(singleDate, 0);
    });

    // 2. Procesar Asignaciones Manuales Teóricas
    manualEntries?.forEach(entry => {
        if (entry.classType !== 'Teórica') return;

        const classDate = toDate(entry.date);
        if (isNaN(classDate.getTime()) || !isWithinInterval(classDate, weekInterval)) return;

        const dateKey = format(classDate, 'yyyy-MM-dd');
        const assignment: TheoryAssignment = {
            studentName: entry.studentName,
            courseType: 'Trámite Manual',
            schedule: entry.timeSlot || 'Teoría',
            classNumber: entry.classNumber || 1,
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
            <p className="text-muted-foreground font-medium animate-pulse">Sincronizando agenda teórica...</p>
        </div>
      );
    }

    return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {days.map(day => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const assignments = weeklyAssignments.get(dayKey) || [];
                const isToday = format(new Date(), 'yyyy-MM-dd') === dayKey;

                return (
                    <Card key={dayKey} className={cn("overflow-hidden border-2", isToday ? "border-primary shadow-md" : "border-slate-100")}>
                        <div className={cn("p-3 flex justify-between items-center", isToday ? "bg-primary text-white" : "bg-slate-50 text-slate-900")}>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-80">{format(day, 'EEEE', { locale: es })}</p>
                                <p className="text-lg font-black">{format(day, 'd \'de\' MMMM', { locale: es })}</p>
                            </div>
                            <GraduationCap className={cn("h-6 w-6", isToday ? "text-white/40" : "text-slate-300")} />
                        </div>
                        <CardContent className="p-0">
                            {assignments.length > 0 ? (
                                <div className="divide-y">
                                    {assignments.map((a, i) => (
                                        <div key={i} className="p-3 hover:bg-slate-50 transition-colors">
                                            <p className="font-bold text-sm uppercase leading-tight mb-1">{a.studentName}</p>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">{a.courseType}</span>
                                                <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <BookOpen className="h-2 w-2" /> {a.schedule}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                                        <BookOpen className="h-5 w-5 text-slate-300" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin Clases</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
       </div>
    );
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="font-headline text-3xl font-bold">Agenda Teórica Semanal</h1>
            <p className="text-muted-foreground">Programación de alumnos en aula teórica (Capacitación).</p>
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
