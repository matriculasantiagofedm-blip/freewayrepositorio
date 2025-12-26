
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addWeeks } from 'date-fns';
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
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
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

// --- Esquemas de Validación con Zod ---

const classScheduleSchema = z.object({
    date: z.date().optional(),
    time: z.string().optional(),
});

const baseSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  clientIdNumber: z.string().min(1, 'La cédula es requerida'),
  clientAddress: z.string().min(1, 'La dirección es requerida'),
  clientPhone1: z.string().min(1, 'Se requiere al menos un teléfono'),
  clientPhone2: z.string().optional(),
  contractType: z.custom<ContractType>(),
});

const autoMotoSchema = baseSchema.extend({
  courseValue: z.number().min(0),
  downPayment: z.number().min(0),
  balance: z.number(),
  paymentDeadline: z.date(),
  vehicle: z.enum(['Spark', 'P. Blanco', 'P. Bronce', 'Moto']).optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']),
  licenseCategory: z.enum(['A, C', 'A, C, D', 'A, B']),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().optional()).optional(),
  practicalClassSchedules: z.array(classScheduleSchema).optional(),
  motoPracticalClassSchedules: z.array(classScheduleSchema).optional(),
});

const deluxeSchema = baseSchema.extend({
  paymentDetails: z.string().min(1, 'Se requieren detalles de pago'),
  paymentAmount: z.number().positive('El monto debe ser positivo'),
  paymentInstallments: z.array(z.date().optional()),
  vehicleTransmission: z.enum(['Automático', 'Manual']),
  licenseCategory: z.enum(['A, C', 'A, C, D']),
  theoreticalClassSchedule: z.enum(['Lunes', 'Miércoles']),
  theoreticalClasses: z.array(z.date().optional()),
  classSchedules: z.array(classScheduleSchema),
});

const formSchema = z.union([autoMotoSchema, deluxeSchema]);
type FormValues = z.infer<typeof formSchema>;


// --- Datos Estáticos ---
const autoCourseValues = [
    { name: 'PAQUETE COMPLETO', price: 230.00 },
    { name: 'PAQUETE BÁSICO', price: 175.00 },
    { name: 'CLASES ADICIONALES (2 HORAS)', price: 40.00 },
    { name: 'ALQUILER DE AUTO PARA PRUEBA', price: 40.00 },
];

const motoCourseValues = [
    { name: 'CURSO COMPLETO', price: 150.00 },
    { name: 'CLASES ADICIONALES (2 HORAS)', price: 30.00 },
    { name: 'ALQUILER DE MOTO PARA PRUEBA', price: 30.00 },
];

const mixtoCourseValues = [
    { name: 'PAQUETE MIXTO COMPLETO', price: 380.00 },
];

