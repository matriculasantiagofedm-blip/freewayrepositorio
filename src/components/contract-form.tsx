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
import { Timestamp, collection, query, where, getDocs, writeBatch, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, Client, DeluxeContractDetails } from '@/lib/types';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { Checkbox } from './ui/checkbox';
import { useCurrentRole } from '@/hooks/use-current-role';
import { ContractView } from './contract-view';
import { useDb, useUser } from './firebase-provider';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

// --- Esquemas de Validación con Zod (para referencia interna y validación manual) ---
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
  deluxeDetails: Partial<z.infer<typeof deluxeDetailsSchema>>;
  autoMotoDetails: any; // Mantener flexible por ahora
  ampliacionesDetails: any; // Mantener flexible
};

// Función auxiliar para convertir las fechas de los detalles a Timestamps de Firestore
const convertDetailsDatesToTimestamps = (details: any) => {
    if (!details) return {};
    const newDetails = { ...details };

    const toTimestamp = (date: any) => {
        if (date instanceof Date && !isNaN(date.getTime())) {
            return Timestamp.fromDate(date);
        }
        return null;
    };

    // Deluxe
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
            .filter((s: { date: any; }) => s.date);
    }

    // Auto/Moto & Ampliaciones - Common paymentDeadline field
    if (newDetails.paymentDeadline) {
        newDetails.paymentDeadline = toTimestamp(newDetails.paymentDeadline);
    } else if (newDetails.paymentDeadline !== undefined) {
        newDetails.paymentDeadline = null;
    }


    // Auto/Moto specific
    if (newDetails.theoreticalClassDates) {
        newDetails.theoreticalClassDates = newDetails.theoreticalClassDates.map((d: any) => d ? toTimestamp(d) : null).filter(Boolean);
    }
    if (newDetails.practicalClassSchedules) {
        newDetails.practicalClassSchedules = newDetails.practicalClassSchedules
            .map((s: { date?: Date, time?: string }) => ({
                ...s,
                date: s.date ? toTimestamp(s.date) : null,
            }))
            .filter((s: { date: any; }) => s.date);
    }
     if (newDetails.motoPracticalClassSchedules) {
        newDetails.motoPracticalClassSchedules = newDetails.motoPracticalClassSchedules
            .map((s: { date?: Date, time?: string }) => ({
                ...s,
                date: s.date ? toTimestamp(s.date) : null,
            }))
            .filter((s: { date: any; }) => s.date);
    }

    // Ampliaciones specific
    if (newDetails.theoreticalClassDate) {
        newDetails.theoreticalClassDate = toTimestamp(newDetails.theoreticalClassDate);
    }

    return newDetails;
};

