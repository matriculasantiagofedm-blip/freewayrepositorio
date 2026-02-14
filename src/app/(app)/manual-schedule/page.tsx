'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy, Timestamp, where, getDocs, updateDoc } from 'firebase/firestore';
import type { ManualSchedule, VehicleName, InstructorName, Contract, TimeSlot, ClassStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, PlusCircle, Trash2, CalendarClock, X, AlertTriangle, Search, UserCheck, RefreshCw, Save, Landmark, Ban, Edit2, ShieldAlert } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentRole } from '@/hooks/use-current-role';
import { isPanamaHoliday } from '@/lib/holidays';

const ALL_COURSE_PLANS = [
    "Curso Auto Básico (8hrz)", "Curso Auto Plus (10hrz)", "Curso Auto Premium (12hrz)", "Reforzamiento 4hrs", "Reforzamiento Plus 2hrs", "Evaluación Estacionamiento (10 min)",
    "Curso Moto Básico (8hrz)", "Curso Moto Plus (10hrz)", "Curso Moto Premium (12hrz)", "Moto Reforzamiento 4hrs", "Moto Reforzamiento Plus 2hrs", "Moto Evaluación Estacionamiento (10 min)",
    "Auto + Moto 10Hrs", "Básico Auto + Moto", "Plus Auto + Moto", "Premium Auto + Moto", "Básico Moto + Auto", "Plus Moto + Auto", "Premium Moto + Auto",
    "Deluxe Premium (12 semanas)", "Deluxe Full (16 semanas)",
    "Solo Práctica (Varios)"
];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: TimeSlot } = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
    '08:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '01:00pm a 03:00pm': '1pm-3pm',
    '03:00pm a 05:00pm': '3pm-5pm',
};

const SLOT_TO_TIME_STRING_MAP: { [key: string]: string } = {
    '8am-10am': '8:00am a 10:00am',
    '10am-12pm': '10:00am a 12:00pm',
    '1pm-3pm': '1:00pm a 3:00pm',
    '3pm-5pm': '3:00pm a 5:00pm',
};

const classEntrySchema = z.object({
  date: z.date({ required_error: 'Fecha requerida' }),
  timeSlot: z.enum(['8am-10am', '10am-12pm', '1pm-3pm', '3pm-5pm'], { required_error: "Turno requerido"}),
  vehicle: z.string().min(1, 'Vehículo requerido'),
  instructor: z.string().min(1, 'Instructor requerido'),
  classNumber: z.coerce.number().min(1, 'Mínimo 1'),
  classType: z.enum(['Práctica', 'Teórica']).default('Práctica'),
  status: z.enum(['scheduled', 'missed', 'completed']).default('scheduled'),
});

const manualScheduleSchema = z.object({
  studentName: z.string().min(1, 'El nombre del estudiante es requerido.'),
  coursePlan: z.string().optional(),
  classes: z.array(classEntrySchema).min(1, 'Añade al menos una clase.'),
});

type FormValues = z.infer<typeof manualScheduleSchema>;

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];
const allVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel', 'Moto Roja', 'Moto Negra'];

const timeSlots = [
    { id: '8am-10am', label: '08:00 - 10:00' },
    { id: '10am-12pm', label: '10:00 - 12:00' },
    { id: '1pm-3pm', label: '13:00 - 15:00' },
    { id: '3pm-5pm', label: '15:00 - 17:00' },
];

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

