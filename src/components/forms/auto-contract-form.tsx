'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE AUTO (ULTRA COMPACTO)
 * Freeway Escuela de Manejo, S.A.
 * 
 * - Ficha de estudiante técnica (12 columnas).
 * - Teoría dinámica (Semanal 4 / Sabatino 3).
 * - Práctica dinámica basada en el Plan/Paquete seleccionado.
 * - Sintaxis blindada para evitar errores de compilación.
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
  Timestamp 
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
  Car, 
  CreditCard, 
  BookOpen,
  Package,
  Clock,
  Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';

const AUTO_PLANS = [
  "Curso Auto Básico (8hrz)",
  "Curso Auto Plus (10hrz)",
  "Curso Auto Premium (12hrz)",
  "Reforzamiento 4hrs",
  "Reforzamiento Plus 2hrs",
  "Evaluación Estacionamiento (10 min)"
];

const PLAN_PRACTICAL_COUNTS: Record<string, number> = {
  "Curso Auto Básico (8hrz)": 4,
  "Curso Auto Plus (10hrz)": 5,
  "Curso Auto Premium (12hrz)": 6,
  "Reforzamiento 4hrs": 2,
  "Reforzamiento Plus 2hrs": 1,
  "Evaluación Estacionamiento (10 min)": 1
};

const TIME_OPTIONS = [
  "08:00am a 10:00am",
  "10:00am a 12:00pm",
  "01:00pm a 03:00pm",
  "03:00pm a 05:00pm"
];

const VEHICLES = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel'];
const INSTRUCTORS = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];

const autoContractSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
  licenseCategory: z.enum(['A, C', 'A, C, D']).default('A, C'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
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

type FormValues = z.infer<typeof autoContractSchema>;

export function AutoContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(autoContractSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      idType: 'C.I.P.',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      licenseCategory: 'A, C',
      vehicleTransmission: 'Automático',
      coursePlan: '',
      courseValue: 0,
      downPayment: 0,
      paymentType: 'cash',
      theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm',
      theoreticalClassDates: [],
      practicalClassSchedules: [],
    },
  });

  const { fields: theoryFields, replace: replaceTheory } = useFieldArray({
    control: form.control,
    name: "theoreticalClassDates" as any
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const watchSchedule = form.watch('theoreticalClassSchedule');
  const watchPlan = form.watch('coursePlan');

  // Lógica de Clases Teóricas
  useEffect(() => {
    const count = watchSchedule === 'Semanal 8:00 am a 10:00 am' ? 4 : 3;
    const current = form.getValues('theoreticalClassDates') || [];
    const newDates = Array.from({ length: count }, (_, i) => current[i] || new Date());
    form.setValue('theoreticalClassDates', newDates);
  }, [watchSchedule, form]);

  // Lógica de Clases Prácticas
  useEffect(() => {
    const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
    const current = form.getValues('practicalClassSchedules') || [];
    const newSchedules = Array.from({ length: count }, (_, i) => current[i] || { date: new Date(), time: '08:00am a 10:00am', vehicle: '', instructor: '' });
    replacePractical(newSchedules);
  }, [watchPlan, replacePractical, form]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);

    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contracts_folio');
        const counterDoc = await transaction.get(counterRef);
        let nextFolio = 1;
        if (counterDoc.exists()) {
          nextFolio = counterDoc.data().count + 1;
          transaction.update(counterRef, { count: nextFolio });
        } else {
          transaction.set(counterRef, { count: nextFolio });
        }

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
        
        const formattedTheoryDates = (values.theoreticalClassDates || []).map(d => Timestamp.fromDate(d));
        const formattedPracticalSchedules = (values.practicalClassSchedules || []).map(s => ({
          ...s,
          date: Timestamp.fromDate(s.date)
        }));

        transaction.set(contractRef, {
          title: `Curso de Auto - Folio ${nextFolio}`,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientId: clientRef.id,
          folioNumber: nextFolio,
          type: 'Curso Auto',
          status: balance <= 0 ? 'completed' : 'active',
          userId: user.uid,
          createdBy: role || 'Sistema',
          createdAt: serverTimestamp(),
          autoMotoDetails: {
            ...values,
            paymentDeadline: Timestamp.fromDate(values.paymentDeadline),
            theoreticalClassDates: formattedTheoryDates,
            practicalClassSchedules: formattedPracticalSchedules,
            balance: balance,
          }
        });
      });

      toast({ title: 'Contrato Creado', description: 'El registro de auto se ha guardado exitosamente.' });
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
        
        {/* SECCIÓN 1: FICHA TÉCNICA DEL ESTUDIANTE (ULTRA COMPACTA) */}
        <Card className="border-t-4 border-t-blue-600 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Ficha Técnica del Estudiante</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-8">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre Completo</FormLabel>
                    <FormControl><Input placeholder="Nombre del alumno..." {...field} className="h-9" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" placeholder="ejemplo@correo.com" {...field} className="h-9" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-4 md:col-span-2">
                <FormField control={form.control} name="idType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Tipo ID</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="C.I.P.">C.I.P.</SelectItem>
                        <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="col-span-8 md:col-span-4">
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Número de Identificación</FormLabel>
                    <FormControl><Input placeholder="Ej: 8-000-000" {...field} className="h-9 font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Teléfonos de Contacto</FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input placeholder="Principal" {...field} className="h-9" /></FormControl>
                      <Input placeholder="Secundario (Opcional)" onChange={(e) => form.setValue('studentPhone2', e.target.value)} className="h-9" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12">
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección Residencial Completa</FormLabel>
                    <FormControl><Input placeholder="Provincia, Distrito, Corregimiento, Calle y Casa..." {...field} className="h-9" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 2: CONFIGURACIÓN DEL CURSO Y PROGRAMACIÓN TEÓRICA */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Configuración del Curso y Teoría</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="A, C">Tipo A y C</SelectItem>
                      <SelectItem value="A, C, D">Tipo A, C y D</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Transmisión</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Automático">Automático</SelectItem>
                      <SelectItem value="Manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Horario de Teoría</FormLabel>
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

            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase text-slate-700">Programación de Clases Teóricas</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {(form.watch('theoreticalClassDates') || []).map((_, i) => (
                  <FormField
                    key={i}
                    control={form.control}
                    name={`theoreticalClassDates.${i}`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-[10px] font-bold uppercase text-blue-600">Sesión {i + 1}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full h-9 pl-3 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Fecha</span>}
                                <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: CLASES PRÁCTICAS (DINÁMICAS) */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Programación de Clases Prácticas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!watchPlan ? (
              <div className="p-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                Seleccione un Plan / Paquete para habilitar la programación práctica.
              </div>
            ) : (
              <div className="space-y-4">
                {practicalFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50/30 items-end">
                    <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-[10px] font-bold uppercase text-blue-600">Clase {index + 1} - Fecha</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full h-9 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "dd/MM/yy") : "Fecha"}
                                <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                        </Popover>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-blue-600">Turno / Horario</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`practicalClassSchedules.${index}.vehicle`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Vehículo (Opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Vehículo..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {VEHICLES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`practicalClassSchedules.${index}.instructor`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Instructor (Opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Instructor..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {INSTRUCTORS.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN 4: PLAN DE PAGOS */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Plan de Pagos y Saldo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="coursePlan" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> Plan / Paquete
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar paquete..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {AUTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="paymentType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago (Abono)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <FormField control={form.control} name="courseValue" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor del Curso (B/.)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono Inicial (B/.)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Pendiente</Label>
                <div className="flex items-center justify-between h-10 px-4 bg-blue-50 rounded-md border border-blue-100">
                  <span className="text-lg font-black text-blue-900">B/. {currentBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                <FormItem className="flex flex-col max-w-xs">
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Fecha Límite para Saldo</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={isSaving} className="min-w-[200px] bg-blue-600 hover:bg-blue-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Contrato de Auto
          </Button>
        </div>

      </form>
    </Form>
  );
}