'use client';
import { collection, query, where, orderBy, Timestamp, doc, runTransaction } from 'firebase/firestore';
import type { Contract, Deadline, VehicleAssignment, VehicleName, TimeSlot, InstructorName } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format, isPast, differenceInDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Eye, Search, CheckCircle, XCircle, Ban, CalendarClock } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { syncCalendarEvent } from '@/lib/actions';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const VEHICLES: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'];
const TIME_SLOTS: { id: TimeSlot, label: string }[] = [
    { id: '8am-10am', label: '8:00am - 10:00am' },
    { id: '10am-12pm', label: '10:00am - 12:00pm' },
    { id: '1pm-3pm', label: '1:00pm - 3:00pm' },
    { id: '3pm-5pm', label: '3:00pm - 5:00pm' },
];
const INSTRUCTORS: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: TimeSlot } = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
};

const timeStringToTimeSlot = (timeString: string): TimeSlot | null => {
    return TIME_STRING_TO_SLOT_MAP[timeString] || null;
}

const convertToISODateTime = (date: Date, timeSlot: TimeSlot): { startISO: string, endISO: string } => {
    const timeParts = {
        '8am-10am': { start: 8, end: 10 },
        '10am-12pm': { start: 10, end: 12 },
        '1pm-3pm': { start: 13, end: 15 },
        '3pm-5pm': { start: 15, end: 17 },
    };

    const { start, end } = timeParts[timeSlot];

    const startDate = new Date(date);
    startDate.setHours(start, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(end, 0, 0, 0);

    return {
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
    };
};


function toDate(date: any): Date {
  if (!date) return new Date(0); // Return an invalid date if input is null/undefined
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date(0);
}

const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) {
        return contract.autoMotoDetails.balance || 0;
    }
    if (contract.ampliacionesDetails) {
        return contract.ampliacionesDetails.balance || 0;
    }
    return 0;
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;

    const balance = getBalance(contract);
    if (balance <= 0) return false;

    let deadline: Date | undefined | null = undefined;
    if (contract.autoMotoDetails?.paymentDeadline) {
        deadline = contract.autoMotoDetails.paymentDeadline;
    } else if (contract.ampliacionesDetails?.paymentDeadline) {
        deadline = contract.ampliacionesDetails.paymentDeadline;
    }

    if (deadline) {
        const paymentDate = toDate(deadline);
        if (paymentDate.getTime() > 0 && isPast(paymentDate)) {
            return true;
        }
    }

    return false;
}

const getDebtAgeInfo = (contract: Contract): { category: string; days: number } | null => {
    if (!isOverdue(contract)) return null;

    let deadline: Date | undefined | null = undefined;
    if (contract.autoMotoDetails?.paymentDeadline) {
        deadline = contract.autoMotoDetails.paymentDeadline;
    } else if (contract.ampliacionesDetails?.paymentDeadline) {
        deadline = contract.ampliacionesDetails.paymentDeadline;
    }

    if (!deadline) return null;

    const paymentDate = toDate(deadline);
    if (paymentDate.getFullYear() <= 1970) return null;
    const daysOverdue = differenceInDays(new Date(), paymentDate);

    if (daysOverdue <= 30) {
        return { category: '0-30 días', days: daysOverdue };
    }
    if (daysOverdue <= 60) {
        return { category: '31-60 días', days: daysOverdue };
    }
    if (daysOverdue <= 90) {
        return { category: '61-90 días', days: daysOverdue };
    }
    return { category: '90+ días', days: daysOverdue };
};


