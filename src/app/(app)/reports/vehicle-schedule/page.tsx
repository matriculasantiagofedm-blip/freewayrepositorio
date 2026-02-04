
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { VehicleSchedule, VehicleName, TimeSlot, VehicleAssignment } from '@/lib/types';
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
import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
    { id: '8am-10am', label: '8:00am - 10:00am' },
    { id: '10am-12pm', label: '10:00am - 12:00pm' },
    { id: '1pm-3pm', label: '1:00pm - 3:00pm' },
    { id: '3pm-5pm', label: '3:00pm - 5:00pm' },
];

const vehicleColors: Record<VehicleName, string> = {
    'Picanto Blanco': 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    'Picanto Bronce': 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    'Spark': 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500',
    'Moto Roja': 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    'Moto Negra': 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700',
};


export default function VehicleScheduleReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Map<string, VehicleSchedule>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!db || !user) {
      setIsLoading(false);
      return;
    }

    const fetchWeekSchedules = async () => {
      setIsLoading(true);
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      
      const q = query(
        collection(db, 'vehicle_schedules'),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end))
      );
      try {
        const querySnapshot = await getDocs(q);
        const weekSchedules = new Map<string, VehicleSchedule>();
        querySnapshot.forEach(doc => {
            weekSchedules.set(doc.id, { id: doc.id, ...doc.data() } as VehicleSchedule);
        });
        setSchedules(weekSchedules);
      } catch (error) {
        console.error("Error fetching week schedules:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeekSchedules();
  }, [db, user, currentDate]);

  const handlePrevWeek = () => {
    setCurrentDate(subDays(currentDate, 7));
  };

  const handleNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };
  
  const renderContent = () => {
    if (isLoading) {
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
                            const daySchedule = schedules.get(dayKey);
                            const assignments = daySchedule?.assignments.filter(a => a.timeSlot === timeSlot.id) || [];
                            
                            return (
                            <TableCell key={day.toISOString()} className="border p-1 align-top">
                                {assignments.length > 0 ? (
                                <div className="grid grid-cols-1 gap-1">
                                    {assignments.map((assignment: Partial<VehicleAssignment>) => (
                                    <div key={`${assignment.vehicle}-${assignment.studentName}`} className={cn("p-1.5 rounded border text-xs shadow-sm", vehicleColors[assignment.vehicle!] || 'bg-gray-100 border-gray-300')}>
                                        <p className="font-bold truncate">{assignment.studentName || 'Sin estudiante'}</p>
                                        <p className="truncate text-muted-foreground">{assignment.instructor || 'Sin instructor'}</p>
                                        <p className="opacity-80 truncate">{assignment.vehicle}</p>
                                        {assignment.classNumber && assignment.classType ? (
                                            <p className="font-semibold text-primary truncate pt-1 mt-1 border-t border-black/10">Clase #{assignment.classNumber} ({assignment.classType})</p>
                                        ) : assignment.studentName ? (
                                            <p className="text-xs text-muted-foreground truncate pt-1 mt-1 border-t border-black/10">(Clase manual)</p>
                                        ): null}
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
