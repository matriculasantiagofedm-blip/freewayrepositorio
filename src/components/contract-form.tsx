'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
    CalendarIcon, 
    Loader2, 
    UserCircle, 
    Settings2, 
    Save, 
    DollarSign,
    Clock,
    CalendarDays,
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, doc, serverTimestamp, runTransaction, query, where } from 'firebase/firestore';
import { useDb, useUser } from './firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';
import type { Contract, VehicleName, ManualSchedule } from '@/lib/types';

const instructors = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const practicalTimeSlots = ['8:00am a 10:00am', '10:00am a 12:00pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];

const TIME_STRING_TO_SLOT_MAP: Record<string, string> = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
};

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico (8hrz)', price: 133.00, hours: 8 },
    { id: 'plus', label: 'Curso Auto Plus (10hrz)', price: 155.00, hours: 10 },
    { id: 'premium', label: 'Curso Auto Premium (12hrz)', price: 180.00, hours: 12 },
];

const motoPackages = [
    { id: 'moto-basico', label: 'Curso Moto Básico (8hrz)', price: 115.00, hours: 8 },
    { id: 'moto-plus', label: 'Curso Moto Plus (10hrz)', price: 135.00, hours: 10 },
];

const mixtoPackages = [
    { id: 'mixto-10h', label: 'Auto + Moto 10Hrs', price: 290.00, hours: 10 },
];