export default function AllContractsPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  
  const [schedulesToSync, setSchedulesToSync] = useState<any[]>([]);

  const filter = searchParams.get('filter');

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;

    let q = query(collection(db, 'contracts'), orderBy('folioNumber', 'desc'));

    if (role !== 'Administrador' && role !== 'Ventas') {
      q = query(q, where('userId', '==', user.uid));
    }
    
    return q;
  }, [db, user, role]);

  const { data: allContracts, isLoading } = useCollection<Contract>(contractsQuery);

  const statusColors: { [key: string]: string } = {
    active: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    completed: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    overdue: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
  };

  const ageCategoryColors: { [key: string]: string } = {
    '0-30 días': 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    '31-60 días': 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700',
    '61-90 días': 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    '90+ días': 'bg-red-200 text-red-900 border-red-400 font-bold dark:bg-red-900 dark:text-red-200 dark:border-red-700',
  };

  const statusTranslations: { [key: string]: string } = {
    active: 'Activo',
    draft: 'Borrador',
    completed: 'Completado',
    expired: 'Anulado', // Changed for display
    overdue: 'Vencido',
  }
  
  const getPaymentDeadline = (contract: Contract): Date | null => {
    let deadline: Date | undefined | null = undefined;
    if (contract.autoMotoDetails?.paymentDeadline) {
        deadline = contract.autoMotoDetails.paymentDeadline;
    } else if (contract.ampliacionesDetails?.paymentDeadline) {
        deadline = contract.ampliacionesDetails.paymentDeadline;
    }

    if (deadline) {
        const paymentDate = toDate(deadline);
        if (paymentDate.getFullYear() > 1970) {
            return paymentDate;
        }
    }
    return null;
  };

  const filteredContracts =
    allContracts?.map(contract => {
        const debtInfo = getDebtAgeInfo(contract);
        return { ...contract, debtInfo };
    }).filter((contract) => {
      const folio = String(contract.folioNumber || '').padStart(6, '0');
      const client = contract.clientName.toLowerCase();
      const type = contract.type.toLowerCase();
      const cedula = contract.studentIdNumber || '';
      const search = searchTerm.toLowerCase();

      // Apply filter from URL param
      if (filter === 'overdue' && !isOverdue(contract)) {
        return false;
      }
      
      // Apply search term
      if (searchTerm) {
          return folio.includes(search) || client.includes(search) || type.includes(search) || cedula.includes(search);
      }

      return true; // if no filter or search, show all (or all overdue if filter is set)
    }) || [];

    const handleOpenScheduleModal = (contract: Contract) => {
        setSelectedContract(contract);
        
        const autoSchedules = (contract.autoMotoDetails?.practicalClassSchedules || [])
            .filter(s => s && s.date && s.time)
            .map(s => ({ ...s, classType: 'Auto' }));

        const motoSchedules = (contract.autoMotoDetails?.motoPracticalClassSchedules || [])
            .filter(s => s && s.date && s.time)
            .map(s => ({ ...s, classType: 'Moto' }));

        const allSchedules = [...autoSchedules, ...motoSchedules];
        
        setSchedulesToSync(allSchedules.map(schedule => ({
            date: toDate(schedule.date),
            time: schedule.time,
            classType: schedule.classType,
            vehicle: '',
            instructor: '',
        })));
        
        setIsScheduleModalOpen(true);
    };

    const handleScheduleItemChange = (index: number, field: 'vehicle' | 'instructor', value: string) => {
        const newSchedules = [...schedulesToSync];
        newSchedules[index][field] = value;
        setSchedulesToSync(newSchedules);
    };


    const handleSaveSchedule = async () => {
        if (!db || !user || !selectedContract) return;

        const schedulesToProcess = schedulesToSync.filter(s => s.vehicle && s.instructor);

        if (schedulesToProcess.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Faltan datos',
                description: 'Por favor, asigna un vehículo y un instructor al menos a una clase.',
            });
            return;
        }

        setIsSavingSchedule(true);

        let allSavesSuccessful = true;
        let errors: string[] = [];

        for (const [index, schedule] of schedulesToProcess.entries()) {
            const { date, time, vehicle, instructor } = schedule;
            
            const timeSlot = timeStringToTimeSlot(time);
            if (!timeSlot) {
                errors.push(`Formato de hora "${time}" inválido para la clase ${index + 1}.`);
                continue;
            }

            const dateId = format(startOfDay(date), 'yyyy-MM-dd');
            const scheduleRef = doc(db, 'vehicle_schedules', dateId);
            
            try {
                await runTransaction(db, async (transaction) => {
                    const scheduleSnap = await transaction.get(scheduleRef);
                    const existingAssignments: VehicleAssignment[] = scheduleSnap.exists() ? scheduleSnap.data().assignments : [];
                    
                    const isSlotTaken = existingAssignments.some(
                        (a) => a.vehicle === vehicle && a.timeSlot === timeSlot
                    );

                    if (isSlotTaken) {
                        throw new Error(`El ${vehicle} ya está asignado el ${format(date, 'P', {locale: es})} a las ${time}.`);
                    }

                    const newAssignment: VehicleAssignment = {
                        vehicle, timeSlot, instructor,
                        studentName: selectedContract.clientName,
                    };

                    transaction.set(scheduleRef, { 
                        id: dateId,
                        date: Timestamp.fromDate(startOfDay(date)),
                        userId: user.uid,
                        assignments: [...existingAssignments, newAssignment] 
                    }, { merge: true });
                });

                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const { startISO, endISO } = convertToISODateTime(date, timeSlot);
                
                await syncCalendarEvent({
                    summary: `Clase: ${selectedContract.clientName}`,
                    description: `Instructor: ${instructor}\nVehículo: ${vehicle}\nContrato: ${String(selectedContract.folioNumber).padStart(6, '0')}`,
                    start: { dateTime: startISO, timeZone },
                    end: { dateTime: endISO, timeZone },
                    vehicle,
                });

            } catch (error: any) {
                allSavesSuccessful = false;
                errors.push(error.message || `Error al guardar la clase ${index + 1}.`);
                
                if (error.code === 'permission-denied') {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: `vehicle_schedules/${dateId}`, operation: 'update',
                    }));
                }
            }
        }

        setIsSavingSchedule(false);

        if (allSavesSuccessful) {
            toast({
                title: 'Clases Agendadas y Sincronizadas',
                description: 'Las clases seleccionadas han sido guardadas y sincronizadas con Google Calendar.',
            });
            setIsScheduleModalOpen(false);
        } else {
            toast({
                variant: 'destructive',
                title: 'Ocurrieron Errores',
                description: <ul>{errors.map((e, i) => <li key={i}>- {e}</li>)}</ul>,
                duration: 10000,
            });
        }
    };


  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">{filter === 'overdue' ? 'Contratos por Cobrar' : 'Todos los Contratos'}</h1>
         <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por folio, cliente, tipo, cédula..."
            className="pl-8 sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      {isLoading && <p>Cargando contratos...</p>}
      {!isLoading && allContracts && (
        <>
            {filteredContracts.length > 0 ? (
                 <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Folio</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Certificado</TableHead>
                                <TableHead>Fecha de Creación</TableHead>
                                {filter === 'overdue' && <TableHead>Fecha de Cancelación</TableHead>}
                                {filter === 'overdue' && <TableHead>Antigüedad</TableHead>}
                                {filter === 'overdue' && <TableHead className="text-right">Monto Adeudado</TableHead>}
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredContracts.map((contract) => {
                                const isAnnulled = contract.status === 'expired';
                                const balance = getBalance(contract);
                                const paymentDeadline = getPaymentDeadline(contract);
                                
                                return (
                                <TableRow key={contract.id} className={cn(isAnnulled && 'bg-muted/50 hover:bg-muted/60')}>
                                    <TableCell className="font-medium text-primary">
                                        {String(contract.folioNumber || '').padStart(6, '0')}
                                    </TableCell>
                                    <TableCell>{contract.clientName}</TableCell>
                                    <TableCell>{contract.type}</TableCell>
                                    <TableCell>
                                        {isAnnulled ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Ban className="h-4 w-4" />
                                                <span>Anulado</span>
                                            </div>
                                        ) : contract.certificateGeneratedAt ? (
                                            <div className="flex items-center gap-2 text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Sí</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <XCircle className="h-4 w-4" />
                                                <span>No</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {format(toDate(contract.createdAt), 'dd/MM/yyyy', { locale: es })}
                                    </TableCell>
                                    {filter === 'overdue' && (
                                        <TableCell className='text-muted-foreground'>
                                            {paymentDeadline ? format(paymentDeadline, 'dd/MM/yyyy') : 'N/A'}
                                        </TableCell>
                                    )}
                                    {filter === 'overdue' && (
                                        <TableCell>
                                            {contract.debtInfo && (
                                                <Badge variant="outline" className={cn(ageCategoryColors[contract.debtInfo.category])}>
                                                    {contract.debtInfo.category}
                                                </Badge>
                                            )}
                                        </TableCell>
                                    )}
                                     {filter === 'overdue' && (
                                        <TableCell className="text-right font-semibold text-destructive">
                                            B/. {balance.toFixed(2)}
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="icon" title="Ver Contrato">
                                            <Link href={`/contracts/${contract.id}`}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Ver Contrato</span>
                                            </Link>
                                        </Button>
                                        <Button variant="ghost" size="icon" title="Generar Horario" onClick={() => handleOpenScheduleModal(contract)}>
                                            <CalendarClock className="h-4 w-4" />
                                            <span className="sr-only">Generar Horario</span>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                        {searchTerm ? 'No se encontraron contratos' : 'No hay contratos para mostrar'}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {searchTerm ? 'Intenta con otro término de búsqueda.' : (filter === 'overdue' ? 'No hay contratos por cobrar.' : 'Comienza creando un nuevo contrato para verlo aquí.')}
                    </p>
                </div>
            )}
        </>
      )}

      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>Agendar Clases Prácticas</DialogTitle>
                <DialogDescription>
                    Asigna un vehículo e instructor para las clases de <span className="font-semibold text-primary">{selectedContract?.clientName}</span>.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {schedulesToSync.length > 0 ? schedulesToSync.map((schedule, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border-b pb-4">
                        <div className="space-y-1">
                            <Label className="text-sm">Clase {index + 1} ({schedule.classType})</Label>
                            <p className="font-semibold text-base">{format(schedule.date, "PPP", { locale: es })}</p>
                            <p className="text-sm text-muted-foreground">{schedule.time}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Vehículo</Label>
                            <Select value={schedule.vehicle} onValueChange={(value) => handleScheduleItemChange(index, 'vehicle', value)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {VEHICLES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Instructor</Label>
                            <Select value={schedule.instructor} onValueChange={(value) => handleScheduleItemChange(index, 'instructor', value)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {INSTRUCTORS.map(i => <SelectItem key={i} value={i}>{i || 'Sin Asignar'}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-muted-foreground py-8">Este contrato no tiene clases prácticas definidas.</p>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsScheduleModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveSchedule} disabled={isSavingSchedule || schedulesToSync.length === 0}>
                    {isSavingSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar y Sincronizar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
