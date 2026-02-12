'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { CalendarIcon, Loader2, Calculator, UserCircle, Settings2, BookOpen, Car, Bike, Save, AlertTriangle, Landmark, Ban } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, InstructorName, VehicleName, ManualSchedule } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from './firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', ''];
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const practicalTimes = ['8:00am a 10:00am', '10:00am a 12:pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];
const theoreticalSchedules = ['Clase Semanal', 'Clase Sabatina'];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
    '8:00am a 10:00am': '8am-10am',
    '10:00am a 12:pm': '10am-12pm',
    '1:00pm a 3:00pm': '1pm-3pm',
    '3:00pm a 5:00pm': '3pm-5pm',
};

const isEvalPlan = (planId?: string) => planId === 'evaluacion-estacionamiento' || planId === 'moto-evaluacion-estacionamiento';

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
    if (day === 0) return 0;
    
    if (slotId === '8am-10am') {
        if (day === 1) return 3;
        if (day >= 2 && day <= 5) return 2;
    }
    if (day === 6 && slotId === '3pm-5pm') return 2;
    return 3;
};

const autoPackages = [
    { id: 'basico', label: 'Curso Auto Básico (8hrz)', price: 133.00, hours: 8 },
    { id: 'plus', label: 'Curso Auto Plus (10hrz)', price: 155.00, hours: 10 },
    { id: 'premium', label: 'Curso Auto Premium (12hrz)', price: 180.00, hours: 12 },
    { id: 'reforzamiento-4h', label: 'Reforzamiento 4hrs', price: 98.00, hours: 4 },
    { id: 'reforzamiento-2h', label: 'Reforzamiento Plus 2hrs', price: 75.00, hours: 2 },
    { id: 'evaluacion-estacionamiento', label: 'Ya se manejar 10 mins (Evaluacion Estacionamiento)', price: 57.00, hours: 1 },
];

const motoPackages = [
    { id: 'moto-basico', label: 'Curso Moto Básico (8hrz)', price: 115.00, hours: 8 },
    { id: 'moto-plus', label: 'Curso Moto Plus (10hrz)', price: 135.00, hours: 10 },
    { id: 'moto-premium', label: 'Curso Moto Premium (12hrz)', price: 155.00, hours: 12 },
    { id: 'moto-reforzamiento-4h', label: 'Reforzamiento 4hrs', price: 98.00, hours: 4 },
    { id: 'moto-reforzamiento-2h', label: 'Reforzamiento Plus 2hrs', price: 75.00, hours: 2 },
    { id: 'moto-evaluacion-estacionamiento', label: 'Ya se manejar 10 mins (Evaluacion Estacionamiento)', price: 57.00, hours: 1 },
];

const mixtoPackages = [
    { id: 'mixto-10h', label: 'Auto + Moto 10Hrs', price: 290.00, hours: 10 },
    { id: 'mixto-basico-am', label: 'Básico Auto + Moto', price: 153.00, hours: 8 },
    { id: 'mixto-plus-am', label: 'Plus Auto + Moto', price: 170.00, hours: 10 },
    { id: 'mixto-premium-am', label: 'Premium Auto + Moto', price: 195.00, hours: 12 },
    { id: 'mixto-basico-ma', label: 'Básico Moto + Auto', price: 135.00, hours: 8 },
    { id: 'mixto-plus-ma', label: 'Plus Moto + Auto', price: 155.00, hours: 10 },
    { id: 'mixto-premium-ma', label: 'Premium Moto + Auto', price: 175.00, hours: 12 },
    { id: 'mixto-reforzamiento', label: 'Reforzamiento Mixto 2Hrs', price: 100.00, hours: 2 },
];

const deluxePackages = [
    { id: 'deluxe-premium', label: 'Plan Premium (Deluxe)', price: 201.00, hours: 12 },
    { id: 'deluxe-full', label: 'Plan Deluxe Full', price: 270.00, hours: 16 },
];

