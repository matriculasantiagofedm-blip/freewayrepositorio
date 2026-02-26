'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE SOLO PRÁCTICA
 * Soporta creación y edición.
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
  where,
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
  CreditCard, 
  Clock,
  RefreshCw
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';
import type { Contract } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const PRACTICE_PLANS = ["Basico 8 Hrs", "Plus 10 Hrs", "Premium 12 Hrs"];
const PLAN_PRICES: Record<string, number> = { "Basico 8 Hrs": 123.00, "Plus 10 Hrs": 135.00, "Premium 12 Hrs": 160.00 };
const PLAN_PRACTICAL_COUNTS: Record<string, number> = { "Basico 8 Hrs": 4, "Plus 10 Hrs": 5, "Premium 12 Hrs": 6 };

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

export function SoloPracticaContractForm({ contract }: { contract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!contract;

  const activeContractsQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null, [db, user]);
  const manualEntriesQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'manual_schedules')) : null, [db, user]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(soloPracticaSchema),
    defaultValues: isEdit ? {
      ...contract.autoMotoDetails,
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      paymentDeadline: toDate(contract.autoMotoDetails?.paymentDeadline),
      practicalClassSchedules: (contract.autoMotoDetails?.practicalClassSchedules || []).map(s => ({
        ...s,
        date: toDate(s.date)
      })),
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '',
      studentAddress: '', studentPhone1: '', vehicleType: 'Auto',
      vehicleTransmission: 'Automático', coursePlan: '', courseValue: 0,
      downPayment: 0, paymentType: 'cash', practicalClassSchedules: [],
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
        if (isEdit && contract && c.id === contract.id) return;
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
  }, [allContracts, allManualEntries, isEdit, contract?.id]);

  const watchPlan = form.watch('coursePlan');

  useEffect(() => {
    if (watchPlan && !isEdit) {
      form.setValue('courseValue', PLAN_PRICES[watchPlan] || 0);
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      replacePractical(Array.from({ length: count }, () => ({ date: new Date(), time: '08:00am a 10:00am', vehicle: '', instructor: '' })));
    }
  }, [watchPlan, replacePractical, form, isEdit]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);

    try {
      const balance = values.courseValue - values.downPayment;
      const { clientName, clientEmail, ...detailsOnly } = values;
      const formattedPracticalSchedules = (values.practicalClassSchedules || []).map(s => ({ ...s, date: Timestamp.fromDate(s.date) }));

      if (isEdit) {
        const contractRef = doc(db, 'contracts', contract.id);
        const updateData = {
          clientName: clientName,
          clientEmail: clientEmail,
          status: balance <= 0 ? 'completed' : contract.status,
          autoMotoDetails: {
            ...detailsOnly,
            paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
            practicalClassSchedules: formattedPracticalSchedules,
            balance: balance,
          },
          updatedAt: serverTimestamp(),
          updatedBy: role || 'Sistema',
        };

        updateDoc(contractRef, updateData)
          .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: contractRef.path,
              operation: 'update',
              requestResourceData: updateData
            }));
          });

        toast({ title: 'Práctica Actualizada' });
        router.push(`/contracts/${contract.id}`);
      } else {
        let createdId = '';
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, 'counters', 'contracts_folio');
          const counterDoc = await transaction.get(counterRef);
          let nextFolio = counterDoc.exists() ? Math.max(counterDoc.data().count + 1, 18) : 18;
          transaction.set(counterRef, { count: nextFolio }, { merge: true });

          const clientRef = doc(collection(db, 'clients'));
          transaction.set(clientRef, {
            name: clientName, email: clientEmail, idNumber: values.studentIdNumber,
            phone: values.studentPhone1, createdAt: serverTimestamp(), userId: user.uid,
          });

          const contractRef = doc(collection(db, 'contracts'));
          createdId = contractRef.id;
          transaction.set(contractRef, {
            title: `Solo Práctica - Folio ${nextFolio}`,
            clientName: clientName,
            clientEmail: clientEmail,
            clientId: clientRef.id,
            folioNumber: nextFolio,
            type: 'Curso Solo Practica',
            status: balance <= 0 ? 'completed' : 'active',
            userId: user.uid,
            createdBy: role || 'Sistema',
            createdAt: serverTimestamp(),
            autoMotoDetails: {
              ...detailsOnly,
              paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
              practicalClassSchedules: formattedPracticalSchedules,
              balance: balance,
            }
          });
        });
        toast({ title: 'Práctica Guardada' });
        if (createdId) router.push(`/contracts/${createdId}`);
      }
    } catch (error: any) {
      console.error("Error saving contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar.' });
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
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">ID</FormLabel><FormControl><Input placeholder="8-000-000" {...field} className="h-9 font-mono" readOnly={isEdit} /></FormControl></FormItem>
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
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold bg-muted/30" readOnly={!isEdit} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl></FormItem>
              )} />
            </div>
            <div className="h-10 flex items-center px-4 bg-red-50 rounded-md border border-red-100"><span className="text-lg font-black text-red-900">Saldo Pendiente: B/. {currentBalance.toFixed(2)}</span></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Límite para Saldo</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(toDate(field.value), "PPP", { locale: es }) : <span>Elegir fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={toDate(field.value)} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                )} />
                <FormField control={form.control} name="paymentType" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">Tarjeta Débito</SelectItem><SelectItem value="credit">Tarjeta Crédito</SelectItem><SelectItem value="bac">BAC</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="cheques">Cheque</SelectItem></SelectContent></Select></FormItem>
                )} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Programación de Horas Prácticas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {!watchPlan ? (
              <p className="text-center text-muted-foreground italic py-4">Seleccione un paquete para programar.</p>
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
                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {index + 1}</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl><Button variant="outline" className="h-9 w-full text-left font-normal text-xs">{f.value ? format(toDate(f.value), "dd/MM/yy") : "Fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
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
                              <SelectContent>{ALL_VEHICLES.map(v => <SelectItem key={v} value={v} className="text-[10px]">{v}</SelectItem>)}</SelectContent>
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
          <Button type="submit" size="lg" disabled={isSaving} className={cn("min-w-[220px]", isEdit ? "bg-green-600 hover:bg-green-700" : "bg-emerald-600 hover:bg-emerald-700")}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEdit ? <RefreshCw className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Actualizar Práctica' : 'Guardar Solo Práctica'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
