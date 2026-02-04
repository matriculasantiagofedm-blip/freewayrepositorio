
'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, addDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import type { MaintenanceLog, MaintenanceType, VehicleName } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wrench, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const maintenanceSchema = z.object({
  vehicle: z.enum(['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'], { required_error: "Debe seleccionar un vehículo."}),
  date: z.date({ required_error: 'La fecha es requerida.' }),
  mileage: z.coerce.number().min(1, 'El kilometraje debe ser mayor a 0.'),
  type: z.enum(['Cambio de Aceite', 'Revisión de Frenos', 'Rotación de Llantas', 'Mantenimiento General', 'Otro'], { required_error: "Debe seleccionar un tipo."}),
  description: z.string().min(1, 'La descripción es requerida.'),
  cost: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
  nextServiceDate: z.date().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

const maintenanceTypes: MaintenanceType[] = ['Cambio de Aceite', 'Revisión de Frenos', 'Rotación de Llantas', 'Mantenimiento General', 'Otro'];
const vehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'];

export default function MaintenancePage() {
    const db = useDb();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<MaintenanceFormValues>({
        resolver: zodResolver(maintenanceSchema),
        defaultValues: {
            date: new Date(),
            mileage: 0,
            cost: 0,
            description: '',
        },
    });

    const maintenanceLogsQuery = useMemoQuery(() => {
        if (!db) return null;
        return query(collection(db, 'maintenance_logs'), orderBy('date', 'desc'));
    }, [db]);

    const { data: logs, isLoading: isLoadingLogs } = useCollection<MaintenanceLog>(maintenanceLogsQuery);

    const onSubmit = (data: MaintenanceFormValues) => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
            return;
        }

        setIsSaving(true);
        
        const { nextServiceDate, ...restOfData } = data;
        const logData: any = {
            ...restOfData,
            userId: user.uid,
            date: Timestamp.fromDate(data.date),
        };
        
        if (nextServiceDate) {
            logData.nextServiceDate = Timestamp.fromDate(nextServiceDate);
        }

        const maintenanceLogsCollection = collection(db, 'maintenance_logs');
        addDoc(maintenanceLogsCollection, logData)
            .then(() => {
                toast({ title: 'Registro Guardado', description: 'El mantenimiento ha sido guardado exitosamente.' });
                form.reset();
            })
            .catch(async (serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: maintenanceLogsCollection.path,
                    operation: 'create',
                    requestResourceData: logData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
                <Wrench className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="font-headline text-3xl font-bold">Registro de Mantenimiento</h1>
                    <p className="text-muted-foreground">Añade y consulta el historial de mantenimiento de los vehículos.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Nuevo Registro de Mantenimiento</CardTitle>
                    <CardDescription>Completa los detalles del servicio realizado.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Controller
                                name="vehicle"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div className="space-y-2">
                                        <Label>Vehículo</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar vehículo..." /></SelectTrigger>
                                            <SelectContent>
                                                {vehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                                    </div>
                                )}
                            />
                            <Controller
                                name="date"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                <div className="flex flex-col space-y-2">
                                    <Label>Fecha del Servicio</Label>
                                    <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Seleccionar fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                    </Popover>
                                    {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                                </div>
                                )}
                            />
                            <div>
                                <Label htmlFor="mileage">Kilometraje</Label>
                                <Input id="mileage" type="number" {...form.register('mileage')} />
                                {form.formState.errors.mileage && <p className="text-sm text-destructive">{form.formState.errors.mileage.message}</p>}
                            </div>
                            <Controller
                                name="type"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <div className="space-y-2">
                                        <Label>Tipo de Mantenimiento</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                                            <SelectContent>
                                                {maintenanceTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && <p className="text-sm text-destructive">{fieldState.error.message}</p>}
                                    </div>
                                )}
                            />
                             <div>
                                <Label htmlFor="cost">Costo (B/.)</Label>
                                <Input id="cost" type="number" step="0.01" {...form.register('cost')} />
                                {form.formState.errors.cost && <p className="text-sm text-destructive">{form.formState.errors.cost.message}</p>}
                            </div>
                             <Controller
                                name="nextServiceDate"
                                control={form.control}
                                render={({ field }) => (
                                <div className="flex flex-col space-y-2">
                                    <Label>Próximo Servicio (Opcional)</Label>
                                    <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Seleccionar fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                    </PopoverContent>
                                    </Popover>
                                </div>
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción del Servicio</Label>
                            <Textarea id="description" {...form.register('description')} />
                            {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
                        </div>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                            Guardar Registro
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Mantenimiento</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingLogs ? (
                        <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : logs && logs.length > 0 ? (
                        <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Vehículo</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Kilometraje</TableHead>
                                    <TableHead className="text-right">Costo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map(log => {
                                    const logDate = toDate(log.date);
                                    return (
                                    <TableRow key={log.id}>
                                        <TableCell>{!isNaN(logDate.getTime()) ? format(logDate, 'dd/MM/yyyy') : 'Fecha inválida'}</TableCell>
                                        <TableCell>{log.vehicle}</TableCell>
                                        <TableCell>{log.type}</TableCell>
                                        <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                                        <TableCell className="text-right">{log.mileage.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-semibold">B/.{log.cost.toFixed(2)}</TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground">No hay registros de mantenimiento.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

    