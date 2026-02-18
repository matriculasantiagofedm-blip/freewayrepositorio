
'use client';

/**
 * FORMULARIO PÚBLICO DE AUTO-INSCRIPCIÓN CON DISPONIBILIDAD, TEORÍA Y PAGOS
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
import { signInAnonymously } from 'firebase/auth';

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
  FormDescription,
} from '@/components/ui/form';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  CalendarIcon, 
  Save, 
  UserCircle, 
  Car, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  GanttChart,
  ShieldCheck,
  Ban,
  BookOpen,
  CreditCard,
  Building2,
  QrCode,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useFirebase } from '@/components/firebase-provider';
import Link from 'next/link';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';

const AUTO_PLANS = [
  "Curso Auto Básico (8 Hrs)",
  "Curso Auto Plus (10 Hrs)",
  "Curso Auto Premium (12 Hrs)"
];

const PLAN_PRACTICAL_COUNTS: Record<string, number> = {
  "Curso Auto Básico (8 Hrs)": 4,
  "Curso Auto Plus (10 Hrs)": 5,
  "Curso Auto Premium (12 Hrs)": 6
};

const TIME_OPTIONS = [
  "08:00am a 10:00am",
  "10:00am a 12:00pm",
  "01:00pm a 03:00pm",
  "03:00pm a 05:00pm"
];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
    '08:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '01:00pm a 03:00pm': '1pm-3pm',
    '03:00pm a 05:00pm': '3pm-5pm',
};

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); 
    if (day === 0) return 0; 
    if (slotId === '8am-10am') {
        if (day === 1) return 3;
        if (day >= 2 && day <= 5) return 2;
    }
    if (day === 6 && slotId === '3pm-5pm') return 2;
    return 3;
};

const enrollmentSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
  theoreticalClassSchedule: z.enum(['Sabados 3:00 pm a 5:00 pm', 'Semanal 8:00 am a 10:00 am'], { required_error: "Seleccione un horario teórico" }),
  theoreticalClassDates: z.array(z.date()).min(3, 'Seleccione las fechas de sus sesiones teóricas'),
  practicalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
  })).min(1, 'Debe elegir su horario'),
  paymentMethod: z.enum(['yappy', 'credit_card', 'in_office'], { required_error: "Seleccione un método de pago" }),
});

type FormValues = z.infer<typeof enrollmentSchema>;

export default function PublicEnrollmentPage() {
  const db = useDb();
  const { auth } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeContractsQuery = useMemoQuery(() => (db && auth.currentUser) ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null, [db, auth.currentUser]);
  const manualEntriesQuery = useMemoQuery(() => (db && auth.currentUser) ? query(collection(db, 'manual_schedules')) : null, [db, auth.currentUser]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

  const availabilityData = useMemo(() => {
    const globalCounts: Record<string, number> = {};
    const processEntry = (date: any, slotString: string) => {
        if (!date || !slotString) return;
        const dObj = toDate(date);
        if (isNaN(dObj.getTime())) return;
        const dateKey = format(dObj, 'yyyy-MM-dd');
        const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString;
        const sKey = `${dateKey}|${slotId}`;
        globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    };
    allManualEntries?.forEach(entry => { if (entry.classType !== 'Teórica') processEntry(entry.date, entry.timeSlot); });
    allContracts?.forEach(c => {
        const proc = (arr: any[]) => arr.forEach(s => processEntry(s.date, s.time));
        if (c.autoMotoDetails?.practicalClassSchedules) proc(c.autoMotoDetails.practicalClassSchedules);
        if (c.autoMotoDetails?.motoPracticalClassSchedules) proc(c.autoMotoDetails.motoPracticalClassSchedules);
        if (c.deluxeDetails?.classSchedules) proc(c.deluxeDetails.classSchedules);
    });
    return { globalCounts };
  }, [allContracts, allManualEntries]);

  useEffect(() => {
    if (auth && !auth.currentUser) signInAnonymously(auth).catch(console.error);
  }, [auth]);

  const form = useForm<FormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '', studentAddress: '', studentPhone1: '',
      vehicleTransmission: 'Automático', coursePlan: '', theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm',
      theoreticalClassDates: [], practicalClassSchedules: [], paymentMethod: 'in_office',
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const watchPlan = form.watch('coursePlan');
  const watchTheorySchedule = form.watch('theoreticalClassSchedule');
  const watchPaymentMethod = form.watch('paymentMethod');

  useEffect(() => {
    if (watchPlan) {
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      const current = form.getValues('practicalClassSchedules') || [];
      replacePractical(Array.from({ length: count }, (_, i) => current[i] || { date: new Date(), time: '08:00am a 10:00am' }));
    }
  }, [watchPlan, replacePractical, form]);

  useEffect(() => {
    if (watchTheorySchedule) {
      const count = watchTheorySchedule === 'Semanal 8:00 am a 10:00 am' ? 4 : 3;
      const current = form.getValues('theoreticalClassDates') || [];
      form.setValue('theoreticalClassDates', Array.from({ length: count }, (_, i) => current[i] || new Date()));
    }
  }, [watchTheorySchedule, form]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !auth.currentUser) return;
    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const contractRef = doc(collection(db, 'contracts'));
        transaction.set(contractRef, {
          title: `Pre-inscripción Web: ${values.clientName}`,
          clientName: values.clientName, clientEmail: values.clientEmail, type: 'Curso Auto', status: 'draft',
          userId: auth.currentUser?.uid, createdBy: 'Web Publica', createdAt: serverTimestamp(),
          autoMotoDetails: {
            ...values, licenseCategory: 'A, C',
            theoreticalClassDates: values.theoreticalClassDates.map(d => Timestamp.fromDate(d)),
            practicalClassSchedules: values.practicalClassSchedules.map(s => ({ ...s, date: Timestamp.fromDate(s.date) })),
            paymentType: 'cash', courseValue: 0, downPayment: 0, balance: 0,
          }
        });
      });
      setSubmitted(true);
      toast({ title: 'Solicitud Enviada' });
    } catch (error) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsSaving(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-green-100 flex flex-col items-center">
          <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">¡Solicitud Recibida!</h1>
          <p className="text-slate-600 mb-8">{watchPaymentMethod === 'in_office' ? 'Registramos tu pre-inscripción. Acércate a nuestra sucursal para realizar el pago inicial y activar tu curso.' : 'Registramos tu solicitud. Estaremos verificando tu pago para activar tu curso a la brevedad.'}</p>
          <Button asChild className="w-full h-12 text-lg font-bold"><Link href="/">Volver al Inicio</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 bg-white border-b flex items-center px-6 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900"><GanttChart className="h-6 w-6 text-primary" /><span>Freeway Escuela de Manejo</span></Link>
      </header>
      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900 font-headline uppercase tracking-tight">Inscripción Online Freeway</h1>
          <p className="text-slate-500 font-medium">Completa tus datos y propón tu horario. Verifica la disponibilidad en tiempo real.</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-primary text-white"><CardTitle className="text-lg font-bold uppercase">1. Información Personal</CardTitle></CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase">Nombre Completo</FormLabel><FormControl><Input placeholder="Como aparece en su cédula" {...field} className="h-11 uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase">Email</FormLabel><FormControl><Input type="email" placeholder="Para recibir su contrato" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase">Cédula / ID</FormLabel><FormControl><Input placeholder="0-000-000" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase">Celular</FormLabel><FormControl><Input placeholder="6000-0000" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="md:col-span-2"><FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase">Dirección</FormLabel><FormControl><Input placeholder="Ubicación..." {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} /></div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-slate-800 text-white"><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><BookOpen className="h-5 w-5" /> 2. Capacitación Teórica</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="coursePlan" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase">Plan Deseado</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent>{AUTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>
                  )} />
                  <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase">Horario Teórico</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sabados 3:00 pm a 5:00 pm">Sábados 3:00 pm a 5:00 pm</SelectItem><SelectItem value="Semanal 8:00 am a 10:00 am">Semanal 8:00 am a 10:00 am</SelectItem></SelectContent></Select></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  {(form.watch('theoreticalClassDates') || []).map((_, i) => (
                    <FormField key={i} control={form.control} name={`theoreticalClassDates.${i}`} render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {i + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-10 text-xs text-left">{field.value ? format(field.value, "dd/MM/yy") : 'Elegir'}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                    )} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-blue-600 text-white"><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><Car className="h-5 w-5" /> 3. Propuesta Práctica</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                {!watchPlan ? (
                  <div className="p-12 text-center border-2 border-dashed rounded-xl text-slate-400 font-bold uppercase text-xs">Elige un plan arriba para programar horas</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {practicalFields.map((field, index) => {
                      const watchDate = form.watch(`practicalClassSchedules.${index}.date`);
                      const watchTime = form.watch(`practicalClassSchedules.${index}.time`);
                      const dObj = toDate(watchDate);
                      const isValidDate = !isNaN(dObj.getTime());
                      const holiday = isValidDate ? isPanamaHoliday(dObj) : null;
                      const isSunday = isValidDate && dObj.getDay() === 0;
                      const slotId = TIME_STRING_TO_SLOT_MAP[watchTime] || watchTime;
                      const dateKey = isValidDate ? format(dObj, 'yyyy-MM-dd') : '';
                      const isFull = (availabilityData.globalCounts[`${dateKey}|${slotId}`] || 0) >= (isValidDate ? getGlobalCapacity(dObj, slotId) : 3);

                      return (
                        <div key={field.id} className={cn("p-4 border rounded-2xl bg-white relative", (isFull || holiday || isSunday) ? "border-amber-500 bg-amber-50/10" : "border-slate-200")}>
                          <div className="absolute -top-2 right-3 flex gap-1 z-10">
                            {isSunday && <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Domingo</div>}
                            {holiday && !isSunday && <div className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Feriado</div>}
                            {isFull && !holiday && !isSunday && <div className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Lleno</div>}
                          </div>
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-500">Clase {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-10 w-full text-xs text-left">{f.value ? format(f.value, "PPP", { locale: es }) : "Elegir día"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus disabled={(d) => d < new Date() || d.getDay() === 0} /></PopoverContent></Popover></FormItem>
                          )} />
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                            <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-10 text-xs mt-2"><SelectValue /></SelectTrigger></FormControl><SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent></Select></FormItem>
                          )} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-emerald-600 text-white"><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><CreditCard className="h-5 w-5" /> 4. Método de Pago de Reserva</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-sm font-bold uppercase text-slate-700">Seleccione su forma de pago inicial:</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormItem><FormControl><RadioGroupItem value="yappy" className="sr-only" /></FormControl><FormLabel className={cn("flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all", field.value === 'yappy' ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500" : "border-slate-100")}><Smartphone className={cn("h-8 w-8 mb-2", field.value === 'yappy' ? "text-emerald-600" : "text-slate-400")} /><span className="font-bold text-sm uppercase">Yappy</span></FormLabel></FormItem>
                        <FormItem><FormControl><RadioGroupItem value="credit_card" className="sr-only" /></FormControl><FormLabel className={cn("flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all", field.value === 'credit_card' ? "border-blue-500 bg-blue-50/30 ring-1 ring-blue-500" : "border-slate-100")}><CreditCard className={cn("h-8 w-8 mb-2", field.value === 'credit_card' ? "text-blue-600" : "text-slate-400")} /><span className="font-bold text-sm uppercase">Tarjeta</span></FormLabel></FormItem>
                        <FormItem><FormControl><RadioGroupItem value="in_office" className="sr-only" /></FormControl><FormLabel className={cn("flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-all", field.value === 'in_office' ? "border-amber-500 bg-amber-50/30 ring-1 ring-amber-500" : "border-slate-100")}><Building2 className={cn("h-8 w-8 mb-2", field.value === 'in_office' ? "text-amber-600" : "text-slate-400")} /><span className="font-bold text-sm uppercase">Sucursal</span></FormLabel></FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )} />

                <div className="mt-6">
                  {watchPaymentMethod === 'yappy' && (
                    <div className="p-6 bg-slate-50 border rounded-2xl space-y-6">
                      <div className="flex flex-col sm:flex-row gap-6 items-center">
                        <div className="bg-white p-4 rounded-xl border-2 border-emerald-100 shadow-sm"><QrCode className="h-32 w-32 text-slate-900" /></div>
                        <div className="space-y-4 flex-1">
                          <h4 className="font-black text-emerald-700 uppercase tracking-tight">Instrucciones de Yappy:</h4>
                          <p className="text-sm text-slate-600">Haz clic en el botón inferior para realizar tu abono de reserva de forma inmediata y segura.</p>
                          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold h-12 shadow-md">
                            <a href="https://link.yappy.com.pa/stc/dgXr5v%2BGA2xDgGKBkz%2BnBhSk16Vdr9BZvaim7nGhYrA%3D" target="_blank" rel="noopener noreferrer">
                              <Smartphone className="mr-2 h-5 w-5" /> Abrir Yappy para Pagar
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {watchPaymentMethod === 'credit_card' && <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl space-y-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-600" /><h4 className="font-black text-blue-800 uppercase tracking-tight">Pago Seguro:</h4></div><p className="text-sm text-blue-700">Serás contactado para completar el cobro de B/. 50.00 por tarjeta.</p></div>}
                  {watchPaymentMethod === 'in_office' && <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-2xl space-y-4"><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-amber-600" /><h4 className="font-black text-amber-800 uppercase tracking-tight">Pago en Sucursal:</h4></div><p className="text-sm text-amber-700">Acércate a Costa Verde para validar tu cupo. Horario: Lunes a Sábados 8AM - 5PM.</p></div>}
                </div>
              </CardContent>
            </Card>

            <Button type="submit" disabled={isSaving || !watchPlan} className="w-full h-16 text-xl font-black shadow-xl uppercase tracking-widest bg-blue-600 hover:bg-blue-700">
              {isSaving ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Procesando...</> : <><Save className="mr-2 h-6 w-6" /> Finalizar Inscripción</>}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
