
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
  SelectLabel
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { ContractType } from '@/lib/types';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { AutoMotoContractTemplatePreview } from './auto-moto-contract-preview';
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
  studentIdNumber: z.string().optional(),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
  studentPhone2: z.string().optional(),
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
}).partial();

const deluxeDetailsSchema = z.object({
  studentIdNumber: z.string().optional(),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
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
  autoMotoDetails: autoMotoDetailsSchema,
  deluxeDetails: deluxeDetailsSchema,
}).superRefine((data, ctx) => {
    if (data.contractType !== 'Curso Deluxe') {
        if (!data.autoMotoDetails?.studentIdNumber) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cédula es requerida", path: ["autoMotoDetails", "studentIdNumber"] });
        }
    } else {
        if (!data.deluxeDetails?.studentIdNumber) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cédula es requerida", path: ["deluxeDetails", "studentIdNumber"] });
        }
    }
});


type FormValues = z.infer<typeof formSchema>;


// --- Datos Estáticos ---
const coursePlans = {
  'Curso Auto': [
    { name: 'BÁSICO', price: 133.00, classes: 4 },
    { name: 'PLUS', price: 150.00, classes: 5 },
    { name: 'PREMIUM', price: 175.00, classes: 6 },
    { name: 'Ya se manejar Auto', price: 57.00, classes: 0 },
  ],
  'Curso Moto': [
    { name: 'BÁSICO', price: 115.00, classes: 4 },
    { name: 'PLUS', price: 135.00, classes: 5 },
    { name: 'PREMIUM', price: 155.00, classes: 6 },
    { name: 'Ya se manejar Moto', price: 57.00, classes: 0 },
  ],
  'Curso Mixto': [
    { name: 'Curso Mixto', price: 290.00, classes: 4, motoClasses: 4 },
    { name: 'Basico Moto + Ya se manejar Auto', price: 135.00, classes: 0, motoClasses: 4, isCombined: true },
    { name: 'Plus Moto + Ya se manejar Auto', price: 155.00, classes: 0, motoClasses: 5, isCombined: true },
    { name: 'Premium Moto + Ya se manejar Auto', price: 175.00, classes: 0, motoClasses: 6, isCombined: true },
    { name: 'Basico Auto + Ya se manejar moto', price: 153.00, classes: 4, motoClasses: 0, isCombined: true },
    { name: 'Plus Auto + Ya se manejar Moto', price: 170.00, classes: 5, motoClasses: 0, isCombined: true },
    { name: 'Premium Auto + Ya se manejar Moto', price: 195.00, classes: 6, motoClasses: 0, isCombined: true },
  ],
};

const mixedCoursePlansRegular = coursePlans['Curso Mixto'].filter(p => !p.isCombined);
const mixedCoursePlansCombined = coursePlans['Curso Mixto'].filter(p => p.isCombined);


const practicalClassTimeSlots = [
  '8:00 am a 10:00 am',
  '10:00 am a 12:00 pm',
  '1:00 pm a 3:00 pm',
  '3:00 pm a 5:00 pm',
];

const theoreticalClassTimeSlots = [
    'Dias de semana de 8:00 am a 10:00 am',
    'Sabados de 3:00 pm a 5:00 pm',
];

const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(2);
};

const getDefaultValues = (contractType: ContractType | null): FormValues => ({
    contractType: contractType || 'Curso Auto',
    clientName: '',
    clientEmail: '',
    autoMotoDetails: {
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      studentPhone2: '',
      coursePlan: undefined,
      paidInFull: false,
      courseValue: 0,
      downPayment: 0,
      balance: 0,
      paymentDeadline: null,
      vehicle: undefined,
      vehicleTransmission: undefined,
      licenseCategory: undefined,
      theoreticalClassSchedule: undefined,
      theoreticalClassDates: [],
      practicalClassSchedules: [],
      motoPracticalClassSchedules: []
    },
    deluxeDetails: {
        studentIdNumber: '',
        studentAddress: '',
        studentPhone1: '',
        studentPhone2: '',
        paymentDetails: '',
        paymentAmount: 0,
        paymentInstallments: [],
        vehicleTransmission: undefined,
        licenseCategory: undefined,
        theoreticalClassSchedule: undefined,
        theoreticalClasses: [],
        classSchedules: [],
    }
});


