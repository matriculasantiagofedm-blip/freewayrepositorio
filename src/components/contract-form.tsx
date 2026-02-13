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
    Save, 
    DollarSign,
    GraduationCap,
    Clock,
    CalendarDays
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, doc, serverTimestamp, runTransaction, updateDoc } from 'firebase/firestore';
import { useDb, useUser } from './firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, VehicleName } from '@/lib/types';

const instructors: string[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const theoreticalSchedules = ['Semanal (8:00 am a 10:00 am)', 'Sabatino (3:00 pm a 5:00 pm)'];

const CATEGORY_PRICES_AMPLIACIONES: Record<string, number> = {
  'B': 57.00,
  'C': 57.00,
  'D': 57.00,
  'E1': 57.00,
  'E2': 75.00,
  'E3': 75.00,
  'F': 85.00,
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
        ...(initialContract.autoMotoDetails || initialContract.deluxeDetails || initialContract.ampliacionesDetails),
        paymentDeadline: (initialContract.autoMotoDetails || initialContract.deluxeDetails || initialContract.ampliacionesDetails)?.paymentDeadline ? toDate((initialContract.autoMotoDetails || initialContract.deluxeDetails || initialContract.ampliacionesDetails)?.paymentDeadline) : null,
        theoreticalClassDates: (initialContract.autoMotoDetails || initialContract.deluxeDetails)?.theoreticalClassDates?.map(d => d ? toDate(d) : null) || [],
        theoreticalClassDate: initialContract.ampliacionesDetails?.theoreticalClassDate ? toDate(initialContract.ampliacionesDetails.theoreticalClassDate) : null,
        practicalClassSchedules: (initialContract.autoMotoDetails?.practicalClassSchedules || []).map(s => ({ ...s, date: s.date ? toDate(s.date) : null })),
        motoPracticalClassSchedules: (initialContract.autoMotoDetails?.motoPracticalClassSchedules || []).map(s => ({ ...s, date: s.date ? toDate(s.date) : null })),
    } : {
        clientName: '', clientEmail: '', contractType, studentIdNumber: '', idType: 'C.I.P.', studentAddress: '', studentPhone1: '',
        courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash',
        vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual',
        licenseCategory: contractType === 'Curso Moto' ? 'A, B' : (contractType === 'Curso Auto' ? 'A, C' : ''),
        theoreticalClassDates: [], practicalClassSchedules: [], motoPracticalClassSchedules: [], theoreticalClassDate: null, theoreticalClassTime: '8:00 am a 10:00 am'
    },
  });

  const theorySessionCount = useMemo(() => {
    if (contractType === 'Curso Deluxe') return 10;
    if (contractType === 'Ampliaciones') return 0;
    const schedule = form.watch('theoreticalClassSchedule');
    if (schedule?.startsWith('Semanal')) return 4;
    if (schedule?.startsWith('Sabatino')) return 3;
    return 2;
  }, [contractType, form.watch('theoreticalClassSchedule')]);

  useEffect(() => {
    if (contractType === 'Ampliaciones') return;
    const currentDates = form.getValues('theoreticalClassDates') || [];
    if (currentDates.length !== theorySessionCount) {
        form.setValue('theoreticalClassDates', Array.from({ length: theorySessionCount }).map((_, i) => currentDates[i] || null));
    }
  }, [theorySessionCount, form, contractType]);

  const { replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { replace: replaceMoto } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  useEffect(() => {
    const plan = form.watch('coursePlan');
    if (!plan || initialContract || contractType === 'Ampliaciones') return;
    const allPkgs = [...autoPackages, ...motoPackages, ...mixtoPackages, ...deluxePackages, ...soloPracticaPackages];
    const currentPkg = allPkgs.find(p => p.id === plan);

    if (currentPkg) {
        form.setValue('courseValue', currentPkg.price);
        if (contractType !== 'Ampliaciones') {
            const count = Math.ceil((currentPkg.hours || 0) / 2);
            const slots = Array.from({ length: count }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: carVehicles[0], instructor: instructors[0] }));
            if (contractType === 'Curso Moto') { 
                replaceMoto(slots.map(s => ({ ...s, vehicle: motoVehicles[0] }))); 
                replacePractical([]); 
            }
            else if (contractType === 'Curso Mixto') {
                replacePractical(Array.from({ length: Math.ceil(count / 2) }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: carVehicles[0], instructor: instructors[0] })));
                replaceMoto(Array.from({ length: Math.floor(count / 2) }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: motoVehicles[0], instructor: instructors[0] })));
            } else { 
                replacePractical(slots); 
                replaceMoto([]); 
            }
        }
    }
  }, [form.watch('coursePlan'), contractType, initialContract, replacePractical, replaceMoto, form]);

  useEffect(() => {
    if (contractType !== 'Ampliaciones') return;
    
    const categories = form.watch('licenseCategory') || '';
    const selected = categories.split(',').map(c => c.trim()).filter(c => c).sort();
    const comboKey = selected.join(', ');

    const combos: Record<string, number> = {
      'D, E1': 85.00,
      'E1, E2': 75.00,
      'E1, E2, E3': 85.00,
      'E1, E2, E3, F': 95.00,
      'D, E1, E2, E3, F': 150.00,
      'B, E1, E2, E3, F': 150.00,
      'B, D, E1, E2, E3, F': 200.00,
    };

    if (combos[comboKey]) {
      form.setValue('courseValue', combos[comboKey]);
    } else {
      let total = 0;
      selected.forEach(cat => {
        total += CATEGORY_PRICES_AMPLIACIONES[cat] || 0;
      });
      form.setValue('courseValue', total);
    }
  }, [form.watch('licenseCategory'), contractType, form]);

  useEffect(() => {
    const val = form.watch('courseValue');
    const down = form.watch('downPayment');
    form.setValue('balance', Math.max(0, (val || 0) - (down || 0)));
  }, [form.watch('courseValue'), form.watch('downPayment'), form]);

  const categoriesToShow = useMemo(() => {
    if (contractType === 'Curso Auto') return ['A', 'C', 'D'];
    if (contractType === 'Curso Moto') return ['A', 'B'];
    if (contractType === 'Curso Mixto') return ['A', 'B', 'C', 'D'];
    return ['B', 'C', 'D', 'E1', 'E2', 'E3', 'F'];
  }, [contractType]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
        const deadline = values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null;
        const detailField = values.contractType === 'Curso Deluxe' ? 'deluxeDetails' : values.contractType === 'Ampliaciones' ? 'ampliacionesDetails' : 'autoMotoDetails';

        let details: any = { 
            idType: values.idType,
            studentIdNumber: values.studentIdNumber,
            studentAddress: values.studentAddress,
            studentPhone1: values.studentPhone1,
            studentPhone2: values.studentPhone2 || '',
            coursePlan: values.coursePlan,
            courseValue: values.courseValue,
            downPayment: values.downPayment,
            balance: values.balance,
            paymentDeadline: deadline,
            paymentType: values.paymentType,
            licenseCategory: values.licenseCategory,
        };

        if (values.contractType === 'Ampliaciones') {
            details.theoreticalClassDate = values.theoreticalClassDate ? Timestamp.fromDate(values.theoreticalClassDate) : null;
            details.theoreticalClassTime = values.theoreticalClassTime;
        } else {
            const theoryDates = values.theoreticalClassDates?.map(d => d ? Timestamp.fromDate(d) : null) || [];
            const practical = values.practicalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })) || [];
            const motoPractical = values.motoPracticalClassSchedules?.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })) || [];
            
            details = { 
                ...details,
                vehicleTransmission: values.vehicleTransmission,
                theoreticalClassSchedule: values.theoreticalClassSchedule,
                theoreticalClassDates: theoryDates,
                practicalClassSchedules: practical,
                motoPracticalClassSchedules: motoPractical
            };
        }

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
    } catch (error) { 
        console.error(error);
        toast({ variant: 'destructive', title: 'Error al procesar el contrato' }); 
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-primary shadow-md">
            <CardHeader className="bg-slate-50/50 border-b">
                <div className="flex items-center gap-2">
                    <UserCircle className="h-6 w-6 text-primary" />
                    <CardTitle className="text-lg">Datos del Estudiante</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold uppercase">Correo Electrónico</FormLabel><FormControl><Input {...field} type="email" className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-3 gap-2">
                        <FormField control={form.control} name="idType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold uppercase">ID</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="C.I.P.">C.I.P.</SelectItem>
                                        <SelectItem value="PASS">PASS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
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
            <CardHeader className="bg-blue-50/30 border-b">
                <div className="flex items-center gap-2">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                    <CardTitle className="text-lg">Financiamiento</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {contractType !== 'Ampliaciones' && (
                        <FormField control={form.control} name="coursePlan" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel className="text-xs font-bold uppercase">Plan de Curso</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {contractType === 'Curso Auto' && autoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                                        {contractType === 'Curso Moto' && motoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                                        {contractType === 'Curso Mixto' && mixtoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                                        {contractType === 'Curso Deluxe' && deluxePackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                                        {contractType === 'Curso Solo Practica' && soloPracticaPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label} - B/.{p.price}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="paymentType" render={({ field }) => (
                        <FormItem className={cn(contractType === 'Ampliaciones' && "md:col-span-3")}>
                            <FormLabel className="text-xs font-bold uppercase">Método Pago</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="cash">Efectivo</SelectItem>
                                    <SelectItem value="debit">T. Débito</SelectItem>
                                    <SelectItem value="credit">T. Crédito</SelectItem>
                                    <SelectItem value="bac">BAC</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                    <SelectItem value="cheques">Cheque</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border">
                    <FormField control={form.control} name="courseValue" render={({ field }) => (<FormItem><FormLabel className="text-xs opacity-70">Total</FormLabel><FormControl><Input {...field} type="number" step="0.01" className="h-10 font-bold" readOnly={contractType === 'Ampliaciones'} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="downPayment" render={({ field }) => (<FormItem><FormLabel className="text-xs text-green-700 font-bold">Abono</FormLabel><FormControl><Input {...field} type="number" step="0.01" className="h-10 font-bold" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="balance" render={({ field }) => (<FormItem><FormLabel className="text-xs text-red-700 font-bold">Saldo</FormLabel><FormControl><Input {...field} readOnly className="h-10 font-black text-red-600 bg-red-50" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Límite</FormLabel>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                                <FormControl><Button variant="outline" className="h-10 w-full">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        {contractType === 'Ampliaciones' ? (
            <Card className="border-t-4 border-t-amber-500 shadow-md">
                <CardHeader className="bg-amber-50/30 border-b">
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-6 w-6 text-amber-600" />
                        <CardTitle className="text-lg">Configuración del Trámite (Seleccione Categorías)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                    <div className="space-y-3">
                        <FormLabel className="text-xs font-bold uppercase text-amber-700">Categoría Licencia (Ampliación - Selección Múltiple)</FormLabel>
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {categoriesToShow.map(cat => {
                                const isSelected = form.watch('licenseCategory')?.includes(cat);
                                return (
                                    <Button 
                                        key={cat} 
                                        type="button" 
                                        variant={isSelected ? "default" : "outline"} 
                                        className={cn("h-10 font-bold text-xs flex flex-col items-center justify-center pt-1", isSelected && "bg-primary text-white")} 
                                        onClick={() => {
                                            const cur = form.getValues('licenseCategory') || '';
                                            const parts = cur.split(',').map(p => p.trim()).filter(p => p);
                                            const next = parts.includes(cat) ? parts.filter(p => p !== cat) : [...parts, cat].sort();
                                            form.setValue('licenseCategory', next.join(', '));
                                        }}
                                    >
                                        <span>{cat}</span>
                                        <span className="text-[8px] opacity-70">B/.{CATEGORY_PRICES_AMPLIACIONES[cat]}</span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-xl border border-dashed grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold uppercase flex items-center gap-2"><CalendarIcon className="h-3 w-3" /> Fecha de Clase Teórica</FormLabel>
                                <Popover modal={true}>
                                    <PopoverTrigger asChild>
                                        <FormControl><Button variant="outline" className="h-11 w-full bg-white">{field.value ? format(toDate(field.value), "PPP", { locale: es }) : "Seleccionar fecha..."}</Button></FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold uppercase flex items-center gap-2"><Clock className="h-3 w-3" /> Horario de Clase</FormLabel>
                                <FormControl><Input {...field} placeholder="Ej: 8:00 am a 10:00 am" className="h-11 bg-white" /></FormControl>
                            </FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>
        ) : (
            <Card className="border-t-4 border-t-primary shadow-md">
                <CardHeader className="bg-slate-50 border-b">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-primary" />
                        <CardTitle className="text-lg">Programación del Curso</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase font-bold">Transmisión del Vehículo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Automático">Automático</SelectItem>
                                        <SelectItem value="Manual">Manual</SelectItem>
                                        <SelectItem value="Moto">Moto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <div className="space-y-3">
                            <FormLabel className="text-xs font-bold uppercase">Categorías a Aplicar</FormLabel>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                {categoriesToShow.map(cat => {
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
                    </div>

                    <div className="bg-slate-50 p-6 rounded-xl border border-dashed">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <GraduationCap className="h-5 w-5" />
                                <h3 className="text-sm uppercase">Cronograma Teórico</h3>
                            </div>
                            <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                                <FormItem className="w-64">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Horario..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {theoreticalSchedules.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {Array.from({ length: theorySessionCount }).map((_, index) => (
                                <FormField key={index} control={form.control} name={`theoreticalClassDates.${index}`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] uppercase opacity-50 font-bold">Sesión {index + 1}</FormLabel>
                                        <Popover modal={true}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                  <Button variant="outline" className="h-10 text-xs w-full bg-white">
                                                    {field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}
                                                  </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )} />
                            ))}
                        </div>
                    </div>

                    {/* Práctica Auto */}
                    {form.watch('practicalClassSchedules') && form.watch('practicalClassSchedules')!.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-blue-600">
                          <Clock className="h-4 w-4" /> Práctica Auto
                        </h3>
                        {form.watch('practicalClassSchedules')?.map((_, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg bg-white shadow-sm">
                            <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field }) => (
                              <FormItem>
                                <Popover modal={true}>
                                  <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className="w-full h-9 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Clase " + (index+1)}</Button></FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} /></PopoverContent>
                                </Popover>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field }) => (
                              <FormItem><FormControl><Input {...field} className="h-9 text-xs" placeholder="Horario" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${index}.vehicle`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>{carVehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${index}.instructor`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>{instructors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Práctica Moto */}
                    {form.watch('motoPracticalClassSchedules') && form.watch('motoPracticalClassSchedules')!.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase flex items-center gap-2 text-orange-600">
                          <Clock className="h-4 w-4" /> Práctica Moto
                        </h3>
                        {form.watch('motoPracticalClassSchedules')?.map((_, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg bg-white shadow-sm">
                            <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.date`} render={({ field }) => (
                              <FormItem>
                                <Popover modal={true}>
                                  <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className="w-full h-9 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Clase " + (index+1)}</Button></FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} /></PopoverContent>
                                </Popover>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.time`} render={({ field }) => (
                              <FormItem><FormControl><Input {...field} className="h-9 text-xs" placeholder="Horario" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.vehicle`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>{motoVehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.instructor`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>{instructors.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                          </div>
                        ))}
                      </div>
                    )}
                </CardContent>
            </Card>
        )}

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {initialContract ? 'Actualizar Contrato' : 'Guardar Contrato'}
            </Button>
        </div>
      </form>
    </Form>
  );
}