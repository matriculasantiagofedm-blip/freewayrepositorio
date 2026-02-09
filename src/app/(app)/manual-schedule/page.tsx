
'use client';

import { useState } from 'react';
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
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import type { ManualSchedule, VehicleName, InstructorName } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, PlusCircle, Trash2, CalendarClock, X } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
            timeSlot: '8am-10am',
            vehicle: lastClass?.vehicle || '',
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
                    <p className="text-muted-foreground">Llena la agenda semanal manualmente sin necesidad de un contrato previo.</p>
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
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-7 gap-3 p-4 border rounded-xl bg-slate-50/50 items-end relative group">
                                        {fields.length > 1 && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border shadow-sm text-destructive hover:bg-red-50"
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
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name={`classes.${index}.timeSlot`} render={({ field }) => (
                                            <FormItem className="md:col-span-1 lg:col-span-1">
                                                <FormLabel className="text-[10px] uppercase font-bold">Turno</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>{timeSlots.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name={`classes.${index}.vehicle`} render={({ field }) => (
                                            <FormItem className="md:col-span-1 lg:col-span-1">
                                                <FormLabel className="text-[10px] uppercase font-bold">Vehículo</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                                    <SelectContent>{vehicles.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name={`classes.${index}.instructor`} render={({ field }) => (
                                            <FormItem className="md:col-span-1 lg:col-span-1">
                                                <FormLabel className="text-[10px] uppercase font-bold">Instructor</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9 text-xs px-2"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                                                    <SelectContent>{instructors.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={form.control} name={`classes.${index}.classNumber`} render={({ field }) => (
                                            <FormItem className="md:col-span-1 lg:col-span-1">
                                                <FormLabel className="text-[10px] uppercase font-bold">N° Clase</FormLabel>
                                                <FormControl><Input type="number" {...field} className="h-9 text-xs" /></FormControl>
                                                <FormMessage />
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
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                ))}
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
