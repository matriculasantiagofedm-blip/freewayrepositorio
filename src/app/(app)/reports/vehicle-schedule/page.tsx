
'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { VehicleSchedule, VehicleName, TimeSlot } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const VEHICLES: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'];
const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
    { id: '8am-10am', label: '8:00am - 10:00am' },
    { id: '10am-12pm', label: '10:00am - 12:00pm' },
    { id: '1pm-3pm', label: '1:00pm - 3:00pm' },
    { id: '3pm-5pm', label: '3:00pm - 5:00pm' },
];

export default function VehicleScheduleReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<VehicleSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !user || !reportDate) {
        setIsLoading(false);
        return;
    };

    const fetchSchedule = async () => {
        setIsLoading(true);
        const dateId = format(startOfDay(reportDate), 'yyyy-MM-dd');
        const scheduleRef = doc(db, 'vehicle_schedules', dateId);
        try {
            const docSnap = await getDoc(scheduleRef);
            if (docSnap.exists()) {
                setSchedule({ id: docSnap.id, ...docSnap.data() } as VehicleSchedule);
            } else {
                setSchedule(null);
            }
        } catch (error) {
            console.error("Error fetching schedule for report:", error);
            setSchedule(null);
        } finally {
            setIsLoading(false);
        }
    };

    fetchSchedule();
  }, [db, user, reportDate]);
  
  const scheduleMatrix = useMemo(() => {
    const matrix = new Map<string, { instructor: string; studentName: string }>();
    if (schedule) {
      schedule.assignments.forEach(assignment => {
        const key = `${assignment.vehicle}-${assignment.timeSlot}`;
        matrix.set(key, { instructor: assignment.instructor, studentName: assignment.studentName });
      });
    }
    return matrix;
  }, [schedule]);


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Cargando reporte...</p>
        </div>
      );
    }
    
    if (!schedule) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                    No se encontró horario
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    No hay un horario guardado para la fecha seleccionada.
                </p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Horario del {format(reportDate, 'PPP', { locale: es })}</CardTitle>
                <CardDescription>Resumen de las asignaciones de vehículos e instructores para el día.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px] min-w-[150px]">Turno</TableHead>
                            {VEHICLES.map(vehicle => (
                                <TableHead key={vehicle} className="min-w-[200px]">{vehicle}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {TIME_SLOTS.map(({ id: timeSlot, label }) => (
                            <TableRow key={timeSlot}>
                                <TableCell className="font-semibold">{label}</TableCell>
                                {VEHICLES.map(vehicle => {
                                    const key = `${vehicle}-${timeSlot}`;
                                    const assignment = scheduleMatrix.get(key);
                                    return (
                                        <TableCell key={vehicle}>
                                            {assignment ? (
                                                <div>
                                                    <p className="font-semibold">{assignment.studentName || <span className="text-muted-foreground">Sin Estudiante</span>}</p>
                                                    <p className="text-xs text-muted-foreground">{assignment.instructor || 'Sin Instructor'}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Libre</span>
                                            )}
                                        </TableCell>
                                    )
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
        <h1 className="font-headline text-3xl font-bold">Reporte de Horarios</h1>
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !reportDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={(date) => setReportDate(date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
