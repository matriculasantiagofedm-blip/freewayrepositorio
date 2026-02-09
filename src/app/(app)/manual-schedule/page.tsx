
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import type { ManualSchedule, VehicleName, InstructorName, TimeSlot } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, PlusCircle, Trash2, CalendarClock } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const manualScheduleSchema = z.object({
  studentName: z.string().min(1, 'El nombre del estudiante es requerido.'),
  date: z.date({ required_error: 'La fecha es requerida.' }),
  timeSlot: z.enum(['8am-10am', '10am-12pm', '1pm-3pm', '3pm-5pm'], { required_error: "Debe seleccionar un turno."}),
  vehicle: z.string().min(1, 'Debe seleccionar un vehículo.'),
  instructor: z.string().min(1, 'Debe seleccionar un instructor.'),
  classNumber: z.coerce.number().min(1, 'Número de clase mínimo 1.'),
  classType: z.enum(['Práctica', 'Teórica']).default('Práctica'),
});

type FormValues = z.infer<typeof manualScheduleSchema>;

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];
const vehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'];
const timeSlots = [
    { id: '8am-10am', label: '08:00 - 10:00' },
    { id: '10am-12pm', label: '10:00 - 12:00' },
    { id: '1pm-3pm', label: '13:00 - 15:00' },
    { id: '3pm-5pm', label: '15:00 - 17:00' },
];

export default function ManualSchedulePage() {
    const db = useDb();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(manualScheduleSchema),
        defaultValues: {
            studentName: '',
            date: new Date(),
            timeSlot: '8am-10am',
            vehicle: '',
            instructor: '',
            classNumber: 1,
            classType: 'Práctica',
        },
    });

    const manualEntriesQuery = useMemoQuery(() => {
        if (!db) return null;
        return query(collection(db, 'manual_schedules'), orderBy('createdAt', 'desc'));
    }, [db]);

    const { data: entries, isLoading: isLoadingEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

    const onSubmit = async (values: FormValues) => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
            return;
        }

        setIsSaving(true);
        try {
            await addDoc(collection(db, 'manual_schedules'), {
                ...values,
                userId: user.uid,
                createdAt: serverTimestamp(),
            });

            toast({ title: 'Asignación Guardada', description: 'La clase se ha añadido a la agenda.' });
            form.reset({
                ...form.getValues(),
                studentName: '',
                classNumber: (form.getValues('classNumber') || 0) + 1
            });
        } catch (error) {
            console.error("Error saving manual entry:", error);
            toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo registrar la asignación.' });
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

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
                <CalendarClock className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="font-headline text-3xl font-bold">Gestión de Agenda Manual</h1>
                    <p className="text-muted-foreground">Llena la agenda semanal manualmente sin necesidad de un contrato previo.</p>
                </div>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Nueva Asignación de Turno</CardTitle>
                    <CardDescription>Completa los datos para que aparezcan en el reporte de horarios.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField control={form.control} name="studentName" render={({ field }) => (
                                    <FormItem className="lg:col-span-2">
                                        <FormLabel>Nombre del Estudiante</FormLabel>
                                        <FormControl><Input placeholder="Introducir nombre..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="mb-1">Fecha de la Clase</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="timeSlot" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Turno / Horario</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar turno..." /></SelectTrigger></FormControl>
                                            <SelectContent>{timeSlots.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="vehicle" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vehículo Asignado</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                            <SelectContent>{vehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="instructor" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Instructor</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                            <SelectContent>{instructors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="classNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>N° de Clase</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="classType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Clase</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Práctica">Práctica</SelectItem>
                                                <SelectItem value="Teórica">Teórica</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            
                            <Button type="submit" disabled={isSaving} className="w-full md:w-auto h-11 px-8 font-bold">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Registrar en Agenda
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Asignaciones Manuales Recientes</CardTitle></CardHeader>
                <CardContent>
                    {isLoadingEntries ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                    ) : entries && entries.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader><TableRow><TableHead>Estudiante</TableHead><TableHead>Fecha</TableHead><TableHead>Turno</TableHead><TableHead>Vehículo</TableHead><TableHead>Instructor</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {entries.map(entry => (
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
