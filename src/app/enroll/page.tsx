'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '@/firebase/client';
import { useSettingsPrices } from '@/hooks/use-settings-prices';

import { StepPersonalInfo } from '@/components/enroll/step-personal-info';
import { StepCourseSelection } from '@/components/enroll/step-course-selection';
import { StepScheduleBooking } from '@/components/enroll/step-schedule-booking';
import { StepPayment } from '@/components/enroll/step-payment';
import { OrderSummarySidebar } from '@/components/enroll/order-summary-sidebar';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { 
  Car, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  MessageCircle, 
  Globe, 
  ShieldCheck, 
  Loader2
} from 'lucide-react';

// --- Mapeo de slots y ocupación ---
const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
  '08:00am a 10:00am': '8am-10am',
  '8:00am a 10:00am': '8am-10am',
  '10:00am a 12:00pm': '10am-12pm',
  '01:00pm a 03:00pm': '1pm-3pm',
  '1:00pm a 3:00pm': '1pm-3pm',
  '03:00pm a 05:00pm': '3pm-5pm',
  '3:00pm a 5:00pm': '3pm-5pm',
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function getSlotOccupancy(
  dateStr: string, 
  timeSlotId: string, 
  globalCounts: Record<string, number>, 
  blockedSlots?: Record<string, string>,
  slotCapacities?: Record<string, number>,
  transmissionCounts?: Record<string, Record<string, number>>,
  activeVehiclesByTransmission?: Record<string, number>,
  chosenTransmission?: string,
  prácticaSlots?: Record<string, boolean>,
  teóricoSlots?: Record<string, boolean>,
  prácticaCapacities?: Record<string, number>,
  teóricoCapacities?: Record<string, number>
) {
  if (!dateStr || !timeSlotId) {
    return { count: 0, max: 0, available: 0, isFull: false, isEmpty: true, label: 'Pendiente' };
  }
  
  const slotKey = TIME_STRING_TO_SLOT_MAP[timeSlotId] || timeSlotId;
  const gKey = `${dateStr}|${slotKey}`;
  const count = globalCounts[gKey] || 0;
  
  const dObj = new Date(dateStr + 'T12:00:00');
  const day = dObj.getDay();
  if (day === 0) {
    return { count, max: 0, available: 0, isFull: true, label: '🔴 (CERRADO - Domingo)' };
  }

  const dayName = DAY_NAMES[day];
  const bKey = `${dayName}|${slotKey}`;

  // Comportamiento por defecto
  const defaultPrácticaActive = (dayName !== 'Lunes' && dayName !== 'Sábado' && slotKey === '10am-12pm') || (dayName === 'Sábado' && slotKey === '3pm-5pm') ? false : true;

  // Determinar si Práctica está activo para este bloque
  let isPrácticaActive = defaultPrácticaActive;
  if (prácticaSlots && prácticaSlots[bKey] !== undefined) {
    isPrácticaActive = prácticaSlots[bKey];
  } else if (blockedSlots && blockedSlots[bKey] !== undefined) {
    isPrácticaActive = blockedSlots[bKey] === 'práctica';
  }

  if (!isPrácticaActive) {
    const defaultTeóricoActive = (dayName !== 'Lunes' && dayName !== 'Sábado' && slotKey === '10am-12pm') || (dayName === 'Sábado' && slotKey === '3pm-5pm') ? true : false;
    let isTeóricoActive = defaultTeóricoActive;
    if (teóricoSlots && teóricoSlots[bKey] !== undefined) {
      isTeóricoActive = teóricoSlots[bKey];
    } else if (blockedSlots && blockedSlots[bKey] !== undefined) {
      isTeóricoActive = blockedSlots[bKey] === 'teórico';
    }

    const label = isTeóricoActive ? '🔴 (RESERVADO PARA TEORÍA)' : '🔴 (NO DISPONIBLE)';
    return { count, max: 0, available: 0, isFull: true, label };
  }

  // Determinar capacidad de Práctica
  let max = 4;
  if (prácticaCapacities && prácticaCapacities[bKey] !== undefined) {
    max = prácticaCapacities[bKey];
  } else if (slotCapacities && slotCapacities[bKey] !== undefined) {
    max = slotCapacities[bKey];
  }

  // VALIDACIÓN POR TRANSMISIÓN ESPECÍFICA (AUTOMÁTICO / MANUAL / MOTO)
  if (chosenTransmission && activeVehiclesByTransmission && transmissionCounts) {
    const maxTrans = activeVehiclesByTransmission[chosenTransmission] || 99;
    const countTrans = transmissionCounts[gKey]?.[chosenTransmission] || 0;
    
    if (countTrans >= maxTrans) {
      let suffix = '';
      if (chosenTransmission === 'Automático') {
        suffix = '🔴 (SIN AUTOS AUTOMÁTICOS LIBRES)';
      } else if (chosenTransmission === 'Manual') {
        suffix = '🔴 (SIN AUTOS MANUALES LIBRES)';
      } else if (chosenTransmission === 'Moto') {
        suffix = '🔴 (SIN MOTOS DISPONIBLES)';
      } else {
        suffix = `🔴 (SIN ${chosenTransmission.toUpperCase()}S)`;
      }

      return { 
        count, 
        max, 
        available: 0, 
        isFull: true, 
        label: suffix
      };
    }
  }

  const available = Math.max(0, max - count);
  const isFull = available === 0;

  let label = `🟢 (${available} de ${max} libres)`;
  if (isFull) label = `🔴 (LLENO - 0 cupos)`;
  else if (available === 1) label = `🟡 (Último cupo de ${max})`;

  return { count, max, available, isFull, label, isEmpty: false };
}

