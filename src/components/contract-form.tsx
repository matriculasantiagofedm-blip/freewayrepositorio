'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, Client, InstructorName } from '@/lib/types';
import { Checkbox } from './ui/checkbox';
import { useCurrentRole } from '@/hooks/use-current-role';
import { ContractView } from './contract-view';
import { useDb, useUser } from './firebase-provider';

// --- Esquemas de Validación con Zod ---
const baseClientSchema = z.object({
  clientName: z.string().min(1, 'El nombre completo es requerido.'),
  clientEmail: z.string().email('Debe ser un correo electrónico válido.'),
});

const deluxeDetailsSchema = z.object({
  studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
  studentAddress: z.string().min(1, 'La dirección es requerida.'),
  studentPhone1: z.string().min(1, 'El teléfono 1 es requerido.'),
  studentPhone2: z.string().optional(),
}).passthrough();

const autoMotoDetailsSchema = z.object({
  studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
  studentAddress: z.string().min(1, 'La dirección es requerida.'),
  studentPhone1: z.string().min(1, 'El teléfono 1 es requerido.'),
}).passthrough();

const ampliacionesDetailsSchema = z.object({
    studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
    studentAddress: z.string().min(1, 'La dirección es requerida.'),
    studentPhone1: z.string().min(1, 'El teléfono 1 es requerido.'),
}).passthrough();


type FormValues = {
  clientName: string;
  clientEmail: string;
  contractType: ContractType;
  folioNumber?: number;
  deluxeDetails: any;
  autoMotoDetails: any;
  ampliacionesDetails: any;
};

const convertDetailsDatesToTimestamps = (details: any) => {
    if (!details) return {};
    const newDetails = { ...details };

    const toTimestamp = (date: any) => {
        if (date instanceof Date && !isNaN(date.getTime())) {
            return Timestamp.fromDate(date);
        }
        return null;
    };
    
    if (newDetails.paymentInstallments) {
        newDetails.paymentInstallments = newDetails.paymentInstallments.map((d: any) => d ? toTimestamp(d) : null).filter(Boolean);
    }
    if (newDetails.theoreticalClasses) {
        newDetails.theoreticalClasses = newDetails.theoreticalClasses.map((d: any) => d ? toTimestamp(d) : null).filter(Boolean);
    }
    if (newDetails.classSchedules) {
        newDetails.classSchedules = newDetails.classSchedules
            .map((s: { date?: Date, time?: string }) => ({
                ...s,
                date: s.date ? toTimestamp(s.date) : null,
            }))
            .filter((s: any) => s.date);
    }

    if (details.paymentDeadline && details.paymentDeadline instanceof Date && !isNaN(details.paymentDeadline.getTime())) {
        newDetails.paymentDeadline = Timestamp.fromDate(details.paymentDeadline);
    } else if (newDetails.paymentDeadline === undefined || newDetails.paymentDeadline === null) {
        newDetails.paymentDeadline = Timestamp.fromDate(new Date());
    }

    if (newDetails.theoreticalClassDates) {
        newDetails.theoreticalClassDates = newDetails.theoreticalClassDates.map((d: any) => d ? toTimestamp(d) : null).filter(Boolean);
    }
    if (newDetails.practicalClassSchedules) {
        newDetails.practicalClassSchedules = newDetails.practicalClassSchedules
            .map((s: { date?: Date, time?: string }) => ({
                ...s,
                date: s.date ? toTimestamp(s.date) : null,
            }))
            .filter((s: any) => s.date);
    }
     if (newDetails.motoPracticalClassSchedules) {
        newDetails.motoPracticalClassSchedules = newDetails.motoPracticalClassSchedules
            .map((s: { date?: Date, time?: string }) => ({
                ...s,
                date: s.date ? toTimestamp(s.date) : null,
            }))
            .filter((s: any) => s.date);
    }

    if (newDetails.theoreticalClassDate) {
        newDetails.theoreticalClassDate = toTimestamp(newDetails.theoreticalClassDate);
    }

    return newDetails;
};

