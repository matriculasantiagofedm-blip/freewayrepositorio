'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import type { Contract, TimeSlot, ManualSchedule, ClassStatus, PracticalClassSlot } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, User, AlertCircle, Fuel, MessageSquare, Timer, ShieldCheck, Landmark, Ban, RefreshCw, Minus, Printer, ClipboardList, Download } from 'lucide-react';
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
  const [isDownloading, setIsDownloading] = useState(false);

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
            id, 
            name, 
            date: d, 
            slot: slotId, 
            vehicle, 
            instructor, 
            status, 
            refueled,
            isEval, 
            type, 
            displayClassNumber, 
            slotIndex, 
            subType,
            plan: plan || 'Plan no especificado',
            studentIdNumber: studentIdNumber || ''
        });
    };

    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        const plan = d?.coursePlan || c.type;
        const isEval = (d?.coursePlan === 'evaluacion-estacionamiento' || d?.coursePlan === 'moto-evaluacion-estacionamiento');
        const sid = d?.studentIdNumber || c.studentIdNumber || '';
        
        const isAutoContract = c.type === 'Curso Auto';
        const isMotoContract = c.type === 'Curso Moto';
        const isMixtoContract = c.type === 'Curso Mixto';
        const isDeluxeContract = c.type === 'Curso Deluxe';
        const isSoloPractica = c.type === 'Curso Solo Practica';

        const hasAutoSessionsEnabled = isAutoContract || isMixtoContract || isDeluxeContract || (isMotoContract && d?.additionalService === 'Curso Plus Auto 10Hrs') || (isSoloPractica && (d as any)?.vehicleType === 'Auto');
        const hasMotoSessionsEnabled = isMotoContract || isMixtoContract || (isAutoContract && d?.additionalService === 'Plus Moto 10Hrs') || (isSoloPractica && (d as any)?.vehicleType === 'Motocicleta');

        const proc = (arr: any[], subType: 'auto' | 'moto' = 'auto') => {
            arr?.forEach((s, i) => {
                processAny(c.id, c.clientName, s.date, s.time, s.vehicle, s.instructor, s.status || 'scheduled', !!s.refueled, isEval, 'contract', i + 1, i, subType, plan, sid);
            });
        };

        if (isDeluxeContract) {
            proc(c.deluxeDetails?.classSchedules || [], 'auto');
        } else {
            if (hasAutoSessionsEnabled && c.autoMotoDetails?.practicalClassSchedules && c.autoMotoDetails.practicalClassSchedules.length > 0) {
                proc(c.autoMotoDetails.practicalClassSchedules, 'auto');
            }
            if (hasMotoSessionsEnabled && c.autoMotoDetails?.motoPracticalClassSchedules && c.autoMotoDetails.motoPracticalClassSchedules.length > 0) {
                proc(c.autoMotoDetails.motoPracticalClassSchedules, 'moto');
            }
        }
    });

    manualEntries?.forEach(e => {
        if (e.classType === 'Práctica') {
            processAny(e.id, e.studentName, e.date, e.timeSlot, e.vehicle, e.instructor, e.status || 'scheduled', !!e.refueled, false, 'manual', e.classNumber, undefined, undefined, e.coursePlan, '');
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

  const getRecommendedLogType = (contract: Contract) => {
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
    const plan = (details as any)?.coursePlan || '';
    const planUpper = plan.toUpperCase();
    const typeUpper = contract.type.toUpperCase();
    const transmission = (details as any)?.vehicleTransmission || 'Manual';
    
    if (planUpper.includes('YA SE MANEJAR')) return 'already-know';

    const isMoto = typeUpper.includes('MOTO') || planUpper.includes('MOTO');
    const isAutomatic = transmission === 'Automático';
    const prefix = isMoto ? 'moto-manual-' : (isAutomatic ? 'auto-automatic-' : 'manual-');
    
    if (planUpper.includes('8 HR') || planUpper.includes('BASICO') || planUpper.includes('BÁSICO')) return `${prefix}8h`;
    if (planUpper.includes('10 HR') || planUpper.includes('PLUS')) return `${prefix}10h`;
    if (planUpper.includes('12 HR') || planUpper.includes('PREMIUM')) return `${prefix}12h`;
    
    if (contract.type === 'Curso Moto') return 'moto-manual-8h';
    if (contract.type === 'Curso Auto') return isAutomatic ? 'auto-automatic-10h' : 'manual-8h';
    return `${prefix}12h`;
  };

  const handlePrintLog = (item: any) => {
    const contract = contracts?.find(c => c.id === item.id);
    if (!contract) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo recuperar los datos del contrato.' });
        return;
    }

    const logType = getRecommendedLogType(contract);
    const params = new URLSearchParams({
        name: contract.clientName || '',
        id: item.studentIdNumber || '',
        type: logType,
        instructor: item.instructor || ''
    });
    window.open(`/print-log/${contract.id}?${params.toString()}`, '_blank');
  };

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

        if (schedules[item.slotIndex] !== undefined) {
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

  const handleToggleRefueled = (item: any) => {
    if (!db || isUpdating) return;
    
    setIsUpdating(true);
    const newRefueled = !item.refueled;
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

        if (schedules[item.slotIndex] !== undefined) {
            schedules[item.slotIndex].refueled = newRefueled;
            updateData[fieldPath] = schedules;
            
            updateDoc(contractRef, updateData)
                .then(() => toast({ title: newRefueled ? 'Gasolina marcada' : 'Gasolina desmarcada' }))
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
        updateDoc(manualRef, { refueled: newRefueled })
            .then(() => toast({ title: newRefueled ? 'Gasolina marcada' : 'Gasolina desmarcada' }))
            .catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: manualRef.path,
                    operation: 'update',
                    requestResourceData: { refueled: newRefueled }
                }));
            })
            .finally(() => setIsUpdating(false));
    }
  };

  const handleNotifyWhatsApp = (item: any) => {
    const text = `Hola ${item.name}, te informamos que tu clase práctica a las ${item.slot} ha sido marcada como NO ASISTIÓ. Según el contrato, requiere un pago de recargo de B/. 20.00 para reprogramarla.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('practical-schedule-content');
    if (!element) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: 0,
        filename: `Agenda_Practica_Semanal_${format(weekStart, 'dd-MM-yyyy')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 1120 
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "La agenda se ha descargado correctamente." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: letter landscape; margin: 0; }
          header, footer, nav, aside, .print-hide, button, .popover-trigger { display: none !important; }
          body { background: white !important; padding: 0 !important; overflow: hidden !important; height: auto !important; }
          .print-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 3mm !important; display: block !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 5pt !important; border: 1px solid black !important; table-layout: fixed !important; }
          th, td { border: 1px solid black !important; padding: 0.5px !important; overflow: hidden !important; }
          .h-40 { height: 5.5rem !important; } /* Reducción agresiva para 40% adicional */
          .card-content { padding: 0 !important; }
          .p-1\\.5 { padding: 0.1rem !important; }
          .text-\\[9px\\] { font-size: 6.5px !important; }
          .text-\\[7px\\] { font-size: 5.5px !important; }
          .text-\\[8px\\] { font-size: 6px !important; }
          .rounded { border-radius: 2px !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />

      <div className="flex justify-between items-center print-hide">
        <div>
            <h1 className="font-headline text-3xl font-bold">Agenda Práctica Semanal</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Control de Flota y Sesiones de Estudiantes</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-background border p-1 rounded-md">
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="font-bold text-[10px] uppercase w-44 text-center">{format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}</span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button onClick={handleDownloadPdf} disabled={isDownloading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
            </Button>
        </div>
      </div>

      <Card id="practical-schedule-content" className="border-none shadow-none bg-transparent print-container">
        <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[1000px] border-collapse table-fixed w-full print:min-w-full">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[80px] border text-center text-[10px] font-bold">TURNO</TableHead>
                        {days.map(day => {
                            const holiday = isPanamaHoliday(day);
                            const isSunday = day.getDay() === 0;
                            return (
                            <TableHead key={day.toISOString()} className={cn("text-center border p-1", isSunday && "bg-red-50", holiday && !isSunday && "bg-amber-50")}>
                                <div className="text-[9px] font-bold uppercase">{format(day, 'eee', { locale: es })}</div>
                                <div className="text-lg font-black">{format(day, 'd')}</div>
                                {isSunday && <div className="text-[7px] font-black text-red-600 uppercase mt-0.5">CERRADO</div>}
                                {holiday && !isSunday && <div className="text-[7px] font-black text-amber-700 uppercase mt-0.5">{holiday.name}</div>}
                            </TableHead>
                            )
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody>
                {TIME_SLOTS.map(slot => (
                    <TableRow key={slot.id} className="h-40 group print:h-32">
                    <TableCell className="border bg-muted/10 text-center text-[9px] font-bold">{slot.label}</TableCell>
                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const assignments = weeklyAssignments.get(dateKey)?.filter(a => a.slot === slot.id) || [];
                        const cap = getGlobalCapacity(day, slot.id);
                        const count = new Set(assignments.map(a => a.vehicle)).size;

                        return (
                        <TableCell key={day.toISOString()} className={cn("border p-1 align-top relative", day.getDay() === 0 && "bg-red-50/20")}>
                            {cap > 0 && (
                                <div className="absolute top-0.5 right-1 z-10 print-hide">
                                    <div className={cn("px-1 py-0.5 rounded text-[8px] font-black border bg-white/80", count >= cap ? "text-red-600 border-red-200" : "text-slate-500")}>
                                        {count}/{cap}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col gap-1 h-full pt-4 print:pt-0.5">
                                {assignments.map((a, i) => {
                                    const isFirstClass = String(a.displayClassNumber) === '1';
                                    const cardContent = (
                                        <div className={cn(
                                            "p-1.5 rounded border text-[9px] shadow-sm relative transition-all", 
                                            !isVentas && "cursor-pointer hover:shadow-md",
                                            a.status === 'missed' ? "bg-red-600 border-red-700 text-white" : 
                                            a.isEval ? "bg-purple-50 border-purple-200" : (vehicleColors[a.vehicle] || 'bg-gray-100 border-gray-200')
                                        )}>
                                            {/* INDICADORES ESQUINA SUPERIOR IZQUIERDA */}
                                            <div className="absolute -top-1 -left-1 flex gap-0.5 z-20">
                                                {a.status === 'cancelled_vehicle' && (
                                                    <div className={cn("h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm", vehicleStatusColors[a.vehicle])}>
                                                        <Minus className="h-2 w-2 text-white" />
                                                    </div>
                                                )}
                                                {a.status === 'rescheduled' && (
                                                    <div className={cn("h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm bg-slate-700")}>
                                                        <RefreshCw className="h-2 w-2 text-white" />
                                                    </div>
                                                )}
                                                {isFirstClass && a.type === 'contract' && (
                                                    <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm bg-blue-600 animate-pulse print:hidden" title="¡Primera Clase! Imprimir Bitácora">
                                                        <ClipboardList className="h-2 w-2 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* INDICADORES ESQUINA SUPERIOR DERECHA */}
                                            <div className="absolute -top-1 -right-1 flex gap-0.5 z-20">
                                                {a.refueled && (
                                                    <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm bg-sky-600">
                                                        <Fuel className="h-2 w-2 text-white" />
                                                    </div>
                                                )}
                                                {a.status === 'missed' && (
                                                    <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-sm bg-white">
                                                        <AlertCircle className="h-2.5 w-2.5 text-red-600" />
                                                    </div>
                                                )}
                                            </div>

                                            <p className="truncate font-black uppercase mb-0.5 leading-none">{a.name}</p>
                                            
                                            <p className={cn("text-[7px] font-black uppercase truncate mb-0.5", a.status === 'missed' ? 'text-white/80' : 'text-primary')}>
                                                {a.plan}
                                            </p>

                                            <p className={cn("truncate text-[7px] font-bold uppercase mb-0.5 flex items-center gap-1", a.status === 'missed' ? 'text-inherit opacity-80' : 'text-muted-foreground')}>
                                                <User className="h-2 w-2" /> {a.instructor || 'SIN ASIGNAR'}
                                            </p>
                                            
                                            <div className={cn("flex justify-between font-bold text-[7px] border-t pt-0.5 mt-0.5", a.status === 'missed' ? 'border-current opacity-40' : 'border-black/10 opacity-80')}>
                                                <span className="flex items-center gap-1">
                                                    {a.vehicle}
                                                </span>
                                            </div>

                                            <div className="absolute bottom-0.5 right-0.5 bg-primary text-white text-[8px] font-black px-1 rounded shadow-sm">
                                                #{a.displayClassNumber}
                                            </div>
                                        </div>
                                    );

                                    if (isVentas) return <div key={`${a.id}-${i}`}>{cardContent}</div>;

                                    return (
                                        <Popover key={`${a.id}-${i}`}>
                                            <PopoverTrigger asChild>
                                                {cardContent}
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-3">
                                                <div className="space-y-3">
                                                    <p className="text-xs font-bold uppercase text-slate-500">Gestión de Clase</p>
                                                    <div className="grid gap-2">
                                                        {isFirstClass && a.type === 'contract' && (
                                                            <Button 
                                                                variant="default" 
                                                                size="sm" 
                                                                className="h-10 justify-start text-[10px] font-black uppercase gap-2 bg-blue-600 hover:bg-blue-700 shadow-md"
                                                                onClick={() => handlePrintLog(a)}
                                                            >
                                                                <Printer className="h-4 w-4" /> Imprimir Bitácora Inicial
                                                            </Button>
                                                        )}

                                                        <Button 
                                                            variant={a.refueled ? "default" : "outline"} 
                                                            size="sm" 
                                                            className={cn("h-8 justify-start text-[10px] font-bold uppercase gap-2", a.refueled ? "bg-sky-600 hover:bg-sky-700" : "text-sky-700 hover:bg-sky-50")} 
                                                            onClick={() => handleToggleRefueled(a)}
                                                        >
                                                            <Fuel className="h-3.5 w-3.5" /> Marcó Gasolina
                                                        </Button>
                                                        
                                                        {isAdmin && (
                                                            <>
                                                                <Button 
                                                                    variant={a.status === 'cancelled_vehicle' ? "default" : "outline"} 
                                                                    size="sm" 
                                                                    className={cn("h-8 justify-start text-[10px] font-bold uppercase gap-2", a.status === 'cancelled_vehicle' ? "bg-slate-800" : "text-amber-600 hover:bg-amber-50")} 
                                                                    onClick={() => handleUpdateStatus(a, 'cancelled_vehicle')}
                                                                >
                                                                    <Minus className="h-3.5 w-3.5" /> Cancelada por Vehículo
                                                                </Button>

                                                                <Button 
                                                                    variant={a.status === 'rescheduled' ? "default" : "outline"} 
                                                                    size="sm" 
                                                                    className={cn("h-8 justify-start text-[10px] font-bold uppercase gap-2", a.status === 'rescheduled' ? "bg-slate-800" : "text-amber-600 hover:bg-amber-50")} 
                                                                    onClick={() => handleUpdateStatus(a, 'rescheduled')}
                                                                >
                                                                    <RefreshCw className="h-3.5 w-3.5" /> Reagendada
                                                                </Button>
                                                            </>
                                                        )}

                                                        <Button 
                                                            variant={a.status === 'missed' ? "default" : "outline"} 
                                                            size="sm" 
                                                            className={cn("h-8 justify-start text-[10px] font-bold uppercase gap-2", a.status === 'missed' ? "bg-red-600" : "text-red-600 hover:bg-red-50")} 
                                                            onClick={() => handleUpdateStatus(a, 'missed')}
                                                        >
                                                            <AlertCircle className="h-3.5 w-3.5" /> No Asistió
                                                        </Button>

                                                        {isAdmin && (
                                                            <Button variant="outline" size="sm" className="h-8 justify-start text-[10px] font-bold uppercase gap-2 text-blue-600 hover:bg-blue-50" onClick={() => handleUpdateStatus(a, 'scheduled')}>
                                                                <Timer className="h-3.5 w-3.5" /> Restablecer Programada
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
                                    );
                                })}
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