const practicalClassTimeSlots = [
  '8:00 am a 10:00 am',
  '10:00 am a 12:00 pm',
  '1:00 pm a 3:00 pm',
  '3:00 pm a 5:00 pm',
];

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

    const { fields: practicalClassFields, append: appendPracticalClass, remove: removePracticalClass } = useFieldArray({
        control: form.control,
        name: "practicalClassSchedules" as any,
    });
    
    const { fields: motoPracticalClassFields, append: appendMotoPracticalClass, remove: removeMotoPracticalClass } = useFieldArray({
        control: form.control,
        name: "motoPracticalClassSchedules" as any,
    });

    const { fields: deluxeClassFields, append: appendDeluxeClass, remove: removeDeluxeClass } = useFieldArray({
        control: form.control,
        name: "classSchedules" as any,
    });

    useEffect(() => {
        if (contractType) {
            form.reset({
                contractType: contractType,
                clientName: '',
                clientEmail: '',
                clientIdNumber: '',
                clientAddress: '',
                clientPhone1: '',
                clientPhone2: '',
            });

            if (contractType === 'Curso Deluxe') {
                form.setValue('classSchedules', Array(6).fill({}));
            } else {
                 if (contractType === 'Curso Mixto') {
                    form.setValue('practicalClassSchedules', Array(6).fill({}));
                    form.setValue('motoPracticalClassSchedules', Array(4).fill({}));
                } else if (contractType === 'Curso Auto') {
                    form.setValue('practicalClassSchedules', Array(6).fill({}));
                } else if (contractType === 'Curso Moto') {
                    form.setValue('practicalClassSchedules', Array(4).fill({}));
                }
            }
        }
    }, [contractType, form]);
    
    useEffect(() => {
        const typePrefix = contractType?.substring(0, 3).toUpperCase() || 'GEN';
        const uniqueId = Date.now().toString().slice(-6);
        setFolio(`${typePrefix}-${uniqueId}`);
    }, [contractType]);

    useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name === 'courseValue' || name === 'downPayment') {
                const courseValue = value.courseValue || 0;
                const downPayment = value.downPayment || 0;
                if (typeof courseValue === 'number' && typeof downPayment === 'number') {
                    form.setValue('balance', courseValue - downPayment);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);


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
                idNumber: values.clientIdNumber,
                userId: user.uid,
                createdAt: serverTimestamp(),
            };
            batch.set(clientRef, clientData);
            
            // 2. Crear contrato
            const contractRef = doc(collection(firestore, 'contracts'));
            
            const currentUserRole = localStorage.getItem('currentUser') || 'Ventas';

            const contractData = {
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

             if ('courseValue' in values) { // Auto/Moto/Mixto
                (contractData as any).autoMotoDetails = {
                    studentIdNumber: values.clientIdNumber,
                    studentAddress: values.clientAddress,
                    studentPhone1: values.clientPhone1,
                    studentPhone2: values.clientPhone2,
                    courseValue: values.courseValue,
                    downPayment: values.downPayment,
                    balance: (values.courseValue || 0) - (values.downPayment || 0),
                    paymentDeadline: values.paymentDeadline,
                    vehicle: values.vehicle,
                    vehicleTransmission: values.vehicleTransmission,
                    licenseCategory: values.licenseCategory,
                    theoreticalClassSchedule: values.theoreticalClassSchedule,
                    theoreticalClassDates: values.theoreticalClassDates?.map(d => d ? format(d, 'yyyy-MM-dd') : undefined),
                    practicalClassSchedules: values.practicalClassSchedules?.map(c => ({...c, date: c.date ? format(c.date, 'yyyy-MM-dd') : undefined })),
                    motoPracticalClassSchedules: values.motoPracticalClassSchedules?.map(c => ({...c, date: c.date ? format(c.date, 'yyyy-MM-dd') : undefined })),
                };
            } else if ('paymentDetails' in values) { // Deluxe
                (contractData as any).deluxeDetails = {
                    studentIdNumber: values.clientIdNumber,
                    studentAddress: values.clientAddress,
                    studentPhone1: values.clientPhone1,
                    studentPhone2: values.clientPhone2,
                    paymentDetails: values.paymentDetails,
                    paymentAmount: values.paymentAmount,
                    paymentInstallments: values.paymentInstallments.map(d => d ? format(d, 'yyyy-MM-dd') : undefined),
                    vehicleTransmission: values.vehicleTransmission,
                    licenseCategory: values.licenseCategory,
                    theoreticalClassSchedule: values.theoreticalClassSchedule,
                    theoreticalClasses: values.theoreticalClasses.map(d => d ? format(d, 'yyyy-MM-dd') : undefined),
                    classSchedules: values.classSchedules.map(c => ({...c, date: c.date ? format(c.date, 'yyyy-MM-dd') : undefined })),
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
            <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre Completo del Cliente</FormLabel>
                        <FormControl><Input placeholder="Ej. Juan Pérez" {...field} /></FormControl>
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
                        <FormControl><Input type="email" placeholder="ej. juan.perez@email.com" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="clientIdNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cédula de Identidad</FormLabel>
                        <FormControl><Input placeholder="Ej. 8-123-456" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="clientAddress"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Dirección Residencial</FormLabel>
                        <FormControl><Textarea placeholder="Dirección completa del cliente..." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="clientPhone1"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teléfono 1</FormLabel>
                            <FormControl><Input type="tel" placeholder="Ej. 6123-4567" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="clientPhone2"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teléfono 2 (Opcional)</FormLabel>
                            <FormControl><Input type="tel" placeholder="Ej. 399-9999" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </>
    );

    const renderAutoMotoFields = () => (
        <>
            <FormField
                control={form.control}
                name="courseValue"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Valor del Curso</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseFloat(value))} >
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un paquete" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {contractType === 'Curso Auto' && autoCourseValues.map(c => <SelectItem key={c.name} value={String(c.price)}>{c.name} - ${c.price.toFixed(2)}</SelectItem>)}
                                {contractType === 'Curso Moto' && motoCourseValues.map(c => <SelectItem key={c.name} value={String(c.price)}>{c.name} - ${c.price.toFixed(2)}</SelectItem>)}
                                {contractType === 'Curso Mixto' && mixtoCourseValues.map(c => <SelectItem key={c.name} value={String(c.price)}>{c.name} - ${c.price.toFixed(2)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="downPayment" render={({ field }) => (<FormItem><FormLabel>Abono Inicial (B/.)</FormLabel><FormControl><Input type="number" placeholder="Ej. 100.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="balance" render={({ field }) => (<FormItem><FormLabel>Saldo Pendiente (B/.)</FormLabel><FormControl><Input type="number" {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (<FormItem className="flex flex-col pt-2"><FormLabel>Fecha Límite de Pago</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            </div>

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Detalles del Vehículo y Licencia</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="vehicle" render={({ field }) => (<FormItem><FormLabel>Vehículo Asignado</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Vehículo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Spark">Spark</SelectItem><SelectItem value="P. Blanco">Picanto Blanco</SelectItem><SelectItem value="P. Bronce">Picanto Bronce</SelectItem><SelectItem value="Moto">Moto</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (<FormItem><FormLabel>Transmisión</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Transmisión" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem>{contractType === "Curso Moto" && <SelectItem value="Moto">Moto</SelectItem>}</SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="licenseCategory" render={({ field }) => (<FormItem><FormLabel>Categoría de Licencia</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Categoría" /></SelectTrigger></FormControl><SelectContent>{contractType === "Curso Moto" ? <SelectItem value="A, B">A, B</SelectItem> : <><SelectItem value="A, C">A, C</SelectItem><SelectItem value="A, C, D">A, C, D</SelectItem></>}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
        </>
    );
    
    const renderPracticalClassFields = (fields: any, remove: any, append: any, title: string) => (
        <div>
            <h3 className="font-semibold text-lg pt-4 border-b pb-2 mb-4">{title}</h3>
            <div className="space-y-4">
                {fields.map((field: any, index: number) => (
                    <div key={field.id} className="flex items-end gap-4 p-4 border rounded-md relative">
                         <p className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground">Clase {index + 1}</p>
                        <FormField control={form.control} name={`practicalClassSchedules.${index}.date` as any} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`practicalClassSchedules.${index}.time` as any} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Hora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar hora" /></SelectTrigger></FormControl><SelectContent>{practicalClassTimeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                ))}
            </div>
             <Button type="button" variant="outline" size="sm" onClick={() => append({})} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase</Button>
        </div>
    );
    
    const renderMotoPracticalClassFields = () => (
         <div>
            <h3 className="font-semibold text-lg pt-4 border-b pb-2 mb-4">Clases Prácticas de Moto</h3>
            <div className="space-y-4">
                {motoPracticalClassFields.map((field: any, index: number) => (
                    <div key={field.id} className="flex items-end gap-4 p-4 border rounded-md relative">
                         <p className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground">Clase de Moto {index + 1}</p>
                        <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.date` as any} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.time` as any} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Hora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar hora" /></SelectTrigger></FormControl><SelectContent>{practicalClassTimeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMotoPracticalClass(index)} className="shrink-0"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                ))}
            </div>
             <Button type="button" variant="outline" size="sm" onClick={() => appendMotoPracticalClass({})} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase de Moto</Button>
        </div>
    );

    const renderDeluxeFields = () => (
        <>
            <FormField control={form.control} name="paymentDetails" render={({ field }) => (<FormItem><FormLabel>Detalles del Pago</FormLabel><FormControl><Textarea placeholder="Ej. El estudiante pagará B/. 201.00 en 6 cuotas quincenales de B/.33.50..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="paymentAmount" render={({ field }) => (<FormItem><FormLabel>Monto por Cuota (B/.)</FormLabel><FormControl><Input type="number" placeholder="33.50" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Fechas de Pago (6 Cuotas)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                    <FormField key={index} control={form.control} name={`paymentInstallments.${index}` as any} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Cuota {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                ))}
            </div>
            
            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Detalles del Curso y Horario</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (<FormItem><FormLabel>Transmisión</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Transmisión" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="licenseCategory" render={({ field }) => (<FormItem><FormLabel>Categoría de Licencia</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Categoría" /></SelectTrigger></FormControl><SelectContent><SelectItem value="A, C">A, C</SelectItem><SelectItem value="A, C, D">A, C, D</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (<FormItem><FormLabel>Horario Teórico</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Horario" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Lunes">Lunes (8am-10am)</SelectItem><SelectItem value="Miércoles">Miércoles (7pm-9pm)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>

            <h3 className="font-semibold text-lg pt-4 border-b pb-2">Clases Teóricas (10 Semanas)</h3>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 10 }).map((_, index) => (
                    <FormField key={index} control={form.control} name={`theoreticalClasses.${index}` as any} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Semana {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                ))}
            </div>
            
            <div>
                <h3 className="font-semibold text-lg pt-4 border-b pb-2 mb-4">Clases Prácticas (6 clases)</h3>
                <div className="space-y-4">
                    {deluxeClassFields.map((field: any, index: number) => (
                        <div key={field.id} className="flex items-end gap-4 p-4 border rounded-md relative">
                            <p className="absolute -top-2 left-2 bg-background px-1 text-xs text-muted-foreground">Clase {index + 1}</p>
                            <FormField control={form.control} name={`classSchedules.${index}.date` as any} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`classSchedules.${index}.time` as any} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Hora</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar hora" /></SelectTrigger></FormControl><SelectContent>{practicalClassTimeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );

    const renderFormContent = () => (
        <>
            {renderCommonFields()}
            {contractType === 'Curso Deluxe' ? renderDeluxeFields() : renderAutoMotoFields()}
            {(contractType === 'Curso Auto' || contractType === 'Curso Mixto') && renderPracticalClassFields(practicalClassFields, removePracticalClass, appendPracticalClass, 'Clases Prácticas de Auto')}
            {(contractType === 'Curso Moto' || contractType === 'Curso Mixto') && (contractType === 'Curso Mixto' ? renderMotoPracticalClassFields() : renderPracticalClassFields(practicalClassFields, removePracticalClass, appendPracticalClass, 'Clases Prácticas de Moto'))}
        </>
    );

    const steps = [
        { title: "Información del Contrato", content: renderFormContent },
        { title: "Vista Previa del Contrato", content: () => (
            <div>
                {contractType === 'Curso Deluxe' 
                    ? <DeluxePremiumContractTemplatePreview folio={folio} clientName={watchedValues.clientName} clientEmail={watchedValues.clientEmail} deluxeDetails={watchedValues as any} createdBy={localStorage.getItem('currentUser')} />
                    : <AutoMotoContractTemplatePreview folio={folio} clientName={watchedValues.clientName} clientEmail={watchedValues.clientEmail} autoMotoDetails={watchedValues as any} createdBy={localStorage.getItem('currentUser')} type={contractType as any} />
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
                                        <CardTitle>Completar Formulario</CardTitle>
                                        <div className='flex justify-between items-center'>
                                            <FormDescription>Ingresa los detalles del cliente y del contrato.</FormDescription>
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

    