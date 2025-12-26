
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
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { ContractType } from '@/lib/types';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { AutoMotoContractTemplatePreview } from './auto-moto-contract-preview';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AccordionWrapper } from './accordion-wrapper';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

// --- Esquemas de Validación con Zod ---

const classScheduleSchema = z.object({
    date: z.date().optional(),
    time: z.string().optional(),
});

const baseSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  contractType: z.custom<ContractType>(),
});

const autoMotoDetailsSchema = z.object({
  studentIdNumber: z.string().min(1, 'La cédula es requerida'),
  studentAddress: z.string().min(1, 'La dirección es requerida'),
  studentPhone1: z.string().min(1, 'Se requiere al menos un teléfono'),
  studentPhone2: z.string().optional(),
  coursePlan: z.string().optional(),
  paidInFull: z.boolean().default(false),
  courseValue: z.number().optional(),
  downPayment: z.number().optional(),
  balance: z.number().optional(),
  paymentDeadline: z.date().optional(),
  vehicle: z.enum(['Spark', 'P. Blanco', 'P. Bronce', 'Moto']).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D', 'A, B']).optional(),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().optional()).optional(),
  practicalClassSchedules: z.array(classScheduleSchema).optional(),
  motoPracticalClassSchedules: z.array(classScheduleSchema).optional(),
}).partial();

const deluxeDetailsSchema = z.object({
  studentIdNumber: z.string().min(1, 'La cédula es requerida'),
  studentAddress: z.string().min(1, 'La dirección es requerida'),
  studentPhone1: z.string().min(1, 'Se requiere al menos un teléfono'),
  studentPhone2: z.string().optional(),
  paymentDetails: z.string().optional(),
  paymentAmount: z.number().optional(),
  paymentInstallments: z.array(z.date().optional()).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
  theoreticalClassSchedule: z.enum(['Lunes', 'Miércoles']).optional(),
  theoreticalClasses: z.array(z.date().optional()).optional(),
  classSchedules: z.array(classScheduleSchema).optional(),
}).partial();

const formSchema = baseSchema.extend({
  contractType: z.custom<ContractType>(),
  autoMotoDetails: autoMotoDetailsSchema.optional(),
  deluxeDetails: deluxeDetailsSchema.optional(),
}).passthrough();

type FormValues = z.infer<typeof formSchema>;


// --- Datos Estáticos ---
const coursePlans = {
  'Curso Auto': [
    { name: 'BÁSICO', price: 133.00, classes: 4 },
    { name: 'PLUS', price: 150.00, classes: 5 },
    { name: 'PREMIUM', price: 175.00, classes: 6 },
  ],
  'Curso Moto': [
    { name: 'BÁSICO', price: 115.00, classes: 4 },
    { name: 'PLUS', price: 135.00, classes: 5 },
    { name: 'PREMIUM', price: 155.00, classes: 6 },
  ],
  'Curso Mixto': [
    { name: 'PAQUETE MIXTO COMPLETO', price: 380.00, classes: 6, motoClasses: 4 },
  ],
};


const practicalClassTimeSlots = [
  '8:00 am a 10:00 am',
  '10:00 am a 12:00 pm',
  '1:00 pm a 3:00 pm',
  '3:00 pm a 5:00 pm',
];

const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(2);
};

