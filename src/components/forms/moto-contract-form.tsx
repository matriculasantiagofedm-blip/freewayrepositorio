'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE MOTO
 * Corrige errores de sintaxis y asegura el cierre de bloques antes del return.
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp,
  updateDoc
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  CalendarIcon, 
  Save, 
  UserCircle, 
  Bike, 
  CreditCard, 
  Clock,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import type { Contract } from '@/lib/types';

const MOTO_PLANS = [
  "Curso Moto Básico (8 Hrs)",
  "Curso Moto Plus (10 Hrs)",
  "Curso Moto Premium (12 Hrs)",
  "Moto Reforzamiento 4 Hrs",
  "Moto Reforzamiento 2 Hrs",
  "Ya se manejar (Moto)"
];

const PLAN_PRICES: Record<string, number> = {
  "Curso Moto Básico (8 Hrs)": 115.00,
  "Curso Moto Plus (10 Hrs)": 135.00,
  "Curso Moto Premium (12 Hrs)": 155.00,
  "Moto Reforzamiento 4 Hrs": 95.00,
  "Moto Reforzamiento 2 Hrs": 75.00,
  "Ya se manejar (Moto)": 57.00
};

const PLAN_PRACTICAL_COUNTS: Record<string, number> = {
  "Curso Moto Básico (8 Hrs)": 4,
  "Curso Moto Plus (10 Hrs)": 5,
  "Curso Moto Premium (12 Hrs)": 6,
  "Moto Reforzamiento 4 Hrs": 2,
  "Moto Reforzamiento 2 Hrs": 1,
  "Ya se manejar (Moto)": 1
};

const TIME_OPTIONS = [
  "08:00am a 10:00am",
  "10:00am a 12:00pm",
  "01:00pm a 03:00pm",
  "03:00pm a 05:00pm"
];

const VEHICLES_MOTO = ['Moto Roja', 'Moto Negra'];
const INSTRUCTORS = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];

const motoContractSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  licenseCategory: z.string().min(1, 'Categoría requerida'),
  vehicleTransmission: z.enum(['Moto']).default('Moto'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
  additionalService: z.enum(['Ninguno', 'Ya se manejar Auto', 'Basico Auto']).default('Ninguno'),
  courseValue: z.coerce.number().min(1, 'Monto inválido'),
  downPayment: z.coerce.number().min(0),
  paymentDeadline: z.date({ required_error: 'Fecha límite requerida' }),
  paymentType: z.string().default('cash'),
  theoreticalClassSchedule: z.enum(['Sabados 3:00 pm a 5:00 pm', 'Semanal 8:00 am a 10:00 am'], { required_error: "Seleccione un horario" }),
  theoreticalClassDates: z.array(z.date()).optional(),
  practicalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
    vehicle: z.string().optional(),
    instructor: z.string().optional(),
  })).optional(),
});

type FormValues = z.infer<typeof motoContractSchema>;

