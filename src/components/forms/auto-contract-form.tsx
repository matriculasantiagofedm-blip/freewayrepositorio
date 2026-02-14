'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE AUTO (SINCRONIZADO CON AGENDA)
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
  Car, 
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

const AUTO_PLANS = [
  "Curso Auto Básico (8 Hrs)",
  "Curso Auto Plus (10 Hrs)",
  "Curso Auto Premium (12 Hrs)",
  "Reforzamiento 4 Hrs",
  "Reforzamiento 2 Hrs",
  "Ya se manejar"
];

const PLAN_PRICES: Record<string, number> = {
  "Curso Auto Básico (8 Hrs)": 133.00,
  "Curso Auto Plus (10 Hrs)": 155.00,
  "Curso Auto Premium (12 Hrs)": 180.00,
  "Reforzamiento 4 Hrs": 95.00,
  "Reforzamiento 2 Hrs": 75.00,
  "Ya se manejar": 57.00
};

const PLAN_PRACTICAL_COUNTS: Record<string, number> = {
  "Curso Auto Básico (8 Hrs)": 4,
  "Curso Auto Plus (10 Hrs)": 5,
  "Curso Auto Premium (12 Hrs)": 6,
  "Reforzamiento 4 Hrs": 2,
  "Reforzamiento 2 Hrs": 1,
  "Ya se manejar": 1
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

const VEHICLES = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel'];
const INSTRUCTORS = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];

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

const autoContractSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
  licenseCategory: z.string().min(1, 'Categoría requerida'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
  additionalService: z.enum(['Ninguno', 'Ya se manejar Moto', 'Basico Moto 10Hrs']).default('Ninguno'),
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

  const activeContractsQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null, [db, user]);
  const manualEntriesQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'manual_schedules')) : null, [db, user]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

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
      additionalService: 'Ninguno',
      courseValue: 0,
      downPayment: 0,
      paymentType: 'cash',
      theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm',
      theoreticalClassDates: [],
      practicalClassSchedules: [],
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const availabilityData = useMemo(() => {
    const vehicleOccupancy: Record<string, string[]> = {};
    const globalCounts: Record<string, number> = {};
    
    const processEntry = (date: any, slotString: string, vehicle: string, name: string) => {
        if (!date || !slotString || !vehicle) return;
        const dObj = toDate(date);
        if (isNaN(dObj.getTime())) return;

        const dateKey = format(dObj, 'yyyy-MM-dd');
        const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString;
        const vKey = `${dateKey}|${slotId}|${vehicle}`;
        if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
        if (!vehicleOccupancy[vKey].includes(name)) vehicleOccupancy[vKey].push(name);
    };

    allManualEntries?.forEach(entry => {
        if (entry.classType === 'Teórica') return;
        processEntry(entry.date, entry.timeSlot, entry.vehicle, entry.studentName);
    });

    allContracts?.forEach(c => {
        const details = c.autoMotoDetails || c.deluxeDetails;
        const processSlots = (slots: any[]) => {
            slots.forEach(s => {
                processEntry(s.date, s.time, s.vehicle, c.clientName);
            });
        };
        if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
        if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
        if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
    });

    Object.keys(vehicleOccupancy).forEach(vKey => {
        const [dateKey, slotId] = vKey.split('|');
        const sKey = `${dateKey}|${slotId}`;
        globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    });

    return { vehicleOccupancy, globalCounts };
  }, [allContracts, allManualEntries]);

  const watchPlan = form.watch('coursePlan');
  const watchAdditional = form.watch('additionalService');

  useEffect(() => {
    if (watchPlan) {
      let price = PLAN_PRICES[watchPlan] || 0;
      
      if (watchAdditional === 'Basico Moto 10Hrs' && watchPlan === 'Curso Auto Básico (8 Hrs)') {
        price = 290.00;
      } else if (watchAdditional === 'Ya se manejar Moto') {
        price += 20.00;
      }

      form.setValue('courseValue', price);
      
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      const current = form.getValues('practicalClassSchedules') || [];
      const newSchedules = Array.from({ length: count }, (_, i) => current[i] || { 
        date: new Date(), 
        time: '08:00am a 10:00am', 
        vehicle: '', 
        instructor: '' 
      });
      replacePractical(newSchedules);
    }
  }, [watchPlan, watchAdditional, replacePractical, form]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);

    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contracts_folio');
        const counterDoc = await transaction.get(counterRef);
        
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
                    <FormControl><Input placeholder="Nombre del alumno..." {...field} className="h-9 uppercase font-bold" /></FormControl>
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
                      <SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="Pasaporte">Pasaporte</SelectItem></SelectContent>
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
                      <Input placeholder="Secundario" onChange={(e) => form.setValue('studentPhone2', e.target.value)} className="h-9" />
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-12">
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección Residencial Completa</FormLabel>
                    <FormControl><Input placeholder="Ubicación..." {...field} className="h-9 uppercase" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="A, C">Tipo A y C</SelectItem>
                        <SelectItem value="A, C, D">Tipo A, C y D</SelectItem>
                        <SelectItem value="A, C, B">Tipo A, C y B (con Moto)</SelectItem>
                        <SelectItem value="A, C, B, D">Tipo A, C, B y D (con Moto)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
              )} />
              <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Transmisión</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem></SelectContent>
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
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Plan de Pagos y Saldo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="coursePlan" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Plan Principal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Elegir plan..." /></SelectTrigger></FormControl>
                    <SelectContent>{AUTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="additionalService" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Plus className="h-3 w-3" /> Añadir (Moto)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Ninguno">Ninguno</SelectItem>
                      <SelectItem value="Ya se manejar Moto">Ya se manejar Moto (+B/.20)</SelectItem>
                      <SelectItem value="Basico Moto 10Hrs">Basico Moto 10Hrs (Combo B/.290)</SelectItem>
                    </SelectContent>
                  </Select>
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
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor del Contrato (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold bg-muted/30" readOnly /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono Inicial (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl></FormItem>
              )} />
              <div className="flex flex-col gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Pendiente</Label><div className="flex items-center justify-between h-10 px-4 bg-blue-50 rounded-md border border-blue-100"><span className="text-lg font-black text-blue-900">B/. {currentBalance.toFixed(2)}</span></div></div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                <FormItem className="flex flex-col max-w-xs">
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Fecha Límite para Saldo</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl><Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Elegir fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* AGENDA DE CLASES PRÁCTICAS ABAJO DE PLAN Y COBRO */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Agenda de Clases Prácticas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!watchPlan ? (
              <p className="text-center text-muted-foreground italic py-4">Seleccione un plan de curso para programar las clases.</p>
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
                      "p-4 border rounded-xl space-y-3 bg-white relative",
                      (isFull || holiday || isSunday) ? "border-amber-500 bg-amber-50/10" : "border-slate-200"
                    )}>
                      <div className="absolute -top-2 right-3 flex gap-1 z-10">
                          {isSunday && <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Domingo</div>}
                          {holiday && !isSunday && <div className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Feriado</div>}
                          {isFull && !holiday && !isSunday && <div className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Lleno</div>}
                      </div>

                      <div className="flex gap-4">
                        <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Clase {index + 1}</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl><Button variant="outline" className="h-9 w-full text-left font-normal text-xs">{f.value ? format(f.value, "dd/MM/yy") : "Fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus /></PopoverContent>
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
                              <SelectContent>{VEHICLES.map(v => <SelectItem key={v} value={v} className="text-[10px]">{v}</SelectItem>)}</SelectContent>
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
                  );
                })}
              </div>
            )}
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
