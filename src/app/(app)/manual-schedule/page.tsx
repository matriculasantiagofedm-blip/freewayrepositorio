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
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy, Timestamp, where } from 'firebase/firestore';
import type { ManualSchedule, VehicleName, InstructorName, Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, PlusCircle, Trash2, CalendarClock, X, AlertTriangle } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';

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
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const allVehicles: VehicleName[] = [...carVehicles, ...motoVehicles];

const timeSlots = [
    { id: '8am-10am', label: '08:00 - 10:00' },
    { id: '10am-12pm', label: '10:00 - 12:00' },
    { id: '1pm-3pm', label: '13:00 - 15:00' },
    { id: '3pm-5pm', label: '15:00 - 17:00' },
];

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); 
    if (day === 1 && slotId === '8am-10am') return 2;
    if (day === 6 && slotId === '3pm-5pm') return 2;
    return 3;
};

export default function ManualSchedulePage() {
    const db = useDb();
    const { user } = useUser();
    const { role, isLoading: isRoleLoading } = useCurrentRole();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(manualScheduleSchema),
        defaultValues: {
            studentName: '',
            classes: [
                {
                    date: new Date(),
                    timeSlot: '8am-10am',
                    vehicle: '',
                    instructor: '',
                    classNumber: 1,
                    classType: 'Práctica',
                }
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
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
        
        const processEntry = (date: any, slot: string, vehicle: string, name: string) => {
            if (!date || !slot || !vehicle) return;
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
                    const timeMap: Record<string, string> = {
                        '8:00am a 10:00am': '8am-10am',
                        '10:00am a 12:pm': '10am-12pm',
                        '1:00pm a 3:00pm': '1pm-3pm',
                        '3:00pm a 5:00pm': '3pm-5pm',
                    };
                    processEntry(s.date, timeMap[s.time] || s.time, s.vehicle, c.clientName);
                });
            };
            processSlots(c.autoMotoDetails?.practicalClassSchedules || []);
            processSlots(c.autoMotoDetails?.motoPracticalClassSchedules || []);
            processSlots(c.deluxeDetails?.classSchedules || []);
        });

        return { vehicleOccupancy, globalCounts };
    }, [allContracts, allManualEntries]);

    if (isRoleLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (role !== 'Administrador') {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-lg max-w-2xl mx-auto mt-12">
                <h3 className="text-lg font-semibold text-destructive">Acceso Restringido</h3>
                <p className="text-muted-foreground mt-2">Solo los usuarios con rol de Administrador pueden gestionar la agenda manual.</p>
                <Button asChild className="mt-6" variant="outline">
                    <Link href="/dashboard">Volver al Panel</Link>
                </Button>
            </div>
        );
    }

    const onSubmit = async (values: FormValues) => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
            return;
        }

        setIsSaving(true);
        try {
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

            toast({ title: 'Asignaciones Guardadas', description: `${values.classes.length} clases añadidas a la agenda.` });
            form.reset({
                studentName: '',
                classes: [{ date: new Date(), timeSlot: '8am-10am', vehicle: '', instructor: '', classNumber: 1, classType: 'Práctica' }]
            });
        } catch (error) {
            console.error("Error saving manual entries:", error);
            toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudieron registrar las asignaciones.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, 'manual_schedules', id));
            toast({ title: 'Registro Eliminado', description: 'La asignación ha sido removida.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el registro.' });
        }
    };

    const addNewClass = () => {
        const lastClass = form.getValues(`classes.${fields.length - 1}`);
        append({
            date: lastClass?.date ? new Date(lastClass.date) : new Date(),
            timeSlot: lastClass?.timeSlot || '8am-10am',
            vehicle: '',
            instructor: lastClass?.instructor || '',
            classNumber: (lastClass?.classNumber || 0) + 1,
            classType: 'Práctica',
        });
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
                <CalendarClock className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="font-headline text-3xl font-bold">Gestión de Agenda Manual</h1>
                    <p className="text-muted-foreground">Llena la agenda semanal manualmente con restricción de flota global (Máx 3).</p>
                </div>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Nueva Asignación de Turnos</CardTitle>
                    <CardDescription>Completa los datos del estudiante y añade las fechas de sus clases.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField control={form.control} name="studentName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Nombre del Estudiante</FormLabel>
                                    <FormControl><Input placeholder="Nombre completo..." {...field} className="h-11 text-lg font-semibold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="space-y-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Listado de Clases / Fechas</Label>
                                {fields.map((field, index) => {
                                    const watchDate = form.watch(`classes.${index}.date`);
                                    const watchTime = form.watch(`classes.${index}.timeSlot`);
                                    const watchVehicle = form.watch(`classes.${index}.vehicle`);
                                    
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
                                        <div key={field.id} className={cn("grid grid-cols-1 md:grid-cols-6 lg:grid-cols-7 gap-3 p-4 border rounded-xl bg-slate-50/50 items-end relative group", (conflictStudent || isFull) && "border-amber-500 bg-amber-50/30")}>
                                            {conflictStudent && (
                                                <div className="absolute -top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10">
                                                    <AlertTriangle className="h-3 w-3" /> OCUPADO POR: {conflictStudent.toUpperCase()}
                                                </div>
                                            )}
                                            {isFull && !conflictStudent && (
                                                <div className="absolute -top-2 right-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10">
                                                    <AlertTriangle className="h-3 w-3" /> CAPACIDAD MÁXIMA ({capacity})
                                                </div>
                                            )}

                                            {fields.length > 1 && (
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-white border shadow-sm text-destructive hover:bg-red-50 z-10"
                                                    onClick={() => remove(index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            )}
                                            
                                            <FormField control={form.control} name={`classes.${index}.date`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Fecha</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button variant="outline" className={cn("w-full h-9 text-xs px-2 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                    {field.value ? format(field.value, "dd/MM/yy") : "Fecha"}
                                                                    <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.timeSlot`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Turno</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>{timeSlots.map(t => {
                                                            const dateKey = watchDate ? format(toDate(watchDate), 'yyyy-MM-dd') : '';
                                                            const count = dateKey ? (availabilityData.globalCounts[`${dateKey}|${t.id}`] || 0) : 0;
                                                            const cap = watchDate ? getGlobalCapacity(toDate(watchDate), t.id) : 3;
                                                            return (
                                                                <SelectItem key={t.id} value={t.id} className="text-xs">
                                                                    {t.label} ({cap - count} disp.)
                                                                </SelectItem>
                                                            );
                                                        })}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.vehicle`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Vehículo</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                                        <SelectContent>{allVehicles.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name={`classes.${index}.instructor`} render={({ field }) => (
                                                <FormItem className="md:col-span-1 lg:col-span-1">
                                                    <FormLabel className="text-[10px] uppercase font-bold">Instructor</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                                                        <SelectContent>{instructors.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}</SelectContent>
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
                                                        <SelectContent>
                                                            <SelectItem value="Práctica" className="text-xs">Práctica</SelectItem>
                                                            <SelectItem value="Teórica" className="text-xs">Teórica</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={addNewClass} className="h-11 px-6 border-dashed border-2 hover:bg-slate-50">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Añadir Clase (Fecha)
                                </Button>
                                <Button type="submit" disabled={isSaving} className="h-11 px-8 font-bold flex-1 sm:flex-none">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
                                    Guardar Todas las Asignaciones
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
                                    {allManualEntries.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-bold uppercase text-xs">{entry.studentName}</TableCell>
                                            <TableCell className="text-xs">{format(toDate(entry.date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-xs font-medium">{timeSlots.find(ts => ts.id === entry.timeSlot)?.label}</TableCell>
                                            <TableCell className="text-xs">{entry.vehicle}</TableCell>
                                            <TableCell className="text-xs">{entry.instructor}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(entry.id)}><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
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
