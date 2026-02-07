'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
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
import { CalendarIcon, Loader2, Calculator, UserCircle, Settings2, Clock, BookOpen, Car, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ContractType, InstructorName, VehicleName } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from './firebase-provider';

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', ''];
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const practicalTimes = ['8:00am a 10:00am', '10:00am a 12:pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];
const ampliacionTheoreticalTimes = ['8:00 am a 12:00 pm', '3:00 pm a 5:00 pm'];
const theoreticalSchedules = [
    'Clase Semanal',
    'Clase Sabatina'
];

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico (8hrz)', price: 133.00, hours: 8 },
    { id: 'plus', label: 'Curso Auto Plus (10hrz)', price: 155.00, hours: 10 },
    { id: 'premium', label: 'Curso Auto Premium (12hrz)', price: 180.00, hours: 12 },
];

const motoPackages = [
    { id: 'moto-basico', label: 'Curso Moto Básico (8hrz)', price: 115.00, hours: 8 },
    { id: 'moto-plus', label: 'Curso Moto Plus (10hrz)', price: 135.00, hours: 10 },
    { id: 'moto-premium', label: 'Curso Moto Premium (12hrz)', price: 155.00, hours: 12 },
];

const mixtoPackages = [
    { id: 'mixto-10h', label: 'Auto + Moto 10Hrs', price: 290.00, hours: 10 },
    { id: 'mixto-basico-am', label: 'Básico Auto + Moto', price: 153.00, hours: 8 },
    { id: 'mixto-plus-am', label: 'Plus Auto + Moto', price: 170.00, hours: 10 },
    { id: 'mixto-premium-am', label: 'Premium Auto + Moto', price: 195.00, hours: 12 },
    { id: 'mixto-basico-ma', label: 'Básico Moto + Auto', price: 135.00, hours: 8 },
    { id: 'mixto-plus-ma', label: 'Plus Moto + Auto', price: 155.00, hours: 10 },
    { id: 'mixto-premium-ma', label: 'Premium Moto + Auto', price: 175.00, hours: 12 },
    { id: 'mixto-reforzamiento', label: 'Reforzamiento Mixto 2Hrs', price: 100.00, hours: 2 },
];

const deluxePackages = [
    { id: 'deluxe-premium', label: 'Plan Premium (Deluxe)', price: 201.00, hours: 12 },
    { id: 'deluxe-full', label: 'Plan Deluxe Full', price: 270.00, hours: 16 },
];

const soloPracticaPackages = [
    { id: 'solo-basico-auto', label: 'Paquete Básico 8hrs (Auto)', price: 125.00, hours: 8, vehicleType: 'Auto' },
    { id: 'solo-plus-auto', label: 'Paquete Plus 10hrs (Auto)', price: 135.00, hours: 10, vehicleType: 'Auto' },
    { id: 'solo-premium-auto', label: 'Paquete Premium 12hrs (Auto)', price: 155.00, hours: 12, vehicleType: 'Auto' },
    { id: 'solo-basico-moto', label: 'Paquete Básico 8hrs (Moto)', price: 103.00, hours: 8, vehicleType: 'Moto' },
    { id: 'solo-plus-moto', label: 'Paquete Plus 10hrs (Moto)', price: 117.00, hours: 10, vehicleType: 'Moto' },
    { id: 'solo-premium-moto', label: 'Paquete Premium 12hrs (Moto)', price: 130.00, hours: 12, vehicleType: 'Moto' },
];

const ampliacionOptions = [
  { id: 'B', label: 'B', price: 57.00 },
  { id: 'C', label: 'C', price: 57.00 },
  { id: 'D', label: 'D', price: 57.00 },
  { id: 'E1', label: 'E1', price: 57.00 },
  { id: 'E2', label: 'E2', price: 75.00 },
  { id: 'E3', label: 'E3', price: 75.00 },
  { id: 'F', label: 'F', price: 80.00 },
];

const calculateAmpliacionPrice = (selected: string[]) => {
  if (selected.length === 0) return 0;
  
  const sortedKey = [...selected].sort().join(' + ');
  
  const rules: Record<string, number> = {
    'B': 57, 'C': 57, 'D': 57, 'E1': 57, 'E2': 75, 'E3': 75, 'F': 80,
    'E1 + E2': 75,
    'E1 + E2 + E3': 85,
    'D + E1': 85,
    'B + D': 85,
    'B + E1': 85,
    'E2 + E3': 85,
    'B + F': 85,
    'B + E1 + E2 + E3': 95,
    'D + E1 + E2 + E3': 95,
    'E1 + E2 + E3 + F': 95,
    'D + E1 + E2 + E3 + F': 150,
    'B + E1 + E2 + E3 + F': 150,
    'B + D + E1 + E2 + E3 + F': 200,
  };

  if (rules[sortedKey]) return rules[sortedKey];

  return selected.reduce((acc, cat) => {
    const base = ampliacionOptions.find(o => o.id === cat)?.price || 0;
    return acc + base;
  }, 0);
};

