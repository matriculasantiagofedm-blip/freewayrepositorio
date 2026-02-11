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
import { CalendarIcon, Loader2, Calculator, UserCircle, Settings2, BookOpen, Car, Bike, Save, AlertTriangle } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType, InstructorName, VehicleName, ManualSchedule } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from './firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

const instructors: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', ''];
const carVehicles: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark'];
const motoVehicles: VehicleName[] = ['Moto Roja', 'Moto Negra'];
const allVehicles: VehicleName[] = [...carVehicles, ...motoVehicles];
const practicalTimes = ['8:00am a 10:00am', '10:00am a 12:pm', '1:00pm a 3:00pm', '3:00pm a 5:00pm'];
const ampliacionTheoreticalTimes = ['8:00 am a 12:00 pm', '3:00 pm a 5:00 pm'];
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
    
    // Regla 8am-10am: Lunes 3, Martes-Viernes 2
    if (slotId === '8am-10am') {
        if (day === 1) return 3;
        if (day >= 2 && day <= 5) return 2;
    }
    
    // Regla Sabatino tarde: 2 vehiculos
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

const ampliacionOptions = [
  { id: 'B', label: 'B', price: 57.00 },
  { id: 'C', label: 'C', price: 57.00 },
  { id: 'D', label: 'D', price: 57.00 },
  { id: 'E1', label: 'E1', price: 57.00 },
  { id: 'E2', label: 'E2', price: 75.00 },
  { id: 'E3', label: 'E3', price: 75.00 },
  { id: 'F', label: 'F', price: 80.00 },
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
  return selected.reduce((acc, cat) => acc + (ampliacionOptions.find(o => o.id === cat)?.price || 0), 0);
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
  practicalClassSchedules: z.array(z.object({
    date: z.date().optional().nullable(),
    time: z.string().optional(),
    vehicle: z.string().optional(),
    instructor: z.string().optional()
  })).optional(),
  motoPracticalClassSchedules: z.array(z.object({
    date: z.date().optional().nullable(),
    time: z.string().optional(),
    vehicle: z.string().optional(),
    instructor: z.string().optional()
  })).optional(),
});

type FormValues = z.infer<typeof contractSchema>;