export function ContractForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [folio, setFolio] = useState('');
    const [currentStep, setCurrentStep] = useState(0);

    const contractType = useMemo(() => searchParams.get('type') as ContractType | null, [searchParams]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            contractType: contractType || 'Curso Auto',
        },
    });

    const watchedValues = form.watch();
    const watchedPaidInFull = form.watch('autoMotoDetails.paidInFull');


    const { fields: theoreticalClassFields, replace: replaceTheoreticalClasses } = useFieldArray({
        control: form.control,
        name: "autoMotoDetails.theoreticalClassDates" as any,
    });

    const { fields: practicalClassFields, replace: replacePracticalClasses } = useFieldArray({
        control: form.control,
        name: "autoMotoDetails.practicalClassSchedules" as any,
    });
    
    const { fields: motoPracticalClassFields, replace: replaceMotoPracticalClasses } = useFieldArray({
        control: form.control,
        name: "autoMotoDetails.motoPracticalClassSchedules" as any,
    });

    const { fields: deluxeClassFields, replace: replaceDeluxeClasses } = useFieldArray({
        control: form.control,
        name: "deluxeDetails.classSchedules" as any,
    });

    useEffect(() => {
        if (contractType) {
            form.reset({
                contractType: contractType,
                clientName: '',
                clientEmail: '',
                autoMotoDetails: {
                  paidInFull: false,
                  courseValue: undefined,
                  downPayment: undefined,
                  balance: undefined,
                  theoreticalClassDates: [],
                  practicalClassSchedules: [],
                  motoPracticalClassSchedules: []
                },
            });

            if (contractType === 'Curso Deluxe') {
                replaceDeluxeClasses(Array(6).fill({ date: undefined, time: undefined }));
            } else {
                 replacePracticalClasses([]);
                 replaceMotoPracticalClasses([]);
            }
        }
    }, [contractType, form, replaceDeluxeClasses, replacePracticalClasses, replaceMotoPracticalClasses]);

    
     useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name === 'autoMotoDetails.coursePlan' || name === 'autoMotoDetails.paidInFull' || name === 'autoMotoDetails.downPayment') {
                const planName = value.autoMotoDetails?.coursePlan;
                const isPaidInFull = value.autoMotoDetails?.paidInFull;
                const downPayment = value.autoMotoDetails?.downPayment || 0;
                
                let newCourseValue = value.autoMotoDetails?.courseValue || 0;
                let newDownPayment = downPayment;

                if (name === 'autoMotoDetails.coursePlan' && contractType && (coursePlans as any)[contractType]) {
                    const selectedPlan = (coursePlans as any)[contractType].find((p: any) => p.name === planName);
                    if (selectedPlan) {
                        newCourseValue = selectedPlan.price;
                        form.setValue('autoMotoDetails.courseValue', newCourseValue, { shouldValidate: true });
                        
                        if (contractType === 'Curso Auto' || contractType === 'Curso Moto') {
                            replacePracticalClasses(Array(selectedPlan.classes).fill({ date: undefined, time: undefined }));
                        } else if (contractType === 'Curso Mixto') {
                            replacePracticalClasses(Array(selectedPlan.classes || 6).fill({ date: undefined, time: undefined }));
                            replaceMotoPracticalClasses(Array(selectedPlan.motoClasses || 4).fill({ date: undefined, time: undefined }));
                        }
                    } else {
                         newCourseValue = 0;
                         form.setValue('autoMotoDetails.courseValue', newCourseValue, { shouldValidate: true });
                         replacePracticalClasses([]);
                         replaceMotoPracticalClasses([]);
                    }
                }
                
                if (isPaidInFull) {
                    newDownPayment = newCourseValue;
                    if(form.getValues('autoMotoDetails.downPayment') !== newDownPayment){
                        form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                    }
                } else if (name === 'autoMotoDetails.coursePlan' || name === 'autoMotoDetails.paidInFull') {
                    if (name !== 'autoMotoDetails.downPayment') {
                        newDownPayment = 0;
                        if(form.getValues('autoMotoDetails.downPayment') !== newDownPayment){
                            form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                        }
                    }
                }

                const newBalance = newCourseValue - newDownPayment;
                 if(form.getValues('autoMotoDetails.balance') !== newBalance){
                    form.setValue('autoMotoDetails.balance', newBalance < 0 ? 0 : newBalance, { shouldValidate: true });
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form, contractType, replacePracticalClasses, replaceMotoPracticalClasses]);


    useEffect(() => {
        const typePrefix = contractType?.substring(0, 3).toUpperCase() || 'GEN';
        const uniqueId = Date.now().toString().slice(-6);
        setFolio(`${typePrefix}-${uniqueId}`);
    }, [contractType]);

    useEffect(() => {
        const theoreticalSchedule = form.watch('autoMotoDetails.theoreticalClassSchedule');
        if (theoreticalSchedule?.includes('Días de Semana')) {
            replaceTheoreticalClasses(Array(5).fill(undefined));
        } else if (theoreticalSchedule?.includes('Sábados')) {
            replaceTheoreticalClasses(Array(3).fill(undefined));
        }
    }, [form, replaceTheoreticalClasses]);


    const onSubmit = async (values: FormValues) => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar a la base de datos. Por favor, inicie sesión.' });
            return;
        }

        try {
            const batch = writeBatch(firestore);

            // 1. Crear o encontrar cliente
            const clientRef = doc(collection(firestore, 'clients'));
            const clientData = {
                id: clientRef.id,
                name: values.clientName,
                email: values.clientEmail,
                idNumber: values.autoMotoDetails?.studentIdNumber || values.deluxeDetails?.studentIdNumber,
                userId: user.uid,
                createdAt: serverTimestamp(),
            };
            batch.set(clientRef, clientData);
            
            // 2. Crear contrato
            const contractRef = doc(collection(firestore, 'contracts'));
            
            const currentUserRole = localStorage.getItem('currentUser') || 'Ventas';

            const contractData: any = {
                id: contractRef.id,
                folio: folio,
                title: `${values.contractType} - ${values.clientName}`,
                clientName: values.clientName,
                clientEmail: values.clientEmail,
                clientId: clientRef.id,
                content: `Contrato de ${values.contractType} para ${values.clientName}.`,
                deadlines: [],
                status: 'active',
                type: values.contractType,
                userId: user.uid,
                createdAt: serverTimestamp(),
                createdBy: currentUserRole,
            };

             if (contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto') {
                contractData.autoMotoDetails = {
                    studentIdNumber: values.autoMotoDetails?.studentIdNumber,
                    studentAddress: values.autoMotoDetails?.studentAddress,
                    studentPhone1: values.autoMotoDetails?.studentPhone1,
                    studentPhone2: values.autoMotoDetails?.studentPhone2 || null,
                    courseValue: values.autoMotoDetails?.courseValue || null,
                    downPayment: values.autoMotoDetails?.downPayment || null,
                    balance: values.autoMotoDetails?.balance || null,
                    paymentDeadline: values.autoMotoDetails?.paymentDeadline ? format(values.autoMotoDetails.paymentDeadline, 'yyyy-MM-dd') : null,
                    vehicle: values.autoMotoDetails?.vehicle || null,
                    vehicleTransmission: values.autoMotoDetails?.vehicleTransmission || null,
                    licenseCategory: values.autoMotoDetails?.licenseCategory || null,
                    theoreticalClassSchedule: values.autoMotoDetails?.theoreticalClassSchedule || null,
                    theoreticalClassDates: values.autoMotoDetails?.theoreticalClassDates?.map(d => d ? format(d, 'yyyy-MM-dd') : null).filter(d => d) || [],
                    practicalClassSchedules: values.autoMotoDetails?.practicalClassSchedules?.map(c => ({ date: c.date ? format(c.date, 'yyyy-MM-dd') : null, time: c.time || null })).filter(c => c.date || c.time) || [],
                    motoPracticalClassSchedules: values.autoMotoDetails?.motoPracticalClassSchedules?.map(c => ({ date: c.date ? format(c.date, 'yyyy-MM-dd') : null, time: c.time || null })).filter(c => c.date || c.time) || [],
                };
            } else if (contractType === 'Curso Deluxe') {
                contractData.deluxeDetails = {
                    studentIdNumber: values.deluxeDetails?.studentIdNumber,
                    studentAddress: values.deluxeDetails?.studentAddress,
                    studentPhone1: values.deluxeDetails?.studentPhone1,
                    studentPhone2: values.deluxeDetails?.studentPhone2 || null,
                    paymentDetails: values.deluxeDetails?.paymentDetails || null,
                    paymentAmount: values.deluxeDetails?.paymentAmount || null,
                    paymentInstallments: values.deluxeDetails?.paymentInstallments?.map(d => d ? format(d, 'yyyy-MM-dd') : null).filter(d => d) || [],
                    vehicleTransmission: values.deluxeDetails?.vehicleTransmission || null,
                    licenseCategory: values.deluxeDetails?.licenseCategory || null,
                    theoreticalClassSchedule: values.deluxeDetails?.theoreticalClassSchedule || null,
                    theoreticalClasses: values.deluxeDetails?.theoreticalClasses?.map(d => d ? format(d, 'yyyy-MM-dd') : null).filter(d => d) || [],
                    classSchedules: values.deluxeDetails?.classSchedules?.map(c => ({ date: c.date ? format(c.date, 'yyyy-MM-dd') : null, time: c.time || null })).filter(c => c.date || c.time) || [],
                };
            }

            batch.set(contractRef, contractData);
            await batch.commit();

            toast({ title: 'Éxito', description: 'Contrato y cliente creados correctamente.' });
            router.push(`/contracts/${contractRef.id}`);

        } catch (error) {
            console.error("Error creating contract:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el contrato.' });
        }
    };
    
    const renderCommonFields = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre del Estudiante</FormLabel>
                            <FormControl><Input placeholder="ej., Juan Pérez" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="clientEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Correo electrónico del Estudiante</FormLabel>
                            <FormControl><Input type="email" placeholder="estudiante@ejemplo.com" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </>
    );

    const renderAutoMotoFields = () => (
        <>
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Cláusula Primera: Valor y Forma de Pago</h3>
            <FormField
                control={form.control}
                name="autoMotoDetails.coursePlan"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plan del Curso</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {contractType && (coursePlans as any)[contractType]?.map((c: any) => <SelectItem key={c.name} value={c.name}>{c.name} - ${c.price.toFixed(2)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="autoMotoDetails.studentIdNumber" render={({ field }) => (<FormItem><FormLabel>Cédula/Pasaporte</FormLabel><FormControl><Input placeholder="Ej. 8-123-456" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="autoMotoDetails.studentPhone1" render={({ field }) => (<FormItem><FormLabel>Teléfono 1</FormLabel><FormControl><Input type="tel" placeholder="Ej. 6123-4567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="autoMotoDetails.studentPhone2" render={({ field }) => (<FormItem><FormLabel>Teléfono 2 (Opcional)</FormLabel><FormControl><Input type="tel" placeholder="Ej. 399-9999" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField control={form.control} name="autoMotoDetails.studentAddress" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Textarea placeholder="Dirección completa del cliente..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="autoMotoDetails.courseValue" render={({ field }) => (<FormItem><FormLabel>Valor Total (B/.)</FormLabel><FormControl><Input type="number" step="0.01" value={formatCurrency(field.value)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="autoMotoDetails.downPayment" render={({ field }) => (<FormItem><FormLabel>Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} disabled={watchedPaidInFull} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="autoMotoDetails.balance" render={({ field }) => (<FormItem><FormLabel>Saldo (B/.)</FormLabel><FormControl><Input type="number" step="0.01" value={formatCurrency(field.value)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField
                control={form.control}
                name="autoMotoDetails.paidInFull"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                id="paidInFull"
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <label htmlFor='paidInFull' className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                               ¿Cancelar la totalidad del curso (100%)?
                            </label>
                        </div>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="autoMotoDetails.paymentDeadline"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Fecha Límite de Pago del Saldo</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        disabled={!watchedValues.autoMotoDetails?.balance || watchedValues.autoMotoDetails?.balance <= 0}
                                    >
                                        {field.value ? (
                                            format(field.value, "PPP", { locale: es })
                                        ) : (
                                            <span>mm/dd/aaaa</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date() || !watchedValues.autoMotoDetails?.balance || watchedValues.autoMotoDetails?.balance <= 0}
                                    initialFocus
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                         {(!watchedValues.autoMotoDetails?.balance || watchedValues.autoMotoDetails?.balance <= 0) && <FormDescription>No aplica, ya que el curso está cancelado en su totalidad.</FormDescription>}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Cláusula Segunda: Detalles del Curso</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="autoMotoDetails.vehicle" render={({ field }) => (<FormItem><FormLabel>Vehículo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un vehículo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Spark">Spark</SelectItem><SelectItem value="P. Blanco">Picanto Blanco</SelectItem><SelectItem value="P. Bronce">Picanto Bronce</SelectItem><SelectItem value="Moto">Moto</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField
                    control={form.control}
                    name="autoMotoDetails.vehicleTransmission"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transmisión</FormLabel>
                             <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex items-center space-x-4 pt-2"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                    <RadioGroupItem value="Automático" />
                                    </FormControl>
                                    <FormLabel className="font-normal">Automático</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                    <RadioGroupItem value="Manual" />
                                    </FormControl>
                                    <FormLabel className="font-normal">Manual</FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <FormField
                control={form.control}
                name="autoMotoDetails.licenseCategory"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Categoría de Licencia a Aplicar</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                            >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="A, B" /></FormControl>
                                <FormLabel className="font-normal">A, B</FormLabel>
                            </FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="A, C" /></FormControl>
                                <FormLabel className="font-normal">A, C</FormLabel>
                            </FormItem>
                             <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="A, C, D" /></FormControl>
                                <FormLabel className="font-normal">A, C, D</FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="autoMotoDetails.theoreticalClassSchedule"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Horario para clases teóricas.</FormLabel>
                         <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                            >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value="Días de Semana de 8:00 am a 10:00 am" /></FormControl>
                                    <FormLabel className="font-normal">Días de Semana de 8:00 am a 10:00 am</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value="Sábados de 3:00 pm a 5:00 pm" /></FormControl>
                                    <FormLabel className="font-normal">Sábados de 3:00 pm a 5:00 pm</FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div>
                <h4 className="font-medium mb-2">Fechas de Clases Teóricas</h4>
                 <div className="space-y-2">
                    {theoreticalClassFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                            <FormField
                                control={form.control}
                                name={`autoMotoDetails.theoreticalClassDates.${index}` as any}
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha {index + 1}</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar locale={es} mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );

    const renderPracticalClassFields = (fields: any, namePrefix: string, title: string) => (
        <div>
            <h3 className="font-semibold text-lg pt-4 border-b pb-2 mb-4">{title}</h3>
            {fields.length > 0 ? (
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-1/4">Clase</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Hora</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field: any, index: number) => (
                            <TableRow key={field.id}>
                                <TableCell className="font-medium py-1">Clase {index + 1}</TableCell>
                                <TableCell className="py-1">
                                    <FormField
                                        control={form.control}
                                        name={`${namePrefix}.${index}.date` as any}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button variant={"outline"} size="sm" className={cn("w-full pl-3 text-left font-normal h-9", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar locale={es} mode="single" selected={field.value} onSelect={field.onChange} />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="py-1">
                                    <FormField
                                        control={form.control}
                                        name={`${namePrefix}.${index}.time` as any}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue placeholder="Seleccionar hora" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {practicalClassTimeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Seleccione un plan para ver las clases prácticas.</p>
            )}
        </div>
    );
    
    const renderDeluxeFields = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="deluxeDetails.studentIdNumber" render={({ field }) => (<FormItem><FormLabel>Cédula/Pasaporte</FormLabel><FormControl><Input placeholder="Ej. 8-123-456" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="deluxeDetails.studentPhone1" render={({ field }) => (<FormItem><FormLabel>Teléfono 1</FormLabel><FormControl><Input type="tel" placeholder="Ej. 6123-4567" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="deluxeDetails.studentPhone2" render={({ field }) => (<FormItem><FormLabel>Teléfono 2 (Opcional)</FormLabel><FormControl><Input type="tel" placeholder="Ej. 399-9999" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField control={form.control} name="deluxeDetails.studentAddress" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Textarea placeholder="Dirección completa del cliente..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <FormField control={form.control} name="deluxeDetails.paymentDetails" render={({ field }) => (<FormItem><FormLabel>Detalles del Pago</FormLabel><FormControl><Textarea placeholder="Ej. El estudiante pagará B/. 201.00 en 6 cuotas quincenales de B/.33.50..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="deluxeDetails.paymentAmount" render={({ field }) => (<FormItem><FormLabel>Monto por Cuota (B/.)</FormLabel><FormControl><Input type="number" placeholder="33.50" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Fechas de Pago (6 Cuotas)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                    <FormField key={index} control={form.control} name={`deluxeDetails.paymentInstallments.${index}` as any} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Cuota {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={es} mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                ))}
            </div>
            
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Detalles del Curso y Horario</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="deluxeDetails.vehicleTransmission" render={({ field }) => (<FormItem><FormLabel>Transmisión</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Transmisión" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="deluxeDetails.licenseCategory" render={({ field }) => (<FormItem><FormLabel>Categoría de Licencia</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Categoría" /></SelectTrigger></FormControl><SelectContent><SelectItem value="A, C">A, C</SelectItem><SelectItem value="A, C, D">A, C, D</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="deluxeDetails.theoreticalClassSchedule" render={({ field }) => (<FormItem><FormLabel>Horario Teórico</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Horario" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Lunes">Lunes (8am-10am)</SelectItem><SelectItem value="Miércoles">Miércoles (7pm-9pm)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Clases Teóricas (10 Semanas)</h3>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 10 }).map((_, index) => (
                    <FormField key={index} control={form.control} name={`deluxeDetails.theoreticalClasses.${index}` as any} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Semana {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={es} mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                ))}
            </div>
            
            {renderPracticalClassFields(deluxeClassFields, 'deluxeDetails.classSchedules', 'Clases Prácticas (6 clases)')}
        </>
    );

    const renderFormContent = () => (
        <>
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Datos del Estudiante</h3>
            {renderCommonFields()}
            {contractType === 'Curso Deluxe' ? renderDeluxeFields() : renderAutoMotoFields()}
            {(contractType === 'Curso Auto' || contractType === 'Curso Mixto') && renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Auto')}
            {(contractType === 'Curso Moto' || contractType === 'Curso Mixto') && renderPracticalClassFields(contractType === 'Curso Mixto' ? motoPracticalClassFields : practicalClassFields, contractType === 'Curso Mixto' ? 'autoMotoDetails.motoPracticalClassSchedules' : 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Moto')}
        </>
    );

    const steps = [
        { title: "Detalles del Contrato", content: renderFormContent },
        { title: "Vista Previa del Contrato", content: () => (
            <div>
                {contractType === 'Curso Deluxe' 
                    ? <DeluxePremiumContractTemplatePreview folio={folio} clientName={watchedValues.clientName} clientEmail={watchedValues.clientEmail} deluxeDetails={watchedValues.deluxeDetails} createdBy={localStorage.getItem('currentUser')} />
                    : <AutoMotoContractTemplatePreview folio={folio} clientName={watchedValues.clientName} clientEmail={watchedValues.clientEmail} autoMotoDetails={watchedValues.autoMotoDetails} createdBy={localStorage.getItem('currentUser')} type={contractType as any} />
                }
            </div>
        )}
    ];
    
    const handleNext = async () => {
        const isValid = await form.trigger();
        if (isValid) {
            setCurrentStep(prev => prev + 1);
        } else {
            toast({ variant: 'destructive', title: 'Error de validación', description: 'Por favor, revisa los campos marcados en rojo.' });
        }
    }


    if (!contractType) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">Tipo de contrato no especificado</h3>
                <p className="mt-2 text-sm text-muted-foreground">Por favor, vuelve al panel y selecciona un tipo de contrato para crear.</p>
                 <Button asChild className="mt-4"><a href="/dashboard">Volver al Panel</a></Button>
            </div>
        );
    }
  
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <AccordionWrapper>
                    <Accordion type="single" collapsible className="w-full" value={String(currentStep)} onValueChange={(value) => setCurrentStep(Number(value))}>
                         <AccordionItem value="0">
                            <AccordionTrigger>Paso 1: {steps[0].title}</AccordionTrigger>
                            <AccordionContent>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Completa los detalles principales de tu acuerdo.</CardTitle>
                                        <div className='flex justify-between items-center'>
                                            <FormDescription>Tipo de Contrato: {contractType}</FormDescription>
                                            <p className='text-sm font-semibold text-destructive'>Folio: {folio}</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {steps[0].content()}
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="1">
                            <AccordionTrigger>Paso 2: {steps[1].title}</AccordionTrigger>
                            <AccordionContent>
                               <Card>
                                    <CardHeader>
                                        <CardTitle>Revisar y Confirmar</CardTitle>
                                        <FormDescription>
                                            Asegúrate de que toda la información en la vista previa sea correcta antes de guardar.
                                        </FormDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {steps[1].content()}
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </AccordionWrapper>

                <div className="flex justify-between mt-8">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(prev => prev - 1)} disabled={currentStep === 0}>
                        Anterior
                    </Button>
                    {currentStep < steps.length - 1 ? (
                        <Button type="button" onClick={handleNext}>
                            Siguiente: Vista Previa
                        </Button>
                    ) : (
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
                        </Button>
                    )}
                </div>
            </form>
        </Form>
    );
}

    