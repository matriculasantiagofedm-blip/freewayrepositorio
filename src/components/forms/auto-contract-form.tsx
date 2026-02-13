'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { UserCircle, Settings2, Save, DollarSign, Clock, Loader2, CalendarIcon } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, doc, serverTimestamp, runTransaction, query, where } from 'firebase/firestore';
import { useDb, useUser } from '../firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';
import type { Contract, VehicleName, ManualSchedule } from '@/lib/types';

const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Auto Diesel'];
const instructors = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];
const practicalTimeSlots = ['8:00am a 10:00am', '10:00am a 12:00pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico (8hrz)', price: 133.00, hours: 8 },
    { id: 'plus', label: 'Curso Auto Plus (10hrz)', price: 155.00, hours: 10 },
    { id: 'premium', label: 'Curso Auto Premium (12hrz)', price: 180.00, hours: 12 },
];

const TIME_MAP: Record<string, string> = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
};

const schema = z.object({
  clientName: z.string().min(1, 'Requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(1, 'Requerido'),
  studentAddress: z.string().min(1, 'Requerido'),
  studentPhone1: z.string().min(1, 'Requerido'),
  coursePlan: z.string().min(1, 'Seleccione plan'),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional().nullable(),
  paymentType: z.string().default('cash'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  licenseCategory: z.string().default('A, C'),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().nullable()).optional(),
  practicalClassSchedules: z.array(z.object({ 
    date: z.date().nullable().optional(), 
    time: z.string().optional(), 
    vehicle: z.string().optional(), 
    instructor: z.string().optional() 
  })),
});

export function AutoContractForm({ initialContract }: { initialContract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const activeQuery = useMemoQuery(() => db ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db]);
  const manualQuery = useMemoQuery(() => db ? collection(db, 'manual_schedules') : null, [db]);
  const { data: allContracts } = useCollection<Contract>(activeQuery);
  const { data: allManual } = useCollection<ManualSchedule>(manualQuery);

  const availability = useMemo(() => {
    const occ: Record<string, boolean> = {};
    const glob: Record<string, number> = {};
    const proc = (d: any, t: string, v: string, cid?: string) => {
        if (!d || !t || !v || (initialContract && cid === initialContract.id)) return;
        const keyD = format(toDate(d), 'yyyy-MM-dd');
        const slot = TIME_MAP[t] || t;
        occ[`${keyD}|${slot}|${v}`] = true;
        glob[`${keyD}|${slot}`] = (glob[`${keyD}|${slot}`] || 0) + 1;
    };
    allContracts?.forEach(c => {
        const d = c.autoMotoDetails;
        if (d?.practicalClassSchedules) d.practicalClassSchedules.forEach(s => proc(s.date, s.time || '', s.vehicle || '', c.id));
    });
    allManual?.forEach(m => { if (m.classType === 'Práctica') proc(m.date, m.timeSlot, m.vehicle); });
    return { occ, glob };
  }, [allContracts, allManual, initialContract]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: initialContract ? {
      clientName: initialContract.clientName,
      clientEmail: initialContract.clientEmail,
      idType: initialContract.autoMotoDetails?.idType || 'C.I.P.',
      studentIdNumber: initialContract.autoMotoDetails?.studentIdNumber || '',
      studentAddress: initialContract.autoMotoDetails?.studentAddress || '',
      studentPhone1: initialContract.autoMotoDetails?.studentPhone1 || '',
      coursePlan: initialContract.autoMotoDetails?.coursePlan || '',
      courseValue: initialContract.autoMotoDetails?.courseValue || 0,
      downPayment: initialContract.autoMotoDetails?.downPayment || 0,
      balance: initialContract.autoMotoDetails?.balance || 0,
      paymentDeadline: initialContract.autoMotoDetails?.paymentDeadline ? toDate(initialContract.autoMotoDetails.paymentDeadline) : null,
      paymentType: initialContract.autoMotoDetails?.paymentType || 'cash',
      vehicleTransmission: (initialContract.autoMotoDetails?.vehicleTransmission as any) || 'Automático',
      licenseCategory: initialContract.autoMotoDetails?.licenseCategory || 'A, C',
      theoreticalClassSchedule: initialContract.autoMotoDetails?.theoreticalClassSchedule || '',
      theoreticalClassDates: initialContract.autoMotoDetails?.theoreticalClassDates?.map(d => toDate(d)) || [null, null],
      practicalClassSchedules: initialContract.autoMotoDetails?.practicalClassSchedules?.map(s => ({ ...s, date: s.date ? toDate(s.date) : null })) || [],
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '', studentAddress: '', studentPhone1: '',
      coursePlan: '', courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash',
      vehicleTransmission: 'Automático', licenseCategory: 'A, C', theoreticalClassDates: [null, null], practicalClassSchedules: [],
    },
  });

  const { fields, replace } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const watchPlan = form.watch('coursePlan');
  const watchValue = form.watch('courseValue');
  const watchDown = form.watch('downPayment');

  useEffect(() => {
    if (!initialContract) {
        const pkg = autoPackages.find(p => p.id === watchPlan);
        if (pkg) {
            form.setValue('courseValue', pkg.price);
            replace(Array.from({ length: pkg.hours / 2 }).map(() => ({ date: null, time: '', vehicle: '', instructor: '' })));
        }
    }
  }, [watchPlan, replace, form, initialContract]);

  useEffect(() => { 
    form.setValue('balance', Math.max(0, watchValue - watchDown)); 
  }, [watchValue, watchDown, form]);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        let folio = initialContract?.folioNumber || 0;
        if (!initialContract) {
            const counterRef = doc(db, 'counters', 'contract_folio');
            const counterDoc = await transaction.get(counterRef);
            folio = counterDoc.exists() ? counterDoc.data().count + 1 : 1;
            transaction.set(counterRef, { count: folio }, { merge: true });
        }
        const contractId = initialContract?.id || doc(collection(db, 'contracts')).id;
        const contractRef = doc(db, 'contracts', contractId);
        const finalData = {
            id: contractId, 
            folioNumber: folio, 
            title: 'Curso Auto', 
            clientName: values.clientName, 
            clientEmail: values.clientEmail,
            clientId: values.studentIdNumber, 
            type: 'Curso Auto', 
            status: initialContract?.status || 'active',
            userId: user.uid, 
            createdBy: initialContract?.createdBy || role || 'Sistema', 
            updatedAt: serverTimestamp(),
            createdAt: initialContract?.createdAt || serverTimestamp(),
            autoMotoDetails: {
                idType: values.idType, 
                studentIdNumber: values.studentIdNumber, 
                studentAddress: values.studentAddress,
                studentPhone1: values.studentPhone1, 
                coursePlan: values.coursePlan, 
                courseValue: values.courseValue,
                downPayment: values.downPayment, 
                balance: values.balance, 
                paymentType: values.paymentType,
                paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
                vehicleTransmission: values.vehicleTransmission, 
                licenseCategory: values.licenseCategory,
                theoreticalClassSchedule: values.theoreticalClassSchedule,
                theoreticalClassDates: values.theoreticalClassDates?.map(d => d ? Timestamp.fromDate(d) : null),
                practicalClassSchedules: values.practicalClassSchedules.map(s => ({ ...s, date: s.date ? Timestamp.fromDate(s.date) : null })),
            }
        };
        if (!initialContract) transaction.set(contractRef, finalData);
        else transaction.update(contractRef, finalData);
      });
      toast({ title: 'Éxito', description: 'Contrato auto guardado.' });
      router.push('/dashboard');
    } catch (e) { 
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al guardar' }); 
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-blue-600 shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-blue-600" /><CardTitle className="text-sm font-bold uppercase">Datos del Estudiante (Compacto)</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-12 gap-x-4 gap-y-3 pt-6">
                <div className="col-span-8">
                  <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo</FormLabel>
                      <FormControl><Input {...field} className="h-9 font-semibold" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="col-span-4">
                  <FormField control={form.control} name="clientEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel>
                      <FormControl><Input {...field} className="h-9" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="col-span-2">
                  <FormField control={form.control} name="idType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Tipo ID</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="PASS">PASS</SelectItem></SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="col-span-4">
                  <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Identificación</FormLabel>
                      <FormControl><Input {...field} className="h-9 font-mono" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="col-span-6">
                  <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono</FormLabel>
                      <FormControl><Input {...field} className="h-9" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="col-span-12">
                  <FormField control={form.control} name="studentAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Dirección Residencial</FormLabel>
                      <FormControl><Input {...field} className="h-9 text-xs" /></FormControl>
                    </FormItem>
                  )} />
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-blue-600" /><CardTitle className="text-sm font-bold uppercase">Configuración del Curso Auto</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                <FormField control={form.control} name="coursePlan" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Plan de Curso</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl>
                      <SelectContent>{autoPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Categorías</FormLabel>
                    <FormControl><Input {...field} className="h-10" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Transmisión</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem></Select>
                    </Select>
                  </FormItem>
                )} />
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" /><CardTitle className="text-sm font-bold uppercase">Agenda Práctica Auto</CardTitle></div></CardHeader>
            <CardContent className="space-y-4 pt-6">
                {fields.map((field, i) => {
                    const d = form.watch(`practicalClassSchedules.${i}.date`);
                    const t = form.watch(`practicalClassSchedules.${i}.time`);
                    const v = form.watch(`practicalClassSchedules.${i}.vehicle`);
                    const dObj = d ? toDate(d) : null;
                    const isSun = dObj?.getDay() === 0;
                    const hol = dObj ? isPanamaHoliday(dObj) : null;
                    const slot = t ? (TIME_MAP[t] || t) : null;
                    const keyD = dObj ? format(dObj, 'yyyy-MM-dd') : null;
                    const isBusy = (keyD && slot && v && availability.occ[`${keyD}|${slot}|${v}`]);
                    const isFull = keyD && slot && (availability.glob[`${keyD}|${slot}`] || 0) >= 3;

                    return (
                        <div key={field.id} className={cn("grid grid-cols-4 gap-3 p-3 border rounded-lg bg-white relative", (isBusy || isFull || isSun || hol) && "border-amber-500 bg-amber-50/30")}>
                            <div className="absolute -top-2 right-2 flex gap-1 z-10">
                                {isSun && <span className="bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-sm">DOMINGO</span>}
                                {hol && !isSun && <span className="bg-orange-500 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-sm">FERIADO</span>}
                                {isBusy && <span className="bg-amber-500 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-sm">OCUPADO</span>}
                                {isFull && !isBusy && <span className="bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-sm">LLENO</span>}
                            </div>
                            <FormField control={form.control} name={`practicalClassSchedules.${i}.date`} render={({ field }) => (
                              <FormItem>
                                <Popover modal={true}>
                                  <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className="w-full h-9 text-xs"><CalendarIcon className="mr-2 h-3 w-3" /> {field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${i}.time`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Turno" /></SelectTrigger></FormControl>
                                  <SelectContent>{practicalTimeSlots.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${i}.vehicle`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                  <SelectContent>{carVehicles.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`practicalClassSchedules.${i}.instructor`} render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Inst." /></SelectTrigger></FormControl>
                                  <SelectContent>{instructors.map(ins => <SelectItem key={ins} value={ins} className="text-xs">{ins}</SelectItem>)}</SelectContent>
                                </Select>
                              </FormItem>
                            )} />
                        </div>
                    );
                })}
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-blue-600" /><CardTitle className="text-sm font-bold uppercase">Información de Pago</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6">
                <FormField control={form.control} name="courseValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Total (B/.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} className="h-10" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="downPayment" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Abono (B/.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} className="h-10 text-green-700 font-bold" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="balance" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</FormLabel>
                    <FormControl><Input className="h-10 bg-muted font-black text-destructive" readOnly {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Límite</FormLabel>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl><Button variant="outline" className="w-full h-10 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover>
                  </FormItem>
                )} />
                <FormField control={form.control} name="paymentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Método</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">T.Débito</SelectItem><SelectItem value="credit">T.Crédito</SelectItem></Select>
                    </Select>
                  </FormItem>
                )} />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" size="lg" className="px-12 h-14 text-lg font-bold shadow-xl bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                {initialContract ? 'Actualizar Contrato' : 'Generar Contrato Auto'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
