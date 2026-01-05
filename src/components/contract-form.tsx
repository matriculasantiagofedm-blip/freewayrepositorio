

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  SelectGroup,
  SelectLabel as SelectLabelComponent,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, PlusCircle, Loader2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, writeBatch, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, Client } from '@/lib/types';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { AutoMotoContractTemplatePreview } from './auto-moto-contract-preview';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useCurrentRole } from '@/hooks/use-current-role';
import { AmpliacionesContractTemplate } from './ampliaciones-contract';
import { ContractView } from './contract-view';
import { useDb, useUser } from './firebase-provider';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Label } from './ui/label';


// --- Esquemas de Validación con Zod ---

const classScheduleSchema = z.object({
    date: z.date().optional(),
    time: z.string().optional(),
});

const baseSchema = z.object({
  clientName: z.string()
    .min(1, 'El nombre del cliente es requerido.')
    .refine((name) => !/\d/.test(name), {
        message: "El nombre no debe contener números.",
    }),
  clientEmail: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
  studentAddress: z.string().min(1, 'La dirección es requerida.'),
  studentPhone1: z.string().min(1, 'El teléfono es requerido.'),
  studentPhone2: z.string().optional(),
  contractType: z.custom<ContractType>(),
  folioNumber: z.number().optional(),
});

const specialPlans = [
    'Reforzamiento de 4 horas',
    'Ya se manejar Plus 2 horas',
    'Ya se manejar (Evaluación de estacionamiento)',
    'Reforzamiento Mixto 2Hrs'
];

const autoMotoDetailsSchema = z.object({
  coursePlan: z.string().optional(),
  paidInFull: z.boolean().default(false),
  courseValue: z.number().default(0),
  downPayment: z.number().min(0, "El abono no puede ser negativo.").default(0),
  balance: z.number().default(0),
  paymentDeadline: z.date().optional().nullable(),
  vehicle: z.enum(['Spark', 'P. Blanco', 'P. Bronce', 'Moto']).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D', 'A, B']).optional(),
  theoreticalClassSchedule: z.enum(['Días de Semana- Martes a Viernes de 8:00am a 10:00am', 'Días Sábado- de 3:00pm a 5:00pm']).optional(),
  theoreticalClassDates: z.array(z.date().optional()).optional(),
  practicalClassSchedules: z.array(classScheduleSchema).optional(),
  motoPracticalClassSchedules: z.array(classScheduleSchema).optional(),
}).superRefine((data, ctx) => {
    // Si es un plan especial o está pagado por completo, no aplicamos la validación del 50%
    if (data.coursePlan && specialPlans.includes(data.coursePlan) || data.paidInFull) {
        return;
    }
    const totalValue = data.courseValue || 0;
    const minAbono = totalValue * 0.5;

    if (data.downPayment < minAbono) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['downPayment'],
            message: `El abono debe ser de al menos el 50% (B/. ${minAbono.toFixed(2)}).`
        });
    }
});


const deluxeDetailsSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  secondLastName: z.string().optional(),
  paymentDetails: z.enum(['Premium B/ 201.00', 'Deluxe B/ 270.00']).optional(),
  paymentAmount: z.number().optional(),
  paymentInstallments: z.array(z.date().optional()).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
  theoreticalClassSchedule: z.enum(['Lunes', 'Miércoles']).optional(),
  theoreticalClasses: z.array(z.date().optional()).optional(),
  classSchedules: z.array(classScheduleSchema).optional(),
});

const ampliacionesDetailsSchema = z.object({
  selectedPlans: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
  courseValue: z.number().default(0),
  downPayment: z.number().min(0, "El abono no puede ser negativo.").default(0),
  balance: z.number().default(0),
  paymentDeadline: z.date().optional().nullable(),
  theoreticalClassDate: z.date().optional(),
  theoreticalClassTime: z.string().optional(),
}).superRefine((data, ctx) => {
    const totalValue = data.courseValue || 0;
    if (totalValue > 100) {
        const minAbono = totalValue * 0.5;
        if (data.downPayment < minAbono) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['downPayment'],
                message: `Para montos superiores a B/.100, el abono mínimo es del 50% (B/. ${minAbono.toFixed(2)}).`
            });
        }
    } else {
        if (data.downPayment < totalValue) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['downPayment'],
                message: `Para montos de B/.100 o menos, se debe cancelar la totalidad (B/. ${totalValue.toFixed(2)}).`
            });
        }
    }
});

