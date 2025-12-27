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
import { CalendarIcon, PlusCircle, Loader2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType } from '@/lib/types';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';
import { AutoMotoContractTemplatePreview } from './auto-moto-contract-preview';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useCurrentRole } from '@/hooks/use-current-role';
import { AmpliacionesContractTemplate } from './ampliaciones-contract';
import { ContractView } from './contract-view';
import { generateContractWithSequentialFolio } from '@/ai/flows/generate-contract-folio';


// --- Esquemas de Validación con Zod ---

const classScheduleSchema = z.object({
    date: z.date().optional(),
    time: z.string().optional(),
});

const baseSchema = z.object({
  clientName: z.string().min(3, 'El nombre del estudiante debe tener al menos 3 caracteres.'),
  clientEmail: z.string().email('Por favor, introduce una dirección de correo electrónico válida.'),
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

const ampliacionesDetailsSchema = z.object({
  studentIdNumber: z.string().optional(),
  studentAddress: z.string().optional(),
  studentPhone1: z.string().optional(),
  studentPhone2: z.string().optional(),
  selectedPlans: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
  courseValue: z.number().optional(),
  downPayment: z.number().optional(),
  balance: z.number().optional(),
  paymentDeadline: z.date().optional().nullable(),
  paidInFull: z.boolean().default(false),
  theoreticalClassDate: z.date().optional().nullable(),
  theoreticalClassTime: z.string().optional(),
}).partial();

const formSchema = baseSchema.extend({
  contractType: z.custom<ContractType>(),
  autoMotoDetails: autoMotoDetailsSchema,
  deluxeDetails: deluxeDetailsSchema,
  ampliacionesDetails: ampliacionesDetailsSchema,
}).superRefine((data, ctx) => {
    const studentIdPath = data.contractType === 'Curso Deluxe'
        ? ["deluxeDetails", "studentIdNumber"]
        : data.contractType === 'Ampliaciones'
            ? ["ampliacionesDetails", "studentIdNumber"]
            : ["autoMotoDetails", "studentIdNumber"];

    const studentIdValue = data.contractType === 'Curso Deluxe'
        ? data.deluxeDetails?.studentIdNumber
        : data.contractType === 'Ampliaciones'
            ? data.ampliacionesDetails?.studentIdNumber
            : data.autoMotoDetails?.studentIdNumber;

    if (!studentIdValue) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El número de cédula o pasaporte del estudiante es un campo obligatorio.",
            path: studentIdPath,
        });
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

const ampliacionesPlans = {
    individual: [
        { name: 'B', price: 67.00 },
        { name: 'C', price: 67.00 },
        { name: 'D', price: 67.00 },
        { name: 'E1', price: 57.00 },
        { name: 'E2', price: 87.00 },
        { name: 'E3', price: 87.00 },
        { name: 'F', price: 107.00 },
        { name: 'G', price: 180.00 },
        { name: 'H', price: 180.00 },
        { name: 'I', price: 107.00 },
    ],
    combos: [
        { name: 'D+E1', price: 107.00 },
        { name: 'E1+E2', price: 75.00 },
        { name: 'E1,E2,E3', price: 117.00 },
        { name: 'E1,E2,E3+F', price: 150.00 },
        { name: 'D+E1,E2,E3+F', price: 187.00 },
        { name: 'E1,E2,E3+F+I', price: 257.00 },
        { name: 'F+I', price: 150.00 },
        { name: 'G+H', price: 207.00 },
    ],
    otherCombos: [
        { name: 'Combo 1: B+D', price: 85.00 },
        { name: 'Combo 2: B+E1', price: 85.00 },
        { name: 'Combo 3: E2+E3', price: 85.00 },
        { name: 'Combo 4: B+F', price: 85.00 },
    ]
};
const allAmpliacionesPlans = [...ampliacionesPlans.individual, ...ampliacionesPlans.combos, ...ampliacionesPlans.otherCombos];

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

const ampliacionesTheoreticalTimeSlots = [
    '8:00 am a 10:00 am',
    '3:00 pm a 5:00 pm'
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
        paymentDeadline: null,
        paidInFull: false,
        theoreticalClassDate: null,
        theoreticalClassTime: undefined,
    },
});


