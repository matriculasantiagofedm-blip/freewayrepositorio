'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE SOLO PRÁCTICA (CON CALCULADORA DE PRECIOS)
 * Freeway Escuela de Manejo, S.A.
 * 
 * - Ficha de estudiante técnica (12 columnas) ULTRA COMPACTA.
 * - Sincronización con Reporte de Agenda Práctica.
 * - Selección de Vehículo (Auto/Motocicleta) y Paquetes con precios automáticos.
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
  AlertTriangle,
  ShieldCheck,
  Package,
  Car
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';

const PRACTICE_PLANS = [
  "Basico 8 Hrs",
  "Plus 10 Hrs",
  "Premium 12 Hrs"
];

const PLAN_PRICES: Record<string, number> = {
  "Basico 8 Hrs": 123.00,
  "Plus 10 Hrs": 135.00,
  "Premium 12 Hrs": 160.00
};

const PLAN_PRACTICAL_COUNTS: Record<string, number> = {
  "Basico 8 Hrs": 4,
  "Plus 10 Hrs": 5,
  "Premium 12 Hrs": 6
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

const ALL_VEHICLES = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel', 'Moto Roja', 'Moto Negra'];
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

  const activeContractsQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db, user]);
  const manualEntriesQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'manual_schedules')) : null, [db, user]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(soloPracticaSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      idType: 'C.I.P.',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      vehicleType: 'Auto',
      vehicleTransmission: 'Automático',
      coursePlan: '',
      courseValue: 0,
      downPayment: 0,
      paymentType: 'cash',
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

  useEffect(() => {
    if (watchPlan) {
      // Asignar precio automático
      const price = PLAN_PRICES[watchPlan] || 0;
      form.setValue('courseValue', price);

      // Generar clases prácticas correspondientes
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
        const formattedPracticalSchedules = (values.practicalClassSchedules || []).map(s => ({
          ...s,
          date: Timestamp.fromDate(s.date)
        }));

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
            practicalClassSchedules: formattedPracticalSchedules,
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
        
        {/* SECCIÓN 1: DATOS DEL ESTUDIANTE (12 COLUMNAS) */}
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Ficha Estudiantil (Solo Práctica)</CardTitle>
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
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección Residencial</FormLabel>
                    <FormControl><Input placeholder="Ubicación completa..." {...field} className="h-9 uppercase" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 2: PLAN Y COBRO */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Plan de Pagos y Saldo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField control={form.control} name="vehicleType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Car className="h-3 w-3" /> Tipo de Vehículo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Auto">Automóvil</SelectItem>
                      <SelectItem value="Motocicleta">Motocicleta</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="coursePlan" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Paquete de Práctica</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar paquete..." /></SelectTrigger></FormControl>
                    <SelectContent>{PRACTICE_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
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
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor del Trámite (B/.)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-black text-emerald-900 bg-emerald-50/30" readOnly /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono Realizado (B/.)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Pendiente</Label>
                <div className="flex items-center h-10 px-4 bg-red-50 rounded-md border border-red-100">
                  <span className="text-lg font-black text-red-900">B/. {currentBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                <FormItem className="flex flex-col max-w-xs">
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Fecha Límite para el Saldo</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl><Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: AGENDA PRÁCTICA SINCRONIZADA */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Programación de Clases Prácticas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!watchPlan ? (
              <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground italic bg-slate-50/50">Seleccione un Paquete de Práctica para habilitar la agenda técnica.</div>
            ) : (
              <div className="space-y-4">
                {practicalFields.map((field, index) => {
                  const watchDate = form.watch(`practicalClassSchedules.${index}.date`);
                  const watchTime = form.watch(`practicalClassSchedules.${index}.time`);
                  const watchVehicle = form.watch(`practicalClassSchedules.${index}.vehicle`);
                  
                  const dObj = toDate(watchDate);
                  const isValidDate = !isNaN(dObj.getTime());
                  const holiday = isValidDate ? isPanamaHoliday(dObj) : null;
                  const isSunday = isValidDate && dObj.getDay() === 0;
                  
                  const slotId = TIME_STRING_TO_SLOT_MAP[watchTime] || watchTime;
                  const dateKey = isValidDate ? format(dObj, 'yyyy-MM-dd') : '';
                  const vKey = `${dateKey}|${slotId}|${watchVehicle}`;
                  
                  const occupants = availabilityData.vehicleOccupancy[vKey] || [];
                  const isOccupied = occupants.length > 0;
                  
                  const capacity = isValidDate ? getGlobalCapacity(dObj, slotId) : 3;
                  const currentGlobalCount = availabilityData.globalCounts[`${dateKey}|${slotId}`] || 0;
                  const isFull = currentGlobalCount >= capacity;

                  return (
                    <div key={field.id} className={cn(
                        "grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-xl items-end relative transition-all",
                        (isOccupied || isFull || holiday || isSunday) ? "border-amber-500 bg-amber-50/30" : "bg-slate-50/30"
                    )}>
                      <div className="absolute -top-2 right-4 flex gap-1 z-10">
                          {isSunday && <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-tighter">DOMINGO</div>}
                          {holiday && !isSunday && <div className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-tighter">FERIADO: {holiday.name}</div>}
                          {isOccupied && !holiday && !isSunday && (
                              <div className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1">
                                  <AlertTriangle className="h-2 w-2" /> OCUPADO POR: {occupants.join(', ')}
                              </div>
                          )}
                          {isFull && !isOccupied && !holiday && !isSunday && (
                              <div className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1">
                                  <ShieldCheck className="h-2 w-2" /> TURNO LLENO ({currentGlobalCount}/{capacity})
                              </div>
                          )}
                      </div>

                      <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-[10px] font-bold uppercase text-emerald-600">Sesión {index + 1} - Fecha</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl><Button variant="outline" className={cn("w-full h-9 text-left font-normal text-xs", !f.value && "text-muted-foreground")}>{f.value ? format(f.value, "dd/MM/yy") : "Fecha"}<CalendarIcon className="ml-auto h-3 w-3 opacity-50" /></Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus /></PopoverContent>
                          </Popover>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold uppercase text-emerald-600">Turno / Horario</FormLabel>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name={`practicalClassSchedules.${index}.vehicle`} render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Vehículo Asignado</FormLabel>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl>
                            <SelectContent>{ALL_VEHICLES.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name={`practicalClassSchedules.${index}.instructor`} render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Instructor Asignado</FormLabel>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl>
                            <SelectContent>{INSTRUCTORS.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                  );
                })}
              </div>
            )}
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
