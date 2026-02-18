
'use client';

/**
 * FORMULARIO PÚBLICO DE AUTO-INSCRIPCIÓN CON DISPONIBILIDAD, TEORÍA Y PAGOS
 * Esta página permite a prospectos:
 * 1. Ingresar sus datos personales.
 * 2. Elegir su horario de capacitación TEÓRICA.
 * 3. Consultar disponibilidad de clases PRÁCTICAS en tiempo real.
 * 4. Seleccionar método de pago (Yappy, Tarjeta o Sucursal).
 * 5. Crear un registro en estado "draft" (borrador).
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
  Smartphone
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

  // Carga de datos para disponibilidad
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

    allManualEntries?.forEach(entry => {
        if (entry.classType === 'Teórica') return;
        processEntry(entry.date, entry.timeSlot);
    });

    allContracts?.forEach(c => {
        const details = c.autoMotoDetails || c.deluxeDetails;
        const processSlots = (slots: any[]) => {
            slots.forEach(s => {
                processEntry(s.date, s.time);
            });
        };
        if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
        if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
        if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
    });

    return { globalCounts };
  }, [allContracts, allManualEntries]);

  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(console.error);
    }
  }, [auth]);

  const form = useForm<FormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      idType: 'C.I.P.',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      vehicleTransmission: 'Automático',
      coursePlan: '',
      theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm',
      theoreticalClassDates: [],
      practicalClassSchedules: [],
      paymentMethod: 'in_office',
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const watchPlan = form.watch('coursePlan');
  const watchTheorySchedule = form.watch('theoreticalClassSchedule');
  const watchPaymentMethod = form.watch('paymentMethod');

  // Actualizar conteo de clases prácticas según el plan
  useEffect(() => {
    if (watchPlan) {
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      const current = form.getValues('practicalClassSchedules') || [];
      const newSchedules = Array.from({ length: count }, (_, i) => current[i] || { 
        date: new Date(), 
        time: '08:00am a 10:00am'
      });
      replacePractical(newSchedules);
    }
  }, [watchPlan, replacePractical, form]);

  // Actualizar número de fechas teóricas según horario elegido
  useEffect(() => {
    if (watchTheorySchedule) {
      const count = watchTheorySchedule === 'Semanal 8:00 am a 10:00 am' ? 4 : 3;
      const current = form.getValues('theoreticalClassDates') || [];
      const newDates = Array.from({ length: count }, (_, i) => current[i] || new Date());
      form.setValue('theoreticalClassDates', newDates);
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
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          type: 'Curso Auto',
          status: 'draft',
          userId: auth.currentUser?.uid,
          createdBy: 'Web Publica',
          createdAt: serverTimestamp(),
          autoMotoDetails: {
            ...values,
            licenseCategory: 'A, C',
            theoreticalClassDates: values.theoreticalClassDates.map(d => Timestamp.fromDate(d)),
            practicalClassSchedules: values.practicalClassSchedules.map(s => ({
              ...s,
              date: Timestamp.fromDate(s.date)
            })),
            paymentType: values.paymentMethod === 'credit_card' ? 'credit' : values.paymentMethod === 'yappy' ? 'cash' : 'cash',
            courseValue: 0,
            downPayment: 0,
            balance: 0,
          }
        });
      });

      setSubmitted(true);
      toast({ title: 'Solicitud Enviada', description: 'Tu pre-inscripción ha sido recibida correctamente.' });
    } catch (error: any) {
      console.error("Error saving enrollment:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la solicitud.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-green-100 flex flex-col items-center">
          <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">¡Solicitud Recibida!</h1>
          <p className="text-slate-600 mb-8">
            {watchPaymentMethod === 'in_office' 
              ? 'Registramos tu pre-inscripción. Acércate a nuestra sucursal para realizar el pago inicial y activar tu curso.' 
              : 'Registramos tu solicitud. Estaremos verificando tu pago para activar tu curso a la brevedad.'}
          </p>
          <Button asChild className="w-full h-12 text-lg font-bold">
            <Link href="/">Volver al Inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 bg-white border-b flex items-center px-6 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <GanttChart className="h-6 w-6 text-primary" />
          <span>Freeway Escuela de Manejo</span>
        </Link>
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900 font-headline uppercase tracking-tight text-center sm:text-left">Inscripción Online Freeway</h1>
          <p className="text-slate-500 font-medium text-center sm:text-left">Completa tus datos y propón tu horario. Verifica la disponibilidad en tiempo real.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
            {/* 1. INFORMACIÓN PERSONAL */}
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="text-lg font-bold uppercase">1. Información Personal</CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Nombre Completo</FormLabel>
                    <FormControl><Input placeholder="Como aparece en su cédula" {...field} className="h-11 uppercase font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" placeholder="Para recibir su contrato" {...field} className="h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Cédula o Pasaporte</FormLabel>
                    <FormControl><Input placeholder="0-000-000" {...field} className="h-11 font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Celular / WhatsApp</FormLabel>
                    <FormControl><Input placeholder="6000-0000" {...field} className="h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="md:col-span-2">
                  <FormField control={form.control} name="studentAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Dirección de Domicilio</FormLabel>
                      <FormControl><Input placeholder="Ubicación completa..." {...field} className="h-11" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* 2. CAPACITACIÓN TEÓRICA */}
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-slate-800 text-white">
                <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                    <BookOpen className="h-5 w-5" /> 2. Capacitación Teórica
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="coursePlan" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Paquete de Manejo Deseado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un plan..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {AUTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Horario de Teoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Sabados 3:00 pm a 5:00 pm">Sábados 3:00 pm a 5:00 pm</SelectItem>
                          <SelectItem value="Semanal 8:00 am a 10:00 am">Semanal 8:00 am a 10:00 am</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-sm font-bold uppercase text-slate-700">Seleccione las fechas de sus sesiones teóricas:</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {(form.watch('theoreticalClassDates') || []).map((_, i) => (
                      <FormField key={i} control={form.control} name={`theoreticalClassDates.${i}`} render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {i + 1}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl><Button variant="outline" className={cn("h-10 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Elegir</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                          </Popover>
                        </FormItem>
                      )} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. SECCIÓN DE HORARIOS PRÁCTICOS */}
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-blue-600 text-white">
                <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                    <Car className="h-5 w-5" /> 3. Propuesta de Agenda Práctica
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="flex flex-col gap-1">
                  <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Tipo de Auto</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Sincrónico (Manual)</SelectItem></SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold italic">Seleccione sus clases prácticas. El sistema le indicará si el turno está disponible.</p>
                  
                  {!watchPlan ? (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl bg-slate-50 text-slate-400 font-bold uppercase text-xs">Debe elegir un paquete de manejo arriba para programar sus horas</div>
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
                        const occupancy = availabilityData.globalCounts[`${dateKey}|${slotId}`] || 0;
                        const capacity = isValidDate ? getGlobalCapacity(dObj, slotId) : 3;
                        const isFull = occupancy >= capacity;

                        return (
                          <div key={field.id} className={cn(
                            "p-4 border rounded-2xl space-y-3 bg-white transition-colors relative",
                            (isFull || holiday || isSunday) ? "border-amber-500 bg-amber-50/10" : "border-slate-200"
                          )}>
                            <div className="absolute -top-2 right-3 flex gap-1 z-10">
                                {isSunday && <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Cerrado Domingos</div>}
                                {holiday && !isSunday && <div className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Feriado</div>}
                                {isFull && !holiday && !isSunday && (
                                    <div className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1">
                                        <Ban className="h-2 w-2" /> Turno Lleno
                                    </div>
                                )}
                                {!isFull && !holiday && !isSunday && isValidDate && watchTime && (
                                    <div className="bg-green-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1">
                                        <CheckCircle2 className="h-2 w-2" /> Disponible
                                    </div>
                                )}
                            </div>

                            <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-[10px] font-black uppercase text-slate-500">Clase Práctica {index + 1}</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className={cn("h-10 text-left font-normal text-xs", !f.value && "text-muted-foreground")}>{f.value ? format(f.value, "PPP", { locale: es }) : "Elegir día"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus disabled={(date) => date < new Date() || date.getDay() === 0} /></PopoverContent>
                                </Popover>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                              <FormItem>
                                <Select onValueChange={f.onChange} value={f.value}>
                                  <FormControl><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 4. MÉTODO DE PAGO */}
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-emerald-600 text-white">
                <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                    <CreditCard className="h-5 w-5" /> 4. Método de Pago de Reserva
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-bold uppercase text-slate-700">Seleccione cómo desea realizar su pago inicial:</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="yappy" className="sr-only" />
                            </FormControl>
                            <FormLabel className={cn(
                              "flex flex-col items-center justify-between rounded-xl border-2 border-slate-100 bg-white p-4 hover:bg-slate-50 hover:border-emerald-200 cursor-pointer transition-all",
                              field.value === 'yappy' && "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500"
                            )}>
                              <Smartphone className={cn("h-8 w-8 mb-2", field.value === 'yappy' ? "text-emerald-600" : "text-slate-400")} />
                              <span className="font-bold text-sm uppercase">Yappy</span>
                              <span className="text-[10px] text-muted-foreground text-center mt-1">Pago móvil inmediato</span>
                            </FormLabel>
                          </FormItem>

                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="credit_card" className="sr-only" />
                            </FormControl>
                            <FormLabel className={cn(
                              "flex flex-col items-center justify-between rounded-xl border-2 border-slate-100 bg-white p-4 hover:bg-slate-50 hover:border-blue-200 cursor-pointer transition-all",
                              field.value === 'credit_card' && "border-blue-500 bg-blue-50/30 ring-1 ring-blue-500"
                            )}>
                              <CreditCard className={cn("h-8 w-8 mb-2", field.value === 'credit_card' ? "text-blue-600" : "text-slate-400")} />
                              <span className="font-bold text-sm uppercase">Tarjeta Online</span>
                              <span className="text-[10px] text-muted-foreground text-center mt-1">Visa o Mastercard</span>
                            </FormLabel>
                          </FormItem>

                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="in_office" className="sr-only" />
                            </FormControl>
                            <FormLabel className={cn(
                              "flex flex-col items-center justify-between rounded-xl border-2 border-slate-100 bg-white p-4 hover:bg-slate-50 hover:border-amber-200 cursor-pointer transition-all",
                              field.value === 'in_office' && "border-amber-500 bg-amber-50/30 ring-1 ring-amber-500"
                            )}>
                              <Building2 className={cn("h-8 w-8 mb-2", field.value === 'in_office' ? "text-amber-600" : "text-slate-400")} />
                              <span className="font-bold text-sm uppercase">En Sucursal</span>
                              <span className="text-[10px] text-muted-foreground text-center mt-1">Efectivo o punto físico</span>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="mt-6">
                  {watchPaymentMethod === 'yappy' && (
                    <div className="p-6 bg-slate-50 border rounded-2xl animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-col sm:flex-row gap-6 items-center">
                        <div className="bg-white p-4 rounded-xl border-2 border-emerald-100 shadow-sm">
                          <QrCode className="h-32 w-32 text-slate-900" />
                        </div>
                        <div className="space-y-3 flex-1">
                          <h4 className="font-black text-emerald-700 uppercase tracking-tight">Instrucciones de Yappy:</h4>
                          <ul className="text-sm space-y-2 text-slate-600">
                            <li className="flex items-center gap-2"><span className="h-5 w-5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-bold">1</span> Buscar en el directorio: <strong>@freeway_escuela</strong></li>
                            <li className="flex items-center gap-2"><span className="h-5 w-5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-bold">2</span> <strong>IMPORTANTE:</strong> Incluir su nombre completo en el comentario.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {watchPaymentMethod === 'credit_card' && (
                    <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl animate-in fade-in slide-in-from-top-2 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full"><ShieldCheck className="h-5 w-5 text-blue-600" /></div>
                        <h4 className="font-black text-blue-800 uppercase tracking-tight">Pago Seguro con Tarjeta:</h4>
                      </div>
                      <p className="text-sm text-blue-700 font-medium">Al finalizar la inscripción, serás redirigido a nuestra pasarela de pagos segura para completar la reserva de B/. 50.00.</p>
                      <div className="flex gap-2 opacity-50 grayscale">
                        <div className="h-8 w-12 bg-white border rounded"></div>
                        <div className="h-8 w-12 bg-white border rounded"></div>
                      </div>
                    </div>
                  )}

                  {watchPaymentMethod === 'in_office' && (
                    <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-2xl animate-in fade-in slide-in-from-top-2 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-full"><Building2 className="h-5 w-5 text-amber-600" /></div>
                        <h4 className="font-black text-amber-800 uppercase tracking-tight">Pago en Oficina:</h4>
                      </div>
                      <p className="text-sm text-amber-700 font-medium">Puedes completar tu inscripción en nuestra sucursal de Costa Verde. Ten en cuenta que los horarios propuestos solo se confirmarán una vez realizado el pago.</p>
                      <p className="text-[10px] text-amber-600 uppercase font-black">Horario: Lunes a Sábados 8:00 AM - 5:00 PM</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                <div className="flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="text-xs text-blue-800 space-y-1">
                        <p className="font-bold uppercase">Nota de Compromiso:</p>
                        <p>Al enviar este formulario, usted declara que los datos suministrados son verídicos. La reserva de horarios está sujeta a la validación del pago inicial.</p>
                    </div>
                </div>
            </div>

            <Button type="submit" disabled={isSaving || !watchPlan} className="w-full h-16 text-xl font-black shadow-xl uppercase tracking-widest bg-blue-600 hover:bg-blue-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Procesando solicitud...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-6 w-6" />
                  Finalizar Pre-Inscripción
                </>
              )}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