const coursePlans = {
  'Curso Auto': [
    { name: 'Paquete Básico 8hrs', price: 133.00 },
    { name: 'Paquete Plus 10hrs', price: 155.00 },
    { name: 'Paquete Premium 12hrs', price: 180.00 },
    { name: 'Reforzamiento de 4 horas', price: 95.00 },
    { name: 'Ya se manejar Plus 2 horas', price: 75.00 },
    { name: 'Ya se manejar (Evaluación de estacionamiento)', price: 57.00 },
  ],
  'Curso Moto': [
    { name: 'Paquete Básico 8hrs', price: 115.00 },
    { name: 'Paquete Plus 10hrs', price: 135.00 },
    { name: 'Paquete Premium 12hrs', price: 155.00 },
    { name: 'Reforzamiento de 4 horas', price: 95.00 },
    { name: 'Ya se manejar Plus 2 horas', price: 75.00 },
  ],
  'Curso Mixto': [
    { name: 'Auto + Moto 10Hrs', price: 290.00 },
    { name: 'Básico Auto + Moto', price: 153.00 },
    { name: 'Plus Auto + Moto', price: 170.00 },
    { name: 'Premium Auto + Moto', price: 195.00 },
    { name: 'Básico Moto + Auto', price: 135.00 },
    { name: 'Plus Moto + Auto', price: 155.00 },
    { name: 'Premium Moto + Auto', price: 175.00 },
    { name: 'Reforzamiento Mixto 2Hrs', price: 100.00 },
  ],
  'Curso Solo Practica': [
    { name: 'Paquete Básico 8hrs (Auto)', price: 125.00 },
    { name: 'Paquete Plus 10hrs (Auto)', price: 135.00 },
    { name: 'Paquete Premium 12hrs (Auto)', price: 155.00 },
    { name: 'Paquete Básico 8hrs (Moto)', price: 103.00 },
    { name: 'Paquete Plus 10hrs (Moto)', price: 117.00 },
    { name: 'Paquete Premium 12hrs (Moto)', price: 130.00 },
  ]
};

const specialPlans = [
    'Reforzamiento de 4 horas',
    'Ya se manejar Plus 2 horas',
    'Ya se manejar (Evaluación de estacionamiento)',
    'Reforzamiento Mixto 2Hrs'
];

const planToClassCount: { [key: string]: number } = {
  'Paquete Básico 8hrs': 4,
  'Paquete Plus 10hrs': 5,
  'Paquete Premium 12hrs': 6,
  'Reforzamiento de 4 horas': 2,
  'Ya se manejar Plus 2 horas': 1,
  'Ya se manejar (Evaluación de estacionamiento)': 1,
  'Auto + Moto 10Hrs': 5,
  'Básico Auto + Moto': 3,
  'Plus Auto + Moto': 3,
  'Premium Auto + Moto': 3,
  'Básico Moto + Auto': 3,
  'Plus Moto + Auto': 3,
  'Premium Moto + Auto': 3,
  'Reforzamiento Mixto 2Hrs': 1,
  'Paquete Básico 8hrs (Auto)': 4,
  'Paquete Plus 10hrs (Auto)': 5,
  'Paquete Premium 12hrs (Auto)': 6,
  'Paquete Básico 8hrs (Moto)': 4,
  'Paquete Plus 10hrs (Moto)': 5,
  'Paquete Premium 12hrs (Moto)': 6,
};

const practicalClassTimes = [
    '8:00am a 10:00am',
    '10:00am a 12:pm',
    '1:00pm a 3:00pm',
    '3:00pm a 5:00pm',
];


const ampliacionesPlans = [
    { name: 'B', price: 57.00 },
    { name: 'C', price: 57.00 },
    { name: 'D', price: 57.00 },
    { name: 'E1', price: 57.00 },
    { name: 'E2', price: 75.00 },
    { name: 'E3', price: 75.00 },
    { name: 'F', price: 80.00 },
];

const specialCombinations = [
  { combo: ['D', 'E1', 'E2', 'E3', 'F'].sort(), price: 150.00 },
  { combo: ['B', 'E1', 'E2', 'E3', 'F'].sort(), price: 150.00 },
  { combo: ['B', 'E1', 'E2', 'E3'].sort(), price: 95.00 },
  { combo: ['D', 'E1'].sort(), price: 85.00 },
  { combo: ['E1', 'E2'].sort(), price: 75.00 },
  { combo: ['E1', 'E2', 'E3'].sort(), price: 85.00 },
  { combo: ['E1', 'E2', 'E3', 'F'].sort(), price: 95.00 },
  { combo: ['B', 'D'].sort(), price: 85.00 },
  { combo: ['B', 'E1'].sort(), price: 85.00 },
  { combo: ['E2', 'E3'].sort(), price: 85.00 },
  { combo: ['B', 'F'].sort(), price: 85.00 },
  { combo: ['D', 'E1', 'E2', 'E3'].sort(), price: 95.00 },
];

const paymentTypes = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'T.Débito' },
    { value: 'credit', label: 'T.Crédito' },
    { value: 'global', label: 'GLOBAL' },
    { value: 'bac', label: 'BAC' },
    { value: 'general', label: 'GENERAL' },
    { value: 'cheques', label: 'Cheques' },
];