const convertDatesToTimestamps = (data: any) => {
    const result: any = {};
    Object.keys(data).forEach(key => { if (data[key] !== undefined) result[key] = data[key]; });
    const toTs = (d: any) => (d instanceof Date) ? Timestamp.fromDate(d) : d;
    const toDateObj = (d: any) => {
        if (!d) return null;
        if (d instanceof Timestamp) return d.toDate();
        if (d instanceof Date) return d;
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (result.paymentDeadline) result.paymentDeadline = toTs(result.paymentDeadline);
    if (result.theoreticalClassDate) result.theoreticalClassDate = toTs(result.theoreticalClassDate);
    if (result.theoreticalClassDates) {
        result.theoreticalClassDates = result.theoreticalClassDates.map((d: any) => {
            const obj = toDateObj(d);
            return obj ? toTs(obj) : null;
        });
    }
    if (result.practicalClassSchedules) {
        result.practicalClassSchedules = result.practicalClassSchedules.map((s: any) => ({ ...s, date: s.date ? toTs(toDateObj(s.date)) : null }));
    }
    if (result.motoPracticalClassSchedules) {
        result.motoPracticalClassSchedules = result.motoPracticalClassSchedules.map((s: any) => ({ ...s, date: s.date ? toTs(toDateObj(s.date)) : null }));
    }
    return result;
};

function ClassSlotGrid({ 
    fields, 
    namePrefix, 
    availableVehicles, 
    title, 
    Icon, 
    form, 
    availabilityData 
}: { 
    fields: any[], 
    namePrefix: string, 
    availableVehicles: string[], 
    title: string, 
    Icon: any, 
    form: any, 
    availabilityData: { 
        vehicleOccupancy: Record<string, { name: string, isEval: boolean }[]>, 
        globalCounts: Record<string, number> 
    }
}) {
    if (fields.length === 0) return null;
    const { vehicleOccupancy, globalCounts } = availabilityData;
    const currentCoursePlan = form.watch('coursePlan');
    const isCurrentEval = isEvalPlan(currentCoursePlan);

    const getTimeSlotLabel = (timeStr: string, date: Date | null | undefined) => {
        if (!date) return timeStr;
        const dateObj = toDate(date);
        if (isNaN(dateObj.getTime())) return timeStr;

        const dateKey = format(dateObj, 'yyyy-MM-dd');
        const slotId = TIME_STRING_TO_SLOT_MAP[timeStr] || timeStr;
        
        const count = globalCounts[`${dateKey}|${slotId}`] || 0;
        const cap = getGlobalCapacity(dateObj, slotId);

        const available = cap - count;
        if (available <= 0) return `${timeStr} (LLENO)`;
        return `${timeStr} (${available} de ${cap} disp.)`;
    };

    return (
        <Card className="shadow-sm mt-4">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold">
                    <Icon className="h-4 w-4" /> {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 gap-3">
                    {fields.map((field, index) => {
                        const watchDate = form.watch(`${namePrefix}.${index}.date`);
                        const watchTime = form.watch(`${namePrefix}.${index}.time`);
                        const watchVehicle = form.watch(`${namePrefix}.${index}.vehicle`);
                        
                        let conflictStudents: { name: string, isEval: boolean }[] = [];
                        let isFull = false;
                        let capacity = 3;

                        if (watchDate && watchTime) {
                            const dateObj = toDate(watchDate);
                            const dateKey = format(dateObj, 'yyyy-MM-dd');
                            const slotId = TIME_STRING_TO_SLOT_MAP[watchTime] || watchTime;
                            
                            if (watchVehicle) {
                                conflictStudents = vehicleOccupancy[`${dateKey}|${slotId}|${watchVehicle}`] || [];
                            }

                            capacity = getGlobalCapacity(dateObj, slotId);
                            const currentOccupancy = globalCounts[`${dateKey}|${slotId}`] || 0;
                            isFull = currentOccupancy >= capacity;
                        }

                        const hasConflict = conflictStudents.length > 0 && (
                            !isCurrentEval || 
                            conflictStudents.some(s => !s.isEval) || 
                            conflictStudents.length >= 3 
                        );

                        return (
                            <div key={field.id} className={cn("p-3 border rounded-md bg-muted/5 space-y-3 relative", (hasConflict || isFull) && "border-amber-500 bg-amber-50/30")}>
                                {hasConflict && (
                                    <div className="absolute -top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10 uppercase">
                                        <AlertTriangle className="h-3 w-3" /> OCUPADO POR: {conflictStudents.map(s => s.name).join(', ')}
                                    </div>
                                )}
                                {isFull && !hasConflict && (
                                    <div className="absolute -top-2 right-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 animate-pulse z-10 uppercase">
                                        <AlertTriangle className="h-3 w-3" /> CAPACIDAD MÁXIMA ({capacity} VEHÍCULOS)
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold w-5 bg-primary text-white rounded-full h-5 flex items-center justify-center shrink-0">#{index + 1}</span>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                                        <FormField control={form.control} name={`${namePrefix}.${index}.date`} render={({ field: f }) => (
                                            <FormItem>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl><Button variant="outline" className={cn("h-8 text-xs w-full text-left font-normal px-2", !f.value && "text-muted-foreground", (hasConflict || isFull) && "border-amber-400")}><CalendarIcon className="mr-1 h-3 w-3" />{f.value ? format(f.value, "dd/MM") : "Fecha"}</Button></FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={f.value} onSelect={f.onChange} initialFocus /></PopoverContent>
                                                </Popover>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`${namePrefix}.${index}.time`} render={({ field: f }) => (
                                            <FormItem>
                                                <Select onValueChange={f.onChange} value={f.value}>
                                                    <FormControl><SelectTrigger className={cn("h-8 text-[10px] md:text-xs px-2", (hasConflict || isFull) && "border-amber-400")}><SelectValue placeholder="Hora" /></SelectTrigger></FormControl>
                                                    <SelectContent>{practicalTimes.map(t => (
                                                        <SelectItem key={t} value={t} className="text-xs">
                                                            {getTimeSlotLabel(t, watchDate)}
                                                        </SelectItem>
                                                    ))}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`${namePrefix}.${index}.vehicle`} render={({ field: f }) => (
                                            <FormItem>
                                                <Select onValueChange={f.onChange} value={f.value}>
                                                    <FormControl><SelectTrigger className={cn("h-8 text-xs px-2", hasConflict && "border-amber-400")}><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                                                    <SelectContent>{availableVehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`${namePrefix}.${index}.instructor`} render={({ field: f }) => (
                                            <FormItem>
                                                <Select onValueChange={f.onChange} value={f.value}>
                                                    <FormControl><SelectTrigger className="h-8 text-xs px-2"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                                                    <SelectContent>{instructors.filter(Boolean).map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
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

  const contractType: ContractType = useMemo(() => {
      if (initialContract) return initialContract.type;
      return (searchParams.get('type') as ContractType) || 'Curso Auto';
  }, [initialContract, searchParams]);

  const form = useForm<FormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      clientName: '', clientEmail: '', contractType: contractType, studentIdNumber: '', idType: 'C.I.P.',
      studentAddress: '', studentPhone1: '', studentPhone2: '', courseValue: 0, downPayment: 0, balance: 0,
      paymentType: 'cash', coursePlan: '', vehicleTransmission: contractType === 'Curso Moto' ? 'Moto' : 'Manual',
      licenseCategory: contractType === 'Curso Moto' ? 'A, B' : 'A, C',
      theoreticalClassSchedule: '', theoreticalClassDates: [], theoreticalClassDate: undefined, theoreticalClassTime: '',
      selectedPlans: [], practicalClassSchedules: [], motoPracticalClassSchedules: [],
    },
  });

  const activeContractsQuery = useMemoQuery(() => db ? query(collection(db, 'contracts'), where('status', '==', 'active')) : null, [db]);
  const manualEntriesQuery = useMemoQuery(() => db ? collection(db, 'manual_schedules') : null, [db]);
  const { data: allContracts } = useCollection<Contract>(activeContractsQuery);
  const { data: manualEntries } = useCollection<ManualSchedule>(manualEntriesQuery);

  const availabilityData = useMemo(() => {
    const vehicleOccupancy: Record<string, { name: string, isEval: boolean }[]> = {};
    const globalCounts: Record<string, number> = {};
    
    const processEntry = (date: any, slot: string, vehicle: string, name: string, isEval: boolean) => {
        if (!date || !slot || !vehicle) return;
        const dateKey = format(toDate(date), 'yyyy-MM-dd');
        const vKey = `${dateKey}|${slot}|${vehicle}`;
        const sKey = `${dateKey}|${slot}`;
        
        if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
        vehicleOccupancy[vKey].push({ name, isEval });
    };

    manualEntries?.forEach(entry => {
      if (entry.classType === 'Teórica') return;
      processEntry(entry.date, entry.timeSlot, entry.vehicle, entry.studentName, false);
    });

    allContracts?.forEach(c => {
      if (c.id === initialContract?.id) return;
      const details = c.autoMotoDetails || c.deluxeDetails;
      const isEval = isEvalPlan(details?.coursePlan);

      const processSlots = (slots: any[]) => {
        slots.forEach(s => {
          processEntry(s.date, TIME_STRING_TO_SLOT_MAP[s.time] || s.time, s.vehicle, c.clientName, isEval);
        });
      };
      processSlots(c.autoMotoDetails?.practicalClassSchedules || []);
      processSlots(c.autoMotoDetails?.motoPracticalClassSchedules || []);
      processSlots(c.deluxeDetails?.classSchedules || []);
    });

    Object.keys(vehicleOccupancy).forEach(vKey => {
        const [dateKey, slotId] = vKey.split('|');
        const sKey = `${dateKey}|${slotId}`;
        const students = vehicleOccupancy[vKey];
        
        const hasNormalClass = students.some(s => !s.isEval);
        const evalCount = students.filter(s => s.isEval).length;
        
        if (hasNormalClass) globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
        else if (evalCount > 0) globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    });

    return { vehicleOccupancy, globalCounts };
  }, [allContracts, manualEntries, initialContract]);

  useEffect(() => {
    if (initialContract) {
        const details = initialContract.autoMotoDetails || initialContract.deluxeDetails || initialContract.ampliacionesDetails;
        const toD = (d: any) => d ? (d instanceof Timestamp ? d.toDate() : new Date(d)) : undefined;
        form.reset({
            clientName: initialContract.clientName, clientEmail: initialContract.clientEmail, contractType: initialContract.type,
            idType: details?.idType || 'C.I.P.', studentIdNumber: details?.studentIdNumber || '', studentAddress: details?.studentAddress || '',
            studentPhone1: details?.studentPhone1 || '', studentPhone2: details?.studentPhone2 || '', coursePlan: details?.coursePlan || '',
            courseValue: details?.courseValue || 0, downPayment: details?.downPayment || 0, balance: details?.balance || 0,
            paymentType: details?.paymentType || 'cash', paymentDeadline: toD(details?.paymentDeadline), vehicleTransmission: details?.vehicleTransmission,
            licenseCategory: details?.licenseCategory, theoreticalClassSchedule: details?.theoreticalClassSchedule,
            theoreticalClassDates: (details?.theoreticalClassDates || []).map(toD), theoreticalClassDate: toD(details?.theoreticalClassDate),
            theoreticalClassTime: details?.theoreticalClassTime, selectedPlans: details?.selectedPlans || [],
            practicalClassSchedules: (details?.practicalClassSchedules || []).map((s: any) => ({ ...s, date: toD(s.date) })),
            motoPracticalClassSchedules: (details?.motoPracticalClassSchedules || []).map((s: any) => ({ ...s, date: toD(s.date) })),
        });
    }
  }, [initialContract, form]);

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const { fields: motoFields, replace: replaceMoto } = useFieldArray({ control: form.control, name: "motoPracticalClassSchedules" });

  const courseValue = form.watch('courseValue');
  const downPayment = form.watch('downPayment');
  const selectedPlanId = form.watch('coursePlan');
  const selectedTheoreticalSchedule = form.watch('theoreticalClassSchedule');
  const selectedPlans = form.watch('selectedPlans') || [];
  
  useEffect(() => {
    if (!selectedPlanId || contractType === 'Ampliaciones' || initialContract) return;
    let pkg: any;
    if (contractType === 'Curso Auto') pkg = autoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Moto') pkg = motoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Mixto') pkg = mixtoPackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Deluxe') pkg = deluxePackages.find(p => p.id === selectedPlanId);
    else if (contractType === 'Curso Solo Practica') pkg = soloPracticaPackages.find(p => p.id === selectedPlanId);
    
    if (pkg) {
        form.setValue('courseValue', pkg.price);
        const slots = Array.from({ length: Math.ceil((pkg.hours || 0) / 2) }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' }));
        if (contractType === 'Curso Moto' || (contractType === 'Curso Solo Practica' && pkg.vehicleType === 'Moto')) {
            replaceMoto(slots); replacePractical([]);
        } else if (contractType === 'Curso Mixto') {
            const counts: Record<string, number> = { 'mixto-10h': 5, 'mixto-reforzamiento': 1, 'mixto-basico-am': 4, 'mixto-plus-am': 5, 'mixto-premium-am': 6 };
            const autoC = counts[pkg.id] || 0;
            const motoC = (pkg.id === 'mixto-10h' || pkg.id === 'mixto-reforzamiento') ? autoC : (pkg.id.includes('-ma') ? counts[pkg.id.replace('-ma', '-am')] || 0 : 0);
            replacePractical(Array.from({ length: autoC }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' })));
            replaceMoto(Array.from({ length: motoC }).map(() => ({ date: null, time: '8:00am a 10:00am', vehicle: '', instructor: '' })));
        } else {
            replacePractical(slots); replaceMoto([]);
        }
    }
  }, [selectedPlanId, contractType, form, replacePractical, replaceMoto, initialContract]);

  useEffect(() => {
    if (initialContract) return;
    if (selectedTheoreticalSchedule === 'Clase Semanal') form.setValue('theoreticalClassDates', Array(4).fill(null));
    else if (selectedTheoreticalSchedule === 'Clase Sabatina') form.setValue('theoreticalClassDates', Array(3).fill(null));
    else if (contractType !== 'Ampliaciones') form.setValue('theoreticalClassDates', []);
  }, [selectedTheoreticalSchedule, form, contractType, initialContract]);

  useEffect(() => { 
    form.setValue('balance', Math.max(0, (Number(courseValue) || 0) - (Number(downPayment) || 0))); 
  }, [courseValue, downPayment, form]);

  async function onSubmit(values: FormValues) {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
      const cleaned = convertDatesToTimestamps(values);
      if (initialContract) {
          const contractRef = doc(db, 'contracts', initialContract.id);
          const updateData: any = { clientName: values.clientName, clientEmail: values.clientEmail };
          if (values.contractType === 'Curso Deluxe') updateData.deluxeDetails = cleaned;
          else if (values.contractType === 'Ampliaciones') updateData.ampliacionesDetails = cleaned;
          else updateData.autoMotoDetails = cleaned;
          await updateDoc(contractRef, updateData);
          toast({ title: 'Contrato Actualizado', description: 'Cambios guardados.' });
          router.push(`/contracts/${initialContract.id}`);
      } else {
          const snap = await getDocs(query(collection(db, 'clients'), where('idNumber', '==', values.studentIdNumber)));
          const cid = await runTransaction(db, async (t) => {
            const countRef = doc(db, 'counters', 'contract_folio');
            const newFolio = ((await t.get(countRef)).data()?.count || 0) + 1;
            let clientId = snap.docs[0]?.id;
            if (!clientId) {
              const newC = doc(collection(db, 'clients')); clientId = newC.id;
              t.set(newC, { id: clientId, name: values.clientName, email: values.clientEmail, idNumber: values.studentIdNumber, phone: values.studentPhone1, userId: user.uid, createdAt: serverTimestamp() });
            }
            const nRef = doc(collection(db, 'contracts'));
            const data: any = { id: nRef.id, folioNumber: newFolio, title: values.contractType, clientName: values.clientName, clientEmail: values.clientEmail, clientId, type: values.contractType, status: 'active', userId: user.uid, createdAt: serverTimestamp(), createdBy: currentUserRole || undefined };
            if (values.contractType === 'Curso Deluxe') data.deluxeDetails = cleaned;
            else if (values.contractType === 'Ampliaciones') data.ampliacionesDetails = cleaned;
            else data.autoMotoDetails = cleaned;
            t.set(nRef, data); t.set(countRef, { count: newFolio }, { merge: true }); return nRef.id;
          });
          toast({ title: 'Contrato Generado', description: 'Éxito.' });
          router.push(`/contracts/${cid}`);
      }
    } catch (e: any) { 
      toast({ variant: 'destructive', title: 'Error', description: e.message }); 
    } finally { 
      setIsSubmitting(false); 
    }
  }

  const currentPackages = useMemo(() => {
    if (contractType === 'Curso Auto') return autoPackages;
    if (contractType === 'Curso Moto') return motoPackages;
    if (contractType === 'Curso Mixto') return mixtoPackages;
    if (contractType === 'Curso Deluxe') return deluxePackages;
    if (contractType === 'Curso Solo Practica') return soloPracticaPackages;
    return null;
  }, [contractType]);

  const watchTheoreticalDates = form.watch('theoreticalClassDates') || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold"><UserCircle className="h-4 w-4" /> 1. Datos del Estudiante</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="flex gap-2 items-end">
                        <FormField control={form.control} name="idType" render={({ field }) => (
                            <FormItem className="w-[100px]"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="PASS">PASS</SelectItem></SelectContent></Select></FormItem>
                        )} />
                        <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                            <FormItem className="flex-1"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">N° Identificación</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="8-000-000" {...field} readOnly={!!initialContract} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="studentPhone1" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono 1</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="studentPhone2" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono 2</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="studentAddress" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Dirección</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl></FormItem>)} />
            </CardContent>
        </Card>

        <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-primary font-bold"><Calculator className="h-4 w-4" /> 2. Valor y Forma de Pago</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentPackages && (
                        <FormField control={form.control} name="coursePlan" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Paquete / Plan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{currentPackages.map(pkg => <SelectItem key={pkg.id} value={pkg.id}>{pkg.label}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="paymentType" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Método de Pago</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">Tarjeta Débito</SelectItem><SelectItem value="credit">Tarjeta Crédito</SelectItem><SelectItem value="general">General</SelectItem><SelectItem value="bac">BAC</SelectItem></SelectContent></Select></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormField control={form.control} name="courseValue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Valor Total</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" {...field} readOnly={contractType === 'Ampliaciones'} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="downPayment" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Abono Inicial</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="balance" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</FormLabel><FormControl><Input className="h-8 text-sm bg-muted font-bold text-destructive" type="number" readOnly {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Límite Saldo</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-8 text-sm pl-3 text-left font-normal"><CalendarIcon className="mr-2 h-3 w-3" />{field.value ? format(field.value, "dd/MM/yy") : "Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-sm">
            <CardHeader className="py-2 px-4 border-b"><CardTitle className="text-sm flex items-center gap-2 text-primary font-bold"><Settings2 className="h-4 w-4" /> 3. Detalles del Curso</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                {contractType === 'Ampliaciones' ? (
                    <div className="md:col-span-2 space-y-2">
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Categorías de Ampliación</FormLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {ampliacionOptions.map((opt) => {
                                const sel = selectedPlans.some(p => p.name === opt.id);
                                return (
                                    <Button key={opt.id} type="button" variant={sel ? "default" : "outline"} className={cn("h-10 text-xs flex flex-col items-center", sel && "bg-primary text-white border-primary")} onClick={() => {
                                        let newP = sel ? selectedPlans.filter(p => p.name !== opt.id) : [...selectedPlans, { name: opt.id, price: opt.price }];
                                        form.setValue('selectedPlans', newP); form.setValue('courseValue', calculateAmpliacionPrice(newP.map(p => p.name)));
                                    }}><span className="font-bold text-sm">{opt.label}</span><span className="text-[9px] opacity-80">B/. {opt.price.toFixed(2)}</span></Button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <>
                        {contractType !== 'Curso Solo Practica' && (
                            <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Categoría de Licencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{contractType === 'Curso Moto' ? <SelectItem value="A, B">A, B (Moto)</SelectItem> : <><SelectItem value="A, C">A, C</SelectItem><SelectItem value="A, C, D">A, C, D</SelectItem></>}</SelectContent></Select></FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Transmisión</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{contractType === 'Curso Moto' ? <SelectItem value="Moto">Moto</SelectItem> : <><SelectItem value="Manual">Manual</SelectItem><SelectItem value="Automático">Automático</SelectItem></>}</SelectContent></Select></FormItem>
                        )} />
                    </>
                )}
            </CardContent>
        </Card>

        {contractType !== 'Curso Solo Practica' && (
            <Card className="shadow-sm">
                <CardHeader className="py-2 px-4 border-b"><CardTitle className="text-sm flex items-center gap-2 text-primary font-bold"><BookOpen className="h-4 w-4" /> 4. Programación Clases Teóricas</CardTitle></CardHeader>
                <CardContent className="p-3 space-y-2">
                    {contractType === 'Ampliaciones' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-8 text-sm pl-3 text-left font-normal"><CalendarIcon className="mr-2 h-3 w-3" />{field.value ? format(field.value, "dd/MM/yy") : "Seleccionar"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>)} />
                            <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Horario</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{ampliacionTheoreticalTimes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Horario Teórico</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl><SelectContent>{theoreticalSchedules.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            {watchTheoreticalDates.map((_, idx) => (
                                <FormField key={idx} control={form.control} name={`theoreticalClassDates.${idx}`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Fecha Clase {idx + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-8 text-sm pl-3 text-left font-normal"><CalendarIcon className="mr-2 h-3 w-3" />{field.value ? format(field.value, "dd/MM/yy") : "Seleccionar"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>)} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

        {contractType !== 'Ampliaciones' && (
            <div className="space-y-4">
                <ClassSlotGrid fields={practicalFields} namePrefix="practicalClassSchedules" availableVehicles={carVehicles} title="5. Programación Clases Prácticas (Auto)" Icon={Car} form={form} availabilityData={availabilityData} />
                <ClassSlotGrid fields={motoFields} namePrefix="motoPracticalClassSchedules" availableVehicles={motoVehicles} title="5. Programación Clases Prácticas (Moto)" Icon={Bike} form={form} availabilityData={availabilityData} />
            </div>
        )}

        <div className="flex justify-end pt-2 pb-8">
            <Button type="submit" size="lg" className="w-full md:w-auto h-10 px-12 font-bold shadow-md" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : (
                    initialContract ? <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</> : 'Generar Contrato y Guardar'
                )}
            </Button>
        </div>
      </form>
    </Form>
  );
}