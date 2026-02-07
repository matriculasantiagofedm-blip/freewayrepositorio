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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Plus, Trash2, Calculator, Info, Package } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ContractType, VehicleName, InstructorName } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from './firebase-provider';

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', ''];

const practicalTimes = [
    '8:00am a 10:00am',
    '10:00am a 12:pm',
    '1:00pm a 3:00pm',
    '3:00pm a 5:00pm',
];

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico', price: 150.00 },
    { id: 'plus', label: 'Curso Auto Plus', price: 185.00 },
    { id: 'premium', label: 'Curso Auto Premium', price: 225.00 },
    { id: 'personalizado', label: 'Personalizado / Otro', price: 0 },
];

const contractSchema = z.object({
  clientName: z.string().min(1, 'El nombre completo es requerido.'),
  clientEmail: z.string().email('Debe ser un correo electrónico válido.'),
  contractType: z.enum(['Curso Auto', 'Curso Moto', 'Curso Mixto', 'Curso Deluxe', 'Ampliaciones', 'Curso Solo Practica']),
  
  studentIdNumber: z.string().min(1, 'La cédula es requerida.'),
  studentAddress: z.string().min(1, 'La dirección es requerida.'),
  studentPhone1: z.string().min(1, 'El teléfono es requerido.'),
  studentPhone2: z.string().optional(),
  
  coursePlan: z.string().optional(),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional(),
  paymentType: z.string().default('cash'),

  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.string().optional(),
  instructor: z.string().optional(),
  vehicle: z.string().optional(),

  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date()).optional(),
  practicalClassSchedules: z.array(z.object({
    date: z.date().optional(),
    time: z.string().optional()
  })).optional(),
  motoPracticalClassSchedules: z.array(z.object({
    date: z.date().optional(),
    time: z.string().optional()
  })).optional(),

  selectedPlans: z.array(z.object({
      name: z.string(),
      price: z.number()
  })).optional(),
  theoreticalClassDate: z.date().optional(),
  theoreticalClassTime: z.string().optional(),
});

type FormValues = z.infer<typeof contractSchema>;