const soloPracticaPackages = [
    { id: 'solo-basico-auto', label: 'Paquete Básico 8hrs (Auto)', price: 125.00, hours: 8, vehicleType: 'Auto' },
    { id: 'solo-plus-auto', label: 'Paquete Plus 10hrs (Auto)', price: 135.00, hours: 10, vehicleType: 'Auto' },
    { id: 'solo-premium-auto', label: 'Paquete Premium 12hrs (Auto)', price: 155.00, hours: 12, vehicleType: 'Auto' },
    { id: 'solo-basico-moto', label: 'Paquete Básico 8hrs (Moto)', price: 103.00, hours: 8, vehicleType: 'Moto' },
    { id: 'solo-plus-moto', label: 'Paquete Plus 10hrs (Moto)', price: 117.00, hours: 10, vehicleType: 'Moto' },
    { id: 'solo-premium-moto', label: 'Paquete Premium 12hrs (Moto)', price: 130.00, hours: 12, vehicleType: 'Moto' },
];

const calculateAmpliacionPrice = (selected: string[]) => {
  if (selected.length === 0) return 0;
  const sortedKey = [...selected].sort().join(' + ');
  const rules: Record<string, number> = {
    'B': 57, 'C': 57, 'D': 57, 'E1': 57, 'E2': 75, 'E3': 75, 'F': 80,
    'E1 + E2': 75, 'E1 + E2 + E3': 85, 'D + E1': 85, 'B + D': 85, 'B + E1': 85, 'E2 + E3': 85, 'B + F': 85,
    'B + E1 + E2 + E3': 95, 'D + E1 + E2 + E3': 95, 'E1 + E2 + E3 + F': 95,
    'D + E1 + E2 + E3 + F': 150, 'B + E1 + E2 + E3 + F': 150, 'B + D + E1 + E2 + E3 + F': 200,
  };
  if (rules[sortedKey]) return rules[sortedKey];
  return selected.reduce((acc, cat) => acc + (cat === 'F' ? 80 : 57), 0);
};

const contractSchema = z.object({
  clientName: z.string().min(1, 'Requerido'),
  clientEmail: z.string().email('Email inválido'),
  contractType: z.enum(['Curso Auto', 'Curso Moto', 'Curso Mixto', 'Curso Deluxe', 'Ampliaciones', 'Curso Solo Practica']),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(1, 'Requerido'),
  studentAddress: z.string().min(1, 'Requerido'),
  studentPhone1: z.string().min(1, 'Requerido'),
  studentPhone2: z.string().optional(),
  coursePlan: z.string().optional(),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional(),
  paymentType: z.string().default('cash'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).optional(),
  licenseCategory: z.string().optional(),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date().nullable()).optional(),
  theoreticalClassDate: z.date().optional(),
  theoreticalClassTime: z.string().optional(),
  selectedPlans: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
  practicalClassSchedules: z.array(z.object({ date: z.date().nullable().optional(), time: z.string().optional(), vehicle: z.string().optional(), instructor: z.string().optional() })).optional(),
  motoPracticalClassSchedules: z.array(z.object({ date: z.date().nullable().optional(), time: z.string().optional(), vehicle: z.string().optional(), instructor: z.string().optional() })).optional(),
});

type FormValues = z.infer<typeof contractSchema>;