const INSTRUCTORS: Exclude<InstructorName, ''>[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];

export function ContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role: currentUserRole } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const contractTypeParam = searchParams.get('type') as ContractType | null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isAbonoDialogOpen, setIsAbonoDialogOpen] = useState(false);
  const [abonoDialogMessage, setAbonoDialogMessage] = useState('');
  const [minAbonoRequired, setMinAbonoRequired] = useState(0);
  
  const contractType: ContractType = useMemo(() => contractTypeParam || 'Curso Auto', [contractTypeParam]);

  const form = useForm<FormValues>({
    mode: 'onBlur',
    defaultValues: {
      clientName: '',
      clientEmail: '',
      contractType: contractType,
      deluxeDetails: {
        studentIdNumber: '', studentAddress: '', studentPhone1: '', studentPhone2: '', paymentAmount: 0,
        paymentInstallments: Array(6).fill(undefined), theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }), paymentType: 'cash', instructor: '',
      },
      autoMotoDetails: {
        studentIdNumber: '', studentAddress: '', studentPhone1: '', studentPhone2: '', courseValue: 0,
        downPayment: 0, balance: 0, theoreticalClassDates: [], practicalClassSchedules: [],
        motoPracticalClassSchedules: [], paidInFull: false, paymentType: 'cash', instructor: '',
      },
       ampliacionesDetails: {
        studentIdNumber: '', studentAddress: '', studentPhone1: '', studentPhone2: '', selectedPlans: [],
        courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash',
      }
    },
  });
  
  const coursePlan = form.watch('autoMotoDetails.coursePlan');

  const { fields: practicalClassFields, replace: replacePracticalClasses } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.practicalClassSchedules",
  });
  
  const { fields: motoPracticalClassFields, replace: replaceMotoPracticalClasses } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.motoPracticalClassSchedules",
  });


  const handleCoursePlanChange = (planName: string) => {
    const currentContractType = form.getValues('contractType') as any;
    const plan = coursePlans[currentContractType as keyof typeof coursePlans]?.find(p => p.name === planName);

    if (plan) {
        form.setValue('autoMotoDetails.courseValue', plan.price);
        const isSpecial = specialPlans.includes(plan.name);
        const downPaymentValue = isSpecial ? plan.price : plan.price * 0.25;
        form.setValue('autoMotoDetails.downPayment', downPaymentValue);
        form.setValue('autoMotoDetails.balance', isSpecial ? 0 : plan.price - downPaymentValue);
        form.setValue('autoMotoDetails.paidInFull', isSpecial);

        const classCount = planToClassCount[planName] || 0;
        if (currentContractType === 'Curso Mixto') {
             if (planName === 'Auto + Moto 10Hrs') {
                replacePracticalClasses(Array.from({ length: 5 }, () => ({ date: undefined, time: '' })));
                replaceMotoPracticalClasses(Array.from({ length: 5 }, () => ({ date: undefined, time: '' })));
            } else if (planName === 'Reforzamiento Mixto 2Hrs') {
                replacePracticalClasses(Array.from({ length: 1 }, () => ({ date: undefined, time: '' })));
                replaceMotoPracticalClasses(Array.from({ length: 1 }, () => ({ date: undefined, time: '' })));
            }
            else {
                replacePracticalClasses(Array.from({ length: 3 }, () => ({ date: undefined, time: '' })));
                replaceMotoPracticalClasses(Array.from({ length: 3 }, () => ({ date: undefined, time: '' })));
            }
        } else {
            replacePracticalClasses(Array.from({ length: classCount }, () => ({ date: undefined, time: '' })));
            replaceMotoPracticalClasses([]);
        }
    }
  };

  const handlePaidInFullChange = (checked: boolean) => {
    form.setValue('autoMotoDetails.paidInFull', checked);
    const currentCourseValue = form.getValues('autoMotoDetails.courseValue') || 0;
    if (checked) {
        form.setValue('autoMotoDetails.downPayment', currentCourseValue);
        form.setValue('autoMotoDetails.balance', 0);
    } else {
        const downPayment = currentCourseValue * 0.25;
        form.setValue('autoMotoDetails.downPayment', downPayment);
        form.setValue('autoMotoDetails.balance', currentCourseValue - downPayment);
    }
  };

  const handleDownPaymentChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    const { courseValue, coursePlan, paidInFull } = form.getValues('autoMotoDetails');
    e.target.value = value.toFixed(2);
    form.setValue('autoMotoDetails.downPayment', value);
    const newBalance = (courseValue || 0) - value;
    form.setValue('autoMotoDetails.balance', newBalance >= 0 ? newBalance : 0);

    if (coursePlan && !specialPlans.includes(coursePlan) && !paidInFull) {
        const minDownPayment = (courseValue || 0) * 0.25;
        if (value < minDownPayment) {
            setAbonoDialogMessage(`El abono mínimo requerido es de B/. ${minDownPayment.toFixed(2)}.`);
            setMinAbonoRequired(minDownPayment);
            setIsAbonoDialogOpen(true);
        }
    }
  };
  
    const handleAmpliacionesPlanChange = (plans: { name: string; price: number }[]) => {
        const selectedNames = plans.map(p => p.name).sort();
        let total = 0;
        let comboFound = false;
        const sortedCombinations = [...specialCombinations].sort((a,b) => b.combo.length - a.combo.length);
        for (const { combo, price } of sortedCombinations) {
            if (JSON.stringify(selectedNames) === JSON.stringify(combo)) {
                total = price; comboFound = true; break;
            }
        }
        if (!comboFound) { total = plans.reduce((sum, plan) => sum + (plan?.price || 0), 0); }
        form.setValue('ampliacionesDetails.courseValue', total);
        const minAbono = total > 100 ? total * 0.25 : total;
        form.setValue('ampliacionesDetails.downPayment', minAbono);
        const newBalance = total - minAbono;
        form.setValue('ampliacionesDetails.balance', newBalance >= 0 ? newBalance : 0);
    };

  const handleAmpliacionesDownPaymentChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    const { courseValue } = form.getValues('ampliacionesDetails');
    e.target.value = value.toFixed(2);
    form.setValue('ampliacionesDetails.downPayment', value);
    const newBalance = (courseValue || 0) - value;
    form.setValue('ampliacionesDetails.balance', newBalance >= 0 ? newBalance : 0);
    const totalValue = courseValue || 0;
    let minAbono = 0;
    let message = '';
    if (totalValue > 100) {
        minAbono = totalValue * 0.25;
        if (value < minAbono) message = `Abono mínimo requerido: B/. ${minAbono.toFixed(2)}.`;
    } else if (totalValue > 0) {
        minAbono = totalValue;
        if (value < minAbono) message = `Para montos de B/.100 o menos se debe cancelar la totalidad.`;
    }
    if (message) {
        setAbonoDialogMessage(message); setMinAbonoRequired(minAbono); setIsAbonoDialogOpen(true);
    }
  };


  useEffect(() => {
    form.setValue('contractType', contractType);
    const existingValues = form.getValues();
    form.reset({
      ...existingValues,
      contractType: contractType,
      deluxeDetails: { ...form.formState.defaultValues.deluxeDetails },
      autoMotoDetails: {
        ...form.formState.defaultValues.autoMotoDetails,
        vehicle: contractType === 'Curso Moto' ? undefined : existingValues.autoMotoDetails.vehicle,
      },
       ampliacionesDetails: { ...form.formState.defaultValues.ampliacionesDetails }
    });
  }, [contractType, form]);


  async function onSubmit(values: FormValues) {
    if (!db || !user) {
      toast({ variant: 'destructive', title: 'Error de Conexión', description: 'No estás autenticado.' }); return;
    }

    const baseValidation = baseClientSchema.safeParse(values);
    if (!baseValidation.success) {
      toast({ variant: 'destructive', title: 'Campos Inválidos', description: baseValidation.error.errors[0].message }); return;
    }

    let details, studentIdNumber;
    switch(values.contractType) {
      case 'Curso Deluxe': details = values.deluxeDetails; break;
      case 'Ampliaciones': details = values.ampliacionesDetails; break;
      default: details = values.autoMotoDetails; break;
    }
    studentIdNumber = details.studentIdNumber;
    if (!studentIdNumber) { toast({ variant: 'destructive', title: 'Campo Requerido', description: 'Cédula obligatoria.' }); return; }

    setIsSubmitting(true);
    try {
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, where('idNumber', '==', studentIdNumber));
      const clientSnapshot = await getDocs(q);
      const existingClientDoc = clientSnapshot.docs[0];

      const newContractId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contract_folio');
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) throw new Error('El contador de folios no existe.');
        const newFolioNumber = counterDoc.data().count + 1;

        let clientId: string;
        if (!existingClientDoc) {
          const newClientRef = doc(collection(db, 'clients'));
          clientId = newClientRef.id;
          transaction.set(newClientRef, {
            id: clientId, name: values.clientName, email: values.clientEmail,
            idNumber: studentIdNumber, userId: user.uid, createdAt: serverTimestamp() as any,
            phone: details.studentPhone1,
          });
        } else { clientId = existingClientDoc.id; }

        const newContractRef = doc(collection(db, 'contracts'));
        let contractData: Partial<Contract> = {
          id: newContractRef.id, folioNumber: newFolioNumber, title: values.contractType,
          clientName: values.clientName, clientEmail: values.clientEmail, clientId: clientId,
          type: values.contractType, status: 'active', userId: user.uid, createdAt: serverTimestamp() as any,
          createdBy: currentUserRole || undefined, clauses: '',
        };
        
        if (values.contractType === 'Curso Deluxe') contractData.deluxeDetails = convertDetailsDatesToTimestamps(values.deluxeDetails);
        else if (values.contractType === 'Ampliaciones') contractData.ampliacionesDetails = convertDetailsDatesToTimestamps(values.ampliacionesDetails);
        else contractData.autoMotoDetails = convertDetailsDatesToTimestamps(values.autoMotoDetails);

        transaction.set(newContractRef, contractData);
        transaction.update(counterRef, { count: newFolioNumber });
        return newContractRef.id;
      });

      if (newContractId) {
        toast({ title: 'Contrato Generado', description: `Contrato ${newContractId} creado.` });
        router.push(`/contracts/${newContractId}`);
      }
    } catch (e: any) {
      console.error('Error: ', e);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: e.message });
    } finally { setIsSubmitting(false); }
  }

  const theoreticalSchedule = form.watch('autoMotoDetails.theoreticalClassSchedule');
  const numTheoreticalClasses = theoreticalSchedule?.includes('Semana') ? 4 : 3;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 print:p-0">
        <Card className="print:hidden">
            <CardHeader><CardTitle>Datos del Estudiante</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={contractType === 'Curso Deluxe' ? 'deluxeDetails.studentIdNumber' : contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentIdNumber' : 'autoMotoDetails.studentIdNumber'} render={({ field }) => (
                        <FormItem><FormLabel>Cédula</FormLabel><FormControl><Input placeholder="8-123-456" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={contractType === 'Curso Deluxe' ? 'deluxeDetails.studentAddress' : contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentAddress' : 'autoMotoDetails.studentAddress'} render={({ field }) => (
                        <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input placeholder="Dirección" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name={contractType === 'Curso Deluxe' ? 'deluxeDetails.studentPhone1' : contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentPhone1' : 'autoMotoDetails.studentPhone1'} render={({ field }) => (
                        <FormItem><FormLabel>Teléfono 1</FormLabel><FormControl><Input placeholder="6123-4567" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        <Card className="print:hidden">
            <CardHeader><CardTitle>Valor y Forma de Pago</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                {(contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto' || contractType === 'Curso Solo Practica') && (
                     <div className="space-y-4">
                        <FormField control={form.control} name="autoMotoDetails.coursePlan" render={({ field }) => (
                            <FormItem><FormLabel>Plan del Curso</FormLabel><Select onValueChange={(v) => { field.onChange(v); handleCoursePlanChange(v); }} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger></FormControl><SelectContent>{coursePlans[contractType as any]?.map(plan => (<SelectItem key={plan.name} value={plan.name}>{plan.name} - B/. {plan.price.toFixed(2)}</SelectItem>))}</SelectContent></Select></FormItem>
                        )} />
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="autoMotoDetails.courseValue" render={({ field }) => (
                                <FormItem><FormLabel>Valor (B/.)</FormLabel><FormControl><Input type="number" readOnly className="bg-muted" value={field.value || 0} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="autoMotoDetails.downPayment" render={({ field }) => (
                                <FormItem><FormLabel>Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" defaultValue={field.value || ''} onBlur={handleDownPaymentChange} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="autoMotoDetails.balance" render={({ field }) => (
                                <FormItem><FormLabel>Saldo (B/.)</FormLabel><FormControl><Input type="number" readOnly className="bg-muted" value={field.value || 0} /></FormControl></FormItem>
                            )} />
                        </div>
                    </div>
                 )}
            </CardContent>
        </Card>

        <div className="flex justify-between items-center print:hidden">
            <Button type="button" variant="outline" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? 'Ocultar Vista Previa' : 'Mostrar Vista Previa'}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
            </Button>
        </div>

        {showPreview && (
            <div className="border rounded-lg p-4 bg-gray-50">
                <ContractView contract={form.getValues() as any} type={contractType} />
            </div>
        )}
      </form>
    </Form>
  );
}