// --- Esquema Zod ---
const enrollmentSchema = z.object({
  clientName: z.string().min(3, 'Ingresa tu nombre completo'),
  clientEmail: z.string().email('Email inválido'),
  studentIdNumber: z.string().min(5, 'Cédula / Pasaporte requerido'),
  studentAddress: z.string().min(5, 'Dirección residencial requerida'),
  studentPhone1: z.string().min(7, 'Número de celular requerido'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).default('Automático'),
  coursePlan: z.string().min(1, 'Selecciona un plan'),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date()).optional(),
  practicalClassSchedules: z.array(
    z.object({
      date: z.string().min(1, 'Fecha requerida'),
      time: z.string().min(1, 'Horario requerido')
    })
  ).optional(),
  practicalType: z.enum(['semanal', 'sabatino']).default('semanal'),
  paymentType: z.enum(['cash', 'yappy', 'cubo']).default('yappy'),
  yappyReference: z.string().optional(),
});

const THEORETICAL_SCHEDULES = [
  { id: 'Semanal 10:00 am a 12:00 pm', label: 'Semanal (10:00 AM - 12:00 PM)', desc: 'Martes a Viernes (4 días consecutivos)' },
  { id: 'Sabados 3:00 pm a 5:00 pm', label: 'Sábados (3:00 PM - 5:00 PM)', desc: '3 sábados consecutivos' }
];

const TIME_SLOTS = [
  { id: '08:00am a 10:00am', label: '08:00 AM - 10:00 AM' },
  { id: '10:00am a 12:00pm', label: '10:00 AM - 12:00 PM' },
  { id: '01:00pm a 03:00pm', label: '01:00 PM - 03:00 PM' },
  { id: '03:00pm a 05:00pm', label: '03:00 PM - 05:00 PM' }
];

