'use client';

/**
 * FORMULARIO PÚBLICO DE AUTO-INSCRIPCIÓN
 * Esta página es accesible sin contraseña y permite a prospectos:
 * 1. Ingresar sus datos personales.
 * 2. Proponer sus horarios de clases prácticas.
 * 3. Crear un registro en estado "draft" (borrador) que no afecta agendas oficiales.
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
  query,
  where,
  getDocs
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
  GanttChart
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useFirebase } from '@/components/firebase-provider';
import Link from 'next/link';

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

const enrollmentSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
  practicalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
  })).min(1, 'Debe elegir su horario'),
});

type FormValues = z.infer<typeof enrollmentSchema>;

export default function PublicEnrollmentPage() {
  const db = useDb();
  const { auth } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      practicalClassSchedules: [],
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const watchPlan = form.watch('coursePlan');

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
            practicalClassSchedules: values.practicalClassSchedules.map(s => ({
              ...s,
              date: Timestamp.fromDate(s.date)
            })),
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
          <p className="text-slate-600 mb-8">Registramos tu pre-inscripción. Acércate a nuestra sucursal para realizar el pago inicial y activar tu curso.</p>
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
          <h1 className="text-3xl font-black text-slate-900 font-headline uppercase tracking-tight">Formulario de Inscripción Online</h1>
          <p className="text-slate-500 font-medium">Completa tus datos y propón tu horario para clases prácticas.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-primary text-white">
                <CardTitle className="text-lg font-bold uppercase">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Nombre Completo</FormLabel>
                    <FormControl><Input placeholder="Nombre y Apellidos" {...field} className="h-11 uppercase font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" placeholder="Para enviarte notificaciones" {...field} className="h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Cédula o Pasaporte</FormLabel>
                    <FormControl><Input placeholder="0-000-000" {...field} className="h-11 font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Celular / WhatsApp</FormLabel>
                    <FormControl><Input placeholder="6000-0000" {...field} className="h-11" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="md:col-span-2">
                  <FormField control={form.control} name="studentAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase">Dirección de Domicilio</FormLabel>
                      <FormControl><Input placeholder="Provincia, Distrito, Calle y Casa..." {...field} className="h-11" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-slate-900 text-white">
                <CardTitle className="text-lg font-bold uppercase">Elección de Curso y Horario</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="coursePlan" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase">Paquete de Manejo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un plan..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {AUTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase">Transmisión</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem></SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-sm font-bold uppercase flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Propuesta de Horario Práctico
                  </Label>
                  <p className="text-xs text-muted-foreground italic">Elige las fechas que mejor te convengan. Sujeto a confirmación.</p>
                  
                  {!watchPlan ? (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl bg-slate-50 text-slate-400 font-bold uppercase text-xs">Selecciona un paquete arriba para elegir horas</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {practicalFields.map((field, index) => (
                        <div key={field.id} className="p-4 border rounded-2xl space-y-3 bg-white border-slate-200">
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-[10px] font-black uppercase text-slate-500">Clase {index + 1}</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl><Button variant="outline" className="h-10 text-left font-normal text-xs">{f.value ? format(f.value, "PPP", { locale: es }) : "Elegir día"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus disabled={(date) => date < new Date() || date.getDay() === 0} /></PopoverContent>
                              </Popover>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button type="submit" disabled={isSaving || !watchPlan} className="w-full h-14 text-xl font-black shadow-xl uppercase tracking-widest bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Save className="mr-2 h-6 w-6" />}
              Enviar Solicitud
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
