'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import type { Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, ClipboardList, Car } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCurrentRole } from '@/hooks/use-current-role';

interface WeeklyStart {
    contract: Contract;
    startDate: Date;
    planName: string;
    logType: string;
    instructor: string;
}

export default function WeeklyStartsReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentDate(new Date());
  }, []);

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']));
  }, [db, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const weekStart = useMemo(() => currentDate ? startOfWeek(currentDate, { weekStartsOn: 1 }) : null, [currentDate]);
  const weekEnd = useMemo(() => currentDate ? endOfWeek(currentDate, { weekStartsOn: 1 }) : null, [currentDate]);

  const startingStudents = useMemo(() => {
    if (!contracts || !weekStart || !weekEnd) return [];
    
    const results: WeeklyStart[] = [];
    const weekInterval = { start: startOfDay(weekStart), end: weekEnd };

    contracts.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        if (!d) return;
        const allPracticalDates = [
            ...(d.practicalClassSchedules || []),
            ...(d.motoPracticalClassSchedules || []),
            ...(c.deluxeDetails?.classSchedules || [])
        ].map(s => toDate(s.date)).filter(dt => !isNaN(dt.getTime()));

        if (allPracticalDates.length === 0) return;
        const startDate = new Date(Math.min(...allPracticalDates.map(d => d.getTime())));

        if (isWithinInterval(startDate, weekInterval)) {
            results.push({
                contract: c,
                startDate,
                planName: (d as any).coursePlan || c.type,
                logType: 'auto',
                instructor: 'POR ASIGNAR'
            });
        }
    });

    return results.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [contracts, weekStart, weekEnd]);

  if (!mounted || !currentDate || !weekStart) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">Inicios de Semana</h1>
        <div className="flex items-center gap-2 bg-background border p-1 rounded-md">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft /></Button>
            <span className="font-bold text-[10px] uppercase w-48 text-center">{format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha Inicio</TableHead>
                            <TableHead>Estudiante</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {startingStudents.map((item) => (
                            <TableRow key={item.contract.id}>
                                <TableCell className="font-bold">{format(item.startDate, "dd/MM")}</TableCell>
                                <TableCell className="font-black uppercase">{item.contract.clientName}</TableCell>
                                <TableCell className="text-xs uppercase">{item.planName}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => window.open(`/print-log/${item.contract.id}`)}><ClipboardList className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