export function ContractForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [folio, setFolio] = useState('');
    const [submissionAction, setSubmissionAction] = useState<'saveAndPrint'>('saveAndPrint');


    const contractType = useMemo(() => searchParams.get('type') as ContractType | null, [searchParams]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: getDefaultValues(contractType),
    });

    const watchedValues = form.watch();
    const watchedPaidInFull = form.watch('autoMotoDetails.paidInFull');
    const watchedCoursePlan = form.watch('autoMotoDetails.coursePlan');

    const isSpecialPlan = useMemo(() => 
        watchedCoursePlan?.toLowerCase().includes('ya se manejar') && !watchedCoursePlan?.toLowerCase().includes('+'),
        [watchedCoursePlan]
    );


    const { fields: theoreticalClassFields, replace: replaceTheoreticalClasses } = useFieldArray({
        control: form.control,
        name: "autoMotoDetails.theoreticalClassDates",
    });

    const { fields: practicalClassFields, replace: replacePracticalClasses } = useFieldArray({
        control: form.control,
        name: "autoMotoDetails.practicalClassSchedules",
    });
    
    const { fields: motoPracticalClassFields, replace: replaceMotoPracticalClasses } = useFieldArray({
        control: form.control,
        name: "autoMotoDetails.motoPracticalClassSchedules",
    });

    const { fields: deluxeClassFields, replace: replaceDeluxeClasses } = useFieldArray({
        control: form.control,
        name: "deluxeDetails.classSchedules",
    });

    useEffect(() => {
        if (contractType) {
            form.reset(getDefaultValues(contractType));

            if (contractType === 'Curso Deluxe') {
                replaceDeluxeClasses(Array(6).fill({ date: undefined, time: undefined }));
            } else {
                 replacePracticalClasses([]);
                 replaceMotoPracticalClasses([]);
                 replaceTheoreticalClasses([]);
            }
        }
    }, [contractType, form, replaceDeluxeClasses, replacePracticalClasses, replaceMotoPracticalClasses, replaceTheoreticalClasses]);

    
     useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name === 'autoMotoDetails.coursePlan' || name === 'autoMotoDetails.paidInFull' || name === 'autoMotoDetails.downPayment') {
                const planName = value.autoMotoDetails?.coursePlan;
                const isPaidInFull = value.autoMotoDetails?.paidInFull;
                const downPayment = value.autoMotoDetails?.downPayment || 0;
                
                const allPlans = contractType ? (coursePlans as any)[contractType] : [];
                const selectedPlan = allPlans.find((p: any) => p.name === planName);
                
                const specialPlanSelected = !!selectedPlan && !selectedPlan.isCombined && planName?.toLowerCase().includes('ya se manejar');

                let newCourseValue = value.autoMotoDetails?.courseValue || 0;
                let newDownPayment = downPayment;

                if ((name === 'autoMotoDetails.coursePlan' || (name === 'autoMotoDetails.paidInFull' && planName)) && selectedPlan) {
                    newCourseValue = selectedPlan.price;
                    form.setValue('autoMotoDetails.courseValue', newCourseValue, { shouldValidate: true });
                    
                    if (name === 'autoMotoDetails.coursePlan') {
                        if (specialPlanSelected) {
                            newDownPayment = newCourseValue;
                            form.setValue('autoMotoDetails.paidInFull', true, { shouldValidate: true });
                        } else if (!selectedPlan.isCombined) {
                            newDownPayment = newCourseValue * 0.5;
                            form.setValue('autoMotoDetails.paidInFull', false, { shouldValidate: true });
                        } else {
                             form.setValue('autoMotoDetails.paidInFull', false, { shouldValidate: true });
                        }
                        form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                    }
                    
                    if (contractType === 'Curso Auto') {
                        replacePracticalClasses(Array(selectedPlan.classes).fill({ date: undefined, time: undefined }));
                        replaceMotoPracticalClasses([]);
                    } else if (contractType === 'Curso Moto') {
                         replacePracticalClasses(Array(selectedPlan.classes).fill({ date: undefined, time: undefined }));
                         replaceMotoPracticalClasses([]);
                    } else if (contractType === 'Curso Mixto') {
                        replacePracticalClasses(Array(selectedPlan.classes || 0).fill({ date: undefined, time: undefined }));
                        replaceMotoPracticalClasses(Array(selectedPlan.motoClasses || 0).fill({ date: undefined, time: undefined }));
                    }
                } else if (!selectedPlan && name === 'autoMotoDetails.coursePlan') {
                     newCourseValue = 0;
                     newDownPayment = 0;
                     form.setValue('autoMotoDetails.courseValue', newCourseValue, { shouldValidate: true });
                     form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                     replacePracticalClasses([]);
                     replaceMotoPracticalClasses([]);
                }
                
                if (isPaidInFull && !specialPlanSelected) {
                    newDownPayment = newCourseValue;
                    if(form.getValues('autoMotoDetails.downPayment') !== newDownPayment){
                        form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                    }
                } else if (name === 'autoMotoDetails.coursePlan' && !isPaidInFull && !specialPlanSelected && !selectedPlan?.isCombined) {
                    newDownPayment = newCourseValue * 0.5;
                    if(form.getValues('autoMotoDetails.downPayment') !== newDownPayment){
                         form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                    }
                }
                
                // Set payment deadline based on paidInFull status
                if (name === 'autoMotoDetails.paidInFull') {
                    if (isPaidInFull) {
                        form.setValue('autoMotoDetails.paymentDeadline', new Date());
                    } else {
                        form.setValue('autoMotoDetails.paymentDeadline', null);
                    }
                }

                const newBalance = newCourseValue - newDownPayment;
                 if(form.getValues('autoMotoDetails.balance') !== newBalance){
                    form.setValue('autoMotoDetails.balance', newBalance < 0 ? 0 : newBalance, { shouldValidate: true });
                }
            }

            if (name === 'autoMotoDetails.theoreticalClassSchedule') {
                const theoreticalSchedule = value.autoMotoDetails?.theoreticalClassSchedule;
                if (theoreticalSchedule?.includes('Dias de semana')) {
                    replaceTheoreticalClasses(Array(5).fill({ date: undefined }));
                } else if (theoreticalSchedule?.includes('Sabados')) {
                    replaceTheoreticalClasses(Array(3).fill({ date: undefined }));
                } else {
                    replaceTheoreticalClasses([]);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form, contractType, replacePracticalClasses, replaceMotoPracticalClasses, replaceTheoreticalClasses]);


    useEffect(() => {
        const generateFolio = async () => {
            if (!firestore) return;
    
            const currentYear = new Date().getFullYear();
            const folioPrefix = `${currentYear}-`;
            
            const contractsRef = collection(firestore, 'contracts');
            const q = query(
                contractsRef,
                where('folio', '>=', folioPrefix),
                where('folio', '<', `${currentYear + 1}-`),
                orderBy('folio', 'desc'),
                limit(1)
            );
    
            try {
                const querySnapshot = await getDocs(q);
                let nextFolioNumber = 1;
    
                if (!querySnapshot.empty) {
                    const lastFolio = querySnapshot.docs[0].data().folio;
                    const lastNumber = parseInt(lastFolio.split('-')[1], 10);
                    nextFolioNumber = lastNumber + 1;
                }
    
                const newFolio = `${currentYear}-${String(nextFolioNumber).padStart(3, '0')}`;
                setFolio(newFolio);
            } catch (error) {
                console.error("Error generating folio:", error);
                // Fallback to a simpler folio format in case of error
                const uniqueId = Date.now().toString().slice(-6);
                setFolio(`${currentYear}-${uniqueId}`);
            }
        };
    
        generateFolio();
    }, [firestore]);

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
                const practicalSchedules = contractType === 'Curso Moto' 
                    ? values.autoMotoDetails?.practicalClassSchedules 
                    : values.autoMotoDetails?.practicalClassSchedules;

                contractData.autoMotoDetails = {
                    ...values.autoMotoDetails,
                    paymentDeadline: values.autoMotoDetails?.paymentDeadline ? format(values.autoMotoDetails.paymentDeadline, 'yyyy-MM-dd') : null,
                    theoreticalClassDates: values.autoMotoDetails?.theoreticalClassDates?.map(d => d ? format(d, 'yyyy-MM-dd') : null).filter(d => d) || [],
                    practicalClassSchedules: practicalSchedules?.map(c => ({ date: c.date ? format(c.date, 'yyyy-MM-dd') : null, time: c.time || null })).filter(c => c.date || c.time) || [],
                    motoPracticalClassSchedules: values.autoMotoDetails?.motoPracticalClassSchedules?.map(c => ({ date: c.date ? format(c.date, 'yyyy-MM-dd') : null, time: c.time || null })).filter(c => c.date || c.time) || [],
                };
            } else if (contractType === 'Curso Deluxe') {
                contractData.deluxeDetails = {
                    ...values.deluxeDetails,
                    paymentInstallments: values.deluxeDetails?.paymentInstallments?.map(d => d ? format(d, 'yyyy-MM-dd') : null).filter(d => d) || [],
                    theoreticalClasses: values.deluxeDetails?.theoreticalClasses?.map(d => d ? format(d, 'yyyy-MM-dd') : null).filter(d => d) || [],
                    classSchedules: values.deluxeDetails?.classSchedules?.map(c => ({ date: c.date ? format(c.date, 'yyyy-MM-dd') : null, time: c.time || null })).filter(c => c.date || c.time) || [],
                };
            }

            batch.set(contractRef, contractData);
            await batch.commit();

            toast({ title: 'Éxito', description: 'Contrato y cliente creados correctamente.' });
            
            const redirectUrl = `/contracts/${contractRef.id}${submissionAction === 'saveAndPrint' ? '?print=true' : ''}`;
            router.push(redirectUrl);

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
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Datos Adicionales del Estudiante</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="autoMotoDetails.studentIdNumber" render={({ field }) => (<FormItem><FormLabel>Cédula/Pasaporte</FormLabel><FormControl><Input placeholder="Ej. 8-123-456" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="autoMotoDetails.studentPhone1" render={({ field }) => (<FormItem><FormLabel>Teléfono 1</FormLabel><FormControl><Input type="tel" placeholder="Ej. 6123-4567" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="autoMotoDetails.studentPhone2" render={({ field }) => (<FormItem><FormLabel>Teléfono 2 (Opcional)</FormLabel><FormControl><Input type="tel" placeholder="Ej. 399-9999" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField control={form.control} name="autoMotoDetails.studentAddress" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Textarea placeholder="Dirección completa del cliente..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />


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
                                {contractType === 'Curso Mixto' ? (
                                    <>
                                        <SelectGroup>
                                            <SelectLabel>Curso Mixto Regular</SelectLabel>
                                            {mixedCoursePlansRegular.map((c: any) => <SelectItem key={c.name} value={c.name}>{c.name} - B/.{c.price.toFixed(2)}</SelectItem>)}
                                        </SelectGroup>
                                        <SelectGroup>
                                            <SelectLabel>Cursos + Ya se manejar</SelectLabel>
                                            {mixedCoursePlansCombined.map((c: any) => <SelectItem key={c.name} value={c.name}>{c.name} - B/.{c.price.toFixed(2)}</SelectItem>)}
                                        </SelectGroup>
                                    </>
                                ) : (
                                    contractType && (coursePlans as any)[contractType]?.map((c: any) => <SelectItem key={c.name} value={c.name}>{c.name} - B/.{c.price.toFixed(2)}</SelectItem>)
                                )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="autoMotoDetails.courseValue" render={({ field }) => (<FormItem><FormLabel>Valor Total (B/.)</FormLabel><FormControl><Input type="text" value={formatCurrency(field.value)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="autoMotoDetails.downPayment" render={({ field }) => (<FormItem><FormLabel>Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} disabled={watchedPaidInFull || isSpecialPlan} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="autoMotoDetails.balance" render={({ field }) => (<FormItem><FormLabel>Saldo (B/.)</FormLabel><FormControl><Input type="text" value={formatCurrency(field.value)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField
                control={form.control}
                name="autoMotoDetails.paidInFull"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                        <FormControl>
                            <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                                id="paidInFull"
                                disabled={isSpecialPlan}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <label htmlFor='paidInFull' className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', isSpecialPlan && 'text-muted-foreground')}>
                               ¿Cancelar la totalidad del curso (100%)?
                            </label>
                            {isSpecialPlan && <FormDescription>Este plan requiere pago completo.</FormDescription>}
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
                                        {field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? (
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
                                    selected={field.value ? new Date(field.value) : undefined}
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
                 {(contractType === 'Curso Auto' || contractType === 'Curso Mixto') && (
                    <FormField control={form.control} name="autoMotoDetails.vehicle" render={({ field }) => (<FormItem><FormLabel>Vehículo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un vehículo" /></SelectTrigger></FormControl><SelectContent>
                        <SelectItem value="Spark">Spark</SelectItem>
                        <SelectItem value="P. Blanco">Picanto Blanco</SelectItem>
                        <SelectItem value="P. Bronce">Picanto Bronce</SelectItem>
                        </SelectContent></Select><FormMessage /></FormItem>)} />
                 )}
                 {contractType === 'Curso Auto' && (
                    <FormField
                        control={form.control}
                        name="autoMotoDetails.vehicleTransmission"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Transmisión (Auto)</FormLabel>
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
                 )}
                 {contractType === 'Curso Moto' && (
                     <FormField
                        control={form.control}
                        name="autoMotoDetails.vehicleTransmission"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Transmisión (Moto)</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex items-center space-x-4 pt-2"
                                    >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value="Moto" />
                                        </FormControl>
                                        <FormLabel className="font-normal">Moto</FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 )}
                 {contractType === 'Curso Mixto' && (
                    <FormField
                        control={form.control}
                        name="autoMotoDetails.vehicleTransmission"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Transmisión (Principal)</FormLabel>
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
                                     <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value="Moto" />
                                        </FormControl>
                                        <FormLabel className="font-normal">Moto</FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 )}
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
                            {contractType === 'Curso Moto' && (
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                    <FormControl><RadioGroupItem value="A, B" /></FormControl>
                                    <FormLabel className="font-normal">A, B</FormLabel>
                                </FormItem>
                            )}
                            {(contractType === 'Curso Auto' || contractType === 'Curso Mixto') && (
                                <>
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value="A, C" /></FormControl>
                                        <FormLabel className="font-normal">A, C</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value="A, C, D" /></FormControl>
                                        <FormLabel className="font-normal">A, C, D</FormLabel>
                                    </FormItem>
                                </>
                            )}
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
                                {theoreticalClassTimeSlots.map(slot => (
                                    <FormItem key={slot} className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value={slot} /></FormControl>
                                        <FormLabel className="font-normal">{slot}</FormLabel>
                                    </FormItem>
                                ))}
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div>
                <h4 className="font-medium mb-2">Fechas de Clases Teóricas</h4>
                 <div className="space-y-2">
                    {theoreticalClassFields.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2">
                            <FormField
                                control={form.control}
                                name={`autoMotoDetails.theoreticalClassDates.${index}`}
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar fecha {index + 1}</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar locale={es} mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} initialFocus />
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
                                                                {field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar locale={es} mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} />
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
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Datos Adicionales del Estudiante</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="deluxeDetails.studentIdNumber" render={({ field }) => (<FormItem><FormLabel>Cédula/Pasaporte</FormLabel><FormControl><Input placeholder="Ej. 8-123-456" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="deluxeDetails.studentPhone1" render={({ field }) => (<FormItem><FormLabel>Teléfono 1</FormLabel><FormControl><Input type="tel" placeholder="Ej. 6123-4567" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="deluxeDetails.studentPhone2" render={({ field }) => (<FormItem><FormLabel>Teléfono 2 (Opcional)</FormLabel><FormControl><Input type="tel" placeholder="Ej. 399-9999" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField control={form.control} name="deluxeDetails.studentAddress" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Textarea placeholder="Dirección completa del cliente..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Detalles del Pago</h3>
            <FormField control={form.control} name="deluxeDetails.paymentDetails" render={({ field }) => (<FormItem><FormLabel>Descripción del Acuerdo de Pago</FormLabel><FormControl><Textarea placeholder="Ej. El estudiante pagará B/. 201.00 en 6 cuotas quincenales de B/.33.50..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="deluxeDetails.paymentAmount" render={({ field }) => (<FormItem><FormLabel>Monto por Cuota (B/.)</FormLabel><FormControl><Input type="number" placeholder="33.50" {...field} value={field.value ?? 0} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Fechas de Pago (6 Cuotas)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                    <FormField key={index} control={form.control} name={`deluxeDetails.paymentInstallments.${index}`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Cuota {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={es} mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
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
                    <FormField key={index} control={form.control} name={`deluxeDetails.theoreticalClasses.${index}`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Semana {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={es} mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                ))}
            </div>
            
            {renderPracticalClassFields(deluxeClassFields, 'deluxeDetails.classSchedules', 'Clases Prácticas (6 clases)')}
        </>
    );

    const renderFormContent = () => (
        <Card>
            <CardHeader>
                <CardTitle>Completa los detalles principales de tu acuerdo.</CardTitle>
                <div className='flex justify-between items-center'>
                    <FormDescription>Tipo de Contrato: {contractType}</FormDescription>
                    <p className='text-sm font-semibold text-destructive'>Folio: {folio}</p>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <h3 className="font-semibold text-lg pt-4 border-b pb-2">Datos del Estudiante</h3>
                {renderCommonFields()}
                {contractType === 'Curso Deluxe' ? renderDeluxeFields() : renderAutoMotoFields()}
                
                {contractType === 'Curso Auto' && renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Auto')}
                
                {contractType === 'Curso Moto' && renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Moto')}

                {contractType === 'Curso Mixto' && (
                    <>
                        {renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Auto')}
                        {renderPracticalClassFields(motoPracticalClassFields, 'autoMotoDetails.motoPracticalClassSchedules', 'Clases Prácticas de Moto')}
                    </>
                )}
                 <div className="flex flex-col sm:flex-row gap-2 justify-end">
                    <Button type="submit" onClick={() => setSubmissionAction('saveAndPrint')} disabled={form.formState.isSubmitting}>
                        <Printer className="mr-2 h-4 w-4" />
                        {form.formState.isSubmitting && submissionAction === 'saveAndPrint' ? 'Guardando...' : 'Guardar e Imprimir'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );


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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-6">
                        {renderFormContent()}
                    </div>
                    <div className="sticky top-4">
                        <Card>
                             <CardHeader>
                                <CardTitle>Vista Previa del Contrato</CardTitle>
                                <FormDescription>
                                    Asegúrate de que toda la información en la vista previa sea correcta antes de guardar.
                                </FormDescription>
                            </CardHeader>
                            <CardContent>
                                {contractType === 'Curso Deluxe' 
                                    ? <DeluxePremiumContractTemplatePreview folio={folio} clientName={watchedValues.clientName} clientEmail={watchedValues.clientEmail} deluxeDetails={watchedValues.deluxeDetails} createdBy={typeof window !== 'undefined' ? localStorage.getItem('currentUser') : 'Ventas'} />
                                    : <AutoMotoContractTemplatePreview folio={folio} clientName={watchedValues.clientName} clientEmail={watchedValues.clientEmail} autoMotoDetails={watchedValues.autoMotoDetails} createdBy={typeof window !== 'undefined' ? localStorage.getItem('currentUser') : 'Ventas'} type={contractType as any} />
                                }
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    );
}

    

    

    