
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { Contract, VehicleName, TimeSlot } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
    { id: '8am-10am', label: '8:00am - 10:00am' },
    { id: '10am-12pm', label: '10:00am - 12:00pm' },
    { id: '1pm-3pm', label: '1:00pm - 3:00pm' },
    { id: '3pm-5pm', label: '3:00pm - 5:00pm' },
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
    'Picanto Blanco': 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    'Picanto Bronce': 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    'Spark': 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500',
    'Moto Roja': 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    'Moto Negra': 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700',
    'Motocicleta': 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
};

const vehicleNameMapping: { [key: string]: VehicleName } = {
    'P. Blanco': 'Picanto Blanco',
    'P. Bronce': 'Picanto Bronce',
    'Spark': 'Spark',
    'Motocicleta': 'Moto Roja' // Default Moto
};

interface LocalAssignment {
    studentName: string;
    instructor: string;
    vehicle: VehicleName;
    timeSlot: TimeSlot;
    classNumber: number;
    classType: 'Auto' | 'Moto';
}

function toDate(date: any): Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (date && typeof date.toDate === 'function') return date.toDate();
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const timezoneOffset = parsed.getTimezoneOffset() * 60000;
      return new Date(parsed.getTime() + timezoneOffset);
    }
  }
  return new Date(0);
}


export default function VehicleScheduleReportPage() {
  const db = useDb();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, LocalAssignment[]>>(new Map());

  const contractsQuery = useMemoQuery(() => {
    if (!db) return null;
    return query(collection(db, 'contracts'), where('status', '==', 'active'));
  }, [db]);

  const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsQuery);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!contracts) return;

    const weekInterval = { start: startOfDay(weekStart), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    const newWeeklyAssignments = new Map<string, LocalAssignment[]>();

    contracts.forEach(contract => {
        const details = contract.autoMotoDetails;
        if (!details) return;

        const processSchedules = (schedules: any[], classType: 'Auto' | 'Moto') => {
            schedules.forEach((schedule, index) => {
                const classDate = toDate(schedule.date);
                if (classDate.getFullYear() > 1970 && isWithinInterval(classDate, weekInterval)) {
                    const dateKey = format(classDate, 'yyyy-MM-dd');
                    const timeSlot = timeStringToTimeSlot(schedule.time);
                    const vehicle = details.vehicle ? vehicleNameMapping[details.vehicle] || 'Spark' : 'Spark';

                    if (timeSlot) {
                        const assignment: LocalAssignment = {
                            studentName: contract.clientName,
                            instructor: details.instructor || 'N/A',
                            vehicle: vehicle,
                            timeSlot: timeSlot,
                            classNumber: index + 1,
                            classType: classType,
                        };
                        const dayAssignments = newWeeklyAssignments.get(dateKey) || [];
                        dayAssignments.push(assignment);
                        newWeeklyAssignments.set(dateKey, dayAssignments);
                    }
                }
            });
        };

        processSchedules(details.practicalClassSchedules || [], 'Auto');
        processSchedules(details.motoPracticalClassSchedules || [], 'Moto');
    });

    setWeeklyAssignments(newWeeklyAssignments);

  }, [contracts, currentDate, weekStart]);

  const handlePrevWeek = () => {
    setCurrentDate(subDays(currentDate, 7));
  };

  const handleNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };
  
  const renderContent = () => {
    if (isLoadingContracts) {
      return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando horario de la semana...</p>
        </div>
      );
    }

    return (
       <Card>
            <CardContent className="p-0 overflow-x-auto">
                <Table className="border-collapse min-w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[140px] border p-2 text-sm">Turno</TableHead>
                            {days.map(day => (
                            <TableHead key={day.toISOString()} className="text-center border p-2">
                                <div className="font-bold capitalize">{format(day, 'eee', { locale: es })}</div>
                                <div className="text-muted-foreground">{format(day, 'd')}</div>
                            </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {TIME_SLOTS.map(timeSlot => (
                        <TableRow key={timeSlot.id}>
                        <TableCell className="font-semibold border align-top p-2 text-xs h-48">{timeSlot.label}</TableCell>
                        {days.map(day => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const dayAssignments = weeklyAssignments.get(dayKey) || [];
                            const assignmentsInSlot = dayAssignments.filter(a => a.timeSlot === timeSlot.id);
                            
                            return (
                            <TableCell key={day.toISOString()} className="border p-1 align-top">
                                {assignmentsInSlot.length > 0 ? (
                                <div className="grid grid-cols-1 gap-1">
                                    {assignmentsInSlot.map((assignment, index) => (
                                    <div key={index} className={cn("p-1.5 rounded border text-xs shadow-sm", vehicleColors[assignment.vehicle] || 'bg-gray-100 border-gray-300')}>
                                        <p className="font-bold truncate">{assignment.studentName}</p>
                                        <p className="truncate text-muted-foreground">{assignment.instructor}</p>
                                        <p className="opacity-80 truncate">{assignment.vehicle}</p>
                                        <p className="font-semibold text-primary truncate pt-1 mt-1 border-t border-black/10">Clase #{assignment.classNumber} ({assignment.classType})</p>
                                    </div>
                                    ))}
                                </div>
                                ) : <div className="h-full w-full"></div>}
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">Reporte Semanal de Horarios</h1>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeek} aria-label="Semana anterior">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm w-64 text-center">
                {format(weekStart, "d 'de' LLLL", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' LLLL 'de' yyyy", { locale: es })}
            </span>
             <Button variant="outline" size="icon" onClick={handleNextWeek} aria-label="Siguiente semana">
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
