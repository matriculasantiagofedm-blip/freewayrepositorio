'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
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
    Car, 
    Bike, 
    Save, 
    DollarSign,
    GraduationCap
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, doc, serverTimestamp, runTransaction, updateDoc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, InstructorName, VehicleName, ManualSchedule } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from './firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', ''];
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const practicalTimes = ['8:00am a 10:00am', '10:00am a 12:pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];
const theoreticalSchedules = [
    'Semanal (8:00 am a 10:00 am)', 
    'Sabatino (3:00 pm a 5:00 pm)'
];

const ALL_CATEGORIES = ['A', 'B', 'C', 'D', 'E1', 'E2', 'E3', 'F'];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
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

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico (8hrz)', price: 133.00, hours: 8 },
    { id: 'plus', label: 'Curso Auto Plus (10hrz)', price: 155.00, hours: 10 },
    { id: 'premium', label: 'Curso Auto Premium (12hrz)', price: 180.00, hours: 12 },
    { id: 'reforzamiento-4h', label: 'Reforzamiento 4hrs', price: 98.00, hours: 4 },
    { id: 'reforzamiento-2h', label: 'Reforzamiento Plus 2hrs', price: 75.00, hours: 2 },
    { id: 'evaluacion-estacionamiento', label: 'Evaluacion Estacionamiento (10 min)', price: 57.00, hours: 1 },
];

const motoPackages = [
    { id: 'moto-basico', label: 'Curso Moto Básico (8hrz)', price: 115.00, hours: 8 },
    { id: 'moto-plus', label: 'Curso Moto Plus (10hrz)', price: 135.00, hours: 10 },
    { id: 'moto-premium', label: 'Curso Moto Premium (12hrz)', price: 155.00, hours: 12 },
    { id: 'moto-evaluacion-estacionamiento', label: 'Moto Evaluacion Estacionamiento (10 min)', price: 57.00, hours: 1 },
];

const mixtoPackages = [
    { id: 'mixto-10h', label: 'Auto + Moto 10Hrs', price: 290.00, hours: 10 },
    { id: 'mixto-basico-am', label: 'Básico Auto + Moto', price: 153.00, hours: 8 },
    { id: 'mixto-plus-am', label: 'Plus Auto + Moto', price: 170.00, hours: 10 },
    { id: 'mixto-premium-am', label: 'Premium Auto + Moto', price: 195.00, hours: 12 },
];

const deluxePackages = [
    { id: 'deluxe-premium', label: 'Plan Premium (Deluxe)', price: 201.00, hours: 12 },
    { id: 'deluxe-full', label: 'Plan Deluxe Full', price: 270.00, hours: 16 },
];

const soloPracticaPackages = [
    { id: 'solo-basico-auto', label: 'Básico 8hrs (Auto)', price: 125.00, hours: 8 },
    { id: 'solo-basico-moto', label: 'Básico 8hrs (Moto)', price: 103.00, hours: 8 },
];