const calculateAmpliacionPrice = (cats: string[]) => {
  const s = new Set(cats.map(c => c.toUpperCase()));
  if (s.has('B') && s.has('D') && s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 200;
  if (s.has('B') && s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 150;
  if (s.has('D') && s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 150;
  if (s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 95;
  if (s.has('E1') && s.has('E2') && s.has('E3')) return 85;
  if (s.has('D') && s.has('E1')) return 85;
  if (s.has('E1') && s.has('E2')) return 75;

  let total = 0;
  s.forEach(c => {
    if (['B', 'C', 'D', 'E1'].includes(c)) total += 57;
    else if (['E2', 'E3'].includes(c)) total += 75;
    else if (c === 'F') total += 85;
  });
  return total;
};

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); 
    if (day === 0) return 0; 
    if (slotId === '8am-10am' && (day >= 2 && day <= 5)) return 2;
    if (day === 6 && slotId === '3pm-5pm') return 2;
    return 3;
};

const contractSchema = z.object({
  clientName: z.string().min(1, 'El nombre es requerido.'),
  clientEmail: z.string().email('Email inválido.'),
  contractType: z.enum(['Curso Auto', 'Curso Moto', 'Curso Mixto', 'Curso Deluxe', 'Curso Solo Practica', 'Ampliaciones']),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
  studentAddress: z.string().min(1, 'La dirección es requerida.'),
  studentPhone1: z.string().min(1, 'El teléfono es requerido.'),
  studentPhone2: z.string().optional(),
  coursePlan: z.string().optional(),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional().nullable(),
  paymentType: z.string().default('cash'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.string().optional(),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().nullable()).optional(),
  theoreticalClassDate: z.date().optional().nullable(),
  theoreticalClassTime: z.string().optional(),
  practicalClassSchedules: z.array(z.object({ 
    date: z.date().nullable().optional(), 
    time: z.string().optional(), 
    vehicle: z.string().optional(), 
    instructor: z.string().optional() 
  })).optional(),
  motoPracticalClassSchedules: z.array(z.object({ 
    date: z.date().nullable().optional(), 
    time: z.string().optional(), 
    vehicle: z.string().optional(), 
    instructor: z.string().optional() 
  })).optional(),
});

type FormValues = z.infer<typeof contractSchema>;

const ClassRow = ({ 
    index, 
    namePrefix, 
    vehicles, 
    form, 
    occupancyData 
}: { 
    index: number, 
    namePrefix: "practicalClassSchedules" | "motoPracticalClassSchedules", 
    vehicles: string[],
    form: UseFormReturn<FormValues>,
    occupancyData: any
}) => {
    const watchDate = form.watch(`${namePrefix}.${index}.date`);
    const watchTime = form.watch(`${namePrefix}.${index}.time`);
    const watchVehicle = form.watch(`${namePrefix}.${index}.vehicle`);
    
    const dObj = watchDate ? toDate(watchDate) : null;
    const isValidDate = dObj && !isNaN(dObj.getTime());
    const holiday = isValidDate ? isPanamaHoliday(dObj) : null;
    const isSunday = isValidDate && dObj.getDay() === 0;
    
    let isOccupied = false;
    let isFull = false;

    if (isValidDate && watchTime) {
        const slotId = TIME_STRING_TO_SLOT_MAP[watchTime] || watchTime;
        const dateKey = format(dObj, 'yyyy-MM-dd');
        
        if (watchVehicle) {
            isOccupied = (occupancyData.vehicleOccupancy[`${dateKey}|${slotId}|${watchVehicle}`] || []).length > 0;
        }
        
        const capacity = getGlobalCapacity(dObj, slotId);
        const currentCount = occupancyData.globalCounts[`${dateKey}|${slotId}`] || 0;
        isFull = currentCount >= capacity && capacity > 0;
    }

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg bg-white relative", (isOccupied || isFull || holiday || isSunday) && "border-amber-500 bg-amber-50/30")}>
            <div className="absolute -top-2 right-2 flex gap-1 z-10">
                {isSunday && <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase">DOMINGO</span>}
                {holiday && !isSunday && <span className="bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase">FERIADO</span>}
                {isOccupied && <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase">OCUPADO</span>}
                {isFull && !isOccupied && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase">LLENO</span>}
            </div>
            <FormField control={form.control} name={`${namePrefix}.${index}.date`} render={({ field }) => (
                <FormItem>
                    <Popover modal={true}>
                        <PopoverTrigger asChild>
                            <FormControl><Button variant="outline" className="w-full h-9 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                </FormItem>
            )} />
            <FormField control={form.control} name={`${namePrefix}.${index}.time`} render={({ field }) => (
                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Horario" /></SelectTrigger></FormControl><SelectContent>{practicalTimeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name={`${namePrefix}.${index}.vehicle`} render={({ field }) => (
                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl><SelectContent>{vehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name={`${namePrefix}.${index}.instructor`} render={({ field }) => (
                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl><SelectContent>{instructors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />
        </div>
    );
};

export function ContractForm({ initialContract }: { initialContract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const activeContractsQuery = useMemoQuery(() => db ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db]);
  const manualSchedulesQuery = useMemoQuery(() => db ? collection(db, 'manual_schedules') : null, [db]);
  
  const { data: allActiveContracts } = useCollection<Contract>(activeContractsQuery);
  const { data: allManualSchedules } = useCollection<ManualSchedule>(manualSchedulesQuery);

  const availabilityData = useMemo(() => {
    const vehicleOccupancy: Record<string, string[]> = {};
    const globalCounts: Record<string, number> = {};

    const process = (date: any, time: string, vehicle: string, contractId?: string) => {
        if (!date || !time || !vehicle) return;
        if (initialContract && contractId === initialContract.id) return;
        const dObj = toDate(date);
        if (isNaN(dObj.getTime())) return;
        const dateKey = format(dObj, 'yyyy-MM-dd');
        const slotId = TIME_STRING_TO_SLOT_MAP[time] || time;
        const key = `${dateKey}|${slotId}|${vehicle}`;
        if (!vehicleOccupancy[key]) vehicleOccupancy[key] = [];
        vehicleOccupancy[key].push('busy');
    };

    allActiveContracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        if (!d) return;
        [...(d.practicalClassSchedules || []), ...(d.motoPracticalClassSchedules || []), ...((d as any).classSchedules || [])].forEach(s => process(s.date, s.time, s.vehicle, c.id));
    });
    allManualSchedules?.forEach(m => {
        if (m.classType === 'Práctica') process(m.date, m.timeSlot, m.vehicle);
    });

    Object.keys(vehicleOccupancy).forEach(vKey => {
        const [dateKey, slotId] = vKey.split('|');
        const sKey = `${dateKey}|${slotId}`;
        globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    });

    return { vehicleOccupancy, globalCounts };
  }, [allActiveContracts, allManualSchedules, initialContract]);

  const form = useForm<FormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: initialContract ? {
      clientName: initialContract.clientName,
      clientEmail: initialContract.clientEmail,
      contractType: initialContract.type,
      idType: initialContract.autoMotoDetails?.idType || initialContract.deluxeDetails?.idType || initialContract.ampliacionesDetails?.idType || 'C.I.P.',
      studentIdNumber: initialContract.autoMotoDetails?.studentIdNumber || initialContract.deluxeDetails?.studentIdNumber || initialContract.ampliacionesDetails?.studentIdNumber || '',
      studentAddress: initialContract.autoMotoDetails?.studentAddress || initialContract.deluxeDetails?.studentAddress || initialContract.ampliacionesDetails?.studentAddress || '',
      studentPhone1: initialContract.autoMotoDetails?.studentPhone1 || initialContract.deluxeDetails?.studentPhone1 || initialContract.ampliacionesDetails?.studentPhone1 || '',
      studentPhone2: initialContract.autoMotoDetails?.studentPhone2 || initialContract.deluxeDetails?.studentPhone2 || initialContract.ampliacionesDetails?.studentPhone2 || '',
      coursePlan: initialContract.autoMotoDetails?.coursePlan || '',
      courseValue: initialContract.autoMotoDetails?.courseValue || initialContract.deluxeDetails?.courseValue || initialContract.ampliacionesDetails?.courseValue || 0,
      downPayment: initialContract.autoMotoDetails?.downPayment || initialContract.deluxeDetails?.downPayment || initialContract.ampliacionesDetails?.downPayment || 0,
      balance: initialContract.autoMotoDetails?.balance || initialContract.deluxeDetails?.balance || initialContract.ampliacionesDetails?.balance || 0,
      paymentDeadline: initialContract.autoMotoDetails?.paymentDeadline ? toDate(initialContract.autoMotoDetails.paymentDeadline) : null,
      paymentType: initialContract.autoMotoDetails?.paymentType || initialContract.deluxeDetails?.paymentType || initialContract.ampliacionesDetails?.paymentType || 'cash',
      vehicleTransmission: initialContract.autoMotoDetails?.vehicleTransmission || initialContract.deluxeDetails?.vehicleTransmission || 'Automático',
      licenseCategory: initialContract.autoMotoDetails?.licenseCategory || initialContract.deluxeDetails?.licenseCategory || initialContract.ampliacionesDetails?.licenseCategory || '',
      theoreticalClassSchedule: initialContract.autoMotoDetails?.theoreticalClassSchedule || initialContract.deluxeDetails?.theoreticalClassSchedule || '',
      theoreticalClassDates: initialContract.autoMotoDetails?.theoreticalClassDates?.map(d => toDate(d)) || initialContract.deluxeDetails?.theoreticalClasses?.map(d => toDate(d)) || [],
      theoreticalClassDate: initialContract.ampliacionesDetails?.theoreticalClassDate ? toDate(initialContract.ampliacionesDetails.theoreticalClassDate) : null,
      theoreticalClassTime: initialContract.ampliacionesDetails?.theoreticalClassTime || '',
      practicalClassSchedules: initialContract.autoMotoDetails?.practicalClassSchedules?.map(s => ({ ...s, date: toDate(s.date) })) || initialContract.deluxeDetails?.classSchedules?.map(s => ({ ...s, date: toDate(s.date) })) || [],
      motoPracticalClassSchedules: initialContract.autoMotoDetails?.motoPracticalClassSchedules?.map(s => ({ ...s, date: toDate(s.date) })) || [],
    } : {
      contractType: (searchParams.get('type') as any) || 'Curso Auto',
      theoreticalClassDates: [],
      practicalClassSchedules: [],
      motoPracticalClassSchedules: [],
      courseValue: 0, downPayment: 0, balance: 0,
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { fields: motoPracticalFields, replace: replaceMotoPractical } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  const watchType = form.watch('contractType');
  const watchPlan = form.watch('coursePlan');
  const watchCats = form.watch('licenseCategory');
  const watchDown = form.watch('downPayment');
  const watchValue = form.watch('courseValue');

  useEffect(() => {
    if (!initialContract) {
        if (watchType === 'Curso Auto') {
            const pkg = autoPackages.find(p => p.id === watchPlan);
            if (pkg) {
                form.setValue('courseValue', pkg.price);
                const classes = Array.from({ length: pkg.hours / 2 }).map(() => ({ date: null, time: '', vehicle: '', instructor: '' }));
                replacePractical(classes);
                form.setValue('theoreticalClassDates', [null, null]);
            }
        } else if (watchType === 'Curso Moto') {
            const pkg = motoPackages.find(p => p.id === watchPlan);
            if (pkg) {
                form.setValue('courseValue', pkg.price);
                const classes = Array.from({ length: pkg.hours / 2 }).map(() => ({ date: null, time: '', vehicle: '', instructor: '' }));
                replacePractical(classes);
                form.setValue('theoreticalClassDates', [null]);
            }
        } else if (watchType === 'Curso Mixto') {
            const pkg = mixtoPackages.find(p => p.id === watchPlan);
            if (pkg) {
                form.setValue('courseValue', pkg.price);
                replacePractical(Array.from({ length: 3 }).map(() => ({ date: null, time: '', vehicle: '', instructor: '' })));
                replaceMotoPractical(Array.from({ length: 2 }).map(() => ({ date: null, time: '', vehicle: '', instructor: '' })));
                form.setValue('theoreticalClassDates', [null, null]);
            }
        } else if (watchType === 'Ampliaciones') {
            const cats = watchCats ? watchCats.split(',').map(c => c.trim()).filter(c => c) : [];
            form.setValue('courseValue', calculateAmpliacionPrice(cats));
        }
    }
  }, [watchType, watchPlan, watchCats, replacePractical, replaceMotoPractical, form, initialContract]);

  useEffect(() => {
    form.setValue('balance', Math.max(0, watchValue - watchDown));
  }, [watchValue, watchDown, form]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        let folio = initialContract?.folioNumber || 0;
        if (!initialContract) {
            const counterRef = doc(db, 'counters', 'contract_folio');
            const counterDoc = await transaction.get(counterRef);
            folio = counterDoc.exists() ? counterDoc.data().count + 1 : 1;
            transaction.set(counterRef, { count: folio }, { merge: true });
        }

        const contractId = initialContract?.id || doc(collection(db, 'contracts')).id;
        const contractRef = doc(db, 'contracts', contractId);

        const baseData = {
            id: contractId,
            folioNumber: folio,
            title: values.contractType,
            clientName: values.clientName,
            clientEmail: values.clientEmail,
            clientId: values.studentIdNumber,
            type: values.contractType,
            status: initialContract?.status || 'active',
            userId: user.uid,
            createdBy: initialContract?.createdBy || role || 'Sistema',
            updatedAt: serverTimestamp(),
        };

        const details: any = {
            idType: values.idType,
            studentIdNumber: values.studentIdNumber,
            studentAddress: values.studentAddress,
            studentPhone1: values.studentPhone1,
            studentPhone2: values.studentPhone2,
            courseValue: values.courseValue,
            downPayment: values.downPayment,
            balance: values.balance,
            paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
            paymentType: values.paymentType,
            licenseCategory: values.licenseCategory,
            vehicleTransmission: values.vehicleTransmission,
        };

        const finalData: any = { ...baseData };

        if (values.contractType === 'Ampliaciones') {
            finalData.ampliacionesDetails = {
                ...details,
                theoreticalClassDate: values.theoreticalClassDate ? Timestamp.fromDate(values.theoreticalClassDate) : null,
                theoreticalClassTime: values.theoreticalClassTime,
            };
        } else if (values.contractType === 'Curso Deluxe') {
            finalData.deluxeDetails = {
                ...details,
                theoreticalClassSchedule: values.theoreticalClassSchedule,
                theoreticalClasses: values.theoreticalClassDates?.map(d => d ? Timestamp.fromDate(d) : null),
                classSchedules: values.practicalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })),
            };
        } else {
            finalData.autoMotoDetails = {
                ...details,
                coursePlan: values.coursePlan,
                theoreticalClassSchedule: values.theoreticalClassSchedule,
                theoreticalClassDates: values.theoreticalClassDates?.map(d => d ? Timestamp.fromDate(d) : null),
                practicalClassSchedules: values.practicalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })),
                motoPracticalClassSchedules: values.motoPracticalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })),
            };
        }

        if (!initialContract) {
            finalData.createdAt = serverTimestamp();
            transaction.set(contractRef, finalData);
        } else {
            transaction.update(contractRef, finalData);
        }
      });

      toast({ title: initialContract ? 'Contrato Actualizado' : 'Contrato Creado' });
      router.push('/dashboard');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold uppercase tracking-wide">Datos del Estudiante</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4 pt-6">
                <div className="md:col-span-3">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="md:col-span-3">
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel><FormControl><Input type="email" {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <div className="md:col-span-1">
                    <FormField control={form.control} name="idType" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Tipo ID</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="PASS">PASS</SelectItem></SelectContent></Select></FormItem>
                    )} />
                </div>
                <div className="md:col-span-2">
                    <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Identificación</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="md:col-span-3">
                    <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono Principal</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <div className="md:col-span-6">
                    <FormField control={form.control} name="studentAddress" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Dirección Residencial</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold uppercase tracking-wide">Configuración del Trámite</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                <FormField control={form.control} name="contractType" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs uppercase font-bold">Tipo de Contrato</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!!initialContract}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Curso Auto">Curso Auto</SelectItem><SelectItem value="Curso Moto">Curso Moto</SelectItem><SelectItem value="Curso Mixto">Curso Mixto</SelectItem><SelectItem value="Curso Deluxe">Curso Deluxe</SelectItem><SelectItem value="Curso Solo Practica">Curso Solo Practica</SelectItem><SelectItem value="Ampliaciones">Ampliaciones</SelectItem></Select></FormControl></FormItem>
                )} />

                {watchType !== 'Ampliaciones' && watchType !== 'Curso Solo Practica' && (
                    <FormField control={form.control} name="coursePlan" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs uppercase font-bold">Plan de Curso</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger></FormControl><SelectContent>
                            {watchType === 'Curso Auto' && autoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                            {watchType === 'Curso Moto' && motoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                            {watchType === 'Curso Mixto' && mixtoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                            {watchType === 'Curso Deluxe' && <><SelectItem value="premium-12">Deluxe Premium (12 semanas)</SelectItem><SelectItem value="full-16">Deluxe Full (16 semanas)</SelectItem></>}
                        </SelectContent></Select></FormItem>
                    )} />
                )}

                <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs uppercase font-bold">Categorías</FormLabel><FormControl><Input placeholder={watchType === 'Curso Auto' ? 'Ej: A, C, D' : 'Ej: A, C'} {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs uppercase font-bold">Transmisión</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem><SelectItem value="Moto">Solo Moto</SelectItem></Select></FormControl></FormItem>
                )} />
            </CardContent>
        </Card>

        {watchType !== 'Ampliaciones' && (
            <Card className="shadow-md">
                <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-bold uppercase tracking-wide">Agenda de Clases</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                    {watchType !== 'Curso Solo Practica' && (
                        <div className="space-y-4">
                            <FormLabel className="text-primary font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><CalendarDays className="h-3 w-3" /> Clases Teóricas</FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Horario Teórico</FormLabel><FormControl><Input placeholder="Ej: Lunes y Martes 6-8pm" {...field} className="h-9" /></FormControl></FormItem>
                                )} />
                                {form.watch('theoreticalClassDates')?.map((_, i) => (
                                    <FormField key={i} control={form.control} name={`theoreticalClassDates.${i}`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Sesión {i + 1}</FormLabel>
                                            <Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-9 text-xs">{field.value ? format(toDate(field.value), "PPP", { locale: es }) : "Elegir Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                                        </FormItem>
                                    )} />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <FormLabel className="text-primary font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Clock className="h-3 w-3" /> Clases Prácticas</FormLabel>
                        <div className="grid grid-cols-1 gap-4">
                            {practicalFields.map((field, i) => (
                                <div key={field.id} className="space-y-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">CLASE #{i + 1} {watchType === 'Curso Mixto' ? '(AUTO)' : ''}</p>
                                    <ClassRow index={i} namePrefix="practicalClassSchedules" vehicles={carVehicles} form={form} occupancyData={availabilityData} />
                                </div>
                            ))}
                            {watchType === 'Curso Mixto' && motoPracticalFields.map((field, i) => (
                                <div key={field.id} className="space-y-2">
                                    <p className="text-[9px] font-black text-orange-600 uppercase tracking-tighter">CLASE #{i + 1} (MOTO)</p>
                                    <ClassRow index={i} namePrefix="motoPracticalClassSchedules" vehicles={motoVehicles} form={form} occupancyData={availabilityData} />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        {watchType === 'Ampliaciones' && (
            <Card className="shadow-md">
                <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><CardTitle className="text-base font-bold uppercase">Sesión Teórica (Ampliación)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                    <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold">Fecha de Clase</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-9 text-xs">{field.value ? format(toDate(field.value), "PPP", { locale: es }) : "Elegir Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></FormItem>
                    )} />
                    <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold">Horario</FormLabel><FormControl><Input placeholder="Ej: 8:00 am" {...field} className="h-9" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>
        )}

        <Card className="shadow-md border-b-4 border-b-primary/20">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold uppercase tracking-wide">Información de Pago</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-6">
                <FormField control={form.control} name="courseValue" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Valor Total (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-9" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="downPayment" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Abono inicial (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-9 font-bold text-green-700" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="balance" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Saldo (B/.)</FormLabel><FormControl><Input type="number" step="0.01" className="bg-muted font-black text-destructive h-9" readOnly {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Límite Saldo</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-9 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></FormItem>
                )} />
                <FormField control={form.control} name="paymentType" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Método</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">Tarjeta Débito</SelectItem><SelectItem value="credit">Tarjeta Crédito</SelectItem><SelectItem value="bac">BAC</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="cheques">Cheque</SelectItem></Select></FormControl></FormItem>
                )} />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" size="lg" className="px-12 h-12 text-base font-bold shadow-lg" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {initialContract ? 'Actualizar Contrato' : 'Generar Contrato'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