function ClassSlotGrid({ fields, namePrefix, availableVehicles, title, Icon, form, availabilityData }: any) {
    if (fields.length === 0) return null;
    const { vehicleOccupancy, globalCounts } = availabilityData;
    const currentCoursePlan = form.watch('coursePlan');
    const isCurrentEval = isEvalPlan(currentCoursePlan);

    return (
        <Card className="shadow-sm mt-4">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold"><Icon className="h-4 w-4" /> {title}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 gap-3">
                    {fields.map((field: any, index: number) => {
                        const watchDate = form.watch(`${namePrefix}.${index}.date`);
                        const watchTime = form.watch(`${namePrefix}.${index}.time`);
                        const watchVehicle = form.watch(`${namePrefix}.${index}.vehicle`);
                        const holiday = isPanamaHoliday(toDate(watchDate));
                        const isSunday = toDate(watchDate).getDay() === 0;
                        
                        let conflictStudents: any[] = [];
                        let isFull = false;
                        let capacity = 3;

                        if (watchDate && watchTime) {
                            const dateObj = toDate(watchDate);
                            const dateKey = format(dateObj, 'yyyy-MM-dd');
                            const slotId = TIME_STRING_TO_SLOT_MAP[watchTime] || watchTime;
                            if (watchVehicle) conflictStudents = vehicleOccupancy[`${dateKey}|${slotId}|${watchVehicle}`] || [];
                            capacity = getGlobalCapacity(dateObj, slotId);
                            isFull = (globalCounts[`${dateKey}|${slotId}`] || 0) >= capacity;
                        }

                        const hasConflict = conflictStudents.length > 0 && (!isCurrentEval || conflictStudents.some(s => !s.isEval) || conflictStudents.length >= 3);

                        return (
                            <div key={field.id} className={cn("p-3 border rounded-md bg-muted/5 relative", (hasConflict || isFull || holiday || isSunday) && "border-amber-500 bg-amber-50/30")}>
                                {isSunday && (
                                    <div className="absolute -top-2 right-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded animate-pulse z-10">
                                        <Ban className="h-3 w-3 inline mr-1" /> DOMINGO: DÍA NO LABORABLE
                                    </div>
                                )}
                                {holiday && !isSunday && (
                                    <div className="absolute -top-2 right-2 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded animate-pulse z-10">
                                        <Landmark className="h-3 w-3 inline mr-1" /> FERIADO: {holiday.name.toUpperCase()}
                                    </div>
                                )}
                                {hasConflict && !holiday && !isSunday && (
                                    <div className="absolute -top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded z-10">
                                        <AlertTriangle className="h-3 w-3 inline mr-1" /> OCUPADO: {conflictStudents.map(s => s.name).join(', ')}
                                    </div>
                                )}
                                {isFull && !hasConflict && !holiday && !isSunday && (
                                    <div className="absolute -top-2 right-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded z-10">
                                        <AlertTriangle className="h-3 w-3 inline mr-1" /> CAPACIDAD MÁXIMA ({capacity})
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold w-5 bg-primary text-white rounded-full h-5 flex items-center justify-center shrink-0">#{index + 1}</span>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                                        <FormField control={form.control} name={`${namePrefix}.${index}.date`} render={({ field: f }) => (
                                            <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-8 text-xs w-full text-left font-normal px-2"><CalendarIcon className="mr-1 h-3 w-3" />{f.value ? format(f.value, "dd/MM") : "Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`${namePrefix}.${index}.time`} render={({ field: f }) => (
                                            <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-8 text-[10px] md:text-xs"><SelectValue placeholder="Hora" /></SelectTrigger></FormControl><SelectContent>{practicalTimes.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent></Select></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`${namePrefix}.${index}.vehicle`} render={({ field: f }) => (
                                            <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl><SelectContent>{availableVehicles.map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`${namePrefix}.${index}.instructor`} render={({ field: f }) => (
                                            <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl><SelectContent>{instructors.filter(Boolean).map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export function ContractForm({ initialContract }: { initialContract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role: currentUserRole } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contractType: ContractType = useMemo(() => initialContract?.type || (searchParams.get('type') as ContractType) || 'Curso Auto', [initialContract, searchParams]);

  const form = useForm<FormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: { clientName: '', clientEmail: '', contractType, studentIdNumber: '', idType: 'C.I.P.', studentAddress: '', studentPhone1: '', courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash', vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual', licenseCategory: contractType === 'Curso Moto' ? 'A, B' : 'A, C' },
  });

  const activeContractsQuery = useMemoQuery(() => db ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db]);
  const manualEntriesQuery = useMemoQuery(() => db ? collection(db, 'manual_schedules') : null, [db]);
  const { data: allContracts } = useCollection<Contract>(activeContractsQuery);
  const { data: manualEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

  const availabilityData = useMemo(() => {
    const vehicleOccupancy: Record<string, any[]> = {};
    const globalCounts: Record<string, number> = {};
    const process = (date: any, slot: string, vehicle: string, name: string, isEval: boolean) => {
        if (!date || !slot || !vehicle) return;
        const dateKey = format(toDate(date), 'yyyy-MM-dd');
        const vKey = `${dateKey}|${slot}|${vehicle}`;
        if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
        vehicleOccupancy[vKey].push({ name, isEval });
    };
    manualEntries?.forEach(e => process(e.date, e.timeSlot, e.vehicle, e.studentName, false));
    allContracts?.forEach(c => {
      if (c.id === initialContract?.id) return;
      const isEval = isEvalPlan(c.autoMotoDetails?.coursePlan || c.deluxeDetails?.coursePlan);
      const procSlots = (slots: any[]) => slots.forEach(s => process(s.date, TIME_STRING_TO_SLOT_MAP[s.time] || s.time, s.vehicle, c.clientName, isEval));
      procSlots(c.autoMotoDetails?.practicalClassSchedules || []); procSlots(c.autoMotoDetails?.motoPracticalClassSchedules || []); procSlots(c.deluxeDetails?.classSchedules || []);
    });
    Object.keys(vehicleOccupancy).forEach(vKey => {
        const [dateKey, slotId] = vKey.split('|');
        const sKey = `${dateKey}|${slotId}`;
        const students = vehicleOccupancy[vKey];
        if (students.some(s => !s.isEval) || students.length > 0) globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    });
    return { vehicleOccupancy, globalCounts };
  }, [allContracts, manualEntries, initialContract]);

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { fields: motoFields, replace: replaceMoto } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  useEffect(() => {
    const plan = form.watch('coursePlan');
    if (!plan || initialContract) return;
    let pkg = [...autoPackages, ...motoPackages, ...mixtoPackages, ...deluxePackages, ...soloPracticaPackages].find(p => p.id === plan);
    if (pkg) {
        form.setValue('courseValue', pkg.price);
        const slots = Array.from({ length: Math.ceil((pkg.hours || 0) / 2) }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' }));
        if (contractType === 'Curso Moto') { replaceMoto(slots); replacePractical([]); } else { replacePractical(slots); replaceMoto([]); }
    }
  }, [form.watch('coursePlan'), contractType, initialContract]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
        const cid = await runTransaction(db, async (t) => {
            const countRef = doc(db, 'counters', 'contract_folio');
            const newFolio = ((await t.get(countRef)).data()?.count || 0) + 1;
            const nRef = doc(collection(db, 'contracts'));
            const data = { id: nRef.id, folioNumber: newFolio, title: values.contractType, clientName: values.clientName, clientEmail: values.clientEmail, clientId: 'temp', type: values.contractType, status: 'active', userId: user.uid, createdAt: serverTimestamp(), createdBy: currentUserRole || undefined, autoMotoDetails: values };
            t.set(nRef, data); t.set(countRef, { count: newFolio }, { merge: true }); return nRef.id;
        });
        router.push(`/contracts/${cid}`);
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsSubmitting(false); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="p-3 space-y-2">
            <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (<FormItem><FormLabel>Cédula</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="coursePlan" render={({ field }) => (
                    <FormItem><FormLabel>Plan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{(contractType === 'Curso Moto' ? motoPackages : autoPackages).map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
            </div>
        </Card>
        <ClassSlotGrid fields={practicalFields} namePrefix="practicalClassSchedules" availableVehicles={carVehicles} title="Clases Auto" Icon={Car} form={form} availabilityData={availabilityData} />
        <ClassSlotGrid fields={motoFields} namePrefix="motoPracticalClassSchedules" availableVehicles={motoVehicles} title="Clases Moto" Icon={Bike} form={form} availabilityData={availabilityData} />
        <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Guardando...' : 'Guardar Contrato'}</Button>
      </form>
    </Form>
  );
}
