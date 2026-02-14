
'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE SOLO PRÁCTICA
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
  Dumbbell, 
  CreditCard, 
  Clock,
  Package,
  Car
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';

const PRACTICE_PLANS = ["Basico 8 Hrs", "Plus 10 Hrs", "Premium 12 Hrs"];
const PLAN_PRICES: Record<string, number> = { "Basico 8 Hrs": 123.00, "Plus 10 Hrs": 135.00, "Premium 12 Hrs": 160.00 };
const PLAN_PRACTICAL_COUNTS: Record<string, number> = { "Basico 8 Hrs": 4, "Plus 10 Hrs": 5, "Premium 12 Hrs": 6 };

const soloPracticaSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
  vehicleType: z.enum(['Auto', 'Motocicleta']).default('Auto'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un paquete" }),
  courseValue: z.coerce.number().min(1, 'Monto inválido'),
  downPayment: z.coerce.number().min(0),
  paymentDeadline: z.date({ required_error: 'Fecha límite requerida' }),
  paymentType: z.string().default('cash'),
  practicalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
    vehicle: z.string().optional(),
    instructor: z.string().optional(),
  })).optional(),
});

type FormValues = z.infer<typeof soloPracticaSchema>;

export function SoloPracticaContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(soloPracticaSchema),
    defaultValues: {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '',
      studentAddress: '', studentPhone1: '', vehicleType: 'Auto',
      vehicleTransmission: 'Automático', coursePlan: '', courseValue: 0,
      downPayment: 0, paymentType: 'cash', practicalClassSchedules: [],
    },
  });

  const { replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const watchPlan = form.watch('coursePlan');

  useEffect(() => {
    if (watchPlan) {
      form.setValue('courseValue', PLAN_PRICES[watchPlan] || 0);
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      replacePractical(Array.from({ length: count }, () => ({ date: new Date(), time: '08:00am a 10:00am' })));
    }
  }, [watchPlan, replacePractical, form]);

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
          name: values.clientName, email: values.clientEmail, idNumber: values.studentIdNumber,
          phone: values.studentPhone1, createdAt: serverTimestamp(), userId: user.uid,
        });

        const contractRef = doc(collection(db, 'contracts'));
        const balance = values.courseValue - values.downPayment;

        transaction.set(contractRef, {
          title: `Solo Práctica - Folio ${nextFolio}`,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientId: clientRef.id,
          folioNumber: nextFolio,
          type: 'Curso Solo Practica',
          status: balance <= 0 ? 'completed' : 'active',
          userId: user.uid,
          createdBy: role || 'Sistema',
          createdAt: serverTimestamp(),
          autoMotoDetails: {
            ...values,
            paymentDeadline: Timestamp.fromDate(values.paymentDeadline),
            practicalClassSchedules: (values.practicalClassSchedules || []).map(s => ({ ...s, date: Timestamp.fromDate(s.date) })),
            balance: balance,
          }
        });
      });

      toast({ title: 'Trámite Registrado', description: 'El contrato de solo práctica se ha guardado correctamente.' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error saving contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al procesar el registro.' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = form.watch('courseValue') - form.watch('downPayment');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Ficha (Solo Práctica)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-8">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre</FormLabel><FormControl><Input placeholder="Nombre..." {...field} className="h-9 uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">ID</FormLabel><FormControl><Input placeholder="8-000-000" {...field} className="h-9 font-mono" /></FormControl></FormItem>
                )} />
              </div>
              <div className="col-span-12">
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</FormLabel><FormControl><Input placeholder="Ubicación..." {...field} className="h-9 uppercase" /></FormControl></FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Valores</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <FormField control={form.control} name="coursePlan" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Paquete</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent>{PRACTICE_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="courseValue" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold bg-muted/30" readOnly /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl></FormItem>
              )} />
            </div>
            <div className="h-10 flex items-center px-4 bg-red-50 rounded-md border border-red-100"><span className="text-lg font-black text-red-900">Saldo Pendiente: B/. {currentBalance.toFixed(2)}</span></div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={isSaving} className="min-w-[220px] bg-emerald-600 hover:bg-emerald-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Solo Práctica
          </Button>
        </div>
      </form>
    </Form>
  );
}
