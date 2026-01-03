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
  clientName: z.string().min(1, 'El nombre del cliente es requerido.'),
  clientEmail: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
  studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
  studentPhone2: z.string().optional(),
  contractType: z.custom<ContractType>(),
  folioNumber: z.number().optional(),
});

const autoMotoDetailsSchema = z.object({
  coursePlan: z.string().optional(),
  paidInFull: z.boolean().default(false),
  courseValue: z.number().optional(),
  downPayment: z.number().optional(),
  balance: z.number().optional(),
  paymentDeadline: z.date().optional().nullable(),
  vehicle: z.enum(['Spark', 'P. Blanco', 'P. Bronce', 'Moto']).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D', 'A, B']).optional(),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().optional()).optional(),
  practicalClassSchedules: z.array(classScheduleSchema).optional(),
  motoPracticalClassSchedules: z.array(classScheduleSchema).optional(),
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
  courseValue: z.number().optional(),
  downPayment: z.number().optional(),
  balance: z.number().optional(),
  paymentDeadline: z.date().optional().nullable(),
  theoreticalClassDate: z.date().optional(),
  theoreticalClassTime: z.string().optional(),
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

    // Deluxe
    if (newDetails.paymentInstallments) {
        newDetails.paymentInstallments = newDetails.paymentInstallments.map((d: Date | undefined) => d ? Timestamp.fromDate(d) : null);
    }
    if (newDetails.theoreticalClasses) {
        newDetails.theoreticalClasses = newDetails.theoreticalClasses.map((d: Date | undefined) => d ? Timestamp.fromDate(d) : null);
    }
    if (newDetails.classSchedules) {
        newDetails.classSchedules = newDetails.classSchedules.map((s: { date?: Date, time?: string }) => ({
            ...s,
            date: s.date ? Timestamp.fromDate(s.date) : null,
        }));
    }

    // Auto/Moto
    if (newDetails.paymentDeadline) {
        newDetails.paymentDeadline = Timestamp.fromDate(newDetails.paymentDeadline);
    }
    if (newDetails.theoreticalClassDates) {
        newDetails.theoreticalClassDates = newDetails.theoreticalClassDates.map((d: Date | undefined) => d ? Timestamp.fromDate(d) : null);
    }
    if (newDetails.practicalClassSchedules) {
        newDetails.practicalClassSchedules = newDetails.practicalClassSchedules.map((s: { date?: Date, time?: string }) => ({
            ...s,
            date: s.date ? Timestamp.fromDate(s.date) : null,
        }));
    }
     if (newDetails.motoPracticalClassSchedules) {
        newDetails.motoPracticalClassSchedules = newDetails.motoPracticalClassSchedules.map((s: { date?: Date, time?: string }) => ({
            ...s,
            date: s.date ? Timestamp.fromDate(s.date) : null,
        }));
    }

    // Ampliaciones
    if (newDetails.paymentDeadline) {
        newDetails.paymentDeadline = Timestamp.fromDate(newDetails.paymentDeadline);
    }
    if (newDetails.theoreticalClassDate) {
        newDetails.theoreticalClassDate = Timestamp.fromDate(newDetails.theoreticalClassDate);
    }


    return newDetails;
};

const coursePlans = {
  'Curso Auto': [
    { name: 'Básico', price: 155.15 },
    { name: 'Plus', price: 187.25 },
    { name: 'Premium', price: 230.05 },
  ],
  'Curso Moto': [
    { name: 'Básico', price: 101.65 },
    { name: 'Plus', price: 133.75 },
    { name: 'Premium', price: 165.85 },
  ],
};

const ampliacionesPlans = [
    { name: 'Teórico B', price: 20 },
    { name: 'Teórico C', price: 20 },
    { name: 'Teórico D', price: 25 },
    { name: 'Teórico E, F', price: 30 },
    { name: 'Teórico G, H, I', price: 35 },
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
  
  const contractType: ContractType = useMemo(() => contractTypeParam || 'Curso Auto', [contractTypeParam]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      studentPhone2: '',
      contractType: contractType,
      deluxeDetails: {
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        courseValue: 0,
        downPayment: 0,
        balance: 0,
        theoreticalClassDates: Array(3).fill(undefined),
        practicalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        motoPracticalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
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

  const { fields: practicalClassFields, append: appendPracticalClass, remove: removePracticalClass } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.practicalClassSchedules",
  });
  
  const { fields: motoPracticalClassFields, append: appendMotoPracticalClass, remove: removeMotoPracticalClass } = useFieldArray({
    control: form.control,
    name: "autoMotoDetails.motoPracticalClassSchedules",
  });

  const { fields: ampliacionesPlansFields, append: appendAmpliacionesPlan, remove: removeAmpliacionesPlan } = useFieldArray({
      control: form.control,
      name: "ampliacionesDetails.selectedPlans",
  });

  useEffect(() => {
    form.setValue('contractType', contractType);
    // Reset fields when type changes
    form.reset({
      clientName: form.getValues('clientName'),
      clientEmail: form.getValues('clientEmail'),
      studentIdNumber: form.getValues('studentIdNumber'),
      studentAddress: form.getValues('studentAddress'),
      studentPhone1: form.getValues('studentPhone1'),
      studentPhone2: form.getValues('studentPhone2'),
      contractType: contractType,
      deluxeDetails: {
        paymentInstallments: Array(6).fill(undefined),
        theoreticalClasses: Array(10).fill(undefined),
        classSchedules: Array(6).fill({ date: undefined, time: '' }),
      },
      autoMotoDetails: {
        courseValue: 0,
        downPayment: 0,
        balance: 0,
        theoreticalClassDates: Array(3).fill(undefined),
        practicalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        motoPracticalClassSchedules: Array(6).fill({ date: undefined, time: '' }),
        paidInFull: false,
      },
       ampliacionesDetails: {
        selectedPlans: [],
        courseValue: 0,
        downPayment: 0,
        balance: 0,
      }
    });
  }, [contractType, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
        if (name === 'ampliacionesDetails.selectedPlans') {
            const total = value.ampliacionesDetails?.selectedPlans?.reduce((sum, plan) => sum + (plan?.price || 0), 0) || 0;
            form.setValue('ampliacionesDetails.courseValue', total);
        }
        if (name === 'ampliacionesDetails.courseValue' || name === 'ampliacionesDetails.downPayment') {
            const total = value.ampliacionesDetails?.courseValue || 0;
            const downPayment = value.ampliacionesDetails?.downPayment || 0;
            form.setValue('ampliacionesDetails.balance', total - downPayment);
        }
        
        if (name === 'autoMotoDetails.coursePlan') {
            const planName = value.autoMotoDetails?.coursePlan;
            const currentContractType = value.contractType;
            if (planName && (currentContractType === 'Curso Auto' || currentContractType === 'Curso Moto')) {
                const plan = coursePlans[currentContractType].find(p => p.name === planName);
                if (plan) {
                    form.setValue('autoMotoDetails.courseValue', plan.price);
                }
            }
        }

        if (name === 'autoMotoDetails.courseValue' || name === 'autoMotoDetails.downPayment' || name === 'autoMotoDetails.paidInFull') {
            const courseValue = value.autoMotoDetails?.courseValue || 0;
            const downPayment = value.autoMotoDetails?.downPayment || 0;
            const paidInFull = value.autoMotoDetails?.paidInFull || false;
            if (paidInFull) {
                form.setValue('autoMotoDetails.downPayment', courseValue);
                form.setValue('autoMotoDetails.balance', 0);
            } else {
                form.setValue('autoMotoDetails.balance', courseValue - downPayment);
            }
        }
    });
    return () => subscription.unsubscribe();
  }, [form]);


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
    return <ContractView contract={values as unknown as Contract} type={contractType} />;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 print:p-0">
        
        {/* --- Sección de Búsqueda y Datos del Cliente --- */}
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


        {/* --- Card para Cláusula Primera --- */}
        <Card className="print:hidden">
            <CardHeader>
                <CardTitle>Cláusula Primera - Valor y Forma de Pago</CardTitle>
                <CardDescription>
                    Define los detalles financieros del contrato.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                       {(contractType === 'Curso Auto' || contractType === 'Curso Moto') && (
                           <FormField
                            control={form.control}
                            name="autoMotoDetails.coursePlan"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Plan del Curso</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {coursePlans[contractType].map(plan => (
                                                <SelectItem key={plan.name} value={plan.name}>
                                                    {plan.name} - B/. {plan.price.toFixed(2)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                            />
                       )}
                       <FormField
                            control={form.control}
                            name="autoMotoDetails.courseValue"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Valor del Curso (B/.)</FormLabel>
                                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="autoMotoDetails.paidInFull"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-start space-x-2 pb-2">
                                    <FormControl>
                                        <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormLabel className='mb-0'>Pagado por completo</FormLabel>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="autoMotoDetails.downPayment"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Abono (B/.)</FormLabel>
                                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} disabled={form.watch('autoMotoDetails.paidInFull')} /></FormControl>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="autoMotoDetails.balance"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Saldo Pendiente (B/.)</FormLabel>
                                <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
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
                                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={form.watch('autoMotoDetails.paidInFull')}>
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
                 )}
                 {contractType === 'Ampliaciones' && (
                     <div className="space-y-4">
                        <div>
                            <FormLabel>Planes de Ampliación</FormLabel>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                                {ampliacionesPlans.map(plan => (
                                    <div key={plan.name} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`plan-${plan.name}`}
                                            onCheckedChange={(checked) => {
                                                const currentPlans = form.getValues('ampliacionesDetails.selectedPlans') || [];
                                                if (checked) {
                                                    form.setValue('ampliacionesDetails.selectedPlans', [...currentPlans, plan]);
                                                } else {
                                                    form.setValue('ampliacionesDetails.selectedPlans', currentPlans.filter(p => p.name !== plan.name));
                                                }
                                            }}
                                        />
                                        <label htmlFor={`plan-${plan.name}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            {plan.name} (B/.{plan.price})
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                             <FormField
                                control={form.control}
                                name="ampliacionesDetails.courseValue"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Valor Total (B/.)</FormLabel>
                                    <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ampliacionesDetails.downPayment"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Abono (B/.)</FormLabel>
                                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ampliacionesDetails.balance"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Saldo (B/.)</FormLabel>
                                    <FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl>
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

        {/* --- Card para Cláusula Segunda --- */}
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
                        <div className="grid grid-cols-2 gap-4">
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
                            </div>
                             <div>
                                <FormField
                                    control={form.control}
                                    name="autoMotoDetails.theoreticalClassSchedule"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Horario Teórico</FormLabel>
                                        <FormControl><Input {...field} placeholder="Ej: Lunes, Miércoles y Viernes de 8am a 10am" /></FormControl>
                                    </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                     {Array.from({ length: 3 }).map((_, index) => (
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
                                            <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => <FormItem><FormControl><Input placeholder={`Hora ${index+1}`} {...timeField} /></FormControl></FormItem>}
                                                />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removePracticalClass(index)}>Eliminar</Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendPracticalClass({ date: undefined, time: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase de Auto
                                    </Button>
                                </div>
                                <div>
                                    <FormLabel>Clases Prácticas de Moto ({motoPracticalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {motoPracticalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.motoPracticalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.motoPracticalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => <FormItem><FormControl><Input placeholder={`Hora ${index+1}`} {...timeField} /></FormControl></FormItem>}
                                                />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeMotoPracticalClass(index)}>Eliminar</Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendMotoPracticalClass({ date: undefined, time: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase de Moto
                                    </Button>
                                </div>
                                </>
                            ) : (
                                <div>
                                    <FormLabel>Clases Prácticas ({practicalClassFields.length})</FormLabel>
                                    <div className="space-y-2 mt-2">
                                        {practicalClassFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-3 gap-2 items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.date`}
                                                    render={({ field: dateField }) => <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "P", { locale: es }) : <span>Fecha {index + 1}</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} /></PopoverContent></Popover></FormItem>}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`autoMotoDetails.practicalClassSchedules.${index}.time`}
                                                    render={({ field: timeField }) => <FormItem><FormControl><Input placeholder={`Hora ${index+1}`} {...timeField} /></FormControl></FormItem>}
                                                />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removePracticalClass(index)}>Eliminar</Button>
                                            </div>
                                        ))}
                                    </div>
                                     <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendPracticalClass({ date: undefined, time: '' })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase
                                    </Button>
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
        

        {/* --- Botones de Acción --- */}
        <div className="flex justify-between items-center print:hidden">
            <Button type="button" variant="outline" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? 'Ocultar Vista Previa' : 'Mostrar Vista Previa'}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
            </Button>
        </div>

        {/* --- Vista Previa del Contrato --- */}
        {showPreview && (
            <div className="print:block">
                <h3 className="text-lg font-semibold my-4 print:hidden">Vista Previa del Contrato</h3>
                <div className="border rounded-lg p-4 bg-gray-50 print:border-none print:p-0 print:bg-white">
                    {renderPreview()}
                </div>
            </div>
        )}
      </form>
    </Form>
  );
}