const formSchema = baseSchema.extend({
  deluxeDetails: deluxeDetailsSchema.optional(),
  autoMotoDetails: autoMotoDetailsSchema.optional(),
  ampliacionesDetails: ampliacionesDetailsSchema.optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Función auxiliar para convertir las fechas de los detalles a Timestamps de Firestore
const convertDetailsDatesToTimestamps = (details: any, baseValues: any) => {
    if (!details) details = {};
    const newDetails = { ...details };

    // Common fields
    newDetails.studentIdNumber = baseValues.studentIdNumber;
    newDetails.studentAddress = baseValues.studentAddress;
    newDetails.studentPhone1 = baseValues.studentPhone1;
    newDetails.studentPhone2 = baseValues.studentPhone2;

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
    } else {
        // Explicitly set to null if undefined to avoid Firestore error
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
};

const planToClassCount: { [key: string]: number } = {
  'Paquete Básico 8hrs': 4,
  'Paquete Plus 10hrs': 5,
  'Paquete Premium 12hrs': 6,
  'Reforzamiento de 4 horas': 2,
  'Ya se manejar Plus 2 horas': 1,
  'Ya se manejar (Evaluación de estacionamiento)': 1,
  // Mixto
  'Auto + Moto 10Hrs': 6, 
  'Básico Auto + Moto': 6,
  'Plus Auto + Moto': 6,
  'Premium Auto + Moto': 6,
  'Básico Moto + Auto': 6,
  'Plus Moto + Auto': 6,
  'Premium Moto + Auto': 6,
  'Reforzamiento Mixto 2Hrs': 1,
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
  { combo: ['D', 'E1', 'E2', 'E3', 'F'], price: 150.00 },
  { combo: ['B', 'E1', 'E2', 'E3', 'F'], price: 150.00 },
  { combo: ['D', 'E1'], price: 85.00 },
  { combo: ['E1', 'E2'], price: 75.00 },
  { combo: ['E1', 'E2', 'E3'], price: 85.00 },
  { combo: ['E1', 'E2', 'E3', 'F'], price: 95.00 },
  { combo: ['B', 'D'], price: 85.00 },
  { combo: ['B', 'E1'], price: 85.00 },
  { combo: ['E2', 'E3'], price: 85.00 },
  { combo: ['B', 'F'], price: 85.00 },
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
    resolver: zodResolver(formSchema),
    mode: 'onBlur', // Trigger validation on blur
    defaultValues: {
      clientName: '',
      clientEmail: '',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      studentPhone2: '',
      contractType: contractType,
      deluxeDetails: {
        paymentAmount: 0,
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        courseValue: 0,
        downPayment: 0,
        balance: 0,
        theoreticalClassDates: [],
        practicalClassSchedules: [],
        motoPracticalClassSchedules: [],
        paidInFull: false,
      },
       ampliacionesDetails: {
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

  const { fields: ampliacionesPlansFields, append: appendAmpliacionesPlan, remove: removeAmpliacionesPlan } = useFieldArray({
      control: form.control,
      name: "ampliacionesDetails.selectedPlans",
  });

  const handleCoursePlanChange = (planName: string) => {
    const currentContractType = form.getValues('contractType') as 'Curso Auto' | 'Curso Moto' | 'Curso Mixto';
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
            const halfCount = Math.floor(classCount / 2);
            replacePracticalClasses(Array.from({ length: halfCount }, () => ({ date: undefined, time: '' })));
            replaceMotoPracticalClasses(Array.from({ length: classCount - halfCount }, () => ({ date: undefined, time: '' })));
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

        // Check for special combinations first, longer combos first
        for (const { combo, price } of specialCombinations) {
            const sortedCombo = [...combo].sort();
            if (JSON.stringify(selectedNames) === JSON.stringify(sortedCombo)) {
                total = price;
                comboFound = true;
                break;
            }
        }

        // If no special combination matches, sum individual prices
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
    
    // Format the input to two decimal places on blur
    e.target.value = value.toFixed(2);
    form.setValue('ampliacionesDetails.downPayment', value);

    const newBalance = (courseValue || 0) - value;
    form.setValue('ampliacionesDetails.balance', newBalance >= 0 ? newBalance : 0);

    // Validation Logic
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
    form.reset({
      clientName: form.getValues('clientName'),
      clientEmail: form.getValues('clientEmail'),
      studentIdNumber: form.getValues('studentIdNumber'),
      studentAddress: form.getValues('studentAddress'),
      studentPhone1: form.getValues('studentPhone1'),
      studentPhone2: form.getValues('studentPhone2'),
      contractType: contractType,
      deluxeDetails: {
        paymentAmount: 0,
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        courseValue: 0,
        downPayment: 0,
        balance: 0,
        theoreticalClassDates: [],
        practicalClassSchedules: [],
        motoPracticalClassSchedules: [],
        paidInFull: false,
        vehicle: contractType === 'Curso Moto' ? 'Moto' : undefined,
      },
       ampliacionesDetails: {
        selectedPlans: [],
        courseValue: 0,
        downPayment: 0,
        balance: 0,
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractType]);


  async function onSubmit(values: FormValues) {
    if (!db || !user) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se ha podido conectar con la base de datos o el usuario no está autenticado.',
        });
        return;
    }
    setIsSubmitting(true);
    
    // Combine names for deluxe contract
    if (contractType === 'Curso Deluxe' && values.deluxeDetails) {
        values.clientName = [values.deluxeDetails.firstName, values.deluxeDetails.middleName, values.deluxeDetails.lastName, values.deluxeDetails.secondLastName].filter(Boolean).join(' ');
    }
    
    try {
        await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, 'counters', 'contract_folio');
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists()) {
                throw new Error("El contador de folios no existe. Por favor, inicialízalo en la base de datos.");
            }

            const newFolioNumber = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: newFolioNumber });
            
            const clientsRef = collection(db, 'clients');
            const q = query(clientsRef, where("idNumber", "==", values.studentIdNumber));
            const clientSnapshot = await getDocs(q);

            let clientId: string;
            
            if (clientSnapshot.empty) {
                // Create new client
                const newClientRef = doc(clientsRef);
                clientId = newClientRef.id;
                const clientData = {
                    id: clientId,
                    name: values.clientName,
                    email: values.clientEmail,
                    idNumber: values.studentIdNumber,
                    phone: values.studentPhone1,
                    userId: user.uid,
                    createdAt: serverTimestamp() as Timestamp,
                };
                transaction.set(newClientRef, clientData);
            } else {
                // Use existing client
                clientId = clientSnapshot.docs[0].id;
            }

            // 2. Create the contract
            const newContractRef = doc(collection(db, 'contracts'));
            
            const contractData: Partial<Contract> = {
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

            const baseValues = {
                studentIdNumber: values.studentIdNumber,
                studentAddress: values.studentAddress,
                studentPhone1: values.studentPhone1,
                studentPhone2: values.studentPhone2,
            };

            if (values.contractType === 'Curso Deluxe') {
                 contractData.deluxeDetails = convertDetailsDatesToTimestamps(values.deluxeDetails, baseValues);
            } else if (values.contractType === 'Ampliaciones') {
                contractData.ampliacionesDetails = convertDetailsDatesToTimestamps(values.ampliacionesDetails, baseValues);
            }
            else {
                contractData.autoMotoDetails = convertDetailsDatesToTimestamps(values.autoMotoDetails, baseValues);
            }
            
            transaction.set(newContractRef, contractData);

            return newContractRef.id;
        }).then((newContractId) => {
             if (newContractId) {
                toast({
                    title: 'Contrato Generado Exitosamente',
                    description: `El contrato para ${values.clientName} ha sido creado.`,
                });
                router.push(`/contracts/${newContractId}`);
            }
        });
    } catch (e: any) {
        console.error("Error al crear contrato: ", e);
        if (e.name !== 'FirestorePermissionError') {
             toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: e.message || 'No se pudo crear el contrato. Revisa los permisos de Firestore.',
            });
        }
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handlePrintPreview = () => {
    const printUrl = `/print-contract/preview`; // A dummy URL for preview
    sessionStorage.setItem('contractPreviewData', JSON.stringify(form.getValues()));
    window.open(printUrl, '_blank');
  };

  const renderPreview = () => {
    const values = form.getValues();
    return <ContractView contract={{...values, createdBy: currentUserRole} as unknown as Contract} type={contractType} />;
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
                        name="studentIdNumber"
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
                        name="studentAddress"
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
                        name="studentPhone1"
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
                        name="studentPhone2"
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
                 {(contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto') && (
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
                                            {coursePlans[contractType as 'Curso Auto' | 'Curso Moto' | 'Curso Mixto'].map(plan => (
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
                                                <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
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
                                                            checked={currentPlans.some(p => p.name === plan.name)}
                                                            onCheckedChange={(checked) => {
                                                                const newPlans = checked
                                                                    ? [...currentPlans, plan]
                                                                    : currentPlans.filter((p) => p.name !== plan.name);
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
                 {(contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto') && (
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
                                 <FormField
                                    control={form.control}
                                    name="autoMotoDetails.vehicle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Vehículo</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={contractType === 'Curso Moto'}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {contractType === 'Curso Moto' ? (
                                                        <SelectItem value="Moto">Moto</SelectItem>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="Spark">Spark</SelectItem>
                                                            <SelectItem value="P. Blanco">P. Blanco</SelectItem>
                                                            <SelectItem value="P. Bronce">P. Bronce</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
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
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
            </Button>
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

    








