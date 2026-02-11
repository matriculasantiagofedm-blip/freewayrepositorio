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
import type { ManualSchedule, VehicleName, InstructorName, Contract, TimeSlot } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, PlusCircle, Trash2, CalendarClock, X, AlertTriangle, Search, UserCheck, RefreshCw, Save, Landmark } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';
import { isPanamaHoliday } from '@/lib/holidays';

const TIME_STRING_TO_SLOT_MAP: { [key: string]: TimeSlot } = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
};

const SLOT_TO_TIME_STRING_MAP: { [key: string]: string } = {
    '8am-10am': '8:00am a 10:00am',
    '10am-12pm': '10:00am a 12:pm',
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
});

const manualScheduleSchema = z.object({
  studentName: z.string().min(1, 'El nombre del estudiante es requerido.'),
  classes: z.array(classEntrySchema).min(1, 'Añade al menos una clase.'),
});

type FormValues = z.infer<typeof manualScheduleSchema>;

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];
const allVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'];

const timeSlots = [
    { id: '8am-10am', label: '08:00 - 10:00' },
    { id: '10am-12pm', label: '10:00 - 12:00' },
    { id: '1pm-3pm', label: '13:00 - 15:00' },
    { id: '3pm-5pm', label: '15:00 - 17:00' },
];

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
    
    // Regla 8am-10am: Lunes 3, Martes-Viernes 2
    if (slotId === '8am-10am') {
        if (day === 1) return 3;
        if (day >= 2 && day <= 5) return 2;
    }
    
    // Regla Sabatino tarde: 2 vehiculos
    if (day === 6 && slotId === '3pm-5pm') return 2;
    
    return 3; // Estándar
};