export default function ManualSchedulePage() {
    const db = useDb();
    const { user } = useUser();
    const { role } = useCurrentRole();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchId, setSearchId] = useState('');
    const [foundContracts, setFoundContracts] = useState<Contract[]>([]);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [editingManualEntryId, setEditingManualEntryId] = useState<string | null>(null);
    const [hasMissedClasses, setHasMissedClasses] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(manualScheduleSchema),
        defaultValues: {
            studentName: '',
            coursePlan: '',
            classes: [{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica', status: 'scheduled' }],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "classes"
    });

    const activeContractsQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db, user]);
    const manualEntriesQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'manual_schedules'), orderBy('date', 'desc')) : null, [db, user]);
    
    const { data: allContracts } = useCollection<Contract>(activeContractsQuery);
    const { data: allManualEntries, isLoading: isLoadingEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

    const availabilityData = useMemo(() => {
        const vehicleOccupancy: Record<string, { name: string, isEval: boolean }[]> = {};
        const globalCounts: Record<string, number> = {};
        
        const processEntry = (date: any, slot: string, vehicle: string, name: string, isEval: boolean, entryId?: string) => {
            if (!date || !slot || !vehicle) return;
            const dObj = toDate(date);
            if (isNaN(dObj.getTime())) return;
            if (editingManualEntryId && entryId === editingManualEntryId) return; 

            const dateKey = format(dObj, 'yyyy-MM-dd');
            const vKey = `${dateKey}|${slot}|${vehicle}`;
            if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
            vehicleOccupancy[vKey].push({ name, isEval });
        };

        allManualEntries?.forEach(entry => {
            if (entry.classType === 'Teórica') return;
            processEntry(entry.date, entry.timeSlot, entry.vehicle, entry.studentName, false, entry.id);
        });

        allContracts?.forEach(c => {
            if (selectedContract && c.id === selectedContract.id) return;
            const details = c.autoMotoDetails || c.deluxeDetails;
            const isEval = (details?.coursePlan === 'evaluacion-estacionamiento' || details?.coursePlan === 'moto-evaluacion-estacionamiento');
            const processSlots = (slots: any[]) => {
                slots.forEach(s => {
                    const slotIdVal = TIME_STRING_TO_SLOT_MAP[s.time] || s.time;
                    processEntry(s.date, slotIdVal, s.vehicle, c.clientName, isEval);
                });
            };
            if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
            if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
            if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
        });

        Object.keys(vehicleOccupancy).forEach(vKey => {
            const [dateKey, slotId] = vKey.split('|');
            const sKey = `${dateKey}|${slotId}`;
            const students = vehicleOccupancy[vKey];
            const hasNormalClass = students.some(s => !s.isEval);
            const evalCount = students.filter(s => s.isEval).length;
            if (hasNormalClass || evalCount > 0) globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
        });

        return { vehicleOccupancy, globalCounts };
    }, [allContracts, allManualEntries, selectedContract, editingManualEntryId]);

    const handleSearch = async () => {
        if (!db || !searchId.trim()) return;
        setIsSearching(true);
        setFoundContracts([]);
        setHasMissedClasses(false);
        try {
            const results: Contract[] = [];
            allContracts?.forEach(c => {
                const details = c.autoMotoDetails || c.deluxeDetails;
                const studentIdNum = details?.studentIdNumber || '';
                if (studentIdNum === searchId.trim()) {
                    results.push(c);
                }
            });
            setFoundContracts(results);
            if (results.length === 0) toast({ description: 'No se encontraron contratos activos.' });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Error al buscar.' });
        } finally {
            setIsSearching(false);
        }
    };

    const loadContractSchedule = (contract: Contract) => {
        setSelectedContract(contract);
        setEditingManualEntryId(null);
        form.setValue('studentName', contract.clientName);
        form.setValue('coursePlan', contract.type);
        
        const details = contract.autoMotoDetails || contract.deluxeDetails;
        const schedules = details?.practicalClassSchedules || details?.motoPracticalClassSchedules || (details as any)?.classSchedules || [];
        
        // Verificar si tiene inasistencias previas
        const missed = schedules.some((s: any) => s.status === 'missed');
        setHasMissedClasses(missed);

        if (schedules.length > 0) {
            const mapped = schedules.map((s: any, i: number) => ({
                date: toDate(s.date),
                timeSlot: TIME_STRING_TO_SLOT_MAP[s.time] || s.time,
                vehicle: s.vehicle || '',
                instructor: s.instructor || '',
                classNumber: i + 1,
                classType: 'Práctica' as const,
                status: s.status || 'scheduled',
            }));
            replace(mapped);
        } else {
            replace([{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica', status: 'scheduled' }]);
        }
    };

    const loadManualEntryForEdit = (entry: ManualSchedule) => {
        setSelectedContract(null);
        setEditingManualEntryId(entry.id);
        setHasMissedClasses(entry.status === 'missed');
        form.reset({
            studentName: entry.studentName,
            coursePlan: entry.coursePlan || '',
            classes: [{
                date: toDate(entry.date),
                timeSlot: entry.timeSlot,
                vehicle: entry.vehicle,
                instructor: entry.instructor,
                classNumber: entry.classNumber,
                classType: entry.classType,
                status: entry.status || 'scheduled',
            }]
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteManualEntry = async (id: string) => {
        if (!db) return;
        if (!confirm('¿Estás seguro de eliminar este registro manual?')) return;
        try {
            await deleteDoc(doc(db, 'manual_schedules', id));
            toast({ title: 'Registro eliminado' });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Error al eliminar' });
        }
    };

    const resetSelection = () => {
        setSelectedContract(null);
        setEditingManualEntryId(null);
        setHasMissedClasses(false);
        form.reset({
            studentName: '',
            coursePlan: '',
            classes: [{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica', status: 'scheduled' }],
        });
    };

    const onSubmit = async (values: FormValues) => {
        if (!db || !user) return;
        setIsSaving(true);
        try {
            if (selectedContract) {
                const contractRef = doc(db, 'contracts', selectedContract.id);
                const mappedSchedules = values.classes.map(c => ({
                    date: Timestamp.fromDate(c.date),
                    time: SLOT_TO_TIME_STRING_MAP[c.timeSlot] || c.timeSlot,
                    vehicle: c.vehicle,
                    instructor: c.instructor,
                    status: c.status || 'scheduled'
                }));
                const updateData: any = {};
                if (selectedContract.type === 'Curso Deluxe') updateData['deluxeDetails.classSchedules'] = mappedSchedules;
                else if (selectedContract.type === 'Curso Moto') updateData['autoMotoDetails.motoPracticalClassSchedules'] = mappedSchedules;
                else updateData['autoMotoDetails.practicalClassSchedules'] = mappedSchedules;
                await updateDoc(contractRef, updateData);
                toast({ title: 'Contrato Actualizado' });
            } else if (editingManualEntryId) {
                const entryRef = doc(db, 'manual_schedules', editingManualEntryId);
                const classItem = values.classes[0]; 
                await updateDoc(entryRef, {
                    studentName: values.studentName,
                    coursePlan: values.coursePlan,
                    ...classItem,
                    date: Timestamp.fromDate(classItem.date),
                    updatedAt: serverTimestamp(),
                });
                toast({ title: 'Registro Actualizado' });
            } else {
                const promises = values.classes.map(classItem => 
                    addDoc(collection(db, 'manual_schedules'), {
                        studentName: values.studentName,
                        coursePlan: values.coursePlan,
                        ...classItem,
                        date: Timestamp.fromDate(classItem.date),
                        userId: user.uid,
                        createdAt: serverTimestamp(),
                    })
                );
                await Promise.all(promises);
                toast({ title: 'Asignaciones Guardadas' });
            }
            resetSelection();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Guardar' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex items-center gap-3">
                <CalendarClock className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="font-headline text-3xl font-bold">Gestión de Agenda</h1>
                    <p className="text-muted-foreground">Asigna turnos manuales o modifica la agenda de contratos existentes.</p>
                </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-primary">
                        <Search className="h-4 w-4" /> Buscar Estudiante para Modificar Agenda
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Cédula o Pasaporte..." 
                            value={searchId} 
                            onChange={(e) => setSearchId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="max-w-sm bg-white"
                        />
                        <Button onClick={handleSearch} disabled={isSearching}>
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Buscar
                        </Button>
                        {(selectedContract || editingManualEntryId) && (
                            <Button variant="outline" onClick={resetSelection} className="bg-white">
                                <RefreshCw className="h-4 w-4 mr-2" /> Cancelar Edición
                            </Button>
                        )}
                    </div>
                    {foundContracts.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                            <div><p className="font-bold text-sm uppercase">{c.clientName}</p><p className="text-[10px] text-muted-foreground font-bold uppercase">CONTRATO N° {String(c.folioNumber).padStart(6, '0')} | {c.type}</p></div>
                            <Button size="sm" variant="secondary" onClick={() => loadContractSchedule(c)}><UserCheck className="h-4 w-4 mr-2" /> Gestionar</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {hasMissedClasses && (
                <div className="bg-red-600 text-white p-4 rounded-lg flex items-center gap-4 animate-bounce shadow-lg border-2 border-red-800">
                    <ShieldAlert className="h-10 w-10 shrink-0" />
                    <div>
                        <p className="font-black text-lg uppercase leading-tight tracking-tighter">ALERTA: EL ESTUDIANTE TIENE INASISTENCIAS PREVIAS</p>
                        <p className="text-xs font-bold opacity-90">No se permite la re-agenda hasta que la inasistencia sea verificada y/o el cargo de B/. 20.00 sea pagado en recepción.</p>
                    </div>
                </div>
            )}

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>
                        {selectedContract ? 'Modificar Agenda de Contrato' : 
                         editingManualEntryId ? 'Editar Registro Manual' : 'Nueva Asignación Manual'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="studentName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Nombre del Estudiante</FormLabel>
                                        <FormControl><Input placeholder="Nombre completo..." {...field} className="h-11 text-lg font-semibold" readOnly={!!selectedContract} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="coursePlan" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Plan de Curso</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder="Seleccionar plan..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ALL_COURSE_PLANS.map(plan => (
                                                    <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="space-y-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Turnos Programados</Label>
                                {fields.map((field, index) => {
                                    const watchDate = form.watch(`classes.${index}.date`);
                                    const watchTime = form.watch(`classes.${index}.timeSlot`);
                                    const watchVehicle = form.watch(`classes.${index}.vehicle`);
                                    const watchStatus = form.watch(`classes.${index}.status`);
                                    
                                    const dObj = toDate(watchDate);
                                    const isValidDate = !isNaN(dObj.getTime());
                                    const holiday = isValidDate ? isPanamaHoliday(dObj) : null;
                                    const isSunday = isValidDate && dObj.getDay() === 0;
                                    
                                    let conflictStudents: { name: string, isEval: boolean }[] = [];
                                    let isFull = false;
                                    let capacity = 3;

                                    if (isValidDate && watchTime) {
                                        const dateKey = format(dObj, 'yyyy-MM-dd');
                                        const slotId = watchTime; // FIX: slotId was undefined
                                        if (watchVehicle) conflictStudents = availabilityData.vehicleOccupancy[`${dateKey}|${watchTime}|${watchVehicle}`] || [];
                                        capacity = getGlobalCapacity(dObj, watchTime);
                                        isFull = (availabilityData.globalCounts[`${dateKey}|${slotId}`] || 0) >= capacity;
                                    }

                                    const hasConflict = conflictStudents.length > 0;

                                    return (
                                        <div key={field.id} className={cn(
                                            "grid grid-cols-1 md:grid-cols-6 lg:grid-cols-8 gap-3 p-4 border rounded-xl items-end relative",
                                            watchStatus === 'missed' ? "border-red-600 bg-red-50/50" : (hasConflict || isFull || holiday || isSunday) ? "border-amber-500 bg-amber-50/30" : "bg-slate-50/50"
                                        )}>
                                            <div className="absolute -top-2 right-2 flex gap-1 z-10">
                                                {watchStatus === 'missed' && <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">INASISTENCIA</div>}
                                                {isSunday && <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">DOMINGO</div>}
                                                {holiday && !isSunday && <div className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">FERIADO</div>}
                                                {hasConflict && !holiday && !isSunday && <div className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">OCUPADO</div>}
                                                {isFull && !hasConflict && !holiday && !isSunday && <div className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">LLENO</div>}
                                            </div>

                                            {!editingManualEntryId && (
                                                <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-white border shadow-sm text-destructive" onClick={() => remove(index)}><X className="h-3 w-3" /></Button>
                                            )}
                                            
                                            <FormField control={form.control} name={`classes.${index}.date`} render={({ field: f }) => (
                                                <FormItem>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl><Button variant="outline" className={cn("w-full h-9 text-xs", (holiday || isSunday) && "border-amber-400")}>{f.value ? format(toDate(f.value), "dd/MM/yy") : "Fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus /></PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.timeSlot`} render={({ field: f }) => (
                                                <FormItem>
                                                    <Select onValueChange={f.onChange} value={f.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>{timeSlots.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.vehicle`} render={({ field: f }) => (
                                                <FormItem>
                                                    <Select onValueChange={f.onChange} value={f.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                                        <SelectContent>{allVehicles.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.instructor`} render={({ field: f }) => (
                                                <FormItem>
                                                    <Select onValueChange={f.onChange} value={f.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                                                        <SelectContent>{instructors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.classNumber`} render={({ field: f }) => (
                                                <FormItem><FormControl><Input type="number" {...f} className="h-9 text-xs" /></FormControl></FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.classType`} render={({ field: f }) => (
                                                <FormItem>
                                                    <Select onValueChange={f.onChange} value={f.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent><SelectItem value="Práctica" className="text-xs">Práctica</SelectItem><SelectItem value="Teórica" className="text-xs">Teórica</SelectItem></SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.status`} render={({ field: f }) => (
                                                <FormItem>
                                                    <Select onValueChange={f.onChange} value={f.value}>
                                                        <FormControl><SelectTrigger className={cn("h-9 text-[10px] font-bold uppercase", f.value === 'missed' ? 'bg-red-600 text-white' : '')}><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="scheduled" className="text-xs">Programada</SelectItem>
                                                            <SelectItem value="missed" className="text-xs">No Asistió</SelectItem>
                                                            <SelectItem value="completed" className="text-xs">Completada</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {!editingManualEntryId && (
                                    <Button type="button" variant="outline" onClick={() => append({ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: fields.length + 1, classType: 'Práctica', status: 'scheduled' })} className="h-11 px-6 border-dashed border-2">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase
                                    </Button>
                                )}
                                <Button type="submit" disabled={isSaving || hasMissedClasses} className={cn("h-11 px-8 font-bold flex-1 sm:flex-none", hasMissedClasses && "bg-slate-400 cursor-not-allowed")}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {hasMissedClasses ? 'BLOQUEADO POR INASISTENCIA' : selectedContract ? 'Actualizar Agenda' : editingManualEntryId ? 'Actualizar Registro' : 'Guardar Manual'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Asignaciones Manuales</CardTitle>
                    <CardDescription>Consulta y edita los turnos asignados de forma manual.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingEntries ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin opacity-20" /></div>
                    ) : allManualEntries && allManualEntries.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-bold text-[10px] uppercase">Fecha</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Estudiante</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Estado</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Turno</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Vehículo</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase">Instructor</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allManualEntries.map(entry => {
                                        const entryDate = toDate(entry.date);
                                        return (
                                        <TableRow key={entry.id}>
                                            <TableCell className="text-xs font-medium">{!isNaN(entryDate.getTime()) ? format(entryDate, 'dd/MM/yyyy') : '---'}</TableCell>
                                            <TableCell className="text-xs font-bold uppercase">{entry.studentName}</TableCell>
                                            <TableCell>
                                                {entry.status === 'missed' ? (
                                                    <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">INASISTENCIA</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold opacity-50 uppercase">{entry.status === 'completed' ? 'Completada' : 'Programada'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">{timeSlots.find(t => t.id === entry.timeSlot)?.label || entry.timeSlot}</TableCell>
                                            <TableCell className="text-xs">{entry.vehicle}</TableCell>
                                            <TableCell className="text-xs">{entry.instructor}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => loadManualEntryForEdit(entry)}><Edit2 className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteManualEntry(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground italic">No hay registros manuales previos.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