export function ContractForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, isUserLoading } = useFirebase();
    const { toast } = useToast();
    const { role: currentUserRole } = useCurrentRole();
    const [savedContract, setSavedContract] = useState<Contract | null>(null);
    const [folioPreview, setFolioPreview] = useState<string>('');


    const contractType = useMemo(() => searchParams.get('type') as ContractType | null, [searchParams]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: getDefaultValues(contractType),
    });

    const watchedValues = form.watch();
    const watchedPaidInFull = form.watch('autoMotoDetails.paidInFull');
    const watchedAmpliacionesPaidInFull = form.watch('ampliacionesDetails.paidInFull');
    const watchedCoursePlan = form.watch('autoMotoDetails.coursePlan');
    const watchedAmpliacionesCourseValue = form.watch('ampliacionesDetails.courseValue');

    const isSpecialPlan = useMemo(() => 
        watchedCoursePlan?.toLowerCase().includes('ya se manejar') && !watchedCoursePlan?.toLowerCase().includes('+'),
        [watchedCoursePlan]
    );

    const isAmpliacionesFullPaymentRequired = useMemo(() => 
        (watchedAmpliacionesCourseValue || 0) <= 100 && (watchedAmpliacionesCourseValue || 0) > 0,
        [watchedAmpliacionesCourseValue]
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
        const year = new Date().getFullYear();
        setFolioPreview(`${year}-XXX`);

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
            const currentContractType = form.getValues('contractType');

            if (currentContractType && ['Curso Auto', 'Curso Moto', 'Curso Mixto'].includes(currentContractType)) {
                if (name === 'autoMotoDetails.coursePlan' || name === 'autoMotoDetails.paidInFull' || name === 'autoMotoDetails.downPayment') {
                    const allPlans = (coursePlans as any)[currentContractType];
                    if (!allPlans || !Array.isArray(allPlans)) return;

                    const planName = value.autoMotoDetails?.coursePlan;
                    const selectedPlan = allPlans.find((p: any) => p.name === planName);

                    if (!selectedPlan) {
                        if (name === 'autoMotoDetails.coursePlan') {
                             if (form.getValues('autoMotoDetails.courseValue')?.toFixed(2) !== (0).toFixed(2)) form.setValue('autoMotoDetails.courseValue', 0);
                            if (form.getValues('autoMotoDetails.downPayment')?.toFixed(2) !== (0).toFixed(2)) form.setValue('autoMotoDetails.downPayment', 0);
                            if (form.getValues('autoMotoDetails.balance')?.toFixed(2) !== (0).toFixed(2)) form.setValue('autoMotoDetails.balance', 0);
                            replacePracticalClasses([]);
                            replaceMotoPracticalClasses([]);
                        }
                        return;
                    }

                    let isPaidInFull = value.autoMotoDetails?.paidInFull ?? false;
                    const downPayment = value.autoMotoDetails?.downPayment || 0;
                    const specialPlanSelected = !!selectedPlan && !selectedPlan.isCombined && planName?.toLowerCase().includes('ya se manejar');
                    let newCourseValue = selectedPlan.price;

                    if (form.getValues('autoMotoDetails.courseValue')?.toFixed(2) !== newCourseValue.toFixed(2)) {
                        form.setValue('autoMotoDetails.courseValue', newCourseValue, { shouldValidate: true });
                    }

                    let newDownPayment = downPayment;
                    if (name === 'autoMotoDetails.coursePlan') {
                        if (specialPlanSelected) {
                            if (!form.getValues('autoMotoDetails.paidInFull')) form.setValue('autoMotoDetails.paidInFull', true, { shouldValidate: true });
                            isPaidInFull = true;
                            newDownPayment = newCourseValue;
                        } else if (!selectedPlan.isCombined) {
                            if (form.getValues('autoMotoDetails.paidInFull')) form.setValue('autoMotoDetails.paidInFull', false, { shouldValidate: true });
                            isPaidInFull = false;
                            newDownPayment = newCourseValue * 0.5;
                        } else {
                            if (form.getValues('autoMotoDetails.paidInFull')) form.setValue('autoMotoDetails.paidInFull', false, { shouldValidate: true });
                            isPaidInFull = false;
                        }
                        if (form.getValues('autoMotoDetails.downPayment')?.toFixed(2) !== newDownPayment.toFixed(2)) {
                            form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                        }

                        if (currentContractType === 'Curso Mixto') {
                            replacePracticalClasses(Array(selectedPlan.classes || 0).fill({ date: undefined, time: undefined }));
                            replaceMotoPracticalClasses(Array(selectedPlan.motoClasses || 0).fill({ date: undefined, time: undefined }));
                        } else {
                            replacePracticalClasses(Array(selectedPlan.classes).fill({ date: undefined, time: undefined }));
                            replaceMotoPracticalClasses([]);
                        }
                    } else if (name === 'autoMotoDetails.paidInFull' && isPaidInFull) {
                        newDownPayment = newCourseValue;
                        if (form.getValues('autoMotoDetails.downPayment')?.toFixed(2) !== newDownPayment.toFixed(2)) {
                            form.setValue('autoMotoDetails.downPayment', newDownPayment, { shouldValidate: true });
                        }
                    }

                    const currentPaymentDeadline = form.getValues('autoMotoDetails.paymentDeadline');
                    if (name === 'autoMotoDetails.paidInFull' || name === 'autoMotoDetails.coursePlan') {
                        if (isPaidInFull) {
                             if (!currentPaymentDeadline || !(currentPaymentDeadline instanceof Date)) {
                                 form.setValue('autoMotoDetails.paymentDeadline', new Date());
                            }
                        } else {
                             if (currentPaymentDeadline !== null) {
                                form.setValue('autoMotoDetails.paymentDeadline', null);
                            }
                        }
                    }

                    const newBalance = newCourseValue - newDownPayment;
                    const finalBalance = newBalance < 0 ? 0 : newBalance;
                    if (form.getValues('autoMotoDetails.balance')?.toFixed(2) !== finalBalance.toFixed(2)) {
                        form.setValue('autoMotoDetails.balance', finalBalance, { shouldValidate: true });
                    }
                }
            }

            if (name?.startsWith('ampliacionesDetails')) {
                if (name === 'ampliacionesDetails.selectedPlans' || name === 'ampliacionesDetails.paidInFull' || name === 'ampliacionesDetails.downPayment') {
                    const selectedPlans = value.ampliacionesDetails?.selectedPlans || [];
                    let isPaidInFull = value.ampliacionesDetails?.paidInFull ?? false;
                    const downPayment = value.ampliacionesDetails?.downPayment || 0;
                    const newCourseValue = selectedPlans.reduce((acc, plan) => acc + plan.price, 0);

                    if (form.getValues('ampliacionesDetails.courseValue')?.toFixed(2) !== newCourseValue.toFixed(2)) {
                        form.setValue('ampliacionesDetails.courseValue', newCourseValue, { shouldValidate: true });
                    }

                    const forceFullPayment = newCourseValue > 0 && newCourseValue <= 100;

                    if (name === 'ampliacionesDetails.selectedPlans') {
                        if (forceFullPayment) {
                            if (form.getValues('ampliacionesDetails.paidInFull') !== true) form.setValue('ampliacionesDetails.paidInFull', true, { shouldValidate: true });
                            isPaidInFull = true;
                        } else {
                            if (form.getValues('ampliacionesDetails.paidInFull') === true) form.setValue('ampliacionesDetails.paidInFull', false, { shouldValidate: true });
                            isPaidInFull = false;
                        }
                    }

                    let newDownPayment = downPayment;
                    if (name === 'ampliacionesDetails.paidInFull' || name === 'ampliacionesDetails.selectedPlans') {
                        if (isPaidInFull || forceFullPayment) {
                            newDownPayment = newCourseValue;
                        } else {
                            newDownPayment = newCourseValue > 100 ? newCourseValue * 0.5 : newCourseValue;
                        }
                    }

                     if (form.getValues('ampliacionesDetails.downPayment')?.toFixed(2) !== newDownPayment.toFixed(2)) {
                        form.setValue('ampliacionesDetails.downPayment', newDownPayment, { shouldValidate: true });
                    }
                    
                    const currentPaymentDeadline = form.getValues('ampliacionesDetails.paymentDeadline');
                    if (name === 'ampliacionesDetails.paidInFull' || name === 'ampliacionesDetails.selectedPlans') {
                         if (isPaidInFull || forceFullPayment) {
                             if (!currentPaymentDeadline || !(currentPaymentDeadline instanceof Date)) {
                                 form.setValue('ampliacionesDetails.paymentDeadline', new Date());
                             }
                         } else {
                            if (currentPaymentDeadline !== null) {
                                form.setValue('ampliacionesDetails.paymentDeadline', null);
                            }
                        }
                    }

                    const newBalance = newCourseValue - newDownPayment;
                    const finalBalance = newBalance < 0 ? 0 : newBalance;
                     if (form.getValues('ampliacionesDetails.balance')?.toFixed(2) !== finalBalance.toFixed(2)) {
                        form.setValue('ampliacionesDetails.balance', finalBalance, { shouldValidate: true });
                    }
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
    }, [form, replacePracticalClasses, replaceMotoPracticalClasses, replaceTheoreticalClasses]);

    const onSubmit = async (values: FormValues) => {
        if (!user || !currentUserRole || isUserLoading) {
            toast({ variant: 'destructive', title: 'Error de Autenticación', description: 'No se pudo conectar a la base de datos. Por favor, inicie sesión o espere a que cargue la sesión.' });
            return;
        }

        try {
            const studentIdNumber = values.autoMotoDetails?.studentIdNumber || values.deluxeDetails?.studentIdNumber || values.ampliacionesDetails?.studentIdNumber;
            if (!studentIdNumber) {
                 toast({ variant: 'destructive', title: 'Error de Validación', description: 'El número de cédula es obligatorio para crear o buscar un cliente.' });
                 return;
            }

            let detailsPayload: any = {};
             if (contractType === 'Curso Auto' || contractType === 'Curso Moto' || contractType === 'Curso Mixto') {
                detailsPayload = values.autoMotoDetails;
            } else if (contractType === 'Curso Deluxe') {
                detailsPayload = values.deluxeDetails;
            } else if (contractType === 'Ampliaciones') {
                detailsPayload = values.ampliacionesDetails;
            }


            const result = await generateContractWithSequentialFolio({
                contractData: {
                    clientName: values.clientName,
                    clientEmail: values.clientEmail,
                    contractType: values.contractType,
                    studentIdNumber,
                    userId: user.uid,
                    createdBy: currentUserRole,
                },
                details: detailsPayload
            });

            if (result.error) {
                throw new Error(result.error);
            }
            
            if (!result.contract) {
                throw new Error("La función de guardado no devolvió un contrato.");
            }
            
            toast({ title: 'Éxito', description: `Contrato ${result.folio} creado correctamente.` });
            
            const contractFromDb = result.contract;
             if (contractFromDb.deluxeDetails) {
                contractFromDb.deluxeDetails = contractFromDb.deluxeDetails;
            }
            if (contractFromDb.autoMotoDetails) {
                contractFromDb.autoMotoDetails = contractFromDb.autoMotoDetails;
            }
            if (contractFromDb.ampliacionesDetails) {
                contractFromDb.ampliacionesDetails = contractFromDb.ampliacionesDetails;
            }

            const finalContractObjectForPrint: Contract = {
                ...contractFromDb,
                createdAt: Timestamp.fromDate(new Date(contractFromDb.createdAt)),
            };

            setSavedContract(finalContractObjectForPrint);

        } catch (error) {
            console.error("Error al crear el contrato:", error);
            toast({ variant: 'destructive', title: 'Error de Guardado', description: `${error instanceof Error ? error.message : 'No se pudo crear el contrato. Revisa los datos e intenta de nuevo.'}` });
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

    const renderAmpliacionesFields = () => {
        const studentIdPath = "ampliacionesDetails.studentIdNumber";
        const studentPhone1Path = "ampliacionesDetails.studentPhone1";
        const studentPhone2Path = "ampliacionesDetails.studentPhone2";
        const studentAddressPath = "ampliacionesDetails.studentAddress";
        const selectedPlansPath = "ampliacionesDetails.selectedPlans";
        const courseValuePath = "ampliacionesDetails.courseValue";
        const downPaymentPath = "ampliacionesDetails.downPayment";
        const balancePath = "ampliacionesDetails.balance";
        const paidInFullPath = "ampliacionesDetails.paidInFull";
        const paymentDeadlinePath = "ampliacionesDetails.paymentDeadline";
        const theoreticalClassDatePath = "ampliacionesDetails.theoreticalClassDate";
        const theoreticalClassTimePath = "ampliacionesDetails.theoreticalClassTime";

        return (
             <>
                <h3 className="font-semibold text-lg pt-4 border-b pb-2">Datos Adicionales del Estudiante</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={form.control} name={studentIdPath} render={({ field }) => (<FormItem><FormLabel>Cédula/Pasaporte</FormLabel><FormControl><Input placeholder="Ej. 8-123-456" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name={studentPhone1Path} render={({ field }) => (<FormItem><FormLabel>Teléfono 1</FormLabel><FormControl><Input type="tel" placeholder="Ej. 6123-4567" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name={studentPhone2Path} render={({ field }) => (<FormItem><FormLabel>Teléfono 2 (Opcional)</FormLabel><FormControl><Input type="tel" placeholder="Ej. 399-9999" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormField control={form.control} name={studentAddressPath} render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Textarea placeholder="Dirección completa del cliente..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />

                <h3 className="font-semibold text-lg pt-4 border-b pb-2">Selección de Planes de Ampliación</h3>
                 <FormField
                    control={form.control}
                    name={selectedPlansPath}
                    render={() => (
                        <FormItem>
                            <div className="mb-4">
                                <FormLabel className="text-base">Planes y Combos</FormLabel>
                                <FormDescription>
                                    Selecciona todos los planes que apliquen. El total se calculará automáticamente.
                                </FormDescription>
                            </div>
                            <Accordion type="multiple" className="w-full">
                                <AccordionItem value="individual">
                                    <AccordionTrigger>Planes Individuales</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                                            {ampliacionesPlans.individual.map((plan) => (
                                                <FormField
                                                    key={plan.name}
                                                    control={form.control}
                                                    name={selectedPlansPath}
                                                    render={({ field }) => (
                                                        <FormItem key={plan.name} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.some(p => p.name === plan.name)}
                                                                    onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), plan]) : field.onChange(field.value?.filter((value) => value.name !== plan.name))}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">{plan.name} <span className="font-semibold text-primary"> (B/.{plan.price.toFixed(2)})</span></FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="combos">
                                    <AccordionTrigger>Combos de Ampliaciones</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                                            {ampliacionesPlans.combos.map((plan) => (
                                                <FormField
                                                    key={plan.name}
                                                    control={form.control}
                                                    name={selectedPlansPath}
                                                    render={({ field }) => (
                                                        <FormItem key={plan.name} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.some(p => p.name === plan.name)}
                                                                    onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), plan]) : field.onChange(field.value?.filter((value) => value.name !== plan.name))}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">{plan.name} <span className="font-semibold text-primary"> (B/.{plan.price.toFixed(2)})</span></FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="other-combos">
                                    <AccordionTrigger>Otros Combos</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                                            {ampliacionesPlans.otherCombos.map((plan) => (
                                                <FormField
                                                    key={plan.name}
                                                    control={form.control}
                                                    name={selectedPlansPath}
                                                    render={({ field }) => (
                                                        <FormItem key={plan.name} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.some(p => p.name === plan.name)}
                                                                    onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), plan]) : field.onChange(field.value?.filter((value) => value.name !== plan.name))}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">{plan.name} <span className="font-semibold text-primary"> (B/.{plan.price.toFixed(2)})</span></FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 
                <h3 className="font-semibold text-lg pt-4 border-b pb-2">Clase Teórica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name={theoreticalClassDatePath}
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Fecha de la Clase Teórica</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value instanceof Date && !isNaN(field.value.getTime()) ? (
                                                    format(field.value, "PPP", { locale: es })
                                                ) : (
                                                    <span>Seleccionar fecha</span>
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
                                            initialFocus
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={theoreticalClassTimePath}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Horario de Clase Teórica</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un horario" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {ampliacionesTheoreticalTimeSlots.map(slot => (
                                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <h3 className="font-semibold text-lg pt-4 border-b pb-2">Cláusula Primera: Valor y Forma de Pago</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name={courseValuePath} render={({ field }) => (<FormItem><FormLabel>Valor Total (B/.)</FormLabel><FormControl><Input type="text" value={formatCurrency(field.value)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={downPaymentPath} render={({ field }) => (<FormItem><FormLabel>Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} disabled={watchedAmpliacionesPaidInFull} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={balancePath} render={({ field }) => (<FormItem><FormLabel>Saldo (B/.)</FormLabel><FormControl><Input type="text" value={formatCurrency(field.value)} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormField
                    control={form.control}
                    name={paidInFullPath}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                            <FormControl>
                                <Checkbox
                                    checked={field.value || false}
                                    onCheckedChange={field.onChange}
                                    id="ampliacionesPaidInFull"
                                    disabled={isAmpliacionesFullPaymentRequired}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <label htmlFor='ampliacionesPaidInFull' className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', isAmpliacionesFullPaymentRequired && 'text-muted-foreground')}>
                                   ¿Cancelar la totalidad del curso (100%)?
                                </label>
                                {isAmpliacionesFullPaymentRequired && <FormDescription>El pago completo es requerido para montos de B/.100.00 o menos.</FormDescription>}
                            </div>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={paymentDeadlinePath}
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
                                            disabled={!watchedValues.ampliacionesDetails?.balance || watchedValues.ampliacionesDetails?.balance <= 0}
                                        >
                                            {field.value instanceof Date && !isNaN(field.value.getTime()) ? (
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
                                        disabled={(date) => date < new Date() || !watchedValues.ampliacionesDetails?.balance || watchedValues.ampliacionesDetails.balance <= 0}
                                        initialFocus
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                            {(!watchedValues.ampliacionesDetails?.balance || watchedValues.ampliacionesDetails.balance <= 0) && <FormDescription>No aplica, ya que el curso está cancelado en su totalidad.</FormDescription>}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </>
        )
    };

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
                                        {field.value instanceof Date && !isNaN(field.value.getTime()) ? (
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
                                                    {field.value instanceof Date && !isNaN(field.value.getTime()) ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar fecha {index + 1}</span>}
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
                                                                {field.value instanceof Date && !isNaN(field.value.getTime()) ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
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
                    <FormField key={index} control={form.control} name={`deluxeDetails.paymentInstallments.${index}`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Cuota {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value instanceof Date && !isNaN(field.value.getTime()) ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={es} mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
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
                    <FormField key={index} control={form.control} name={`deluxeDetails.theoreticalClasses.${index}`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Semana {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value instanceof Date && !isNaN(field.value.getTime()) ? format(new Date(field.value), "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar locale={es} mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
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
                    <p className='text-sm font-semibold text-muted-foreground'>Folio: {folioPreview}</p>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <h3 className="font-semibold text-lg pt-4 border-b pb-2">Datos del Estudiante</h3>
                {renderCommonFields()}
                {contractType === 'Curso Deluxe' ? renderDeluxeFields() 
                    : contractType === 'Ampliaciones' ? renderAmpliacionesFields()
                    : renderAutoMotoFields()}
                
                {contractType === 'Curso Auto' && renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Auto')}
                
                {contractType === 'Curso Moto' && renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Moto')}

                {contractType === 'Curso Mixto' && (
                    <>
                        {renderPracticalClassFields(practicalClassFields, 'autoMotoDetails.practicalClassSchedules', 'Clases Prácticas de Auto')}
                        {renderPracticalClassFields(motoPracticalClassFields, 'autoMotoDetails.motoPracticalClassSchedules', 'Clases Prácticas de Moto')}
                    </>
                )}
            </CardContent>
        </Card>
    );
    
    const PreviewComponent = () => {
      const formValues = form.watch();

      if (contractType === 'Curso Deluxe') {
          return <DeluxePremiumContractTemplatePreview folio={folioPreview} clientName={formValues.clientName} clientEmail={formValues.clientEmail} deluxeDetails={formValues.deluxeDetails} createdBy={currentUserRole || 'Ventas'} />
      }
      if (contractType === 'Ampliaciones') {
          const { clientName, clientEmail, ampliacionesDetails } = formValues;
          const contractForPreview: Contract = {
              id: '',
              folio: folioPreview,
              title: `Ampliaciones - ${clientName}`,
              clientName,
              clientEmail,
              clientId: '',
              content: '',
              deadlines: [],
              status: 'active' as const,
              type: 'Ampliaciones' as const,
              userId: user?.uid || '',
              createdAt: Timestamp.now(),
              createdBy: currentUserRole || 'Ventas',
              ampliacionesDetails: {
                  ...ampliacionesDetails,
                  theoreticalClassDate: ampliacionesDetails.theoreticalClassDate ? Timestamp.fromDate(new Date(ampliacionesDetails.theoreticalClassDate)) : undefined,
                  paymentDeadline: ampliacionesDetails.paymentDeadline ? Timestamp.fromDate(new Date(ampliacionesDetails.paymentDeadline)) : undefined,
              }
          }
          return <AmpliacionesContractTemplate contract={contractForPreview} />;
      }
      
      return <AutoMotoContractTemplatePreview folio={folioPreview} clientName={formValues.clientName} clientEmail={formValues.clientEmail} autoMotoDetails={formValues.autoMotoDetails} createdBy={currentUserRole || 'Ventas'} type={contractType as any} />
    }


    if (savedContract) {
        return (
            <div className='flex flex-col gap-4'>
                <div className='flex justify-between items-center print:hidden'>
                    <Button variant="outline" onClick={() => setSavedContract(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Nuevo Contrato
                    </Button>
                     <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Contrato
                    </Button>
                </div>
                <ContractView contract={savedContract} />
            </div>
        );
    }

    if (!contractType) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">Tipo de contrato no especificado</h3>
                <p className="mt-2 text-sm text-muted-foreground">Por favor, vuelve al panel y selecciona un tipo de contrato para crear.</p>                 <Button asChild className="mt-4"><a href="/dashboard">Volver al Panel</a></Button>
            </div>
        );
    }
  
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex flex-col gap-8">
                    {renderFormContent()}
                    
                     <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Contrato'}
                        </Button>
                    </div>

                    <Card>
                            <CardHeader>
                            <CardTitle>Vista Previa del Contrato</CardTitle>
                            <FormDescription>
                                Asegúrate de que toda la información en la vista previa sea correcta antes de guardar.
                            </FormDescription>
                        </CardHeader>
                        <CardContent>
                            <PreviewComponent />
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    );
}