const contractSchema = z.object({
  clientName: z.string().min(1, 'El nombre es requerido.'),
  clientEmail: z.string().email('Email inválido.'),
  contractType: z.enum(['Curso Auto', 'Curso Moto', 'Curso Mixto', 'Curso Deluxe', 'Curso Solo Practica']),
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

export function ContractForm({ initialContract }: { initialContract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role: currentUserRole } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contractType: ContractType = useMemo(() => 
    initialContract?.type || (searchParams.get('type') as ContractType) || 'Curso Auto', 
  [initialContract, searchParams]);

  const form = useForm<FormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: initialContract ? {
        clientName: initialContract.clientName || '',
        clientEmail: initialContract.clientEmail || '',
        contractType: initialContract.type,
        ...(initialContract.autoMotoDetails || initialContract.deluxeDetails),
        paymentDeadline: (initialContract.autoMotoDetails || initialContract.deluxeDetails)?.paymentDeadline ? toDate((initialContract.autoMotoDetails || initialContract.deluxeDetails)?.paymentDeadline) : null,
        theoreticalClassDates: (initialContract.autoMotoDetails || initialContract.deluxeDetails)?.theoreticalClassDates?.map(d => d ? toDate(d) : null) || [],
        practicalClassSchedules: (initialContract.autoMotoDetails?.practicalClassSchedules || []).map(s => ({ ...s, date: s.date ? toDate(s.date) : null })),
        motoPracticalClassSchedules: (initialContract.autoMotoDetails?.motoPracticalClassSchedules || []).map(s => ({ ...s, date: s.date ? toDate(s.date) : null })),
    } : {
        clientName: '', clientEmail: '', contractType, studentIdNumber: '', idType: 'C.I.P.', studentAddress: '', studentPhone1: '',
        courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash',
        vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual',
        licenseCategory: contractType === 'Curso Moto' ? 'A, B' : 'A, C',
        theoreticalClassDates: [], practicalClassSchedules: [], motoPracticalClassSchedules: [],
    },
  });

  const activeContractsQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db, user]);
  const manualEntriesQuery = useMemoQuery(() => (db && user) ? collection(db, 'manual_schedules') : null, [db, user]);
  const { data: allContracts } = useCollection<Contract>(activeContractsQuery);
  const { data: manualEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

  const theorySessionCount = useMemo(() => {
    if (contractType === 'Curso Deluxe') return 10;
    const schedule = form.watch('theoreticalClassSchedule');
    if (schedule?.startsWith('Semanal')) return 4;
    if (schedule?.startsWith('Sabatino')) return 3;
    return 2;
  }, [contractType, form.watch('theoreticalClassSchedule')]);

  useEffect(() => {
    const currentDates = form.getValues('theoreticalClassDates') || [];
    if (currentDates.length !== theorySessionCount) {
        form.setValue('theoreticalClassDates', Array.from({ length: theorySessionCount }).map((_, i) => currentDates[i] || null));
    }
  }, [theorySessionCount, form]);

  const availabilityData = useMemo(() => {
    const vehicleOccupancy: Record<string, any[]> = {};
    const globalCounts: Record<string, number> = {};
    const process = (date: any, slot: string, vehicle: string, name: string) => {
        if (!date || !slot || !vehicle) return;
        const dObj = toDate(date);
        if (isNaN(dObj.getTime())) return;
        const dateKey = format(dObj, 'yyyy-MM-dd');
        const vKey = `${dateKey}|${slot}|${vehicle}`;
        if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
        vehicleOccupancy[vKey].push({ name });
    };
    manualEntries?.forEach(e => process(e.date, e.timeSlot, e.vehicle, e.studentName));
    allContracts?.forEach(c => {
      if (initialContract && c.id === initialContract.id) return;
      const proc = (slots: any[]) => slots.forEach(s => process(s.date, TIME_STRING_TO_SLOT_MAP[s.time] || s.time, s.vehicle, c.clientName));
      if (c.autoMotoDetails?.practicalClassSchedules) proc(c.autoMotoDetails.practicalClassSchedules);
      if (c.autoMotoDetails?.motoPracticalClassSchedules) proc(c.autoMotoDetails.motoPracticalClassSchedules);
      if (c.deluxeDetails?.classSchedules) proc(c.deluxeDetails.classSchedules);
    });
    Object.keys(vehicleOccupancy).forEach(vKey => {
        const [dateKey, slotId] = vKey.split('|');
        const sKey = `${dateKey}|${slotId}`;
        globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    });
    return { vehicleOccupancy, globalCounts };
  }, [allContracts, manualEntries, initialContract]);

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { fields: motoFields, replace: replaceMoto } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  useEffect(() => {
    const plan = form.watch('coursePlan');
    if (!plan || initialContract) return;
    let pkg = [...autoPackages, ...motoPackages, ...mixtoPackages, ...deluxePackages, ...soloPracticaPackages].find(p => p.id === plan);
    if (pkg) {
        form.setValue('courseValue', pkg.price);
        const count = Math.ceil((pkg.hours || 0) / 2);
        const slots = Array.from({ length: count }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' }));
        if (contractType === 'Curso Moto') { replaceMoto(slots); replacePractical([]); }
        else if (contractType === 'Curso Mixto') {
            replacePractical(Array.from({ length: Math.ceil(count / 2) }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' })));
            replaceMoto(Array.from({ length: Math.floor(count / 2) }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' })));
        } else { replacePractical(slots); replaceMoto([]); }
    }
  }, [form.watch('coursePlan'), contractType, initialContract, replacePractical, replaceMoto]);

  useEffect(() => {
    const val = form.watch('courseValue');
    const down = form.watch('downPayment');
    form.setValue('balance', Math.max(0, val - down));
  }, [form.watch('courseValue'), form.watch('downPayment')]);

  async function onSubmit(values: FormValues) {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
        const theoryDates = values.theoreticalClassDates?.map(d => d ? Timestamp.fromDate(d) : null) || [];
        const deadline = values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null;
        const practical = values.practicalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })) || [];
        const motoPractical = values.motoPracticalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })) || [];

        const details = { 
            idType: values.idType,
            studentIdNumber: values.studentIdNumber,
            studentAddress: values.studentAddress,
            studentPhone1: values.studentPhone1,
            studentPhone2: values.studentPhone2,
            coursePlan: values.coursePlan,
            courseValue: values.courseValue,
            downPayment: values.downPayment,
            balance: values.balance,
            paymentDeadline: deadline,
            paymentType: values.paymentType,
            vehicleTransmission: values.vehicleTransmission,
            licenseCategory: values.licenseCategory,
            theoreticalClassSchedule: values.theoreticalClassSchedule,
            theoreticalClassDates: theoryDates,
            practicalClassSchedules: practical,
            motoPracticalClassSchedules: motoPractical
        };

        const detailField = values.contractType === 'Curso Deluxe' ? 'deluxeDetails' : 'autoMotoDetails';

        if (initialContract) {
            const contractRef = doc(db, 'contracts', initialContract.id);
            await updateDoc(contractRef, { 
                clientName: values.clientName, 
                clientEmail: values.clientEmail, 
                [detailField]: details, 
                updatedAt: serverTimestamp() 
            });
            toast({ title: 'Contrato Actualizado' }); 
            router.push(`/contracts/${initialContract.id}`);
        } else {
            const cid = await runTransaction(db, async (t) => {
                const cRef = doc(db, 'counters', 'contract_folio');
                const cSnap = await t.get(cRef);
                const newFolio = (cSnap.exists() ? cSnap.data().count : 0) + 1;
                const nRef = doc(collection(db, 'contracts'));
                const data = { 
                    id: nRef.id, 
                    folioNumber: newFolio, 
                    title: values.contractType, 
                    clientName: values.clientName, 
                    clientEmail: values.clientEmail, 
                    clientId: 'temp_id', 
                    type: values.contractType, 
                    status: 'active', 
                    userId: user.uid, 
                    createdAt: serverTimestamp(), 
                    createdBy: currentUserRole || 'Sistema', 
                    [detailField]: details 
                };
                t.set(nRef, data); 
                t.set(cRef, { count: newFolio }, { merge: true });
                return nRef.id;
            });
            toast({ title: 'Contrato Creado' }); 
            router.push(`/contracts/${cid}`);
        }
    } catch (e) { 
        console.error(e);
        toast({ variant: 'destructive', title: 'Error al procesar el contrato' }); 
    } finally { 
        setIsSubmitting(false); 
    }
  }

  const ClassSlotGrid = ({ fields, namePrefix, availableVehicles, title, Icon, form, availabilityData }: any) => {
    if (fields.length === 0) return null;
    const { vehicleOccupancy, globalCounts } = availabilityData;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
                <Icon className="h-5 w-5" />
                <h3 className="text-sm uppercase tracking-wider">{title}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map((field: any, index: number) => {
                    const watchDate = form.watch(`${namePrefix}.${index}.date`);
                    const watchTime = form.watch(`${namePrefix}.${index}.time`);
                    const watchVehicle = form.watch(`${namePrefix}.${index}.vehicle`);
                    const dObj = toDate(watchDate);
                    const isValidDate = !isNaN(dObj.getTime());
                    const holiday = isValidDate ? isPanamaHoliday(dObj) : null;
                    const isSunday = isValidDate && dObj.getDay() === 0;
                    
                    let conflictStudents: any[] = [];
                    let isFull = false;
                    let capacity = 3;

                    if (isValidDate && watchTime) {
                        const dateKey = format(dObj, 'yyyy-MM-dd');
                        const slotId = TIME_STRING_TO_SLOT_MAP[watchTime] || watchTime;
                        if (watchVehicle) conflictStudents = vehicleOccupancy[`${dateKey}|${slotId}|${watchVehicle}`] || [];
                        capacity = getGlobalCapacity(dObj, slotId);
                        isFull = (globalCounts[`${dateKey}|${slotId}`] || 0) >= capacity;
                    }

                    const hasConflict = conflictStudents.length > 0;

                    return (
                        <div key={field.id} className={cn(
                            "p-4 border rounded-xl bg-slate-50/50 relative shadow-sm transition-all",
                            (hasConflict || isFull || holiday || isSunday) && "border-amber-500 bg-amber-50/30"
                        )}>
                            <div className="absolute -top-2 right-2 flex gap-1 z-10">
                                {isSunday && <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">DOMINGO</div>}
                                {holiday && !isSunday && <div className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">FERIADO</div>}
                                {hasConflict && !holiday && !isSunday && <div className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">OCUPADO</div>}
                                {isFull && !hasConflict && !holiday && !isSunday && <div className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase">LLENO</div>}
                            </div>
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full w-fit uppercase">Clase Práctica #{index + 1}</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={form.control} name={`${namePrefix}.${index}.date`} render={({ field: f }) => (
                                        <FormItem><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-9 text-xs w-full justify-start font-normal bg-white"><CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />{f.value ? format(toDate(f.value), "dd/MM/yy") : "Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`${namePrefix}.${index}.time`} render={({ field: f }) => (
                                        <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-9 text-xs bg-white"><SelectValue placeholder="Turno" /></SelectTrigger></FormControl><SelectContent>{practicalTimes.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`${namePrefix}.${index}.vehicle`} render={({ field: f }) => (
                                        <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-9 text-xs bg-white"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl><SelectContent>{availableVehicles.map((v: string) => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`${namePrefix}.${index}.instructor`} render={({ field: f }) => (
                                        <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-9 text-xs bg-white"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl><SelectContent>{instructors.filter(Boolean).map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}</Select></FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="bg-slate-50/50 border-b"><div className="flex items-center gap-2"><UserCircle className="h-6 w-6 text-primary" /><CardTitle className="text-lg">Datos del Estudiante</CardTitle></div></CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Correo Electrónico</FormLabel><FormControl><Input {...field} type="email" className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-3 gap-2">
                        <FormField control={form.control} name="idType" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">ID</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="PASS">PASS</SelectItem></Select></FormItem>)} />
                        <FormField control={form.control} name="studentIdNumber" render={({ field }) => (<FormItem className="col-span-2"><FormLabel className="text-xs font-bold uppercase">Número</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="studentAddress" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Dirección</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="studentPhone1" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Teléfono 1</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="studentPhone2" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Teléfono 2</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>)} />
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-600 shadow-md">
            <CardHeader className="bg-blue-50/30 border-b"><div className="flex items-center gap-2"><DollarSign className="h-6 w-6 text-blue-600" /><CardTitle className="text-lg">Financiamiento</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="coursePlan" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel className="text-xs font-bold uppercase">Plan de Curso</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>
                            {contractType === 'Curso Auto' && autoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                            {contractType === 'Curso Moto' && motoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                            {contractType === 'Curso Mixto' && mixtoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                            {contractType === 'Curso Deluxe' && deluxePackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                            {contractType === 'Curso Solo Practica' && soloPracticaPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                        </Select></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="paymentType" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Método Pago</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">T. Débito</SelectItem><SelectItem value="credit">T. Crédito</SelectItem><SelectItem value="bac">BAC</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="cheques">Cheque</SelectItem></Select></FormControl></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border">
                    <FormField control={form.control} name="courseValue" render={({ field }) => (<FormItem><FormLabel className="text-xs opacity-70">Total</FormLabel><FormControl><Input {...field} type="number" step="0.01" className="h-10 font-bold" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="downPayment" render={({ field }) => (<FormItem><FormLabel className="text-xs text-green-700 font-bold">Abono</FormLabel><FormControl><Input {...field} type="number" step="0.01" className="h-10 font-bold" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="balance" render={({ field }) => (<FormItem><FormLabel className="text-xs text-red-700 font-bold">Saldo</FormLabel><FormControl><Input {...field} readOnly className="h-10 font-black text-red-600 bg-red-50" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Límite</FormLabel>
                        <Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-10 w-full">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} /></PopoverContent></Popover>
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        <Card className="border-t-4 border-t-amber-500 shadow-md">
            <CardHeader className="bg-amber-50/30 border-b"><div className="flex items-center gap-2"><Settings2 className="h-6 w-6 text-amber-600" /><CardTitle className="text-lg">Configuración del Trámite</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase">Transmisión</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem><SelectItem value="Moto">Moto</SelectItem></Select></FormControl></FormItem>)} />
                            <FormField control={form.control} name="licenseCategory" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase">Categoría Manual</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl></FormItem>)} />
                        </div>
                        <div className="space-y-3">
                            <FormLabel className="text-xs font-bold uppercase text-amber-700">Categoría Licencia</FormLabel>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                {ALL_CATEGORIES.map(cat => {
                                    const isSelected = form.watch('licenseCategory')?.includes(cat);
                                    return (
                                        <Button key={cat} type="button" variant={isSelected ? "default" : "outline"} className={cn("h-10 font-bold text-xs", isSelected && "bg-primary text-white")} onClick={() => {
                                            const cur = form.getValues('licenseCategory') || '';
                                            const parts = cur.split(',').map(p => p.trim()).filter(p => p);
                                            const next = parts.includes(cat) ? parts.filter(p => p !== cat) : [...parts, cat].sort();
                                            form.setValue('licenseCategory', next.join(', '));
                                        }}>{cat}</Button>
                                    );
                                })}
                            </div>
                        </div>
                        <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Horario Teórico</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{theoreticalSchedules.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</Select></FormControl></FormItem>)} />
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-dashed">
                    <div className="flex items-center gap-2 text-amber-700 font-bold mb-4"><GraduationCap className="h-5 w-5" /><h3 className="text-sm uppercase">Sesiones Teóricas ({theorySessionCount})</h3></div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Array.from({ length: theorySessionCount }).map((_, index) => (
                            <FormField key={index} control={form.control} name={`theoreticalClassDates.${index}`} render={({ field }) => (
                                <FormItem><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-10 text-xs w-full bg-white">{field.value ? format(toDate(field.value), "dd/MM") : "---"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                            )} />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="space-y-6">
            <ClassSlotGrid fields={practicalFields} namePrefix="practicalClassSchedules" availableVehicles={carVehicles} title="Clases de Auto" Icon={Car} form={form} availabilityData={availabilityData} />
            <ClassSlotGrid fields={motoFields} namePrefix="motoPracticalClassSchedules" availableVehicles={motoVehicles} title="Clases de Moto" Icon={Bike} form={form} availabilityData={availabilityData} />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4 sticky bottom-0 bg-background/95 backdrop-blur p-4 z-50 border-t shadow-lg">
            <Button type="submit" disabled={isSubmitting} size="lg" className="flex-1 h-14 text-lg font-bold">
                {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Save className="mr-2 h-6 w-6" />}
                {initialContract ? 'Guardar Cambios' : 'Generar Contrato'}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-14" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </Form>
  );
}