export default function ManualSchedulePage() {
    const db = useDb();
    const { user } = useUser();
    const { role, isLoading: isRoleLoading } = useCurrentRole();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchId, setSearchId] = useState('');
    const [foundContracts, setFoundContracts] = useState<Contract[]>([]);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(manualScheduleSchema),
        defaultValues: {
            studentName: '',
            classes: [{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica' }],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "classes"
    });

    const activeContractsQuery = useMemoQuery(() => db ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db]);
    const manualEntriesQuery = useMemoQuery(() => db ? collection(db, 'manual_schedules') : null, [db]);
    
    const { data: allContracts } = useCollection<Contract>(activeContractsQuery);
    const { data: allManualEntries, isLoading: isLoadingEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

    const availabilityData = useMemo(() => {
        const vehicleOccupancy: Record<string, string> = {};
        const globalCounts: Record<string, number> = {};
        
        const processEntry = (date: any, slot: string, vehicle: string, name: string, entryId?: string) => {
            if (!date || !slot || !vehicle) return;
            if (selectedContract && entryId === selectedContract.id) return;

            const dateKey = format(toDate(date), 'yyyy-MM-dd');
            const vKey = `${dateKey}|${slot}|${vehicle}`;
            const sKey = `${dateKey}|${slot}`;
            
            vehicleOccupancy[vKey] = name;
            globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
        };

        allManualEntries?.forEach(entry => {
            if (entry.classType === 'Teórica') return;
            processEntry(entry.date, entry.timeSlot, entry.vehicle, entry.studentName);
        });

        allContracts?.forEach(c => {
            const processSlots = (slots: any[]) => {
                slots.forEach(s => {
                    const slotId = TIME_STRING_TO_SLOT_MAP[s.time] || s.time;
                    processEntry(s.date, slotId, s.vehicle, c.clientName, c.id);
                });
            };
            processSlots(c.autoMotoDetails?.practicalClassSchedules || []);
            processSlots(c.autoMotoDetails?.motoPracticalClassSchedules || []);
            processSlots(c.deluxeDetails?.classSchedules || []);
        });

        return { vehicleOccupancy, globalCounts };
    }, [allContracts, allManualEntries, selectedContract]);

    const handleSearch = async () => {
        if (!db || !searchId.trim()) return;
        setIsSearching(true);
        setFoundContracts([]);
        try {
            const contractsRef = collection(db, 'contracts');
            const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', searchId.trim()));
            const q2 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', searchId.trim()));
            const q3 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', searchId.trim()));

            const [snap1, snap2, snap3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
            const results: Contract[] = [];
            [snap1, snap2, snap3].forEach(snap => {
                snap.forEach(doc => {
                    const data = { id: doc.id, ...doc.data() } as Contract;
                    if (data.status === 'active' && !results.find(r => r.id === data.id)) {
                        results.push(data);
                    }
                });
            });
            setFoundContracts(results);
            if (results.length === 0) toast({ description: 'No se encontraron contratos activos para esa cédula.' });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Error al buscar.' });
        } finally {
            setIsSearching(false);
        }
    };

    const loadContractSchedule = (contract: Contract) => {
        setSelectedContract(contract);
        form.setValue('studentName', contract.clientName);
        
        const details = contract.autoMotoDetails || contract.deluxeDetails;
        const schedules = details?.practicalClassSchedules || details?.motoPracticalClassSchedules || (details as any)?.classSchedules || [];
        
        if (schedules.length > 0) {
            const mapped = schedules.map((s: any, i: number) => ({
                date: toDate(s.date),
                timeSlot: TIME_STRING_TO_SLOT_MAP[s.time] || '8am-10am',
                vehicle: s.vehicle || '',
                instructor: s.instructor || '',
                classNumber: i + 1,
                classType: 'Práctica' as const,
            }));
            replace(mapped);
        } else {
            replace([{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica' }]);
        }
        toast({ title: 'Contrato Cargado', description: `Editando agenda de ${contract.clientName}` });
    };

    const resetSelection = () => {
        setSelectedContract(null);
        form.reset({
            studentName: '',
            classes: [{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica' }],
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
                    instructor: c.instructor
                }));

                const updateData: any = {};
                if (selectedContract.type === 'Curso Deluxe') {
                    updateData['deluxeDetails.classSchedules'] = mappedSchedules;
                } else if (selectedContract.type === 'Curso Moto') {
                    updateData['autoMotoDetails.motoPracticalClassSchedules'] = mappedSchedules;
                } else {
                    updateData['autoMotoDetails.practicalClassSchedules'] = mappedSchedules;
                }

                await updateDoc(contractRef, updateData);
                toast({ title: 'Contrato Actualizado', description: 'La agenda del contrato ha sido guardada.' });
            } else {
                const promises = values.classes.map(classItem => 
                    addDoc(collection(db, 'manual_schedules'), {
                        studentName: values.studentName,
                        ...classItem,
                        date: Timestamp.fromDate(classItem.date),
                        userId: user.uid,
                        createdAt: serverTimestamp(),
                    })
                );
                await Promise.all(promises);
                toast({ title: 'Asignaciones Guardadas', description: `${values.classes.length} clases añadidas a la agenda manual.` });
            }
            resetSelection();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo completar la operación.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEntry = async (id: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, 'manual_schedules', id));
            toast({ title: 'Registro Eliminado' });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Error al eliminar.' });
        }
    };

    if (isRoleLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    if (role !== 'Administrador') return <div className="p-12 text-center border-2 border-dashed rounded-lg max-w-2xl mx-auto mt-12"><h3 className="text-lg font-semibold text-destructive">Acceso Restringido</h3><p className="text-muted-foreground mt-2">Solo Administradores.</p><Button asChild className="mt-6" variant="outline"><Link href="/dashboard">Volver</Link></Button></div>;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
                <CalendarClock className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="font-headline text-3xl font-bold">Gestión de Agenda</h1>
                    <p className="text-muted-foreground">Asigna turnos manuales o modifica la agenda de contratos existentes.</p>
                </div>
            </div>

            {/* BUSCADOR DE CONTRATOS */}
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
                        {selectedContract && (
                            <Button variant="outline" onClick={resetSelection} className="bg-white">
                                <RefreshCw className="h-4 w-4 mr-2" /> Limpiar Selección
                            </Button>
                        )}
                    </div>

                    {foundContracts.length > 0 && (
                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                            {foundContracts.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm uppercase">{c.clientName}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold">CONTRATO N° {String(c.folioNumber).padStart(6, '0')} | {c.type}</p>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => loadContractSchedule(c)}>
                                        <UserCheck className="h-4 w-4 mr-2" /> Gestionar Horarios
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{selectedContract ? 'Modificar Agenda de Contrato' : 'Nueva Asignación Manual'}</CardTitle>
                            <CardDescription>
                                {selectedContract 
                                    ? `Editando clases prácticas del contrato ${String(selectedContract.folioNumber).padStart(6, '0')}`
                                    : 'Añade clases a estudiantes externos o asignaciones directas.'}
                            </CardDescription>
                        </div>
                        {selectedContract && <div className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">MODO EDICIÓN</div>}
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField control={form.control} name="studentName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Nombre del Estudiante</FormLabel>
                                    <FormControl><Input placeholder="Nombre completo..." {...field} className="h-11 text-lg font-semibold" readOnly={!!selectedContract} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="space-y-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Turnos Programados</Label>
                                {fields.map((field, index) => {
                                    const watchDate = form.watch(`classes.${index}.date`);
                                    const watchTime = form.watch(`classes.${index}.timeSlot`);
                                    const watchVehicle = form.watch(`classes.${index}.vehicle`);
                                    const holiday = isPanamaHoliday(toDate(watchDate));
                                    
                                    let conflictStudent = null;
                                    let isFull = false;
                                    let capacity = 3;

                                    if (watchDate && watchTime) {
                                        const dateObj = toDate(watchDate);
                                        const dateKey = format(dateObj, 'yyyy-MM-dd');
                                        
                                        if (watchVehicle) {
                                            conflictStudent = availabilityData.vehicleOccupancy[`${dateKey}|${watchTime}|${watchVehicle}`];
                                        }

                                        capacity = getGlobalCapacity(dateObj, watchTime);
                                        const currentOccupancy = availabilityData.globalCounts[`${dateKey}|${watchTime}`] || 0;
                                        isFull = currentOccupancy >= capacity;
                                    }

                                    return (
                                        <div key={field.id} className={cn("grid grid-cols-1 md:grid-cols-6 lg:grid-cols-7 gap-3 p-4 border rounded-xl bg-slate-50/50 items-end relative", (conflictStudent || isFull || holiday) && "border-amber-500 bg-amber-50/30")}>
                                            {holiday && (
                                                <div className="absolute -top-2 right-2 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10 uppercase">
                                                    <Landmark className="h-3 w-3" /> FERIADO: {holiday.name.toUpperCase()}
                                                </div>
                                            )}
                                            {conflictStudent && !holiday && (
                                                <div className="absolute -top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10 uppercase">
                                                    <AlertTriangle className="h-3 w-3" /> OCUPADO POR: {conflictStudent.toUpperCase()}
                                                </div>
                                            )}
                                            {isFull && !conflictStudent && !holiday && (
                                                <div className="absolute -top-2 right-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10 uppercase">
                                                    <AlertTriangle className="h-3 w-3" /> CAPACIDAD MÁXIMA ({capacity})
                                                </div>
                                            )}

                                            <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-white border shadow-sm text-destructive hover:bg-red-50 z-10" onClick={() => remove(index)}><X className="h-3 w-3" /></Button>
                                            
                                            <FormField control={form.control} name={`classes.${index}.date`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Fecha</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl><Button variant="outline" className={cn("w-full h-9 text-xs px-2 text-left font-normal", holiday && "border-amber-400")}>{field.value ? format(field.value, "dd/MM/yy") : "Fecha"}<CalendarIcon className="ml-auto h-3 w-3 opacity-50" /></Button></FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.timeSlot`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Turno</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className={cn("h-9 text-xs px-2", (hasConflict || isFull || holiday) && "border-amber-400")}><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>{timeSlots.map(t => {
                                                            const dateKey = watchDate ? format(toDate(watchDate), 'yyyy-MM-dd') : '';
                                                            const count = dateKey ? (availabilityData.globalCounts[`${dateKey}|${t.id}`] || 0) : 0;
                                                            const cap = watchDate ? getGlobalCapacity(toDate(watchDate), t.id) : 3;
                                                            return <SelectItem key={t.id} value={t.id} className="text-xs">{t.label} ({cap - count} disp.)</SelectItem>;
                                                        })}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.vehicle`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Vehículo</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className={cn("h-9 text-xs px-2", hasConflict && "border-amber-400")}><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                                        <SelectContent>{allVehicles.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.instructor`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Instructor</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                                                        <SelectContent>{instructors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.classNumber`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">N° Clase</FormLabel>
                                                    <FormControl><Input type="number" {...field} className="h-9 text-xs" /></FormControl>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.classType`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Tipo</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent><SelectItem value="Práctica" className="text-xs">Práctica</SelectItem><SelectItem value="Teórica" className="text-xs">Teórica</SelectItem></SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => append({ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: fields.length + 1, classType: 'Práctica' })} className="h-11 px-6 border-dashed border-2">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase
                                </Button>
                                <Button type="submit" disabled={isSaving} className="h-11 px-8 font-bold flex-1 sm:flex-none">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {selectedContract ? 'Actualizar Agenda del Contrato' : 'Guardar Agenda Manual'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Asignaciones Manuales Recientes</CardTitle></CardHeader>
                <CardContent>
                    {isLoadingEntries ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                    ) : allManualEntries && allManualEntries.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader><TableRow><TableHead>Estudiante</TableHead><TableHead>Fecha</TableHead><TableHead>Turno</TableHead><TableHead>Vehículo</TableHead><TableHead>Instructor</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {allManualEntries.map(entry => {
                                        const holiday = isPanamaHoliday(toDate(entry.date));
                                        return (
                                        <TableRow key={entry.id} className={cn(holiday && "bg-amber-50/50")}>
                                            <TableCell className="font-bold uppercase text-xs">
                                                {entry.studentName}
                                                {holiday && <div className="text-[8px] text-amber-600 font-black uppercase mt-0.5">{holiday.name}</div>}
                                            </TableCell>
                                            <TableCell className="text-xs">{format(toDate(entry.date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-xs font-medium">{timeSlots.find(ts => ts.id === entry.timeSlot)?.label}</TableCell>
                                            <TableCell className="text-xs">{entry.vehicle}</TableCell>
                                            <TableCell className="text-xs">{entry.instructor}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteEntry(entry.id)}><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No hay registros manuales.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
