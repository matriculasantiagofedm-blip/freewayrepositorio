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
import { collection, addDoc, query, orderBy, Timestamp, updateDoc, doc } from 'firebase/firestore';
import type { MaintenanceLog, MaintenanceType, VehicleName } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wrench, CalendarIcon, AlertTriangle, Car, CheckCircle2, Clock, User, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const maintenanceSchema = z.object({
  vehicle: z.enum(['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Pick up', 'Moto Roja', 'Moto Negra', 'Skoda Automatico', 'Skoda Manual'], { required_error: "Debe seleccionar un vehículo."}),
  date: z.date({ required_error: 'La fecha es requerida.' }),
  mileage: z.coerce.number().min(1, 'El kilometraje debe ser mayor a 0.'),
  type: z.enum(['Cambio de Aceite', 'Revisión de Frenos', 'Rotación de Llantas', 'Mantenimiento General', 'Otro'], { required_error: "Debe seleccionar un tipo."}),
  description: z.string().min(1, 'La descripción es requerida.'),
  cost: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
  nextServiceDate: z.date().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

const maintenanceTypes: MaintenanceType[] = ['Cambio de Aceite', 'Revisión de Frenos', 'Rotación de Llantas', 'Mantenimiento General', 'Otro'];
const vehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Pick up', 'Moto Roja', 'Moto Negra', 'Skoda Automatico', 'Skoda Manual'];

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

    const vehicleReportsQuery = useMemoQuery(() => {
        if (!db) return null;
        return query(collection(db, 'vehicle_reports'), orderBy('createdAt', 'desc'));
    }, [db]);

    const { data: logs, isLoading: isLoadingLogs } = useCollection<MaintenanceLog>(maintenanceLogsQuery);
    const { data: vehicleReports, isLoading: isLoadingReports } = useCollection<any>(vehicleReportsQuery);

    const pendingReports = vehicleReports?.filter(r => r.status !== 'resolved') || [];
    const [expandedReport, setExpandedReport] = useState<string | null>(null);

    const handleResolveReport = async (reportId: string) => {
        if (!db) return;
        try {
            await updateDoc(doc(db, 'vehicle_reports', reportId), { status: 'resolved', resolvedAt: Timestamp.now() });
            toast({ title: '✅ Reporte marcado como resuelto' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error al actualizar' });
        }
    };

    const onSubmit = async (data: MaintenanceFormValues) => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
            return;
        }

        setIsSaving(true);
        
        try {
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
            await addDoc(maintenanceLogsCollection, logData);

            toast({ title: 'Registro Guardado', description: 'El mantenimiento ha sido guardado exitosamente.' });
            form.reset();
        } catch (error) {
            console.error("Error saving maintenance log:", error);
            toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: 'No se pudo guardar el registro. Por favor, revisa tus permisos e inténtalo de nuevo.',
            });
        } finally {
            setIsSaving(false);
        }
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

            {/* ── ALERTAS DE PROFESORES ── */}
            <Card className="border-orange-200 shadow-orange-50 shadow-md">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-xl">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Alertas de Profesores</CardTitle>
                                <CardDescription className="text-xs">Problemas reportados desde el portal de instructores</CardDescription>
                            </div>
                        </div>
                        {pendingReports.length > 0 && (
                            <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">
                                {pendingReports.length} pendiente{pendingReports.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingReports ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                    ) : pendingReports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
                            <p className="font-semibold text-slate-600">Sin alertas pendientes</p>
                            <p className="text-xs text-slate-400 mt-1">Todos los vehículos están en buen estado según los profesores.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingReports.map((report: any) => {
                                const isOpen = expandedReport === report.id;
                                const reportDate = report.createdAt?.toDate ? report.createdAt.toDate() : null;
                                return (
                                    <div key={report.id} className="border-2 border-orange-100 rounded-xl overflow-hidden">
                                        {/* Header row */}
                                        <button
                                            onClick={() => setExpandedReport(isOpen ? null : report.id)}
                                            className="w-full flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                                        >
                                            <Car className="h-4 w-4 text-orange-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 text-sm truncate">{report.vehicle}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                                        <User className="h-3 w-3" />{report.instructorName}
                                                    </span>
                                                    {reportDate && (
                                                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                            <Clock className="h-3 w-3" />{format(reportDate, "dd/MM/yyyy HH:mm")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full mr-2 shrink-0">
                                                {report.issues?.length || 0} problema{(report.issues?.length || 0) > 1 ? 's' : ''}
                                            </span>
                                            {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                                        </button>

                                        {/* Expanded detail */}
                                        {isOpen && (
                                            <div className="p-4 bg-white space-y-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Problemas Reportados</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {report.issues?.map((issue: string, i: number) => (
                                                            <span key={i} className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
                                                                {issue}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {report.notes && (
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                                                            <MessageSquare className="h-3 w-3" /> Observaciones
                                                        </p>
                                                        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{report.notes}</p>
                                                    </div>
                                                )}
                                                <Button
                                                    onClick={() => handleResolveReport(report.id)}
                                                    size="sm"
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider mt-2"
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Marcar como Resuelto
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
