'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
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
import { Loader2, ChevronLeft, ChevronRight, User, AlertCircle, Fuel, MessageSquare, Timer, ShieldCheck, Landmark, Ban, RefreshCw, XCircle } from 'lucide-react';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weeklyAssignments, setWeeklyAssignments] = useState<Map<string, any[]>>(new Map());
  const [isUpdating, setIsUpdating] = useState(false);

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

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!contracts && !manualEntries) return;
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
        isEval = false, 
        type: 'contract' | 'manual' = 'contract', 
        displayClassNumber: number | string, 
        slotIndex?: number, 
        subType?: 'auto' | 'moto'
    ) => {
        if (!date || !vehicle) return;
        const d = toDate(date);
        if (isNaN(d.getTime())) return;
        const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString as TimeSlot;
        
        allSessionsFlat.push({ 
            id, 
            name, 
            date: d, 
            slot: slotId, 
            vehicle, 
            instructor, 
            status, 
            isEval, 
            type, 
            displayClassNumber, 
            slotIndex, 
            subType 
        });
    };

    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        const isEval = (d?.coursePlan === 'evaluacion-estacionamiento' || d?.coursePlan === 'moto-evaluacion-estacionamiento');
        const proc = (arr: any[], subType: 'auto' | 'moto' = 'auto') => {
            arr?.forEach((s, i) => {
                processAny(c.id, c.clientName, s.date, s.time, s.vehicle, s.instructor, s.status || 'scheduled', isEval, 'contract', i + 1, i, subType);
            });
        };
        if (c.type === 'Curso Moto') proc(c.autoMotoDetails?.motoPracticalClassSchedules || c.autoMotoDetails?.practicalClassSchedules || [], 'moto');
        else if (c.type === 'Curso Deluxe') proc(c.deluxeDetails?.classSchedules || [], 'auto');
        else if (c.type === 'Curso Mixto') {
            proc(c.autoMotoDetails?.practicalClassSchedules || [], 'auto');
            proc(c.autoMotoDetails?.motoPracticalClassSchedules || [], 'moto');
        } else proc(c.autoMotoDetails?.practicalClassSchedules || [], 'auto');
    });

    manualEntries?.forEach(e => {
        if (e.classType === 'Práctica') {
            processAny(e.id, e.studentName, e.date, e.timeSlot, e.vehicle, e.instructor, e.status || 'scheduled', false, 'manual', e.classNumber);
        }
    });

    allSessionsFlat.sort((a, b) => {
        if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime();
        return (SLOT_ORDER[a.slot] || 0) - (SLOT_ORDER[b.slot] || 0);
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

  const handleUpdateStatus = (item: any, newStatus: ClassStatus) => {
    if (!db || isUpdating) return;
    
    setIsUpdating(true);
    const updateData: any = {};

    if (item.type === 'contract') {
        const contractRef = doc(db, 'contracts', item.id);
        const contract = contracts?.find(c => c.id === item.id);
        if (!contract) {
            setIsUpdating(false);
            return;
        }

        let schedules: any[] = [];
        let fieldPath = '';

        if (item.subType === 'moto') {
            schedules = [...(contract.autoMotoDetails?.motoPracticalClassSchedules || [])];
            fieldPath = 'autoMotoDetails.motoPracticalClassSchedules';
        } else if (contract.type === 'Curso Deluxe') {
            schedules = [...(contract.deluxeDetails?.classSchedules || [])];
            fieldPath = 'deluxeDetails.classSchedules';
        } else {
            schedules = [...(contract.autoMotoDetails?.practicalClassSchedules || [])];
            fieldPath = 'autoMotoDetails.practicalClassSchedules';
        }

        if (schedules[item.slotIndex]) {
            schedules[item.slotIndex].status = newStatus;
            updateData[fieldPath] = schedules;
            
            updateDoc(contractRef, updateData)
                .then(() => toast({ title: 'Estado actualizado' }))
                .catch(async (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: contractRef.path,
                        operation: 'update',
                        requestResourceData: updateData
                    }));
                })
                .finally(() => setIsUpdating(false));
        } else {
            setIsUpdating(false);
        }
    } else {
        const manualRef = doc(db, 'manual_schedules', item.id);
        updateDoc(manualRef, { status: newStatus })
            .then(() => toast({ title: 'Estado actualizado' }))
            .catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: manualRef.path,
                    operation: 'update',
                    requestResourceData: { status: newStatus }
                }));
            })
            .finally(() => setIsUpdating(false));
    }
  };

  const handleNotifyWhatsApp = (item: any) => {
    const text = `Hola ${item.name}, te informamos que tu clase práctica a las ${item.slot} ha sido marcada como NO ASISTIÓ. Según el contrato, requiere un pago de recargo de B/. 20.00 para reprogramarla.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="font-headline text-3xl font-bold">Agenda Práctica Semanal</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Control de Flota y Sesiones de Estudiantes</p>
        </div>
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
                        const assignments = weeklyAssignments.get(dateKey)?.filter(a => a.slot === slot.id) || [];
                        const cap = getGlobalCapacity(day, slot.id);
                        const count = new Set(assignments.map(a => a.vehicle)).size;

                        return (
                        <TableCell key={day.toISOString()} className={cn("border p-1.5 align-top relative", day.getDay() === 0 && "bg-red-50/20")}>
                            {cap > 0 && (
                                <div className="absolute top-1 right-1 z-10">
                                    <div className={cn("px-1 py-0.5 rounded text-[9px] font-black border bg-white", count >= cap ? "text-red-600 border-red-200" : "text-slate-500")}>
                                        <ShieldCheck className="h-2.5 w-2.5 inline mr-1" /> {count}/{cap}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5 h-full pt-5">
                                {assignments.map((a, i) => (
                                    <Popover key={`${a.id}-${i}`}>
                                        <PopoverTrigger asChild>
                                            <div className={cn(
                                                "p-2 rounded border text-[10px] shadow-sm cursor-pointer hover:shadow-md transition-all relative", 
                                                a.status === 'missed' ? "bg-red-600 border-red-700 text-white" : 
                                                a.status === 'rescheduled_vehicle' ? cn(vehicleColors[a.vehicle] || 'bg-amber-600 border-amber-700', "border-2") :
                                                a.isEval ? "bg-purple-50 border-purple-200" : (vehicleColors[a.vehicle] || 'bg-gray-100 border-gray-200')
                                            )}>
                                                {/* INDICADOR NO ASISTIÓ (DERECHA) */}
                                                {a.status === 'missed' && (
                                                    <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm bg-white">
                                                        <AlertCircle className="h-2.5 w-2.5 text-red-600" />
                                                    </div>
                                                )}

                                                {/* INDICADOR CANCELADA POR VEHÍCULO (IZQUIERDA) */}
                                                {a.status === 'rescheduled_vehicle' && (
                                                    <div className={cn("absolute -top-1 -left-1 h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm", vehicleStatusColors[a.vehicle])}>
                                                        <XCircle className="h-2.5 w-2.5 text-white" />
                                                    </div>
                                                )}

                                                {a.status === 'refueled' && <Fuel className="absolute -top-2 -right-2 h-5 w-5 text-white fill-sky-600 drop-shadow-sm z-20" />}

                                                <p className="truncate font-black uppercase mb-0.5">{a.name}</p>
                                                <p className={cn("truncate text-[8px] font-bold uppercase mb-1 flex items-center gap-1", a.status === 'missed' ? 'text-inherit opacity-80' : 'text-muted-foreground')}>
                                                    <User className="h-2.5 w-2.5" /> {a.instructor || 'SIN ASIGNAR'}
                                                </p>
                                                
                                                <div className={cn("flex justify-between font-bold text-[9px] border-t pt-1 mt-1", a.status === 'missed' ? 'border-current opacity-40' : 'border-black/10 opacity-80')}>
                                                    <span className="flex items-center gap-1 text-[8px]">
                                                        {a.vehicle}
                                                    </span>
                                                </div>

                                                <div className="absolute bottom-1 right-1 bg-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                                    #{a.displayClassNumber}
                                                </div>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-3">
                                            <div className="space-y-3">
                                                <p className="text-xs font-bold uppercase text-slate-500">Gestión de Clase</p>
                                                <div className="grid gap-2">
                                                    <Button variant="outline" size="sm" className="h-8 justify-start text-[10px] font-bold uppercase gap-2 text-sky-700 hover:bg-sky-50" onClick={() => handleUpdateStatus(a, 'refueled')}>
                                                        <Fuel className="h-3.5 w-3.5" /> Marcó Gasolina
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="h-8 justify-start text-[10px] font-bold uppercase gap-2 text-amber-600 hover:bg-amber-50" onClick={() => handleUpdateStatus(a, 'rescheduled_vehicle')}>
                                                        <XCircle className="h-3.5 w-3.5" /> Cancelada por Vehículo
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="h-8 justify-start text-[10px] font-bold uppercase gap-2 text-red-600 hover:bg-red-50" onClick={() => handleUpdateStatus(a, 'missed')}>
                                                        <AlertCircle className="h-3.5 w-3.5" /> No Asistió
                                                    </Button>
                                                    {role === 'Administrador' && (
                                                        <Button variant="outline" size="sm" className="h-8 justify-start text-[10px] font-bold uppercase gap-2" onClick={() => handleUpdateStatus(a, 'scheduled')}>
                                                            <Timer className="h-3.5 w-3.5 text-blue-600" /> Restablecer Programada
                                                        </Button>
                                                    )}
                                                    {a.status === 'missed' && (
                                                        <Button variant="secondary" size="sm" className="h-8 w-full text-[10px] font-black uppercase gap-2 bg-green-600 text-white hover:bg-green-700" onClick={() => handleNotifyWhatsApp(a)}>
                                                            <MessageSquare className="h-3.5 w-3.5" /> Notificar WhatsApp
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
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
