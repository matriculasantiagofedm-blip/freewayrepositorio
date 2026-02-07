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
import { CalendarIcon, Loader2, Plus, Trash2, Calculator, UserCircle, Settings2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ContractType, InstructorName } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from './firebase-provider';

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', ''];
const carVehicles = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const practicalTimes = ['8:00am a 10:00am', '10:00am a 12:pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico (8hrz)', price: 133.00, hours: 8 },
    { id: 'plus', label: 'Curso Auto Plus (10hrz)', price: 155.00, hours: 10 },
    { id: 'premium', label: 'Curso Auto Premium (12hrz)', price: 180.00, hours: 12 },
];

const motoPackages = [{ id: 'moto-estandar', label: 'Curso Moto Estándar', price: 100.00, hours: 4 }];
const mixtoPackages = [{ id: 'mixto-estandar', label: 'Curso Mixto (Auto/Moto)', price: 250.00, hours: 12 }];
const deluxePackages = [
    { id: 'deluxe-premium', label: 'Plan Premium (Deluxe)', price: 201.00, hours: 12 },
    { id: 'deluxe-full', label: 'Plan Deluxe Full', price: 270.00, hours: 16 },
];

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
  vehicle: z.string().optional(),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.string().optional(),
  instructor: z.string().optional(),
  practicalClassSchedules: z.array(z.object({
    date: z.date().optional(),
    time: z.string().optional()
  })).optional(),
  motoPracticalClassSchedules: z.array(z.object({
    date: z.date().optional(),
    time: z.string().optional()
  })).optional(),
});

type FormValues = z.infer<typeof contractSchema>;

const convertDatesToTimestamps = (data: any) => {
    const result = { ...data };
    const toTs = (d: any) => (d instanceof Date) ? Timestamp.fromDate(d) : d;
    if (result.paymentDeadline) result.paymentDeadline = toTs(result.paymentDeadline);
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
      paymentType: 'cash', coursePlan: '', vehicle: '', vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual',
      licenseCategory: contractType === 'Curso Moto' ? 'A, B' : 'A, C',
      practicalClassSchedules: contractType === 'Ampliaciones' ? [] : [{ date: new Date(), time: '8:00am a 10:00am' }],
      motoPracticalClassSchedules: contractType === 'Curso Mixto' ? [{ date: new Date(), time: '8:00am a 10:00am' }] : [],
    },
  });

  const { fields: practicalFields, append: appendPractical, remove: removePractical, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { fields: motoFields, append: appendMoto, remove: removeMoto } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  const courseValue = form.watch('courseValue');
  const downPayment = form.watch('downPayment');
  const selectedPlanId = form.watch('coursePlan');
  
  useEffect(() => {
    if (!selectedPlanId) return;
    let pkg;
    if (contractType === 'Curso Auto') pkg = autoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Moto') pkg = motoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Mixto') pkg = mixtoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Deluxe') pkg = deluxePackages.find(p => p.id === selectedPlanId);
    
    if (pkg) {
        form.setValue('courseValue', pkg.price);
        // Automate practical class slots (assuming 2 hours per slot)
        if (pkg.hours && contractType !== 'Ampliaciones') {
            const numSlots = Math.ceil(pkg.hours / 2);
            const newSlots = Array.from({ length: numSlots }).map((_, i) => ({
                date: addDays(new Date(), i + 1),
                time: '8:00am a 10:00am'
            }));
            replacePractical(newSlots);
        }
    }
  }, [selectedPlanId, contractType, form, replacePractical]);

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
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setIsSubmitting(false); }
  }

  const currentPackages = useMemo(() => {
    if (contractType === 'Curso Auto') return autoPackages;
    if (contractType === 'Curso Moto') return motoPackages;
    if (contractType === 'Curso Mixto') return mixtoPackages;
    if (contractType === 'Curso Deluxe') return deluxePackages;
    return null;
  }, [contractType]);

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
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Valor Total (B/.)</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" {...field} /></FormControl></FormItem>
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
                <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Categoría de Licencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="A, C">Tipo C (Auto)</SelectItem><SelectItem value="A, C, D">Tipo D (Camioneta)</SelectItem><SelectItem value="A, B">Tipo B (Moto)</SelectItem><SelectItem value="E1, E2, E3">Profesional (E)</SelectItem></SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Transmisión</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Manual">Manual</SelectItem><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Moto">Moto</SelectItem></SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="vehicle" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Vehículo Asignado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                {carVehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField control={form.control} name="instructor" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Instructor</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{instructors.map(i => i && <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
            </CardContent>
        </Card>

        {/* 4. Programación de Clases Prácticas */}
        {contractType !== 'Ampliaciones' && (
            <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                        <Clock className="h-4 w-4" /> 4. Programación de Clases Prácticas
                    </CardTitle>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs font-bold" onClick={() => appendPractical({ date: addDays(new Date(), practicalFields.length + 1), time: '8:00am a 10:00am' })}>
                        <Plus className="h-3 w-3 mr-1" /> Añadir Clase
                    </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {practicalFields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/10">
                                <span className="text-[10px] font-bold w-5 bg-primary text-white rounded-full h-5 flex items-center justify-center shrink-0">#{index + 1}</span>
                                <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl><Button variant="outline" className={cn("h-7 text-xs w-full text-left font-normal px-2", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-1 h-3 w-3" />{field.value ? format(field.value, "dd/MM") : "Fecha"}</Button></FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-7 text-xs px-2"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{practicalTimes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removePractical(index)} disabled={practicalFields.length <= 1}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
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