const convertDatesToTimestamps = (data: any) => {
    const result = { ...data };
    const toTs = (d: any) => (d instanceof Date) ? Timestamp.fromDate(d) : d;

    if (result.paymentDeadline) result.paymentDeadline = toTs(result.paymentDeadline);
    if (result.theoreticalClassDate) result.theoreticalClassDate = toTs(result.theoreticalClassDate);
    if (result.theoreticalClassDates) result.theoreticalClassDates = result.theoreticalClassDates.map(toTs);
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
      clientName: '',
      clientEmail: '',
      contractType: contractType,
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      courseValue: 0,
      downPayment: 0,
      balance: 0,
      paymentType: 'cash',
      coursePlan: '',
      vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual',
      licenseCategory: contractType === 'Curso Moto' ? 'A, B' : 'A, C',
      practicalClassSchedules: contractType === 'Ampliaciones' ? [] : [{ date: new Date(), time: '8:00am a 10:00am' }],
      motoPracticalClassSchedules: contractType === 'Curso Mixto' ? [{ date: new Date(), time: '8:00am a 10:00am' }] : [],
      theoreticalClassDates: [],
      selectedPlans: [],
    },
  });

  const { fields: practicalFields, append: appendPractical, remove: removePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const { fields: motoFields, append: appendMoto, remove: removeMoto } = useFieldArray({
    control: form.control,
    name: "motoPracticalClassSchedules"
  });

  // Observadores para cálculos automáticos
  const courseValue = form.watch('courseValue');
  const downPayment = form.watch('downPayment');
  const selectedPlanId = form.watch('coursePlan');
  
  // Actualizar precio basado en paquete
  useEffect(() => {
    if (contractType === 'Curso Auto' && selectedPlanId) {
        const pkg = autoPackages.find(p => p.id === selectedPlanId);
        if (pkg && pkg.id !== 'personalizado') {
            form.setValue('courseValue', pkg.price);
        }
    }
  }, [selectedPlanId, contractType, form]);

  // Cálculo de saldo
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
            id: clientId, 
            name: values.clientName, 
            email: values.clientEmail, 
            idNumber: values.studentIdNumber, 
            phone: values.studentPhone1,
            userId: user.uid, 
            createdAt: serverTimestamp() as any
          });
        }

        const newContractRef = doc(collection(db, 'contracts'));
        const cleanedData = convertDatesToTimestamps(values);
        
        const contractData: any = {
          id: newContractRef.id,
          folioNumber: newFolioNumber,
          title: values.contractType,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientId: clientId,
          type: values.contractType,
          status: 'active',
          userId: user.uid,
          createdAt: serverTimestamp() as any,
          createdBy: currentUserRole || undefined
        };

        if (values.contractType === 'Curso Deluxe') {
            contractData.deluxeDetails = cleanedData;
        } else if (values.contractType === 'Ampliaciones') {
            contractData.ampliacionesDetails = cleanedData;
        } else {
            contractData.autoMotoDetails = cleanedData;
        }

        transaction.set(newContractRef, contractData);
        transaction.set(counterRef, { count: newFolioNumber }, { merge: true });
        return newContractRef.id;
      });

      toast({ title: 'Contrato Generado', description: 'El documento ha sido guardado exitosamente.' });
      router.push(`/contracts/${newContractId}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al Guardar', description: e.message });
    } finally { setIsSubmitting(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Datos del Estudiante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                            <FormItem><FormLabel>Cédula / Pasaporte</FormLabel><FormControl><Input placeholder="8-000-000" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="clientEmail" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="correo@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <FormField control={form.control} name="studentAddress" render={({ field }) => (
                        <FormItem><FormLabel>Dirección de Domicilio</FormLabel><FormControl><Input placeholder="Calle, Edificio, Casa..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                            <FormItem><FormLabel>Teléfono Principal</FormLabel><FormControl><Input placeholder="6000-0000" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="studentPhone2" render={({ field }) => (
                            <FormItem><FormLabel>Teléfono Alternativo</FormLabel><FormControl><Input placeholder="255-0000" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Valor y Forma de Pago</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {contractType === 'Curso Auto' && (
                        <FormField control={form.control} name="coursePlan" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2"><Package className="h-4 w-4" /> Plan / Paquete</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar paquete..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {autoPackages.map(pkg => (
                                            <SelectItem key={pkg.id} value={pkg.id}>
                                                {pkg.label} {pkg.price > 0 ? `- B/. ${pkg.price.toFixed(2)}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Selecciona un plan para auto-completar el precio.</FormDescription>
                            </FormItem>
                        )} />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="courseValue" render={({ field }) => (
                            <FormItem><FormLabel>Valor Total (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="downPayment" render={({ field }) => (
                            <FormItem><FormLabel>Abono Inicial (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="balance" render={({ field }) => (
                            <FormItem><FormLabel>Saldo Pendiente</FormLabel><FormControl><Input type="number" readOnly className="bg-muted font-bold text-destructive" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="paymentType" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Pago</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                    <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Fecha Límite de Saldo</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</Button></FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader><CardTitle className="text-lg">Detalles del Curso</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Transmisión</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Manual">Manual</SelectItem>
                                <SelectItem value="Automático">Automático</SelectItem>
                                <SelectItem value="Moto">Moto</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Categoría de Licencia</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="A, C">Tipo C (Auto)</SelectItem>
                                <SelectItem value="A, C, D">Tipo D (Camioneta)</SelectItem>
                                <SelectItem value="A, B">Tipo B (Moto)</SelectItem>
                                <SelectItem value="E1, E2, E3">Profesional (E)</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField control={form.control} name="instructor" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Instructor Asignado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                {instructors.map(i => i && <SelectItem key={i} value={i}>{i}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
            </CardContent>
        </Card>

        {contractType !== 'Ampliaciones' && (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Programación de Clases Prácticas</CardTitle>
                        <CardDescription>Añade los días y turnos para el entrenamiento.</CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendPractical({ date: addDays(new Date(), practicalFields.length + 1), time: '8:00am a 10:00am' })}>
                        <Plus className="h-4 w-4 mr-2" /> Añadir Clase
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {practicalFields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-4 p-4 border rounded-lg bg-slate-50/50">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Clase #{index + 1}</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl><Button variant="outline" className={cn("text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : "Seleccionar"}</Button></FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Horario / Turno</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{practicalTimes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removePractical(index)} disabled={practicalFields.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}

        {contractType === 'Curso Mixto' && (
             <Card className="border-orange-200">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg text-orange-700">Clases Prácticas de Motocicleta</CardTitle>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendMoto({ date: new Date(), time: '8:00am a 10:00am' })}>
                        <Plus className="h-4 w-4 mr-2" /> Añadir Clase Moto
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {motoFields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-4 p-4 border rounded-lg bg-orange-50/30">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.date`} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Moto #{index + 1}</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl><Button variant="outline" className={cn("text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : "Seleccionar"}</Button></FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.time`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Horario Moto</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{practicalTimes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMoto(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}

        <div className="flex justify-end pt-6 border-t">
            <Button type="submit" size="lg" className="w-full md:w-auto px-12" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando Contrato...</> : 'Generar y Guardar Contrato'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
