
'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE MOTO (SINCRONIZADO CON AGENDA)
 * Freeway Escuela de Manejo, S.A.
 */

import { useState, useEffect, useMemo } from 'react';
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
  query,
  where
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
  BookOpen,
  Package,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';

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

const motoContractSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
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

export function MotoContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(motoContractSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      idType: 'C.I.P.',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      licenseCategory: 'A, B',
      vehicleTransmission: 'Moto',
      coursePlan: '',
      additionalService: 'Ninguno',
      courseValue: 0,
      downPayment: 0,
      paymentType: 'cash',
      theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm',
      theoreticalClassDates: [],
      practicalClassSchedules: [],
    },
  });

  const { replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const watchPlan = form.watch('coursePlan');
  const watchAdditional = form.watch('additionalService');

  useEffect(() => {
    if (watchPlan) {
      let price = PLAN_PRICES[watchPlan] || 0;
      if (watchAdditional === 'Basico Auto') price = 290.00;
      else if (watchAdditional === 'Ya se manejar Auto') price += 20.00;

      form.setValue('courseValue', price);
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      replacePractical(Array.from({ length: count }, () => ({ date: new Date(), time: '08:00am a 10:00am' })));
    }
  }, [watchPlan, watchAdditional, replacePractical, form]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);

    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contracts_folio');
        const counterDoc = await transaction.get(counterRef);
        
        // UNIFICACIÓN: El próximo folio debe ser al menos 18
        let nextFolio = counterDoc.exists() 
            ? Math.max(counterDoc.data().count + 1, 18) 
            : 18;
        
        transaction.set(counterRef, { count: nextFolio }, { merge: true });

        const clientRef = doc(collection(db, 'clients'));
        transaction.set(clientRef, {
          name: values.clientName,
          email: values.clientEmail,
          idNumber: values.studentIdNumber,
          phone: values.studentPhone1,
          createdAt: serverTimestamp(),
          userId: user.uid,
        });

        const contractRef = doc(collection(db, 'contracts'));
        const balance = values.courseValue - values.downPayment;

        transaction.set(contractRef, {
          title: `Curso de Moto - Folio ${nextFolio}`,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientId: clientRef.id,
          folioNumber: nextFolio,
          type: 'Curso Moto',
          status: balance <= 0 ? 'completed' : 'active',
          userId: user.uid,
          createdBy: role || 'Sistema',
          createdAt: serverTimestamp(),
          autoMotoDetails: {
            ...values,
            paymentDeadline: Timestamp.fromDate(values.paymentDeadline),
            theoreticalClassDates: (values.theoreticalClassDates || []).map(d => Timestamp.fromDate(d)),
            motoPracticalClassSchedules: (values.practicalClassSchedules || []).map(s => ({ ...s, date: Timestamp.fromDate(s.date) })),
            balance: balance,
          }
        });
      });

      toast({ title: 'Contrato Creado', description: 'El registro de moto se ha guardado exitosamente.' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error saving contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el contrato.' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = form.watch('courseValue') - form.watch('downPayment');

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
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre Completo</FormLabel><FormControl><Input placeholder="Nombre..." {...field} className="h-9 uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Email</FormLabel><FormControl><Input type="email" placeholder="ejemplo@correo.com" {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Cédula / Pasaporte</FormLabel><FormControl><Input placeholder="Ej: 8-000-000" {...field} className="h-9 font-mono" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono</FormLabel><FormControl><Input placeholder="6000-0000" {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="col-span-12">
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</FormLabel><FormControl><Input placeholder="Ubicación completa..." {...field} className="h-9 uppercase" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Plan y Cobro</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="coursePlan" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Plan Moto</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Elegir plan..." /></SelectTrigger></FormControl><SelectContent>{MOTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="courseValue" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold bg-muted/30" readOnly /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl></FormItem>
              )} />
            </div>
            <div className="flex justify-between items-center h-12 px-6 bg-orange-50 rounded-xl border border-orange-100">
                <span className="text-[10px] font-bold uppercase text-orange-700">Saldo Pendiente:</span>
                <span className="text-xl font-black text-orange-900">B/. {currentBalance.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Límite para Cancelar Saldo</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Elegir fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                )} />
                <FormField control={form.control} name="paymentType" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">Tarjeta Débito</SelectItem><SelectItem value="credit">Tarjeta Crédito</SelectItem><SelectItem value="bac">BAC</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="cheques">Cheque</SelectItem></SelectContent></Select></FormItem>
                )} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={isSaving} className="min-w-[200px] bg-orange-600 hover:bg-orange-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Contrato de Moto
          </Button>
        </div>
      </form>
    </Form>
  );
}