export default function DynamicEnrollPage() {
  const { toast } = useToast();
  const { prices: settingsPrices } = useSettingsPrices();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{ folio: number; contractId: string; clientName: string; plan: string } | null>(null);
  const [voucherBase64, setVoucherBase64] = useState<string | null>(null);
  const [voucherMime, setVoucherMime] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [savedContractId, setSavedContractId] = useState<string | null>(null);
  const [savedFolio, setSavedFolio] = useState<number | null>(null);

  // Disponibilidad en tiempo real desde la API de ContractTime
  const [availability, setAvailability] = useState<{ 
    globalCounts: Record<string, number>; 
    blockedSlots?: Record<string, string>;
    slotCapacities?: Record<string, number>;
    transmissionCounts?: Record<string, Record<string, number>>;
    activeVehiclesByTransmission?: Record<string, number>;
    prácticaSlots?: Record<string, boolean>;
    teóricoSlots?: Record<string, boolean>;
    prácticaCapacities?: Record<string, number>;
    teóricoCapacities?: Record<string, number>;
  }>({ 
    globalCounts: {}, 
    blockedSlots: {}, 
    slotCapacities: {}, 
    transmissionCounts: {}, 
    activeVehiclesByTransmission: {},
    prácticaSlots: {},
    teóricoSlots: {},
    prácticaCapacities: {},
    teóricoCapacities: {}
  });

  useEffect(() => {
    fetch('/api/availability')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailability({ 
            globalCounts: data.globalCounts || {},
            blockedSlots: data.blockedSlots || {},
            slotCapacities: data.slotCapacities || {},
            transmissionCounts: data.transmissionCounts || {},
            activeVehiclesByTransmission: data.activeVehiclesByTransmission || {},
            prácticaSlots: data.prácticaSlots || {},
            teóricoSlots: data.teóricoSlots || {},
            prácticaCapacities: data.prácticaCapacities || {},
            teóricoCapacities: data.teóricoCapacities || {}
          });
        }
      })
      .catch(err => console.warn("Error fetching availability:", err));
  }, []);

  const form = useForm<z.infer<typeof enrollmentSchema>>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      vehicleTransmission: 'Automático',
      coursePlan: '',
      theoreticalClassSchedule: '',
      theoreticalClassDates: [],
      practicalClassSchedules: [],
      practicalType: 'semanal',
      paymentType: 'yappy',
      yappyReference: ''
    },
    mode: "onChange"
  });

  const { watch, setValue, control } = form;
  const currentValues = watch();

  const { fields, replace } = useFieldArray({
    control,
    name: 'practicalClassSchedules'
  });

  // Lista dinámica de planes utilizando los precios oficiales configurados en ContractTime
  const plansList = useMemo(() => {
    const isMoto = currentValues.vehicleTransmission === 'Moto';
    if (isMoto) {
      const motoPrices = settingsPrices?.moto || {};
      return [
        {
          title: "Básico (8 Hrs)",
          name: "Curso Moto Básico (8 Hrs)",
          hoursText: "8 Horas Prácticas",
          classCount: 4,
          price: motoPrices["Curso Moto Básico (8 Hrs)"] || 115,
          tag: "",
          desc: "4 clases prácticas de 2 horas cada una."
        },
        {
          title: "Plus (10 Hrs)",
          name: "Curso Moto Plus (10 Hrs)",
          hoursText: "10 Horas Prácticas",
          classCount: 5,
          price: motoPrices["Curso Moto Plus (10 Hrs)"] || 135,
          tag: "Más Popular",
          desc: "5 clases prácticas de 2 horas cada una."
        },
        {
          title: "Premium (12 Hrs)",
          name: "Curso Moto Premium (12 Hrs)",
          hoursText: "12 Horas Prácticas",
          classCount: 6,
          price: motoPrices["Curso Moto Premium (12 Hrs)"] || 155,
          tag: "Recomendado",
          desc: "6 clases prácticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (4 Hrs)",
          name: "Moto Reforzamiento 4 Hrs",
          hoursText: "4 Horas Prácticas",
          classCount: 2,
          price: motoPrices["Moto Reforzamiento 4 Hrs"] || 95,
          tag: "",
          desc: "2 clases prácticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (2 Hrs)",
          name: "Moto Reforzamiento 2 Hrs",
          hoursText: "2 Horas Prácticas",
          classCount: 1,
          price: motoPrices["Moto Reforzamiento 2 Hrs"] || 75,
          tag: "",
          desc: "1 clase práctica de 2 horas."
        },
        {
          title: "Ya sé manejar",
          name: "Ya se manejar (Moto)",
          hoursText: "Evaluación Práctica",
          classCount: 1,
          price: motoPrices["Ya se manejar (Moto)"] || 57,
          tag: "",
          desc: "1 sesión de evaluación de maniobra y parqueo."
        }
      ];
    } else {
      const autoPrices = settingsPrices?.auto || {};
      return [
        {
          title: "Básico (8 Hrs)",
          name: "Curso Auto Básico (8 Hrs)",
          hoursText: "8 Horas Prácticas",
          classCount: 4,
          price: autoPrices["Curso Auto Básico (8 Hrs)"] || 133,
          tag: "",
          desc: "4 clases prácticas de 2 horas cada una."
        },
        {
          title: "Plus (10 Hrs)",
          name: "Curso Auto Plus (10 Hrs)",
          hoursText: "10 Horas Prácticas",
          classCount: 5,
          price: autoPrices["Curso Auto Plus (10 Hrs)"] || 155,
          tag: "Más Popular",
          desc: "5 clases prácticas de 2 horas cada una."
        },
        {
          title: "Premium (12 Hrs)",
          name: "Curso Auto Premium (12 Hrs)",
          hoursText: "12 Horas Prácticas",
          classCount: 6,
          price: autoPrices["Curso Auto Premium (12 Hrs)"] || 180,
          tag: "Recomendado",
          desc: "6 clases prácticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (4 Hrs)",
          name: "Reforzamiento 4 Hrs",
          hoursText: "4 Horas Prácticas",
          classCount: 2,
          price: autoPrices["Reforzamiento 4 Hrs"] || 95,
          tag: "",
          desc: "2 clases prácticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (2 Hrs)",
          name: "Reforzamiento 2 Hrs",
          hoursText: "2 Horas Prácticas",
          classCount: 1,
          price: autoPrices["Reforzamiento 2 Hrs"] || 75,
          tag: "",
          desc: "1 clase práctica de 2 horas."
        },
        {
          title: "Ya sé manejar",
          name: "Ya se manejar",
          hoursText: "Evaluación Práctica",
          classCount: 1,
          price: autoPrices["Ya se manejar"] || 57,
          tag: "",
          desc: "1 sesión de evaluación de maniobra y parqueo."
        }
      ];
    }
  }, [settingsPrices, currentValues.vehicleTransmission]);

  const filteredTheoreticalSchedules = THEORETICAL_SCHEDULES;

  const selectedPlan = plansList.find(p => p.name === currentValues.coursePlan);

  // Generar las fechas para las N clases prácticas según el horario teórico seleccionado y la cantidad de clases del plan
  const practicalDays: Date[] = useMemo(() => {
    const count = selectedPlan?.classCount || 4;
    const scheduleId = currentValues.theoreticalClassSchedule;
    const dates: Date[] = [];
    const today = new Date();

    if (!scheduleId) {
      // Si aún no elige teoría, generar días hábiles a partir de mañana (sin domingos)
      let current = new Date(today);
      while (dates.length < count) {
        current = addDays(current, 1);
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0) {
          dates.push(new Date(current));
        }
      }
      return dates;
    }

    if (scheduleId.includes('Sabados')) {
      // Modalidad Sabatina: N sábados consecutivos
      let d = new Date(today);
      d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
      for (let i = 0; i < count; i++) {
        const next = new Date(d);
        next.setDate(d.getDate() + (i * 7));
        dates.push(next);
      }
    } else {
      // Modalidad Semanal: N días de Martes a Viernes
      let d = new Date(today);
      d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
      let current = new Date(d);
      while (dates.length < count) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek >= 2 && dayOfWeek <= 5) {
          dates.push(new Date(current));
        }
        current = addDays(current, 1);
      }
    }

    return dates;
  }, [selectedPlan, currentValues.theoreticalClassSchedule]);

  // Al cambiar de plan o días prácticos, inicializar la cantidad requerida de clases prácticas
  useEffect(() => {
    if (!selectedPlan || practicalDays.length === 0) return;

    const currentSchedules = form.getValues('practicalClassSchedules') || [];
    const newSchedules = practicalDays.map((dateObj, i) => {
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const existing = currentSchedules.find((s: any) => s.date === dateStr);
      return {
        date: dateStr,
        time: existing?.time || ''
      };
    });

    replace(newSchedules);
  }, [selectedPlan, practicalDays, replace, form]);

  // Asignar un horario a todas las clases en 1 clic
  const handleAssignAll = (slotId: string, count: number) => {
    const updated = practicalDays.map((dateObj) => ({
      date: format(dateObj, 'yyyy-MM-dd'),
      time: slotId
    }));

    setValue('practicalClassSchedules', updated, { shouldValidate: true, shouldDirty: true });
    toast({ title: "Horario Aplicado", description: `Se asignó el horario ${slotId} a tus ${count} clases prácticas.` });
  };

  // Autogenerar fechas de clases teóricas (4 días si semanal, 3 si sabatino)
  useEffect(() => {
    if (!currentValues.theoreticalClassSchedule) return;

    const dates: Date[] = [];
    const today = new Date();

    if (currentValues.theoreticalClassSchedule.includes('Sabados')) {
      let d = new Date(today);
      d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
      for (let i = 0; i < 3; i++) {
        const next = new Date(d);
        next.setDate(d.getDate() + (i * 7));
        dates.push(next);
      }
    } else {
      // Martes a Viernes (4 días)
      let d = new Date(today);
      d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
      for (let i = 0; i < 4; i++) {
        const next = new Date(d);
        next.setDate(d.getDate() + i);
        dates.push(next);
      }
    }

    setValue('theoreticalClassDates', dates, { shouldValidate: true });
  }, [currentValues.theoreticalClassSchedule, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El comprobante debe pesar menos de 5MB.",
        variant: "destructive"
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setVoucherBase64(reader.result as string);
      setVoucherMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const getAssignedSlotForDate = (dateStr: string) => {
    const schedules = currentValues.practicalClassSchedules || [];
    const item = schedules.find((s: any) => s.date === dateStr);
    return item?.time;
  };

  const handleSlotSelection = (dateStr: string, timeSlot: string) => {
    const schedules = [...(form.getValues('practicalClassSchedules') || [])];
    const index = schedules.findIndex((s: any) => s.date === dateStr);
    
    if (index >= 0) {
      schedules[index].time = timeSlot;
    } else {
      schedules.push({ date: dateStr, time: timeSlot });
    }
    
    setValue('practicalClassSchedules', schedules, { shouldValidate: true, shouldDirty: true });
  };

  // Pre-registro del contrato al pasar del paso 3 al paso 4
  const preRegisterContract = async () => {
    const data = form.getValues();
    const isMoto = data.vehicleTransmission === 'Moto';
    const price = selectedPlan?.price || 0;

    setIsSubmitting(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);

      const formattedPracticalSchedules = (data.practicalClassSchedules || []).map((s: any, idx: number) => ({
        classNumber: idx + 1,
        date: Timestamp.fromDate(new Date(s.date + 'T12:00:00')),
        time: s.time,
        instructor: '',
        vehicle: '',
        status: 'pending'
      }));

      if (savedContractId) {
        // Actualizar borrador existente
        const contractRef = doc(db, 'contracts', savedContractId);
        await updateDoc(contractRef, {
          title: `${isMoto ? 'Curso de Moto' : 'Curso de Auto'} - Folio ${savedFolio}`,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          studentIdNumber: data.studentIdNumber,
          studentAddress: data.studentAddress,
          studentPhone1: data.studentPhone1,
          contractType: isMoto ? 'Curso Moto' : 'Curso Auto',
          type: isMoto ? 'Curso Moto' : 'Curso Auto',
          totalAmount: price,
          pendingAmount: price,
          'autoMotoDetails.coursePlan': data.coursePlan,
          'autoMotoDetails.courseValue': price,
          'autoMotoDetails.balance': price,
          'autoMotoDetails.vehicleTransmission': data.vehicleTransmission,
          'autoMotoDetails.studentAddress': data.studentAddress,
          'autoMotoDetails.studentIdNumber': data.studentIdNumber,
          'autoMotoDetails.studentPhone1': data.studentPhone1,
          'autoMotoDetails.theoreticalClassSchedule': data.theoreticalClassSchedule || '',
          'autoMotoDetails.theoreticalClassDates': data.theoreticalClassDates ? data.theoreticalClassDates.map(d => Timestamp.fromDate(d)) : [],
          'autoMotoDetails.practicalClassSchedules': formattedPracticalSchedules,
          'autoMotoDetails.practicalType': data.practicalType
        });
        return true;
      }

      // Crear nuevo contrato en Firestore con Folio Oficial
      const newContractRef = doc(collection(db, 'contracts'));
      let assignedFolio = 18;

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contracts_folio');
        const counterDoc = await transaction.get(counterRef);
        assignedFolio = counterDoc.exists() ? Math.max(counterDoc.data().count + 1, 18) : 18;
        transaction.set(counterRef, { count: assignedFolio }, { merge: true });

        const contractData = {
          title: `${isMoto ? 'Curso de Moto' : 'Curso de Auto'} - Folio ${assignedFolio}`,
          folioNumber: assignedFolio,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          idType: 'C.I.P.',
          studentIdNumber: data.studentIdNumber,
          studentAddress: data.studentAddress,
          studentPhone1: data.studentPhone1,
          contractType: isMoto ? 'Curso Moto' : 'Curso Auto',
          type: isMoto ? 'Curso Moto' : 'Curso Auto',
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: data.paymentType,
          paymentReference: '',
          totalAmount: price,
          pendingAmount: price,
          payments: [],
          createdAt: serverTimestamp(),
          activatedAt: serverTimestamp(),
          createdBy: 'Inscripción Web',
          isOnline: true,
          source: 'online',
          autoMotoDetails: {
            coursePlan: data.coursePlan,
            courseValue: price,
            downPayment: 0,
            balance: price,
            paidInFull: false,
            vehicleTransmission: data.vehicleTransmission,
            studentAddress: data.studentAddress,
            studentIdNumber: data.studentIdNumber,
            studentPhone1: data.studentPhone1,
            theoreticalClassSchedule: data.theoreticalClassSchedule || '',
            theoreticalClassDates: data.theoreticalClassDates ? data.theoreticalClassDates.map(d => Timestamp.fromDate(d)) : [],
            practicalClassSchedules: formattedPracticalSchedules,
            practicalType: data.practicalType
          }
        };

        transaction.set(newContractRef, contractData);
      });

      setSavedContractId(newContractRef.id);
      setSavedFolio(assignedFolio);

      // Notificar al asesor vía WhatsApp
      fetch('/api/contracts/notify-new-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: assignedFolio,
          clientName: data.clientName,
          clientPhone: data.studentPhone1,
          clientEmail: data.clientEmail,
          coursePlan: data.coursePlan,
          vehicleTransmission: data.vehicleTransmission,
          theoreticalSchedule: data.theoreticalClassSchedule || '',
          practicalSchedules: (data.practicalClassSchedules || []).map((s: any) => ({
            date: s.date,
            time: s.time,
          })),
          contractId: newContractRef.id,
        })
      }).catch(err => console.error('Error notify-new-enrollment:', err));

      return true;
    } catch (error: any) {
      console.error("Error al pre-registrar cupo:", error);
      toast({ title: "Error de Inscripción", description: "No se pudo guardar la matrícula. Revisa tu conexión.", variant: "destructive" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const valid = await form.trigger(['clientName', 'studentIdNumber', 'clientEmail', 'studentPhone1', 'studentAddress']);
      if (!valid) {
        toast({ title: "Datos incompletos", description: "Por favor completa todos tus datos personales correctamente.", variant: "destructive" });
        return;
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 2) {
      const chosenPlan = form.getValues('coursePlan');
      if (!chosenPlan) {
        toast({ title: "Selecciona un plan", description: "Debes seleccionar uno de los planes disponibles para continuar.", variant: "destructive" });
        return;
      }
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 3) {
      const theoSchedule = form.getValues('theoreticalClassSchedule');
      if (!theoSchedule) {
        toast({ title: "Horario teórico requerido", description: "Por favor selecciona un horario para tus clases teóricas en el Punto 1.", variant: "destructive" });
        return;
      }

      const practicalSchedules = form.getValues('practicalClassSchedules') || [];
      const requiredCount = selectedPlan?.classCount || practicalDays.length;

      const unassigned = practicalSchedules.some(s => !s.date || !s.time);
      if (unassigned || practicalSchedules.length < requiredCount) {
        toast({ title: "Horarios prácticos incompletos", description: `Debes asignar el horario para las ${requiredCount} clases prácticas en el Punto 2.`, variant: "destructive" });
        return;
      }

      // Validar cupos en tiempo real
      for (let i = 0; i < practicalSchedules.length; i++) {
        const s = practicalSchedules[i];
        const occ = getSlotOccupancy(
          s.date,
          s.time,
          availability.globalCounts,
          availability.blockedSlots,
          availability.slotCapacities,
          availability.transmissionCounts,
          availability.activeVehiclesByTransmission,
          currentValues.vehicleTransmission,
          availability.prácticaSlots,
          availability.teóricoSlots,
          availability.prácticaCapacities,
          availability.teóricoCapacities
        );

        if (occ.isFull) {
          toast({
            title: "Horario lleno",
            description: `La Clase ${i + 1} (${s.date} a las ${s.time}) ya está llena. Elige otro horario.`,
            variant: "destructive"
          });
          return;
        }
      }

      const ok = await preRegisterContract();
      if (ok) {
        setStep(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast({
          title: "¡Cupo Reservado con Éxito!",
          description: "Tu cupo quedó registrado. Ahora adjunta tu comprobante de pago.",
        });
      }
    }
  };

  const handlePrevStep = () => {
    setStep(s => Math.max(1, s - 1) as any);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit final en Paso 4
  const onSubmit = async (data: z.infer<typeof enrollmentSchema>) => {
    if (!savedContractId) {
      toast({
        title: "Reserva no encontrada",
        description: "Regresando al paso anterior para verificar tu cupo...",
        variant: "destructive"
      });
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    try {
      const contractRef = doc(db, 'contracts', savedContractId);
      await updateDoc(contractRef, {
        status: 'active',
        paymentStatus: 'pending',
        paymentMethod: data.paymentType,
        paymentReference: data.yappyReference || '',
        'autoMotoDetails.paymentReference': data.yappyReference || ''
      });

      // Notificación al WhatsApp del Asesor
      fetch('/api/contracts/notify-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: savedFolio,
          clientName: data.clientName,
          clientPhone: data.studentPhone1,
          clientEmail: data.clientEmail,
          coursePlan: data.coursePlan,
          vehicleTransmission: data.vehicleTransmission,
          paymentAmount: selectedPlan?.price || 0,
          paymentMethod: data.paymentType,
          paymentReference: data.yappyReference || '',
          theoreticalSchedule: data.theoreticalClassSchedule || '',
          practicalSchedules: (data.practicalClassSchedules || []).map((s: any) => ({
            date: s.date,
            time: s.time,
          })),
          contractId: savedContractId,
          base64Image: voucherBase64,
          mimeType: voucherMime
        })
      }).catch(err => console.error("Error notify-advisor:", err));

      setSuccessData({
        folio: savedFolio || 0,
        contractId: savedContractId,
        clientName: data.clientName,
        plan: data.coursePlan
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error("Error al registrar pago:", error);
      toast({ title: "Error de Registro", description: "No se pudo actualizar el pago del contrato.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("Validation errors on submit:", errors);
    toast({
      title: "Formulario Incompleto",
      description: "Por favor completa todos los campos requeridos.",
      variant: "destructive"
    });
  };

  const currentPlanObj = plansList.find(p => p.name === currentValues.coursePlan);
  const total = currentPlanObj ? currentPlanObj.price : 0;

  if (successData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-3xl p-8 sm:p-12 max-w-xl w-full text-center shadow-2xl border border-slate-100 space-y-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-widest mb-2">
              <Globe className="w-3.5 h-3.5" /> Folio Oficial #{String(successData.folio).padStart(6, '0')}
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">¡Inscripción Confirmada!</h1>
            <p className="text-slate-500 mt-2">
              Bienvenido(a), <strong className="text-slate-800">{successData.clientName}</strong>. Tu contrato ya fue registrado formalmente en nuestro sistema.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left text-sm space-y-2 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Plan Inscrito:</span>
              <strong className="text-slate-900">{successData.plan}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Estado:</span>
              <strong className="text-emerald-600 font-bold">Activo / En Verificación</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Asesor Asignado:</span>
              <strong className="text-slate-900">Freeway Central</strong>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-400">
              Un asesor se comunicará contigo vía WhatsApp para confirmar los detalles de tu primera clase.
            </p>
            <a
              href={`https://wa.me/50763814115?text=${encodeURIComponent(
                `Hola, acabo de inscribirme en la web. Mi folio es el #${String(successData.folio).padStart(6, '0')} a nombre de ${successData.clientName} para el ${successData.plan}.`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" className="w-full h-12 text-base font-bold rounded-2xl border-emerald-500 text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                <MessageCircle className="w-5 h-5 mr-2" /> Contactar al Asesor por WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 pb-24 lg:pb-0">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto min-h-screen relative">
          
          {/* Main Content Area */}
          <div className="w-full lg:w-[65%] p-6 lg:p-12 xl:p-16 flex flex-col justify-between min-h-screen">
            <div>
              {/* Header / Logo */}
              <div className="mb-8 flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-600/25">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">ContractTime</h1>
                  <p className="text-xs font-bold text-blue-600 tracking-wider uppercase mt-1">Matrícula Online Oficial</p>
                </div>
              </div>

              {/* Stepper indicator */}
              <div className="flex items-center gap-2 mb-10">
                {[
                  { num: 1, label: 'Datos' },
                  { num: 2, label: 'Curso' },
                  { num: 3, label: 'Horarios' },
                  { num: 4, label: 'Pago' }
                ].map(({ num, label }) => (
                  <div key={num} className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        step === num 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-110 ring-4 ring-blue-100' 
                          : step > num 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-200 text-slate-400'
                      }`}>
                        {step > num ? <CheckCircle2 className="w-4 h-4" /> : num}
                      </div>
                      <span className={`text-xs font-bold hidden sm:inline ${step === num ? 'text-blue-600' : 'text-slate-400'}`}>
                        {label}
                      </span>
                    </div>
                    {num < 4 && (
                      <div className={`h-1 w-6 sm:w-12 rounded-full transition-colors duration-300 ${step > num ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Step Content */}
              <div className="flex-1 pb-12">
                <AnimatePresence mode="wait">
                  {step === 1 && <StepPersonalInfo key="step1" />}
                  {step === 2 && <StepCourseSelection key="step2" plans={plansList} />}
                  {step === 3 && (
                    <StepScheduleBooking 
                      key="step3" 
                      filteredTheoreticalSchedules={filteredTheoreticalSchedules}
                      currentValues={currentValues}
                      practicalDays={practicalDays}
                      timeSlots={TIME_SLOTS}
                      getSlotOccupancy={(d, s) => getSlotOccupancy(
                        d, 
                        s, 
                        availability.globalCounts, 
                        availability.blockedSlots, 
                        availability.slotCapacities, 
                        availability.transmissionCounts, 
                        availability.activeVehiclesByTransmission, 
                        currentValues.vehicleTransmission,
                        availability.prácticaSlots,
                        availability.teóricoSlots,
                        availability.prácticaCapacities,
                        availability.teóricoCapacities
                      )}
                      handleAssignAll={handleAssignAll}
                      getAssignedSlotForDate={getAssignedSlotForDate}
                      handleSlotSelection={handleSlotSelection}
                    />
                  )}
                  {step === 4 && (
                    <StepPayment 
                      key="step4"
                      total={total}
                      handleFileChange={handleFileChange}
                      voucherBase64={voucherBase64}
                      setVoucherBase64={setVoucherBase64}
                      setVoucherMime={setVoucherMime}
                      isSubmitting={isSubmitting}
                      submitForm={form.handleSubmit(onSubmit, onInvalid)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* STICKY BOTTOM NAVIGATION BAR (Always visible on any screen size) */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-4 px-6 -mx-6 -mb-6 lg:-mx-12 lg:-mb-12 xl:-mx-16 xl:-mb-16 z-40 flex items-center justify-between shadow-lg">
              {step > 1 ? (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePrevStep} 
                  className="h-12 px-6 rounded-2xl font-bold border-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Atrás
                </Button>
              ) : <div></div>}
              
              {step < 4 ? (
                <Button 
                  type="button" 
                  onClick={handleNextStep} 
                  disabled={isSubmitting}
                  className="h-12 px-8 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 text-sm tracking-wide cursor-pointer transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                    </>
                  ) : step === 1 ? (
                    <>
                      Siguiente: Elegir Plan <ChevronRight className="w-5 h-5 ml-1.5" />
                    </>
                  ) : step === 2 ? (
                    <>
                      Siguiente: Elegir Horarios <ChevronRight className="w-5 h-5 ml-1.5" />
                    </>
                  ) : (
                    <>
                      Continuar al Pago <ChevronRight className="w-5 h-5 ml-1.5" />
                    </>
                  )}
                </Button>
              ) : null}
            </div>
            
            {/* Footer */}
            <div className="mt-8 text-center pb-4 text-slate-400">
              <p className="text-xs font-semibold">© 2026 Freeway Escuela de Manejo. Todos los derechos reservados.</p>
              <p className="text-[11px] mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Transacciones seguras y encriptadas de extremo a extremo
              </p>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="w-full lg:w-[35%] bg-slate-900 lg:min-h-screen p-6 lg:p-12 relative overflow-hidden flex flex-col justify-start">
            <div className="lg:sticky lg:top-12">
              <OrderSummarySidebar 
                total={total}
                plans={plansList}
                filteredTheoreticalSchedules={filteredTheoreticalSchedules}
              />
            </div>
          </div>

        </form>
      </Form>
    </div>
  );
}
