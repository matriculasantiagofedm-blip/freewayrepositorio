'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import type { Contract, ManualSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon, Printer, Download, ClipboardCheck } from 'lucide-react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface AttendanceRow {
    name: string;
    idNumber: string;
    plan: string;
    schedule: string;
}

export default function TheoryAttendanceReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReportDate(new Date());
  }, []);

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

  const attendanceList = useMemo(() => {
    if (!contracts && !manualEntries || !reportDate) return [];
    
    const results: AttendanceRow[] = [];
    const targetDate = startOfDay(reportDate);

    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
        if (!d) return;
        const checkAndAdd = (date: any) => {
            if (!date) return;
            const classDate = toDate(date);
            if (isSameDay(classDate, targetDate)) {
                results.push({
                    name: c.clientName,
                    idNumber: d.studentIdNumber || c.studentIdNumber || '---',
                    plan: c.type,
                    schedule: (d as any).theoreticalClassSchedule || (d as any).theoreticalClassTime || 'Teoría',
                });
            }
        };
        const theoryDates = (d as any).theoreticalClassDates || (d as any).theoreticalClasses || [];
        if (Array.isArray(theoryDates)) theoryDates.forEach(dt => checkAndAdd(dt));
        if ((d as any).theoreticalClassDate) checkAndAdd((d as any).theoreticalClassDate);
    });

    manualEntries?.forEach(e => {
        if (e.classType === 'Teórica' && isSameDay(toDate(e.date), targetDate)) {
            results.push({ name: e.studentName, idNumber: 'MANUAL', plan: e.coursePlan || 'Manual', schedule: e.timeSlot || 'Teoría' });
        }
    });

    return results.sort((a, b) => a.schedule.localeCompare(b.schedule) || a.name.localeCompare(b.name));
  }, [contracts, manualEntries, reportDate]);

  if (!mounted || !reportDate) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <h1 className="font-headline text-3xl font-bold">Asistencia Teórica</h1>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[240px] h-11 text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(reportDate, "PPP", { locale: es })}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={reportDate} onSelect={(d) => d && setReportDate(d)} initialFocus />
                </PopoverContent>
            </Popover>
            <Button onClick={() => window.print()} variant="outline" className="h-11"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
      </div>

      <div id="attendance-print-content" className="bg-white">
        <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase">FREEWAY ESCUELA DE MANEJO S.A.</h1>
            <h2 className="text-lg font-bold uppercase">LISTA DE ASISTENCIA - TEORÍA</h2>
            <p className="text-sm font-bold uppercase mt-2">FECHA: {format(reportDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}</p>
        </div>

        {isLoadingContracts || isLoadingManual ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : (
            <Table className="border-collapse border border-black">
                <TableHeader className="bg-slate-50 print:bg-slate-100">
                    <TableRow className="border-black">
                        <TableHead className="text-center font-bold text-black border-black">N°</TableHead>
                        <TableHead className="font-bold text-black border-black">Estudiante</TableHead>
                        <TableHead className="font-bold text-black border-black">ID</TableHead>
                        <TableHead className="font-bold text-black border-black text-center">Firma</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {attendanceList.map((row, idx) => (
                        <TableRow key={idx} className="h-12 border-black">
                            <TableCell className="text-center border-black">{idx + 1}</TableCell>
                            <TableCell className="font-bold uppercase border-black">{row.name}</TableCell>
                            <TableCell className="border-black">{row.idNumber}</TableCell>
                            <TableCell className="border-black"></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
      </div>
    </div>
  );
}
