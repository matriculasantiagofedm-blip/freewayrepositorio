'use client';

/**
 * FORMULARIO DE CONTRATO: CURSO DE AUTO (SINCRONIZADO CON AGENDA)
 * Soporta creación, edición y descarga de PDF en tiempo real.
 * Incluye lógica de Combo Plus Moto con agenda doble.
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
  Car, 
  CreditCard, 
  Package,
  Clock,
  Plus,
  RefreshCw,
  BookOpen,
  Download,
  Bike,
  CalendarSearch
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';
import type { Contract } from '@/lib/types';
import { AutoMotoContractTemplate } from '@/components/auto-moto-contract';
import { CameraCapture } from '@/components/camera-capture';
import { useSettingsPrices } from '@/hooks/use-settings-prices';

const DEFAULT_AUTO_PRICES: Record<string, number> = {
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
  "03:00pm a 05:00pm",
  "10 minutos"
];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
    '08:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '01:00pm a 03:00pm': '1pm-3pm',
    '03:00pm a 05:00pm': '3pm-5pm',
    '10 minutos': '10min',
};

const VEHICLES = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Skoda Automatico', 'Skoda Manual', 'Hyundai Manual'];
const VEHICLES_MOTO = ['Moto Roja', 'Moto Negra'];
const INSTRUCTORS = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon', 'Roberto Brown'];

const getGlobalCapacity = (date: Date, slotId: string) => {
    const day = date.getDay(); 
    if (day === 0) return 0; // Domingo cerrado
    return 3;
};

const autoContractSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  firstName: z.string().optional().or(z.literal('')),
  secondName: z.string().optional().or(z.literal('')),
  firstLastName: z.string().optional().or(z.literal('')),
  secondLastName: z.string().optional().or(z.literal('')),
  marriedLastName: z.string().optional().or(z.literal('')),
  clientEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
  licenseCategory: z.string().min(1, 'Categoría requerida'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
  additionalService: z.string().default('Ninguno'),
  courseValue: z.coerce.number().min(1, 'Monto inválido'),
  downPayment: z.coerce.number().min(0),
  paymentDeadline: z.date({ required_error: 'Fecha límite requerida' }).optional().nullable(),
  paymentType: z.string().default('cash'),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date()).optional(),
  practicalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
    vehicle: z.string().optional(),
    instructor: z.string().optional(),
  })).optional(),
  motoPracticalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
    vehicle: z.string().optional(),
    instructor: z.string().optional(),
  })).optional(),
  photoDataUri: z.string().optional(),
  idCardDataUri: z.string().optional(),
  licenseDataUri: z.string().optional(),
});

type FormValues = z.infer<typeof autoContractSchema>;

export function AutoContractForm({ contract }: { contract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { prices: settingsPrices } = useSettingsPrices();
  const isEdit = !!contract;

  const planPrices = settingsPrices?.auto || DEFAULT_AUTO_PRICES;
  const autoPlans = Object.keys(planPrices);

  const activeContractsQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null, [db, user]);
  const manualEntriesQuery = useMemoQuery(() => (db && user) ? query(collection(db, 'manual_schedules')) : null, [db, user]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(autoContractSchema),
    defaultValues: isEdit ? {
      ...contract.autoMotoDetails,
      clientName: contract.clientName || '',
      firstName: (contract.autoMotoDetails as any)?.firstName || '',
      secondName: (contract.autoMotoDetails as any)?.secondName || '',
      firstLastName: (contract.autoMotoDetails as any)?.firstLastName || '',
      secondLastName: (contract.autoMotoDetails as any)?.secondLastName || '',
      marriedLastName: (contract.autoMotoDetails as any)?.marriedLastName || '',
      clientEmail: contract.clientEmail || '',
      idType: contract.autoMotoDetails?.idType || 'C.I.P.',
      studentIdNumber: contract.autoMotoDetails?.studentIdNumber || '',
      studentAddress: contract.autoMotoDetails?.studentAddress || '',
      studentPhone1: contract.autoMotoDetails?.studentPhone1 || '',
      studentPhone2: contract.autoMotoDetails?.studentPhone2 || '',
      licenseCategory: contract.autoMotoDetails?.licenseCategory || 'A, C',
      vehicleTransmission: contract.autoMotoDetails?.vehicleTransmission || 'Automático',
      coursePlan: contract.autoMotoDetails?.coursePlan || '',
      additionalService: (contract.autoMotoDetails as any)?.additionalService || 'Ninguno',
      courseValue: contract.autoMotoDetails?.courseValue || 0,
      downPayment: contract.autoMotoDetails?.downPayment || 0,
      paymentType: contract.autoMotoDetails?.paymentType || 'cash',
      theoreticalClassSchedule: (contract.autoMotoDetails?.theoreticalClassSchedule as any) || 'Sabados 3:00 pm a 5:00 pm',
      paymentDeadline: toDate(contract.autoMotoDetails?.paymentDeadline),
      theoreticalClassDates: (contract.autoMotoDetails?.theoreticalClassDates || []).map(d => toDate(d)),
      practicalClassSchedules: (contract.autoMotoDetails?.practicalClassSchedules || []).map(s => ({
        ...s,
        date: toDate(s.date)
      })),
      motoPracticalClassSchedules: (contract.autoMotoDetails?.motoPracticalClassSchedules || []).map(s => ({
        ...s,
        date: toDate(s.date)
      })),
      photoDataUri: (contract.autoMotoDetails as any)?.photoDataUri || '',
      idCardDataUri: (contract.autoMotoDetails as any)?.idCardDataUri || '',
      licenseDataUri: (contract.autoMotoDetails as any)?.licenseDataUri || '',
    } : {
      clientName: '',
      firstName: '', secondName: '', firstLastName: '', secondLastName: '', marriedLastName: '',
      clientEmail: '',
      idType: 'C.I.P.',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      studentPhone2: '',
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
      motoPracticalClassSchedules: [],
      photoDataUri: '',
      idCardDataUri: '',
      licenseDataUri: '',
    },
  });

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({
    control: form.control,
    name: "practicalClassSchedules"
  });

  const { fields: motoPracticalFields, replace: replaceMotoPractical } = useFieldArray({
    control: form.control,
    name: "motoPracticalClassSchedules"
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
  const watchAdditional = form.watch('additionalService');
  const watchTheorySchedule = form.watch('theoreticalClassSchedule');

  useEffect(() => {
    if (watchTheorySchedule && !isEdit) {
      const count = watchTheorySchedule === 'Semanal 8:00 am a 10:00 am' ? 4 : 3;
      const current = form.getValues('theoreticalClassDates') || [];
      const newDates = Array.from({ length: count }, (_, i) => current[i] || new Date());
      form.setValue('theoreticalClassDates', newDates);
    }
  }, [watchTheorySchedule, form, isEdit]);

  useEffect(() => {
    if (watchPlan && !isEdit) {
      // VALIDACIÓN: Solo permitir 'Plus Moto 10Hrs' si el plan es 'Curso Auto Plus (10 Hrs)'
      if (watchPlan !== "Curso Auto Plus (10 Hrs)" && watchAdditional === "Plus Moto 10Hrs") {
        form.setValue('additionalService', 'Ninguno');
        return; 
      }

      let price = planPrices[watchPlan] || 0;
      
      if (watchAdditional === 'Plus Moto 10Hrs') {
        price = settingsPrices?.combos?.["Combo Plus Auto + Moto"] || 310.00;
        // Inicializar agenda de moto (5 sesiones / 10 horas)
        replaceMotoPractical(Array.from({ length: 5 }, () => ({ 
          date: new Date(), 
          time: '08:00am a 10:00am', 
          vehicle: 'Moto Roja', 
          instructor: '' 
        })));
      } else {
        replaceMotoPractical([]); // Limpiar si no es combo
      }

      if (watchAdditional === 'Ya se manejar Moto') {
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
  }, [watchPlan, watchAdditional, replacePractical, replaceMotoPractical, form, isEdit, planPrices, settingsPrices]);

  useEffect(() => {
    const handleSlotSelected = (e: any) => {
      const { date, time, vehicle, index } = e.detail;
      const current = form.getValues('practicalClassSchedules') || [];
      
      let indexToUpdate = index !== -1 ? index : current.findIndex((s: any) => format(s.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && s.time === '08:00am a 10:00am');
      if (indexToUpdate === -1) indexToUpdate = 0;
      
      if (indexToUpdate < current.length) {
          form.setValue(`practicalClassSchedules.${indexToUpdate}.date`, date, { shouldDirty: true, shouldValidate: true });
          form.setValue(`practicalClassSchedules.${indexToUpdate}.time`, time, { shouldDirty: true, shouldValidate: true });
          if (vehicle) {
             form.setValue(`practicalClassSchedules.${indexToUpdate}.vehicle`, vehicle, { shouldDirty: true, shouldValidate: true });
          }
          toast({ title: "Horario y Auto Asignados", description: `Sesión ${indexToUpdate + 1} programada para ${format(date, 'dd/MM')} a las ${time} en el ${vehicle || 'auto'}` });
      }
    };
    window.addEventListener('agendaSlotSelected', handleSlotSelected);
    return () => window.removeEventListener('agendaSlotSelected', handleSlotSelected);
  }, [form, toast]);

  const handleDownloadPdf = async () => {
    const element = document.getElementById('contract-preview-hidden');
    if (!element) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const values = form.getValues();
      const clientFileName = values.clientName.replace(/\s+/g, '_');
      
      const opt = {
        margin: [0.3, 0.7, 0.3, 0.3],
        filename: `Contrato_Borrador_${clientFileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', width: 820 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "Borrador de contrato descargado." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);

    try {
      const balance = values.courseValue - values.downPayment;
      const { clientName, clientEmail, ...detailsOnly } = values;

      const formattedTheoryDates = (values.theoreticalClassDates || []).map(d => Timestamp.fromDate(d));
      const formattedPracticalSchedules = (values.practicalClassSchedules || []).map(s => ({
        ...s,
        date: Timestamp.fromDate(s.date)
      }));
      const formattedMotoPracticalSchedules = (values.motoPracticalClassSchedules || []).map(s => ({
        ...s,
        date: Timestamp.fromDate(s.date)
      }));

      const finalRole = role || 'Sistema';

      if (isEdit && contract) {
        const contractRef = doc(db, 'contracts', contract.id);
        const updateData = {
          clientName: clientName,
          clientEmail: clientEmail,
          status: balance <= 0 ? 'completed' : (contract.status === 'draft' ? 'active' : contract.status),
          autoMotoDetails: {
            ...detailsOnly,
            paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
            theoreticalClassDates: formattedTheoryDates,
            practicalClassSchedules: formattedPracticalSchedules,
            motoPracticalClassSchedules: formattedMotoPracticalSchedules,
            balance: balance,
          },
          updatedAt: serverTimestamp(),
          updatedBy: finalRole,
        };

        await updateDoc(contractRef, updateData);
        toast({ title: 'Contrato Actualizado' });
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
            title: `Curso de Auto - Folio ${nextFolio}`,
            clientName: clientName,
            clientEmail: clientEmail,
            clientId: clientRef.id,
            folioNumber: nextFolio,
            type: 'Curso Auto',
            status: balance <= 0 ? 'completed' : 'active',
            userId: user.uid,
            createdBy: finalRole,
            createdAt: serverTimestamp(),
            activatedAt: serverTimestamp(), // Vital para reportes inmediatos
            autoMotoDetails: {
              ...detailsOnly,
              paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
              theoreticalClassDates: formattedTheoryDates,
              practicalClassSchedules: formattedPracticalSchedules,
              motoPracticalClassSchedules: formattedMotoPracticalSchedules,
              balance: balance,
            }
          });
        });
        toast({ title: 'Contrato Creado' });
        if (createdId) router.push(`/contracts/${createdId}`);
      }
    } catch (error: any) {
      console.error("Error saving contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = (Number(form.watch('courseValue')) || 0) - (Number(form.watch('downPayment')) || 0);
  const theoryDates = form.watch('theoreticalClassDates') || [];

  // Objeto de contrato simulado para la descarga de PDF
  const watchAll = form.watch();
  const dummyContractForPdf: any = {
    clientName: watchAll.clientName,
    clientEmail: watchAll.clientEmail,
    type: 'Curso Auto',
    folioNumber: contract?.folioNumber || 0,
    createdAt: contract?.createdAt || new Date(),
    createdBy: role || 'Sistema',
    autoMotoDetails: {
        ...watchAll,
        balance: currentBalance,
    }
  };

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
    toast({ variant: 'destructive', title: 'Campos Inválidos', description: 'Por favor, revisa y completa los campos obligatorios.' });
  };

  return (
    <>
      <div id="contract-preview-hidden" className="hidden">
          <AutoMotoContractTemplate contract={dummyContractForPdf} />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 max-w-5xl mx-auto pb-20">
          <Card className="border-t-4 border-t-blue-600 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Ficha Técnica del Estudiante</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-4 flex flex-col gap-4 justify-center md:justify-start">
                  <CameraCapture 
                    initialImage={form.getValues('photoDataUri')} 
                    onCapture={(uri) => form.setValue('photoDataUri', uri || '')} 
                    label="Foto del Estudiante"
                  />
                  <CameraCapture 
                    initialImage={form.getValues('idCardDataUri')} 
                    onCapture={(uri) => form.setValue('idCardDataUri', uri || '')} 
                    label="Cédula o Pasaporte"
                  />
                  <CameraCapture 
                    initialImage={form.getValues('licenseDataUri')} 
                    onCapture={(uri) => form.setValue('licenseDataUri', uri || '')} 
                    label="Licencia (Opcional)"
                  />
                </div>
                
                <div className="md:col-span-8 grid grid-cols-12 gap-4">
                  {/* Desglose del Nombre */}
                  <div className="col-span-12 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <FormField control={form.control} name={"firstName" as any} render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-muted-foreground">1er Nombre</FormLabel><FormControl><Input {...field} className="h-9 uppercase" onChange={e => { field.onChange(e.target.value.toUpperCase()); setTimeout(() => { const v = form.getValues(); const full=[v.firstName,v.secondName,v.firstLastName,v.secondLastName,v.marriedLastName].filter(Boolean).join(' '); if(full) form.setValue('clientName', full); }, 0); }} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name={"secondName" as any} render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-muted-foreground">2do Nombre</FormLabel><FormControl><Input {...field} className="h-9 uppercase" onChange={e => { field.onChange(e.target.value.toUpperCase()); setTimeout(() => { const v = form.getValues(); const full=[v.firstName,v.secondName,v.firstLastName,v.secondLastName,v.marriedLastName].filter(Boolean).join(' '); if(full) form.setValue('clientName', full); }, 0); }} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name={"firstLastName" as any} render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-muted-foreground">1er Apellido</FormLabel><FormControl><Input {...field} className="h-9 uppercase" onChange={e => { field.onChange(e.target.value.toUpperCase()); setTimeout(() => { const v = form.getValues(); const full=[v.firstName,v.secondName,v.firstLastName,v.secondLastName,v.marriedLastName].filter(Boolean).join(' '); if(full) form.setValue('clientName', full); }, 0); }} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name={"secondLastName" as any} render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-muted-foreground">2do Apellido</FormLabel><FormControl><Input {...field} className="h-9 uppercase" onChange={e => { field.onChange(e.target.value.toUpperCase()); setTimeout(() => { const v = form.getValues(); const full=[v.firstName,v.secondName,v.firstLastName,v.secondLastName,v.marriedLastName].filter(Boolean).join(' '); if(full) form.setValue('clientName', full); }, 0); }} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name={"marriedLastName" as any} render={({ field }) => (<FormItem><FormLabel className="text-[9px] font-bold uppercase text-muted-foreground">Ap. Casada</FormLabel><FormControl><Input {...field} className="h-9 uppercase" onChange={e => { field.onChange(e.target.value.toUpperCase()); setTimeout(() => { const v = form.getValues(); const full=[v.firstName,v.secondName,v.firstLastName,v.secondLastName,v.marriedLastName].filter(Boolean).join(' '); if(full) form.setValue('clientName', full); }, 0); }} /></FormControl></FormItem>)} />
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
                  <div className="col-span-4 md:col-span-3">
                    <FormField control={form.control} name="idType" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Tipo ID</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="Pasaporte">Pasaporte</SelectItem></SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <div className="col-span-8 md:col-span-9">
                    <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Número de Identificación</FormLabel>
                        <FormControl><Input placeholder="Ej: 8-000-000" {...field} className="h-9 font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="col-span-12 md:col-span-12">
                    <div className="space-y-2">
                      <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Teléfonos de Contacto</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                          <FormItem><FormControl><Input placeholder="Principal" {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="studentPhone2" render={({ field }) => (
                          <FormItem><FormControl><Input placeholder="Opcional" {...field} className="h-9" /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>
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
                          <SelectItem value="A, C, B">Tipo A, C, B (con Moto)</SelectItem>
                          <SelectItem value="A, C, B, D">Tipo A, C, B, D (con Moto)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                )} />
                <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Transmisión</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl><SelectTrigger className="h-10 bg-blue-50 border-blue-200"><SelectValue /></SelectTrigger></FormControl>
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

              {watchTheorySchedule && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-xs font-bold uppercase text-slate-700 flex items-center gap-2">
                    <BookOpen className="h-3 w-3" /> Programación de Sesiones Teóricas
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {theoryDates.map((_, i) => (
                      <FormField key={i} control={form.control} name={`theoreticalClassDates.${i}`} render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {i + 1}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className={cn("h-9 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>
                                  {field.value ? format(toDate(field.value), "dd/MM/yyyy") : <span>Elegir</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar 
                                mode="single" 
                                selected={field.value ? toDate(field.value) : undefined} 
                                onSelect={(date) => { if (date) field.onChange(date); }} 
                                initialFocus 
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )} />
                    ))}
                  </div>
                </div>
              )}
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
                      <SelectContent>{autoPlans.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="additionalService" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase flex items-center gap-1"><Plus className="h-3 w-3" /> Añadir (Moto)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Ninguno">Ninguno</SelectItem>
                        <SelectItem value="Ya se manejar Moto">Ya se manejar Moto (+B/.20)</SelectItem>
                        {watchPlan === "Curso Auto Plus (10 Hrs)" && (
                          <SelectItem value="Plus Moto 10Hrs">Plus Moto 10Hrs (Combo 310.00)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="paymentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago (Abono)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor del Contrato (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold bg-muted/30" readOnly={!isEdit} /></FormControl></FormItem>
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
                        <FormControl><Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(toDate(field.value), "PPP", { locale: es }) : <span>Elegir fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar 
                          mode="single" 
                          selected={field.value ? toDate(field.value) : undefined} 
                          onSelect={(date) => { if (date) field.onChange(date); }} 
                          initialFocus 
                        />
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Agenda de Clases Prácticas (AUTO)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              
              {!watchPlan ? (
                <p className="text-center text-muted-foreground italic py-4">Seleccione un plan de curso para programar las clases.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {practicalFields.map((field, index) => {
                    const watchDate = watchAll.practicalClassSchedules?.[index]?.date;
                    const watchTime = watchAll.practicalClassSchedules?.[index]?.time;
                    
                    const dObj = toDate(watchDate);
                    const isValidDate = !isNaN(dObj.getTime());
                    const holiday = isValidDate ? isPanamaHoliday(dObj) : null;
                    const isSunday = isValidDate && dObj.getDay() === 0;
                    
                    const safeWatchTime = String(watchTime || '');
                    const slotId = TIME_STRING_TO_SLOT_MAP[safeWatchTime] || safeWatchTime;
                    const dateKey = isValidDate ? format(dObj, 'yyyy-MM-dd') : '';
                    const occupancy = availabilityData?.globalCounts?.[`${dateKey}|${slotId}`] || 0;
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
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <FormLabel className="text-[10px] font-black uppercase text-slate-500">Clase {index + 1}</FormLabel>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                onClick={() => {
                                  // @ts-ignore
                                  window.__ACTIVE_SLOT_INDEX__ = index;
                                  window.dispatchEvent(new Event('openAvailabilityWidget'));
                                }}
                              >
                                <CalendarSearch className="h-3 w-3 mr-1" /> Libreta
                              </Button>
                            </div>
                            <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                              <FormItem>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl><Button variant="outline" className="h-9 w-full text-left font-normal text-xs">{f.value ? format(toDate(f.value), "dd/MM/yy") : "Fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                  </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar 
                                    mode="single" 
                                    selected={f.value ? toDate(f.value) : undefined} 
                                    onSelect={(date) => { if (date) f.onChange(date); }} 
                                    initialFocus 
                                  />
                                </PopoverContent>
                              </Popover>
                            </FormItem>
                          )} />
                          </div>
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-[10px] font-black uppercase text-slate-500 pt-1 block">Horario</FormLabel>
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

          {/* AGENDA MOTO (PARA COMBO) */}
          {watchAdditional === 'Plus Moto 10Hrs' && (
            <Card className="shadow-sm border-t-4 border-t-orange-600">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                  <Bike className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Agenda de Clases Prácticas (MOTO)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {motoPracticalFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-xl space-y-3 bg-white border-slate-200">
                      <div className="flex gap-4">
                        <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.date`} render={({ field: f }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión Moto {index + 1}</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl><Button variant="outline" className="h-9 w-full text-left font-normal text-xs">{f.value ? format(toDate(f.value), "dd/MM/yy") : 'Fecha'}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={f.value ? toDate(f.value) : undefined} onSelect={(date) => { if (date) f.onChange(date); }} initialFocus />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.time`} render={({ field: f }) => (
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
                        <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.vehicle`} render={({ field: f }) => (
                          <FormItem>
                            <Select onValueChange={f.onChange} value={f.value}>
                              <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Vehículo" /></SelectTrigger></FormControl>
                              <SelectContent>{VEHICLES_MOTO.map(v => <SelectItem key={v} value={v} className="text-[10px]">{v}</SelectItem>)}</SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`motoPracticalClassSchedules.${index}.instructor`} render={({ field: f }) => (
                          <FormItem>
                            <Select onValueChange={f.onChange} value={f.value}>
                              <FormControl><SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Instructor" /></SelectTrigger></FormControl>
                              <SelectContent>{INSTRUCTORS.map(i => <SelectItem key={i} value={i} className="text-[10px]">{i}</SelectItem>)}</SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-4">
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
            <Button 
              type="button" 
              variant="outline" 
              size="lg" 
              onClick={handleDownloadPdf} 
              disabled={isDownloading || !watchAll.clientName} 
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Descargar PDF
            </Button>
            <Button type="submit" size="lg" disabled={isSaving} className={cn("min-w-[220px]", isEdit ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700")}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEdit ? <RefreshCw className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {isEdit ? 'Actualizar Contrato' : 'Guardar Contrato de Auto'}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