const contractSchema = z.object({
  clientName: z.string().min(1, 'Requerido'),
  clientEmail: z.string().email('Email inválido'),
  contractType: z.enum(['Curso Auto', 'Curso Moto', 'Curso Mixto', 'Curso Deluxe', 'Ampliaciones', 'Curso Solo Practica']),
  studentIdNumber: z.string().min(1, 'Requerido'),
  studentAddress: z.string().min(1, 'Requerido'),
  studentPhone1: z.string().min(1, 'Requerido'),
  studentPhone2: z.string().optional(),
  coursePlan: z.string().optional(),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional(),
  paymentType: z.string().default('cash'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.string().optional(),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date()).optional(),
  theoreticalClassDate: z.date().optional(),
  theoreticalClassTime: z.string().optional(),
  selectedPlans: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
  practicalClassSchedules: z.array(z.object({
    date: z.date().optional(),
    time: z.string().optional(),
    vehicle: z.string().optional(),
    instructor: z.string().optional()
  })).optional(),
  motoPracticalClassSchedules: z.array(z.object({
    date: z.date().optional(),
    time: z.string().optional(),
    vehicle: z.string().optional(),
    instructor: z.string().optional()
  })).optional(),
});

type FormValues = z.infer<typeof contractSchema>;

const convertDatesToTimestamps = (data: any) => {
    const result: any = {};
    
    // Remove undefined values to avoid Firestore transaction errors
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
            result[key] = data[key];
        }
    });

    const toTs = (d: any) => (d instanceof Date) ? Timestamp.fromDate(d) : d;
    
    if (result.paymentDeadline) result.paymentDeadline = toTs(result.paymentDeadline);
    if (result.theoreticalClassDate) result.theoreticalClassDate = toTs(result.theoreticalClassDate);
    if (result.theoreticalClassDates) {
        result.theoreticalClassDates = result.theoreticalClassDates
            .filter((d: any) => d !== null && d !== undefined)
            .map((d: any) => toTs(d));
    }
    if (result.practicalClassSchedules) {
        result.practicalClassSchedules = result.practicalClassSchedules.map((s: any) => ({
            ...s,
            date: s.date ? toTs(s.date) : null
        }));
    }
    if (result.motoPracticalClassSchedules) {
        result.motoPracticalClassSchedules = result.motoPracticalClassSchedules.map((s: any) => ({
            ...s,
            date: s.date ? toTs(s.date) : null
        }));
    }
    return result;
};