const coursePlans = {
  'Curso Auto': [
    { name: 'Paquete Básico 8hrs', price: 133.00 },
    { name: 'Paquete Plus 10hrs', price: 150.00 },
    { name: 'Paquete Premium 12hrs', price: 175.00 },
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
    { name: 'Paquete Básico 8hrs (Auto)', price: 133.00 },
    { name: 'Paquete Plus 10hrs (Auto)', price: 150.00 },
    { name: 'Paquete Premium 12hrs (Auto)', price: 175.00 },
    { name: 'Paquete Básico 8hrs (Moto)', price: 115.00 },
    { name: 'Paquete Plus 10hrs (Moto)', price: 135.00 },
    { name: 'Paquete Premium 12hrs (Moto)', price: 155.00 },
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
  // Mixto
  'Auto + Moto 10Hrs': 5, // 5 auto + 5 moto = 10 total. Let's adjust logic for this.
  'Básico Auto + Moto': 3, // Assuming 3 auto, 3 moto
  'Plus Auto + Moto': 3,
  'Premium Auto + Moto': 3,
  'Básico Moto + Auto': 3,
  'Plus Moto + Auto': 3,
  'Premium Moto + Auto': 3,
  'Reforzamiento Mixto 2Hrs': 1, // 1 auto, 1 moto
  // Solo Practica
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
  { combo: ['D', 'E1'].sort(), price: 85.00 },
  { combo: ['E1', 'E2'].sort(), price: 75.00 },
  { combo: ['E1', 'E2', 'E3'].sort(), price: 85.00 },
  { combo: ['E1', 'E2', 'E3', 'F'].sort(), price: 95.00 },
  { combo: ['B', 'D'].sort(), price: 85.00 },
  { combo: ['B', 'E1'].sort(), price: 85.00 },
  { combo: ['E2', 'E3'].sort(), price: 85.00 },
  { combo: ['B', 'F'].sort(), price: 85.00 },
];


// --- Componente del Formulario ---

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
        studentIdNumber: '',
        studentAddress: '',
        studentPhone1: '',
        studentPhone2: '',
        paymentAmount: 0,
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        studentIdNumber: '',
        studentAddress: '',
        studentPhone1: '',
        studentPhone2: '',
        courseValue: 0,
        downPayment: 0,
        balance: 0,
        theoreticalClassDates: [],
        practicalClassSchedules: [],
        motoPracticalClassSchedules: [],
        paidInFull: false,
      },
       ampliacionesDetails: {
        studentIdNumber: '',
        studentAddress: '',
        studentPhone1: '',
        studentPhone2: '',
        selectedPlans: [],
        courseValue: 0,
        downPayment: 0,
        balance: 0,
      }
    },
  });

  const { fields: practicalClassFields, replace: replacePracticalClasses } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.practicalClassSchedules",
  });
  
  const { fields: motoPracticalClassFields, replace: replaceMotoPracticalClasses } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.motoPracticalClassSchedules",
  });


  const handleCoursePlanChange = (planName: string) => {
    const currentContractType = form.getValues('contractType') as 'Curso Auto' | 'Curso Moto' | 'Curso Mixto' | 'Curso Solo Practica';
    const plan = coursePlans[currentContractType]?.find(p => p.name === planName);

    if (plan) {
        form.setValue('autoMotoDetails.courseValue', plan.price);
        const isSpecial = specialPlans.includes(plan.name);
        
        const downPaymentValue = isSpecial ? plan.price : plan.price * 0.5;
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
    if (checked) {
        const currentCourseValue = form.getValues('autoMotoDetails.courseValue') || 0;
        form.setValue('autoMotoDetails.downPayment', currentCourseValue);
        form.setValue('autoMotoDetails.balance', 0);
    } else {
        const currentCourseValue = form.getValues('autoMotoDetails.courseValue') || 0;
        const downPayment = currentCourseValue * 0.5;
        form.setValue('autoMotoDetails.downPayment', downPayment);
        form.setValue('autoMotoDetails.balance', currentCourseValue - downPayment);
    }
  };

  const handleDownPaymentChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    const { courseValue, coursePlan, paidInFull } = form.getValues('autoMotoDetails');

    // Format the input to two decimal places on blur
    e.target.value = value.toFixed(2);
    form.setValue('autoMotoDetails.downPayment', value);

    const newBalance = (courseValue || 0) - value;
    form.setValue('autoMotoDetails.balance', newBalance >= 0 ? newBalance : 0);

    // Validation logic for popup
    if (coursePlan && !specialPlans.includes(coursePlan) && !paidInFull) {
        const minDownPayment = (courseValue || 0) * 0.5;
        if (value < minDownPayment) {
            setAbonoDialogMessage(`El abono para este plan no puede ser inferior al 50%. El abono mínimo requerido es de B/. ${minDownPayment.toFixed(2)}.`);
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
                total = price;
                comboFound = true;
                break;
            }
        }

        if (!comboFound) {
            total = plans.reduce((sum, plan) => sum + (plan?.price || 0), 0);
        }

        form.setValue('ampliacionesDetails.courseValue', total);

        const minAbono = total > 100 ? total * 0.5 : total;
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
        minAbono = totalValue * 0.5;
        if (value < minAbono) {
            message = `Para montos superiores a B/.100, el abono mínimo es del 50%. El abono mínimo requerido es de B/. ${minAbono.toFixed(2)}.`;
        }
    } else if (totalValue > 0) {
        minAbono = totalValue;
        if (value < minAbono) {
            message = `Para montos de B/.100 o menos, se debe cancelar la totalidad. El abono mínimo requerido es de B/. ${minAbono.toFixed(2)}.`;
        }
    }

    if (message) {
        setAbonoDialogMessage(message);
        setMinAbonoRequired(minAbono);
        setIsAbonoDialogOpen(true);
    }
  };


  useEffect(() => {
    form.setValue('contractType', contractType);
    const existingValues = form.getValues();
    form.reset({
      ...existingValues,
      contractType: contractType,
      deluxeDetails: {
        ...form.formState.defaultValues.deluxeDetails,
      },
      autoMotoDetails: {
        ...form.formState.defaultValues.autoMotoDetails,
        vehicle: contractType === 'Curso Moto' ? 'Moto' : undefined,
      },
       ampliacionesDetails: {
        ...form.formState.defaultValues.ampliacionesDetails,
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractType]);


  async function onSubmit(values: FormValues) {
    if (!db || !user) {
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se ha podido conectar con la base de datos o el usuario no está autenticado.',
      });
      return;
    }

    // Manual Validation
    const baseValidation = baseClientSchema.safeParse(values);
    if (!baseValidation.success) {
      toast({ variant: 'destructive', title: 'Campos Inválidos', description: `Error en datos del cliente: ${baseValidation.error.errors[0].message}` });
      return;
    }

    let details, detailsSchema, studentIdNumber;
    
    switch(values.contractType) {
      case 'Curso Deluxe':
        details = values.deluxeDetails;
        detailsSchema = deluxeDetailsSchema;
        break;
      case 'Ampliaciones':
        details = values.ampliacionesDetails;
        detailsSchema = ampliacionesDetailsSchema;
        break;
      default:
        details = values.autoMotoDetails;
        detailsSchema = autoMotoDetailsSchema;
        break;
    }
    
    const detailsValidation = detailsSchema.safeParse(details);
    if (!detailsValidation.success) {
      toast({ variant: 'destructive', title: 'Campos Inválidos', description: `Error en detalles del contrato: ${detailsValidation.error.errors[0].message}` });
      return;
    }
    
    studentIdNumber = details.studentIdNumber;

    if (!studentIdNumber) {
      toast({ variant: 'destructive', title: 'Campo Requerido', description: 'La cédula del estudiante es obligatoria.' });
      return;
    }

    setIsSubmitting(true);
    let contractData: Partial<Contract> = {};

    try {
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, where('idNumber', '==', studentIdNumber));
      const clientSnapshot = await getDocs(q);
      const existingClientDoc = clientSnapshot.docs[0];

      const newContractId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contract_folio');
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          throw new Error('El contador de folios no existe.');
        }
        const newFolioNumber = counterDoc.data().count + 1;

        let clientId: string;

        if (!existingClientDoc) {
          const newClientRef = doc(collection(db, 'clients'));
          clientId = newClientRef.id;
          const clientData: Partial<Client> = {
            id: clientId,
            name: values.clientName,
            email: values.clientEmail,
            idNumber: studentIdNumber,
            userId: user.uid,
            createdAt: serverTimestamp() as Timestamp,
            phone: details.studentPhone1,
          };
          transaction.set(newClientRef, clientData);
        } else {
          clientId = existingClientDoc.id;
        }

        const newContractRef = doc(collection(db, 'contracts'));
        
        contractData = {
          id: newContractRef.id,
          folioNumber: newFolioNumber,
          title: values.contractType,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientId: clientId,
          type: values.contractType,
          status: 'active',
          userId: user.uid,
          createdAt: serverTimestamp() as Timestamp,
          createdBy: currentUserRole,
          content: '',
          deadlines: [],
        };
        
        if (values.contractType === 'Curso Deluxe') {
            contractData.deluxeDetails = convertDetailsDatesToTimestamps(values.deluxeDetails);
        } else if (values.contractType === 'Ampliaciones') {
            contractData.ampliacionesDetails = convertDetailsDatesToTimestamps(values.ampliacionesDetails);
        } else {
            contractData.autoMotoDetails = convertDetailsDatesToTimestamps(values.autoMotoDetails);
        }

        transaction.set(newContractRef, contractData);
        transaction.update(counterRef, { count: newFolioNumber });

        return newContractRef.id;
      });

      if (newContractId) {
        toast({
          title: 'Contrato Generado Exitosamente',
          description: `El contrato para ${values.clientName} ha sido creado.`,
        });
        router.push(`/contracts/${newContractId}`);
      }
    } catch (e: any) {
      const permissionError = new FirestorePermissionError({
        path: 'contracts',
        operation: 'create',
        requestResourceData: contractData,
      });
      errorEmitter.emit('permission-error', permissionError);

      console.error('Error al crear contrato: ', e);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: e.message || 'No se pudo crear el contrato. Revisa la consola para más detalles.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const renderPreview = () => {
    const values = form.getValues();
    let contractToPreview = { ...values, createdBy: currentUserRole } as unknown as Contract;
    
    return <ContractView contract={contractToPreview} type={contractType} />;
  };

  const selectedPlanName = form.watch('autoMotoDetails.coursePlan');
  const isSpecialPlan = selectedPlanName ? specialPlans.includes(selectedPlanName) : false;
  const isPaidInFull = form.watch('autoMotoDetails.paidInFull');
  const theoreticalSchedule = form.watch('autoMotoDetails.theoreticalClassSchedule');
  const numTheoreticalClasses = theoreticalSchedule?.includes('Semana') ? 4 : 3;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 print:p-0">
        
        <Card className="print:hidden">
            <CardHeader>
                <CardTitle>Datos del Estudiante</CardTitle>
                <CardDescription>
                    Completa la información principal del estudiante.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Nombre Completo del Estudiante</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="clientEmail"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: john.doe@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={
                            contractType === 'Curso Deluxe' ? 'deluxeDetails.studentIdNumber' :
                            contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentIdNumber' :
                            'autoMotoDetails.studentIdNumber'
                        }
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Cédula o Pasaporte</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: 8-123-456" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                        control={form.control}
                        name={
                            contractType === 'Curso Deluxe' ? 'deluxeDetails.studentAddress' :
                            contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentAddress' :
                            'autoMotoDetails.studentAddress'
                        }
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Dirección</FormLabel>
                            <FormControl><Input placeholder="Dirección completa" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={
                            contractType === 'Curso Deluxe' ? 'deluxeDetails.studentPhone1' :
                            contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentPhone1' :
                            'autoMotoDetails.studentPhone1'
                        }
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Teléfono 1</FormLabel>
                            <FormControl><Input placeholder="Ej: 6123-4567" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={
                            contractType === 'Curso Deluxe' ? 'deluxeDetails.studentPhone2' :
                            contractType === 'Ampliaciones' ? 'ampliacionesDetails.studentPhone2' :
                            'autoMotoDetails.studentPhone2'
                        }
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Teléfono 2 (Opcional)</FormLabel>
                            <FormControl><Input placeholder="Ej: 345-6789" {...field} /></FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>


        <Card className="print:hidden">
            <CardHeader>
                <CardTitle>Cláusula Primera - Valor y Forma de Pago</CardTitle>
                <CardDescription>
                    Define los detalles financieros del contrato.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {contractType === 'Curso Deluxe' && (
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="deluxeDetails.paymentDetails"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Plan de Pago</FormLabel>
                                <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    const amount = value === 'Premium B/ 201.00' ? 33.50 : 45.00;
                                    form.setValue('deluxeDetails.paymentAmount', amount);
                                }} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Premium B/ 201.00">Premium - 6 cuotas de B/. 33.50</SelectItem>
                                        <SelectItem value="Deluxe B/ 270.00">Deluxe - 6 cuotas de B/. 45.00</SelectItem>
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )}
                        />
                        <div>
                            <FormLabel>Fechas de Pago (6 Cuotas Quincenales)</FormLabel>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                 {Array.from({ length: 6 }).map((_, index) => (
                                    <FormField
                                        key={index}
                                        control={form.control}
                                        name={`deluxeDetails.paymentInstallments.${index}`}
                                        render={({ field }) => (
                                        <FormItem className='flex flex-col'>
                                            <FormLabel className='text-xs'>Cuota {index + 1}</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                 {(contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto' || contractType === 'Curso Solo Practica') && (
                     <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="autoMotoDetails.coursePlan"
                            render={({ field }) => (
                                <FormItem className="w-full">
                                    <FormLabel>Plan del Curso</FormLabel>
                                    <Select onValueChange={(value) => {
                                        field.onChange(value);
                                        handleCoursePlanChange(value);
                                    }} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {coursePlans[contractType as 'Curso Auto' | 'Curso Moto' | 'Curso Mixto' | 'Curso Solo Practica'].map(plan => (
                                                <SelectItem key={plan.name} value={plan.name}>
                                                    {plan.name} - B/. {plan.price.toFixed(2)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="autoMotoDetails.courseValue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor del Curso (B/.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                readOnly
                                                className="bg-muted"
                                                value={field.value || 0}
                                                onBlur={(e) => {
                                                    const value = parseFloat(e.target.value) || 0;
                                                    e.target.value = value.toFixed(2);
                                                    field.onChange(value);
                                                }}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="autoMotoDetails.downPayment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Abono (B/.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                defaultValue={field.value || ''}
                                                onBlur={handleDownPaymentChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="autoMotoDetails.balance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Saldo Pendiente (B/.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                readOnly
                                                className="bg-muted"
                                                value={field.value || 0}
                                                onBlur={(e) => {
                                                    const value = parseFloat(e.target.value) || 0;
                                                    e.target.value = value.toFixed(2);
                                                    field.onChange(value);
                                                }}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-end'>
                            <FormField
                                control={form.control}
                                name="autoMotoDetails.paidInFull"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 rounded-md border p-3 shadow-sm h-10">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(checked) => handlePaidInFullChange(Boolean(checked)) }
                                                disabled={isSpecialPlan}
                                            />
                                        </FormControl>
                                        <FormLabel className='mb-0 leading-none'>Pagado por completo</FormLabel>
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="autoMotoDetails.paymentDeadline"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Fecha Límite de Pago</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isPaidInFull || isSpecialPlan}>
                                                    {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar fecha</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                 )}
                 {contractType === 'Ampliaciones' && (
                     <div className="space-y-6">
                        <div>
                            <FormLabel>Planes de Ampliación</FormLabel>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                                {ampliacionesPlans.map(plan => (
                                    <FormField
                                        key={plan.name}
                                        control={form.control}
                                        name="ampliacionesDetails.selectedPlans"
                                        render={({ field }) => {
                                            const currentPlans = field.value || [];
                                            return (
                                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={currentPlans.some((p:any) => p.name === plan.name)}
                                                            onCheckedChange={(checked) => {
                                                                const newPlans = checked
                                                                    ? [...currentPlans, plan]
                                                                    : currentPlans.filter((p:any) => p.name !== plan.name);
                                                                field.onChange(newPlans);
                                                                handleAmpliacionesPlanChange(newPlans);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <div className="space-y-1 leading-none">
                                                        <FormLabel>{plan.name}</FormLabel>
                                                        <FormDescription>B/. {plan.price.toFixed(2)}</FormDescription>
                                                    </div>
                                                </FormItem>
                                            )
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                             <FormField
                                control={form.control}
                                name="ampliacionesDetails.courseValue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor Total (B/.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                readOnly
                                                className="bg-muted"
                                                value={field.value || 0}
                                                onBlur={(e) => {
                                                    const value = parseFloat(e.target.value) || 0;
                                                    e.target.value = value.toFixed(2);
                                                    field.onChange(value);
                                                }}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ampliacionesDetails.downPayment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Abono (B/.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                defaultValue={field.value || ''}
                                                onBlur={handleAmpliacionesDownPaymentChange}
                                            />
                                        </FormControl>
                                     <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ampliacionesDetails.balance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Saldo (B/.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                readOnly
                                                className="bg-muted"
                                                value={field.value || 0}
                                                 onBlur={(e) => {
                                                    const value = parseFloat(e.target.value) || 0;
                                                    e.target.value = value.toFixed(2);
                                                    field.onChange(value);
                                                }}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ampliacionesDetails.paymentDeadline"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Fecha Límite de Saldo</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </FormItem>
                            )}
                        />
                        </div>
                     </div>
                 )}
            </CardContent>
        </Card>

        <Card className="print:hidden">
            <CardHeader>
                <CardTitle>Cláusula Segunda - Detalles del Curso</CardTitle>
                <CardDescription>
                    Especifica los detalles académicos y logísticos del curso.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {contractType === 'Curso Deluxe' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.vehicleTransmission"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Transmisión de Vehículo</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Automático">Automático</SelectItem>
                                                <SelectItem value="Manual">Manual</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.licenseCategory"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Categoría de Licencia</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="A, C">A, C</SelectItem>
                                                <SelectItem value="A, C, D">A, C, D</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <div>
                                <FormField
                                    control={form.control}
                                    name="deluxeDetails.theoreticalClassSchedule"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Horario Teórico</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione el horario..."/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Lunes">Lunes (8:00am - 10:00am)</SelectItem>
                                                <SelectItem value="Miércoles">Miércoles (7:00pm - 9:00pm)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                                    {Array.from({ length: 10 }).map((_, index) => (
                                        <FormField
                                            key={index}
                                            control={form.control}
                                            name={`deluxeDetails.theoreticalClasses.${index}`}
                                            render={({ field }) => (
                                            <FormItem className='flex flex-col'>
                                                <FormLabel className='text-xs'>Semana {index + 1}</FormLabel>
                                                 <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal text-xs h-8", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "P", { locale: es }) : <span>Fecha</span>}
                                                            <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                                                        </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                            </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                             <div>
                                <FormLabel>Clases Prácticas (6 clases)</FormLabel>
                                <div className="space-y-2 mt-2 text-sm text-muted-foreground">
                                    Las fechas y horas de las clases prácticas se completarán a mano en el contrato impreso.
                                </div>
                            </div>
                    </div>
                 )}
                 {(contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto' || contractType === 'Curso Solo Practica') && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {contractType !== 'Curso Moto' && (
                                    <FormField
                                        control={form.control}
                                        name="autoMotoDetails.vehicleTransmission"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Transmisión</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Automático">Automático</SelectItem>
                                                    <SelectItem value="Manual">Manual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            </FormItem>
                                        )}
                                    />
                                )}
                                {contractType !== 'Curso Solo Practica' && (
                                    <FormField
                                        control={form.control}
                                        name="autoMotoDetails.licenseCategory"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Categoría de Licencia</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {contractType === 'Curso Moto' ? (
                                                        <SelectItem value="A, B">A, B</SelectItem>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="A, C">A, C</SelectItem>
                                                            <SelectItem value="A, C, D">A, C, D</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            </FormItem>
                                        )}
                                    />
                                )}
                                 <FormField
                                    control={form.control}
                                    name="autoMotoDetails.vehicle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Vehículo</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Spark">Spark</SelectItem>
                                                    <SelectItem value="P. Blanco">P. Blanco</SelectItem>
                                                    <SelectItem value="P. Bronce">P. Bronce</SelectItem>
                                                    <SelectItem value="Motocicleta">Motocicleta</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                             {contractType !== 'Curso Solo Practica' && (
                                <div>
                                    <FormField
                                        control={form.control}
                                        name="autoMotoDetails.theoreticalClassSchedule"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Horario Teórico</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar horario..." /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Días de Semana- Martes a Viernes de 8:00am a 10:00am">Días de Semana- Martes a Viernes de 8:00am a 10:00am</SelectItem>
                                                    <SelectItem value="Días Sábado- de 3:00pm a 5:00pm">Días Sábado- de 3:00pm a 5:00pm</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                        )}
                                    />
                                    <div className={cn("grid gap-2 mt-2", numTheoreticalClasses === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
                                        {Array.from({ length: numTheoreticalClasses }).map((_, index) => (
                                            <FormField
                                                key={index}
                                                control={form.control}
                                                name={`autoMotoDetails.theoreticalClassDates.${index}`}
                                                render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel className="text-xs">Clase Teórica {index + 1}</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                        </PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                             )}
                            
                            {contractType === 'Curso Mixto' ? (
                                <>
                                <div>
                                    <FormLabel>Clases Prácticas de Auto ({practicalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {practicalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-2 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => (
                                                        <FormItem>
                                                            <Select onValueChange={timeField.onChange} defaultValue={timeField.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={`Hora ${index + 1}`} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {practicalClassTimes.map(time => (
                                                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <FormLabel>Clases Prácticas de Moto ({motoPracticalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {motoPracticalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-2 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.motoPracticalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.motoPracticalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => (
                                                        <FormItem>
                                                            <Select onValueChange={timeField.onChange} defaultValue={timeField.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={`Hora ${index + 1}`} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {practicalClassTimes.map(time => (
                                                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                </>
                            ) : (
                                <div>
                                    <FormLabel>Clases Prácticas ({practicalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {practicalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-2 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => (
                                                        <FormItem>
                                                            <Select onValueChange={timeField.onChange} defaultValue={timeField.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={`Hora ${index + 1}`} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {practicalClassTimes.map(time => (
                                                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                     </div>
                 )}
                 {contractType === 'Ampliaciones' && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="ampliacionesDetails.theoreticalClassDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Fecha de Clase Teórica</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="ampliacionesDetails.theoreticalClassTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hora de Clase Teórica</FormLabel>
                                    <FormControl><Input placeholder="Ej: 9:00 AM" {...field} /></FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                 )}
            </CardContent>
        </Card>

        <AlertDialog open={isAbonoDialogOpen} onOpenChange={setIsAbonoDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Abono Mínimo Requerido</AlertDialogTitle>
                    <AlertDialogDescription>
                        {abonoDialogMessage}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cerrar y corregir manualmente</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                        if (contractType === 'Ampliaciones') {
                            form.setValue('ampliacionesDetails.downPayment', minAbonoRequired);
                            const balance = (form.getValues('ampliacionesDetails.courseValue') || 0) - minAbonoRequired;
                            form.setValue('ampliacionesDetails.balance', balance);
                        } else {
                            form.setValue('autoMotoDetails.downPayment', minAbonoRequired);
                            const balance = (form.getValues('autoMotoDetails.courseValue') || 0) - minAbonoRequired;
                            form.setValue('autoMotoDetails.balance', balance);
                        }
                    }}>
                        Usar Abono Mínimo
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        

        <div className="flex justify-between items-center print:hidden">
            <Button type="button" variant="outline" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? 'Ocultar Vista Previa' : 'Mostrar Vista Previa'}
            </Button>
            <div className="flex items-center gap-2">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
                </Button>
                {contractType === 'Curso Deluxe' && (
                    <Button type="submit" disabled={isSubmitting} variant="secondary">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Guardar Contrato Deluxe
                    </Button>
                )}
            </div>
        </div>

        {showPreview && (
            <div className="print:block">
                <h3 className="text-lg font-semibold my-4 print:hidden">Vista Previa del Contrato</h3>
                <div className="border rounded-lg p-4 bg-gray-50 print:hidden print:border-none print:p-0 print:bg-white">
                    {renderPreview()}
                </div>
            </div>
        )}
      </form>
    </Form>
  );
}
