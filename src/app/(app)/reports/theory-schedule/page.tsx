'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { Contract, ManualSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, GraduationCap, BookOpen, Landmark, Ban } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';

interface TheoryAssignment {
    studentName: string;
    courseType: string;
    schedule: string;
    classNumber: number;
}

export default function TheoryScheduleReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, TheoryAssignment[]>>(new Map());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentDate(new Date());
  }, []);

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', '==', 'active'));
  }, [db, user]);

  const manualEntriesQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return collection(db, 'manual_schedules');
  }, [db, user]);

  const { data: contracts } = useCollection<Contract>(contractsQuery);
  const { data: manualEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

  const weekStart = useMemo(() => currentDate ? startOfWeek(currentDate, { weekStartsOn: 1 }) : null, [currentDate]);
  const days = useMemo(() => weekStart ? Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)) : [], [weekStart]);

  useEffect(() => {
    if (!contracts && !manualEntries || !weekStart || !currentDate) return;
    const weekInterval = { start: startOfDay(weekStart), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    const newWeeklyAssignments = new Map<string, TheoryAssignment[]>();

    const addTheory = (contract: any, date: any, index: number, isManual = false) => {
        if (!date) return;
        const classDate = toDate(date);
        if (isNaN(classDate.getTime()) || !isWithinInterval(classDate, weekInterval)) return;
        const dateKey = format(classDate, 'yyyy-MM-dd');
        const dayAssignments = newWeeklyAssignments.get(dateKey) || [];
        dayAssignments.push({
            studentName: contract.clientName || contract.studentName,
            courseType: isManual ? 'Trámite Manual' : contract.type,
            schedule: contract.autoMotoDetails?.theoreticalClassSchedule || contract.timeSlot || 'Teoría',
            classNumber: index + 1,
        });
        newWeeklyAssignments.set(dateKey, dayAssignments);
    };

    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
        if (d) {
            const dates = (d as any).theoreticalClassDates || (d as any).theoreticalClasses || [];
            dates.forEach((dt: any, i: number) => addTheory(c, dt, i));
            if ((d as any).theoreticalClassDate) addTheory(c, (d as any).theoreticalClassDate, 0);
        }
    });
    manualEntries?.forEach(e => { if (e.classType === 'Teórica') addTheory(e, e.date, 0, true); });
    setWeeklyAssignments(newWeeklyAssignments);
  }, [contracts, manualEntries, weekStart, currentDate]);

  if (!mounted || !currentDate || !weekStart) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">Agenda Teórica Semanal</h1>
        <div className="flex items-center gap-2 bg-background border p-1 rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-bold text-[10px] uppercase w-44 text-center">{format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {days.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const assignments = weeklyAssignments.get(dateKey) || [];
                const holiday = isPanamaHoliday(day);
                const isSunday = day.getDay() === 0;

                return (
                    <Card key={dateKey} className={cn("overflow-hidden border-2", isSunday ? "bg-red-50/30 border-red-100" : holiday ? "bg-amber-50/30 border-amber-100" : "border-slate-100")}>
                        <div className={cn("p-3 flex justify-between items-start", isSunday ? "bg-red-100 text-red-900" : holiday ? "bg-amber-100 text-amber-900" : "bg-slate-50")}>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-60">{format(day, 'EEEE', { locale: es })}</p>
                                <p className="text-lg font-black">{format(day, 'd \'de\' MMMM', { locale: es })}</p>
                            </div>
                        </div>
                        <CardContent className="p-0">
                            {assignments.length > 0 ? (
                                <div className="divide-y">
                                    {assignments.map((a, i) => (
                                        <div key={i} className="p-3">
                                            <p className="font-bold text-sm uppercase leading-tight">{a.studentName}</p>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{a.schedule}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-[10px] font-bold text-slate-400 uppercase">Sin Actividad</div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
       </div>
    </div>
  );
}