export function ContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role: currentUserRole } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const contractTypeParam = searchParams.get('type') as ContractType | null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contractType: ContractType = useMemo(() => contractTypeParam || 'Curso Auto', [contractTypeParam]);

  const form = useForm<FormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      clientName: '', clientEmail: '', contractType: contractType, studentIdNumber: '',
      studentAddress: '', studentPhone1: '', studentPhone2: '', courseValue: 0, downPayment: 0, balance: 0,
      paymentType: 'cash', coursePlan: '', vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual',
      licenseCategory: contractType === 'Curso Moto' ? 'A, B' : 'A, C, B',
      theoreticalClassSchedule: '',
      theoreticalClassDates: [],
      theoreticalClassDate: undefined,
      theoreticalClassTime: '',
      selectedPlans: [],
      practicalClassSchedules: [],
      motoPracticalClassSchedules: [],
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { fields: motoFields, replace: replaceMoto } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  const courseValue = form.watch('courseValue');
  const downPayment = form.watch('downPayment');
  const selectedPlanId = form.watch('coursePlan');
  const selectedTheoreticalSchedule = form.watch('theoreticalClassSchedule');
  const theoreticalDates = form.watch('theoreticalClassDates') || [];
  const selectedPlans = form.watch('selectedPlans') || [];
  
  useEffect(() => {
    if (!selectedPlanId || contractType === 'Ampliaciones') return;
    let pkg: any;
    if (contractType === 'Curso Auto') pkg = autoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Moto') pkg = motoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Mixto') pkg = mixtoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Deluxe') pkg = deluxePackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Solo Practica') pkg = soloPracticaPackages.find(p => p.id === selectedPlanId);
    
    if (pkg) {
        form.setValue('courseValue', pkg.price);
        if (pkg.hours || pkg.id === 'mixto-10h' || pkg.id === 'mixto-reforzamiento') {
            const isMotoPlan = contractType === 'Curso Moto' || (contractType === 'Curso Solo Practica' && pkg.vehicleType === 'Moto');

            if (isMotoPlan) {
                const totalSlots = Math.ceil(pkg.hours / 2);
                const newSlots = Array.from({ length: totalSlots }).map((_, i) => ({
                    date: addDays(new Date(), i + 1),
                    time: '8:00am a 10:00am',
                    vehicle: '',
                    instructor: ''
                }));
                replaceMoto(newSlots);
                replacePractical([]);
            } else if (contractType === 'Curso Mixto') {
                let autoCount = 0;
                let motoCount = 0;

                if (pkg.id === 'mixto-reforzamiento') {
                    autoCount = 1;
                    motoCount = 1;
                } else if (pkg.id === 'mixto-10h') {
                    autoCount = 5;
                    motoCount = 5;
                } else if (pkg.id === 'mixto-basico-am') {
                    autoCount = 4;
                    motoCount = 0;
                } else if (pkg.id === 'mixto-plus-am') {
                    autoCount = 5;
                    motoCount = 0;
                } else if (pkg.id === 'mixto-premium-am') {
                    autoCount = 6;
                    motoCount = 0;
                } else if (pkg.id === 'mixto-basico-ma') {
                    autoCount = 0;
                    motoCount = 4;
                } else if (pkg.id === 'mixto-plus-ma') {
                    autoCount = 0;
                    motoCount = 5;
                } else if (pkg.id === 'mixto-premium-ma') {
                    autoCount = 0;
                    motoCount = 6;
                }

                const autoSlots = Array.from({ length: autoCount }).map((_, i) => ({
                    date: addDays(new Date(), i + 1),
                    time: '8:00am a 10:00am',
                    vehicle: '',
                    instructor: ''
                }));
                const motoSlots = Array.from({ length: motoCount }).map((_, i) => ({
                    date: addDays(new Date(), i + autoCount + 1),
                    time: '8:00am a 10:00am',
                    vehicle: '',
                    instructor: ''
                }));
                
                replacePractical(autoSlots);
                replaceMoto(motoSlots);
            } else {
                const totalSlots = Math.ceil(pkg.hours / 2);
                const newSlots = Array.from({ length: totalSlots }).map((_, i) => ({
                    date: addDays(new Date(), i + 1),
                    time: '8:00am a 10:00am',
                    vehicle: '',
                    instructor: ''
                }));
                replacePractical(newSlots);
                replaceMoto([]);
            }
        }
    }
  }, [selectedPlanId, contractType, form, replacePractical, replaceMoto]);

  useEffect(() => {
    if (selectedTheoreticalSchedule === 'Clase Semanal') {
      const currentDates = form.getValues('theoreticalClassDates') || [];
      const newDates = Array.from({ length: 4 }).map((_, i) => currentDates[i] || addDays(new Date(), i + 1));
      form.setValue('theoreticalClassDates', newDates);
    } else if (selectedTheoreticalSchedule === 'Clase Sabatina') {
      const currentDates = form.getValues('theoreticalClassDates') || [];
      const newDates = Array.from({ length: 3 }).map((_, i) => currentDates[i] || addDays(new Date(), i + 1));
      form.setValue('theoreticalClassDates', newDates);
    } else if (contractType !== 'Ampliaciones') {
      form.setValue('theoreticalClassDates', []);
    }
  }, [selectedTheoreticalSchedule, form, contractType]);

  useEffect(() => {
    const val = Number(courseValue) || 0;
    const pay = Number(downPayment) || 0;
    form.setValue('balance', Math.max(0, val - pay));
  }, [courseValue, downPayment, form]);

  async function onSubmit(values: FormValues) {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, where('idNumber', '==', values.studentIdNumber));
      const clientSnapshot = await getDocs(q);
      const existingClientDoc = clientSnapshot.docs[0];

      const newContractId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contract_folio');
        const counterDoc = await transaction.get(counterRef);
        const newFolioNumber = counterDoc.exists() ? counterDoc.data().count + 1 : 1;

        let clientId = existingClientDoc?.id;
        if (!existingClientDoc) {
          const newClientRef = doc(collection(db, 'clients'));
          clientId = newClientRef.id;
          transaction.set(newClientRef, {
            id: clientId, name: values.clientName, email: values.clientEmail, 
            idNumber: values.studentIdNumber, phone: values.studentPhone1,
            userId: user.uid, createdAt: serverTimestamp() as any
          });
        }

        const newContractRef = doc(collection(db, 'contracts'));
        const cleanedData = convertDatesToTimestamps(values);
        const contractData: any = {
          id: newContractRef.id, folioNumber: newFolioNumber, title: values.contractType,
          clientName: values.clientName, clientEmail: values.clientEmail, clientId: clientId,
          type: values.contractType, status: 'active', userId: user.uid, createdAt: serverTimestamp() as any,
          createdBy: currentUserRole || undefined
        };

        if (values.contractType === 'Curso Deluxe') contractData.deluxeDetails = cleanedData;
        else if (values.contractType === 'Ampliaciones') contractData.ampliacionesDetails = cleanedData;
        else contractData.autoMotoDetails = cleanedData;

        transaction.set(newContractRef, contractData);
        transaction.set(counterRef, { count: newFolioNumber }, { merge: true });
        return newContractRef.id;
      });

      toast({ title: 'Contrato Generado', description: 'Éxito.' });
      router.push(`/contracts/${newContractId}`);
    } catch (e: any) {
      console.error("Error saving contract:", e);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: e.message || 'Error desconocido' });
    } finally { setIsSubmitting(false); }
  }

  const currentPackages = useMemo(() => {
    if (contractType === 'Curso Auto') return autoPackages;
    if (contractType === 'Curso Moto') return motoPackages;
    if (contractType === 'Curso Mixto') return mixtoPackages;
    if (contractType === 'Curso Deluxe') return deluxePackages;
    if (contractType === 'Curso Solo Practica') return soloPracticaPackages;
    return null;
  }, [contractType]);

  const renderClassSlots = (fields: any[], namePrefix: string, vehicles: string[], title: string, Icon: any) => {
    if (fields.length === 0) return null;
    return (
        <Card className="shadow-sm mt-4">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                    <Icon className="h-4 w-4" /> {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 gap-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="p-3 border rounded-md bg-muted/5 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold w-5 bg-primary text-white rounded-full h-5 flex items-center justify-center shrink-0">#{index + 1}</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                                    <FormField control={form.control} name={`${namePrefix}.${index}.date` as any} render={({ field }) => (
                                        <FormItem>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl><Button variant="outline" className={cn("h-8 text-xs w-full text-left font-normal px-2", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-1 h-3 w-3" />{field.value ? format(field.value, "dd/MM") : "Fecha"}</Button></FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name={`${namePrefix}.${index}.time` as any} render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs px-2"><SelectValue placeholder="Hora" /></SelectTrigger></FormControl>
                                                <SelectContent>{practicalTimes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name={`${namePrefix}.${index}.vehicle` as any} render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs px-2"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {vehicles.map(v => (
                                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name={`${namePrefix}.${index}.instructor` as any} render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-8 text-xs px-2"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                                                <SelectContent>{instructors.map(i => i && <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        {/* 1. Datos del Estudiante */}
        <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                    <UserCircle className="h-4 w-4" /> 1. Datos del Estudiante
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Cédula / Pasaporte</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="8-000-000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="correo@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono 1</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="6000-0000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="studentPhone2" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono 2</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="255-0000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Dirección</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="Calle, Edificio, Casa..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
        </Card>

        {/* 2. Valor o Forma de Pago */}
        <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                    <Calculator className="h-4 w-4" /> 2. Valor y Forma de Pago
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentPackages && (
                        <FormField control={form.control} name="coursePlan" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Paquete / Plan</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {currentPackages.map(pkg => <SelectItem key={pkg.id} value={pkg.id}>{pkg.label} - B/. {pkg.price.toFixed(2)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="paymentType" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Método de Pago</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="cash">Efectivo</SelectItem>
                                    <SelectItem value="debit">Tarjeta Débito</SelectItem>
                                    <SelectItem value="credit">Tarjeta Crédito</SelectItem>
                                    <SelectItem value="global">Global</SelectItem>
                                    <SelectItem value="bac">BAC</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormField control={form.control} name="courseValue" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Valor Total (B/.)</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" {...field} readOnly={contractType === 'Ampliaciones'} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="downPayment" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Abono Inicial (B/.)</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="balance" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</FormLabel><FormControl><Input className="h-8 text-sm bg-muted font-bold text-destructive" type="number" readOnly {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Límite Saldo</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className={cn("h-8 text-sm pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-3 w-3" />{field.value ? format(field.value, "dd/MM/yy") : <span>Fecha</span>}</Button></FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                            </Popover>
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        {/* 3. Detalles del Curso */}
        <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                    <Settings2 className="h-4 w-4" /> 3. Detalles del Curso
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                {contractType === 'Ampliaciones' ? (
                    <div className="md:col-span-2 space-y-2">
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Categorías de Ampliación (Selección Múltiple)</FormLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {ampliacionOptions.map((opt) => {
                                const isSelected = selectedPlans.some(p => p.name === opt.id);
                                return (
                                    <Button
                                        key={opt.id}
                                        type="button"
                                        variant={isSelected ? "default" : "outline"}
                                        className={cn("h-10 text-xs flex flex-col items-center justify-center gap-0", isSelected && "bg-primary text-white border-primary")}
                                        onClick={() => {
                                            let newPlans = [...selectedPlans];
                                            if (isSelected) {
                                                newPlans = newPlans.filter(p => p.name !== opt.id);
                                            } else {
                                                newPlans.push({ name: opt.id, price: opt.price });
                                            }
                                            form.setValue('selectedPlans', newPlans);
                                            
                                            const selectedIds = newPlans.map(p => p.name);
                                            const total = calculateAmpliacionPrice(selectedIds);
                                            form.setValue('courseValue', total);
                                        }}
                                    >
                                        <span className="font-bold text-sm">{opt.label}</span>
                                        <span className="text-[9px] opacity-80">B/. {opt.price.toFixed(2)}</span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <>
                        {contractType !== 'Curso Solo Practica' && (
                            <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Categoría de Licencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent>
                                    {contractType === 'Curso Moto' ? (
                                        <SelectItem value="A, B">A, B (Moto)</SelectItem>
                                    ) : (
                                        <>
                                            <SelectItem value="A, C, B">A, C, B</SelectItem>
                                            <SelectItem value="A, B, C, D">A, B, C, D</SelectItem>
                                        </>
                                    )}
                                </SelectContent></Select></FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Transmisión</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent>
                                {contractType === 'Curso Moto' ? (
                                    <SelectItem value="Moto">Moto</SelectItem>
                                ) : (
                                    <>
                                        <SelectItem value="Manual">Manual</SelectItem>
                                        <SelectItem value="Automático">Automático</SelectItem>
                                    </>
                                )}
                            </SelectContent></Select></FormItem>
                        )} />
                    </>
                )}
            </CardContent>
        </Card>

        {/* 4. Clases Teóricas Dinámicas */}
        {contractType !== 'Curso Solo Practica' && (
            <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b">
                    <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                        <BookOpen className="h-4 w-4" /> 4. Programación de Clases Teóricas
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                    {contractType === 'Ampliaciones' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Fecha Clase Teórica</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl><Button variant="outline" className={cn("h-8 text-sm pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-3 w-3" />{field.value ? format(field.value, "dd/MM/yy") : <span>Seleccionar</span>}</Button></FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                    </Popover>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Horario Teórico</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {ampliacionTheoreticalTimes.map(t => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Horario Teórico</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar horario..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {theoreticalSchedules.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            {theoreticalDates.map((_, idx) => (
                                <FormField key={idx} control={form.control} name={`theoreticalClassDates.${idx}`} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Fecha Clase {idx + 1}</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl><Button variant="outline" className={cn("h-8 text-sm pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-3 w-3" />{field.value ? format(field.value, "dd/MM/yy") : <span>Seleccionar</span>}</Button></FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

        {/* 5. Programación de Clases Prácticas (Generadas automáticamente) */}
        {contractType !== 'Ampliaciones' && (
            <div className="space-y-4">
                {renderClassSlots(practicalFields, "practicalClassSchedules", carVehicles, "5. Programación Clases Prácticas (Auto)", Car)}
                {renderClassSlots(motoFields, "motoPracticalClassSchedules", motoVehicles, "5. Programación Clases Prácticas (Moto)", Bike)}
            </div>
        )}

        <div className="flex justify-end pt-2 pb-8">
            <Button type="submit" size="lg" className="w-full md:w-auto h-10 px-12 font-bold shadow-md" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : 'Generar Contrato y Guardar'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