export function MotoContractForm({ contract }: { contract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!contract;

  const form = useForm<FormValues>({
    resolver: zodResolver(motoContractSchema),
    defaultValues: isEdit ? {
      ...contract.autoMotoDetails,
      clientName: contract.clientName || '',
      clientEmail: contract.clientEmail || '',
      idType: contract.autoMotoDetails?.idType || 'C.I.P.',
      studentIdNumber: contract.autoMotoDetails?.studentIdNumber || '',
      studentAddress: contract.autoMotoDetails?.studentAddress || '',
      studentPhone1: contract.autoMotoDetails?.studentPhone1 || '',
      licenseCategory: contract.autoMotoDetails?.licenseCategory || 'A, B',
      vehicleTransmission: 'Moto',
      coursePlan: contract.autoMotoDetails?.coursePlan || '',
      additionalService: (contract.autoMotoDetails as any)?.additionalService || 'Ninguno',
      courseValue: contract.autoMotoDetails?.courseValue || 0,
      downPayment: contract.autoMotoDetails?.downPayment || 0,
      paymentType: contract.autoMotoDetails?.paymentType || 'cash',
      theoreticalClassSchedule: (contract.autoMotoDetails?.theoreticalClassSchedule as any) || 'Sabados 3:00 pm a 5:00 pm',
      paymentDeadline: toDate(contract.autoMotoDetails?.paymentDeadline),
      theoreticalClassDates: (contract.autoMotoDetails?.theoreticalClassDates || []).map(d => toDate(d)),
      practicalClassSchedules: (contract.autoMotoDetails?.motoPracticalClassSchedules || []).map(s => ({ ...s, date: toDate(s.date) })),
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '',
      studentAddress: '', studentPhone1: '', licenseCategory: 'A, B',
      vehicleTransmission: 'Moto', coursePlan: '', additionalService: 'Ninguno',
      courseValue: 0, downPayment: 0, paymentType: 'cash',
      theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm', theoreticalClassDates: [],
      practicalClassSchedules: [],
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });

  const watchPlan = form.watch('coursePlan');
  const watchAdditional = form.watch('additionalService');
  const watchTheorySchedule = form.watch('theoreticalClassSchedule');
  const theoryDates = form.watch('theoreticalClassDates') || [];
  const currentBalance = (form.watch('courseValue') || 0) - (form.watch('downPayment') || 0);

  useEffect(() => {
    if (watchTheorySchedule && !isEdit) {
      const count = watchTheorySchedule === 'Semanal 8:00 am a 10:00 am' ? 4 : 3;
      const current = form.getValues('theoreticalClassDates') || [];
      form.setValue('theoreticalClassDates', Array.from({ length: count }, (_, i) => current[i] || new Date()));
    }
  }, [watchTheorySchedule, form, isEdit]);

  useEffect(() => {
    if (watchPlan && !isEdit) {
      let price = PLAN_PRICES[watchPlan] || 0;
      if (watchAdditional === 'Basico Auto') price = 290.00;
      else if (watchAdditional === 'Ya se manejar Auto') price += 20.00;
      form.setValue('courseValue', price);
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      replacePractical(Array.from({ length: count }, () => ({ date: new Date(), time: '08:00am a 10:00am', vehicle: 'Moto Roja', instructor: '' })));
    }
  }, [watchPlan, watchAdditional, replacePractical, form, isEdit]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      const balance = values.courseValue - values.downPayment;
      const { clientName, clientEmail, ...detailsOnly } = values;
      const formattedTheoryDates = (values.theoreticalClassDates || []).map(d => Timestamp.fromDate(d));
      const formattedPracticalSchedules = (values.practicalClassSchedules || []).map(s => ({ ...s, date: Timestamp.fromDate(s.date) }));

      if (isEdit && contract) {
        const contractRef = doc(db, 'contracts', contract.id);
        const updateData = {
          clientName, clientEmail,
          status: balance <= 0 ? 'completed' : (contract.status === 'draft' ? 'active' : contract.status),
          autoMotoDetails: { 
            ...detailsOnly, 
            paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null, 
            theoreticalClassDates: formattedTheoryDates, 
            motoPracticalClassSchedules: formattedPracticalSchedules, 
            balance 
          },
          updatedAt: serverTimestamp(), updatedBy: role || 'Sistema',
        };
        await updateDoc(contractRef, updateData);
        toast({ title: 'Moto Actualizada' });
        router.push(`/contracts/${contract.id}`);
      } else {
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, 'counters', 'contracts_folio');
          const counterDoc = await transaction.get(counterRef);
          let nextFolio = counterDoc.exists() ? Math.max(counterDoc.data().count + 1, 18) : 18;
          transaction.set(counterRef, { count: nextFolio }, { merge: true });
          const clientRef = doc(collection(db, 'clients'));
          transaction.set(clientRef, { name: clientName, email: clientEmail, idNumber: values.studentIdNumber, phone: values.studentPhone1, createdAt: serverTimestamp(), userId: user.uid });
          const contractRef = doc(collection(db, 'contracts'));
          transaction.set(contractRef, { 
            title: `Curso de Moto - Folio ${nextFolio}`, 
            clientName, 
            clientEmail, 
            clientId: clientRef.id, 
            folioNumber: nextFolio, 
            type: 'Curso Moto', 
            status: balance <= 0 ? 'completed' : 'active', 
            userId: user.uid, 
            createdBy: role || 'Sistema', 
            createdAt: serverTimestamp(), 
            autoMotoDetails: { 
              ...detailsOnly, 
              paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null, 
              theoreticalClassDates: formattedTheoryDates, 
              motoPracticalClassSchedules: formattedPracticalSchedules, 
              balance 
            } 
          });
        });
        toast({ title: 'Contrato Creado' });
        router.push('/dashboard');
      }
    } catch (error) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsSaving(false); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-orange-600 shadow-md">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Ficha Técnica (Moto)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-8">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre Completo</FormLabel>
                    <FormControl><Input placeholder="Nombre..." {...field} className="h-9 uppercase font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Email</FormLabel>
                    <FormControl><Input type="email" placeholder="ejemplo@correo.com" {...field} className="h-9" /></FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Cédula / Pasaporte</FormLabel>
                    <FormControl><Input placeholder="Ej: 8-000-000" {...field} className="h-9 font-mono" readOnly={isEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono de Contacto</FormLabel>
                    <FormControl><Input placeholder="6000-0000" {...field} className="h-9" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12">
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</FormLabel>
                    <FormControl><Input placeholder="Ubicación completa..." {...field} className="h-9 uppercase" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Bike className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Curso y Teoría</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Categoría</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="A, B">Tipo A y B</SelectItem>
                      <SelectItem value="A, B, C">Tipo A, B y C</SelectItem>
                      <SelectItem value="A, B, C, D">Tipo A, B, C y D</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Vehículo</FormLabel>
                  <FormControl><Input value="Motocicleta" readOnly className="h-10 bg-muted/30 font-bold" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Horario Teoría</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Sabados 3:00 pm a 5:00 pm">Sábados 3:00 pm a 5:00 pm</SelectItem>
                      <SelectItem value="Semanal 8:00 am a 10:00 am">Semanal 8:00 am a 10:00 am</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            {watchTheorySchedule && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                {theoryDates.map((_, i) => (
                  <FormField key={i} control={form.control} name={`theoreticalClassDates.${i}`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {i + 1}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="h-9 text-xs text-left">
                              {field.value ? format(toDate(field.value), "dd/MM/yy") : 'Elegir'}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(field.value)} onSelect={field.onChange} initialFocus /></PopoverContent>
                      </Popover>
                    </FormItem>
                  )} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Plan y Pago</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="coursePlan" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl>
                    <SelectContent>{MOTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="courseValue" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Valor</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold bg-muted/30" readOnly={!isEdit} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase">Abono</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="h-12 flex items-center justify-between px-6 bg-orange-50 rounded-xl border border-orange-100">
              <span className="text-[10px] font-bold uppercase text-orange-700">Saldo:</span>
              <span className="text-xl font-black text-orange-900">B/. {currentBalance.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Límite para Saldo</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="h-10 text-left">
                          {field.value ? format(toDate(field.value), "PPP", { locale: es }) : 'Elegir'}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(field.value)} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método Pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="debit">Tarjeta Débito</SelectItem>
                      <SelectItem value="credit">Tarjeta Crédito</SelectItem>
                      <SelectItem value="bac">BAC</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="cheques">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Agenda Práctica</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {practicalFields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-xl space-y-3 bg-white border-slate-200">
                  <div className="flex gap-4">
                    <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {index + 1}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl><Button variant="outline" className="h-9 w-full text-left font-normal text-xs">{f.value ? format(toDate(f.value), "dd/MM/yy") : 'Fecha'}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate(f.value)} onSelect={f.onChange} initialFocus /></PopoverContent>
                        </Popover>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Horario</FormLabel>
                        <Select onValueChange={f.onChange} value={f.value}>
                          <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name={`practicalClassSchedules.${index}.vehicle`} render={({ field: f }) => (
                      <FormItem>
                        <Select onValueChange={f.onChange} value={f.value}>
                          <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                          <SelectContent>{VEHICLES_MOTO.map(v => <SelectItem key={v} value={v} className="text-[10px]">{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`practicalClassSchedules.${index}.instructor`} render={({ field: f }) => (
                      <FormItem>
                        <Select onValueChange={f.onChange} value={f.value}>
                          <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                          <SelectContent>{INSTRUCTORS.map(i => <SelectItem key={i} value={i} className="text-[10px]">{i}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={isSaving} className={cn("min-w-[220px]", isEdit ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700")}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEdit ? <RefreshCw className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Actualizar Moto' : 'Guardar Curso Moto'}
          </Button>
        </div>
      </form>
    </Form>
  );
}