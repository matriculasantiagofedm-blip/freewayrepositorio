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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  Car, 
  CheckCircle2, 
  CreditCard, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  IdCard,
  User,
  Phone,
  Mail,
  ShieldCheck,
  ChevronRight,
  Info,
  Globe,
  FileText,
  MessageCircle,
  AlertCircle,
  CalendarSearch,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

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

const getGlobalCapacity = (dObj: Date, slotId: string, blockedSlots?: Record<string, string>, slotCapacities?: Record<string, number>) => {
  const day = dObj.getDay(); 
  if (day === 0) return 0; // Domingo cerrado
  
  const dayName = DAY_NAMES[day];
  const bKey = `${dayName}|${slotId}`;

  if (slotCapacities?.[bKey] !== undefined) {
    return slotCapacities[bKey];
  }

  const customStatus = blockedSlots?.[bKey];

  if (customStatus === 'bloqueado') return 0; // Bloqueado / No disponible
  if (customStatus === 'teorico') return 3; // Clase Teórica (1 instructor ocupado)
  if (customStatus === 'practica') return 4; // Práctica normal

  if (day >= 2 && day <= 5 && slotId === '10am-12pm') return 3; // Martes a Viernes 10am-12pm (Teoría)
  if (day === 6 && slotId === '3pm-5pm') return 3; // Sábado 3pm-5pm (Teoría)
  return 4; 
};

function getSlotOccupancy(
  dateStr: string, 
  timeSlotId: string, 
  globalCounts: Record<string, number>, 
  blockedSlots?: Record<string, string>,
  slotCapacities?: Record<string, number>,
  transmissionCounts?: Record<string, Record<string, number>>,
  activeVehiclesByTransmission?: Record<string, number>,
  chosenTransmission?: string,
  practicaSlots?: Record<string, boolean>,
  teoricoSlots?: Record<string, boolean>,
  practicaCapacities?: Record<string, number>,
  teoricoCapacities?: Record<string, number>
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
  const defaultPracticaActive = (dayName !== 'Lunes' && dayName !== 'Sábado' && slotKey === '10am-12pm') || (dayName === 'Sábado' && slotKey === '3pm-5pm') ? false : true;

  // Determinar si Práctica está activo para este bloque
  let isPracticaActive = defaultPracticaActive;
  if (practicaSlots && practicaSlots[bKey] !== undefined) {
    isPracticaActive = practicaSlots[bKey];
  } else if (blockedSlots && blockedSlots[bKey] !== undefined) {
    isPracticaActive = blockedSlots[bKey] === 'practica';
  }

  if (!isPracticaActive) {
    const defaultTeoricoActive = (dayName !== 'Lunes' && dayName !== 'Sábado' && slotKey === '10am-12pm') || (dayName === 'Sábado' && slotKey === '3pm-5pm') ? true : false;
    let isTeoricoActive = defaultTeoricoActive;
    if (teoricoSlots && teoricoSlots[bKey] !== undefined) {
      isTeoricoActive = teoricoSlots[bKey];
    } else if (blockedSlots && blockedSlots[bKey] !== undefined) {
      isTeoricoActive = blockedSlots[bKey] === 'teorico';
    }

    const label = isTeoricoActive ? '🔴 (RESERVADO PARA CLASE TEÓRICA)' : '🔴 (NO DISPONIBLE / BLOQUEADO)';
    return { count, max: 0, available: 0, isFull: true, label };
  }

  // Determinar capacidad de Práctica
  let max = 4;
  if (practicaCapacities && practicaCapacities[bKey] !== undefined) {
    max = practicaCapacities[bKey];
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
        suffix = '🔴 (SIN CARROS AUTOMÁTICOS DISPONIBLES)';
      } else if (chosenTransmission === 'Manual') {
        suffix = '🔴 (SIN CARROS MANUALES DISPONIBLES)';
      } else if (chosenTransmission === 'Moto') {
        suffix = '🔴 (SIN MOTOS DISPONIBLES)';
      } else {
        suffix = `🔴 (SIN ${chosenTransmission.toUpperCase()}S DISPONIBLES)`;
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

  let label = `🟢 (${available} de ${max} cupos libres)`;
  if (isFull) label = `🔴 (LLENO - 0 cupos)`;
  else if (available === 1) label = `🟡 (Último cupo de ${max})`;

  return { count, max, available, isFull, label, isEmpty: false };
}

// --- Esquema Zod ---
const enrollmentSchema = z.object({
  clientName: z.string().min(3, 'Ingresa tu nombre completo'),
  clientEmail: z.string().email('Email inválido'),
  studentIdNumber: z.string().min(5, 'Cédula / ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).default('Automático'),
  coursePlan: z.string().min(1, "Selecciona un plan"),
  theoreticalClassSchedule: z.string().optional(),
  theoreticalClassDates: z.array(z.date()).optional(),
  practicalClassSchedules: z.array(
    z.object({
      date: z.string().min(1, "Fecha requerida"),
      time: z.string().min(1, "Horario requerido")
    })
  ).optional(),
  practicalType: z.enum(['semanal', 'sabatino']).default('semanal'),
  paymentType: z.enum(['cash', 'yappy', 'cubo']).default('cash'),
  yappyReference: z.string().optional(),
});

const THEORETICAL_SCHEDULES = [
  { id: 'Sabados 3:00 pm a 5:00 pm', label: 'Sábados (3:00 PM - 5:00 PM)', desc: '3 sábados consecutivos' },
  { id: 'Semanal 10:00 am a 12:00 pm', label: 'Semanal (10:00 AM - 12:00 PM)', desc: 'Lunes a Miércoles' }
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
  const [step, setStep] = useState<1 | 2>(1);
  const [savedContractId, setSavedContractId] = useState<string | null>(null);
  const [savedFolio, setSavedFolio] = useState<number | null>(null);

  // Disponibilidad en tiempo real desde la API de ContractTime
  const [availability, setAvailability] = useState<{ 
    globalCounts: Record<string, number>; 
    blockedSlots?: Record<string, string>;
    slotCapacities?: Record<string, number>;
    transmissionCounts?: Record<string, Record<string, number>>;
    activeVehiclesByTransmission?: Record<string, number>;
    practicaSlots?: Record<string, boolean>;
    teoricoSlots?: Record<string, boolean>;
    practicaCapacities?: Record<string, number>;
    teoricoCapacities?: Record<string, number>;
  }>({ 
    globalCounts: {}, 
    blockedSlots: {}, 
    slotCapacities: {}, 
    transmissionCounts: {}, 
    activeVehiclesByTransmission: {},
    practicaSlots: {},
    teoricoSlots: {},
    practicaCapacities: {},
    teoricoCapacities: {}
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
            practicaSlots: data.practicaSlots || {},
            teoricoSlots: data.teoricoSlots || {},
            practicaCapacities: data.practicaCapacities || {},
            teoricoCapacities: data.teoricoCapacities || {}
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
          desc: "2 clases prácticas de 2 horas."
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

  const filteredTheoreticalSchedules = useMemo(() => {
    const checkIsTeoricoActive = (day: string, slotId: string) => {
      const bKey = `${day}|${slotId}`;
      const defaultTeoricoActive = (day !== 'Lunes' && day !== 'Sábado' && slotId === '10am-12pm') || (day === 'Sábado' && slotId === '3pm-5pm') ? true : false;
      
      if (availability.teoricoSlots && availability.teoricoSlots[bKey] !== undefined) {
        return availability.teoricoSlots[bKey];
      } else if (availability.blockedSlots && availability.blockedSlots[bKey] !== undefined) {
        return availability.blockedSlots[bKey] === 'teorico';
      }
      return defaultTeoricoActive;
    };

    return THEORETICAL_SCHEDULES.filter(sch => {
      // 1. Sábados 3:00 pm a 5:00 pm
      if (sch.id === 'Sabados 3:00 pm a 5:00 pm') {
        return checkIsTeoricoActive('Sábado', '3pm-5pm');
      }
      
      // 2. Semanal 10:00 am a 12:00 pm
      if (sch.id === 'Semanal 10:00 am a 12:00 pm') {
        const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        return weekdays.some(day => checkIsTeoricoActive(day, '10am-12pm'));
      }
      
      return true;
    });
  }, [availability.teoricoSlots, availability.blockedSlots]);

  const selectedPlan = plansList.find(p => p.name === currentValues.coursePlan);

  // Al cambiar modalidad (semanal / sabatino), limpiar fechas inválidas
  useEffect(() => {
    const type = currentValues.practicalType || 'semanal';
    const schedules = form.getValues('practicalClassSchedules') || [];
    
    let changed = false;
    const updated = schedules.map((s: any) => {
      if (!s.date) return s;
      const dateObj = new Date(s.date + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      
      let shouldReset = false;
      if (dayOfWeek === 0) shouldReset = true;
      else if (type === 'semanal' && dayOfWeek === 6) shouldReset = true;
      else if (type === 'sabatino' && dayOfWeek !== 6) shouldReset = true;
      
      if (shouldReset) {
        changed = true;
        return { ...s, date: '', time: '' };
      }
      return s;
    });
    
    if (changed) {
      setValue('practicalClassSchedules', updated);
      toast({
        title: "Fechas restablecidas",
        description: "Se han limpiado las fechas que no corresponden a la nueva modalidad del curso.",
      });
    }
  }, [currentValues.practicalType, setValue, form]);

  // Al cambiar de plan, crear dinámicamente las N clases requeridas
  useEffect(() => {
    if (!selectedPlan) return;

    const count = selectedPlan.classCount || 1;
    const baseDate = new Date();

    const newSchedules = Array.from({ length: count }, (_, i) => {
      const classDate = addDays(baseDate, i + 1);
      return {
        date: format(classDate, 'yyyy-MM-dd'),
        time: ''
      };
    });

    replace(newSchedules);
  }, [selectedPlan, replace]);

  // Aplicar un mismo horario a todas las clases en 1 clic
  const handleApplySameTime = (timeSlot: string) => {
    const count = selectedPlan?.classCount || 1;
    const baseDate = new Date();

    const updated = fields.map((fieldItem: any, idx: number) => ({
      date: fieldItem.date || format(addDays(baseDate, idx + 1), 'yyyy-MM-dd'),
      time: timeSlot
    }));

    replace(updated);
    toast({ title: "Horario Aplicado", description: `Asignado ${timeSlot} a las ${count} clases.` });
  };

  // Autogenerar 3 fechas de clases teóricas si selecciona horario
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
      let d = new Date(today);
      d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
      for (let i = 0; i < 3; i++) {
        const next = new Date(d);
        next.setDate(d.getDate() + i);
        dates.push(next);
      }
    }

    setValue('theoreticalClassDates', dates);
  }, [currentValues.theoreticalClassSchedule, setValue]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El comprobante debe pesar menos de 5MB",
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

  const onSubmit = async (data: z.infer<typeof enrollmentSchema>) => {
    if (step === 1) {
      // Validar que no haya domingos y que todos los cupos seleccionados estén disponibles
      const selectedSchedules = data.practicalClassSchedules || [];
      for (let i = 0; i < selectedSchedules.length; i++) {
        const s = selectedSchedules[i];
        if (!s.date || !s.time) {
          toast({
            title: "Horario incompleto",
            description: `Por favor selecciona la fecha y hora para la Clase ${i + 1}.`,
            variant: "destructive"
          });
          return;
        }

        const dateObj = new Date(s.date + 'T12:00:00');
        if (dateObj.getDay() === 0) {
          toast({
            title: "Día no laborable",
            description: `La Clase ${i + 1} está programada para un domingo. Por favor selecciona otro día.`,
            variant: "destructive"
          });
          return;
        }

        const occ = getSlotOccupancy(
          s.date,
          s.time,
          availability.globalCounts,
          availability.blockedSlots,
          availability.slotCapacities,
          availability.transmissionCounts,
          availability.activeVehiclesByTransmission,
          data.vehicleTransmission,
          availability.practicaSlots,
          availability.teoricoSlots,
          availability.practicaCapacities,
          availability.teoricoCapacities
        );

        if (occ.isFull) {
          toast({
            title: "Horario ya reservado",
            description: `La Clase ${i + 1} (${s.date} a las ${s.time}) ya se encuentra llena o reservada. Por favor selecciona otro horario.`,
            variant: "destructive"
          });
          return;
        }
      }

      setIsSubmitting(true);
      try {
        if (!auth.currentUser) await signInAnonymously(auth);

        const isMoto = data.vehicleTransmission === 'Moto';

        if (savedContractId) {
          // El contrato ya existe en borrador, simplemente lo actualizamos
          const contractRef = doc(db, 'contracts', savedContractId);
          
          const price = selectedPlan?.price || 0;
          const formattedPracticalSchedules = (data.practicalClassSchedules || []).map((s: any, idx: number) => ({
            classNumber: idx + 1,
            date: Timestamp.fromDate(new Date(s.date + 'T12:00:00')),
            time: s.time,
            instructor: '',
            vehicle: '',
            status: 'pending'
          }));

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

          setStep(2);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast({
            title: "Inscripción Actualizada",
            description: "Tus datos y horarios han sido actualizados en la reserva.",
          });
          setIsSubmitting(false);
          return;
        }

        const newContractRef = doc(collection(db, 'contracts'));
        let assignedFolio = 18;

        await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, 'counters', 'contracts_folio');
          const counterDoc = await transaction.get(counterRef);
          assignedFolio = counterDoc.exists() ? Math.max(counterDoc.data().count + 1, 18) : 18;
          transaction.set(counterRef, { count: assignedFolio }, { merge: true });

          const price = selectedPlan?.price || 0;

          const formattedPracticalSchedules = (data.practicalClassSchedules || []).map((s: any, idx: number) => ({
            classNumber: idx + 1,
            date: Timestamp.fromDate(new Date(s.date + 'T12:00:00')),
            time: s.time,
            instructor: '',
            vehicle: '',
            status: 'pending'
          }));

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
            status: 'active',
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
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast({
          title: "¡Cupo Reservado!",
          description: "Tu cupo ha sido pre-registrado en el sistema. Procede a realizar tu pago.",
        });
      } catch (error: any) {
        console.error("Error al pre-registrar cupo:", error);
        toast({ title: "Error de Inscripción", description: "No se pudo guardar la matrícula. Revisa tu conexión.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // step === 2
      if (data.paymentType === 'yappy' && !data.yappyReference) {
        toast({
          title: "Referencia de Yappy requerida",
          description: "Por favor ingresa el número de referencia de tu pago por Yappy.",
          variant: "destructive"
        });
        return;
      }

      if (data.paymentType === 'cubo' && !data.yappyReference) {
        toast({
          title: "Referencia de pago requerida",
          description: "Por favor ingresa el número de referencia de tu transacción por tarjeta / Cubo.",
          variant: "destructive"
        });
        return;
      }

      if (!savedContractId) {
        toast({
          title: "Contrato no encontrado",
          description: "No encontramos tu número de registro previo. Por favor contacta soporte.",
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const contractRef = doc(db, 'contracts', savedContractId);
        await updateDoc(contractRef, {
          paymentMethod: data.paymentType,
          paymentReference: data.yappyReference || '',
          'autoMotoDetails.paymentReference': data.yappyReference || ''
        });

        // Notificación automática al WhatsApp del Asesor con referencia e imagen si hay
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
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("Validation errors on submit:", errors);
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0]];
      let message = "Por favor revisa todos los campos obligatorios.";
      
      if (firstError.message) {
        message = firstError.message;
      } else if (firstError.root?.message) {
        message = firstError.root.message;
      } else if (typeof firstError === 'object') {
        const subKeys = Object.keys(firstError);
        if (subKeys.length > 0 && firstError[subKeys[0]]?.message) {
          message = firstError[subKeys[0]].message;
        } else if (Array.isArray(firstError)) {
          const firstElem = firstError.find(Boolean);
          if (firstElem) {
            const innerKeys = Object.keys(firstElem);
            if (innerKeys.length > 0 && firstElem[innerKeys[0]]?.message) {
              message = firstElem[innerKeys[0]].message;
            }
          }
        }
      }
      
      toast({
        title: "Formulario Incompleto",
        description: message,
        variant: "destructive"
      });

      setTimeout(() => {
        const firstInvalidElement = document.querySelector('[aria-invalid="true"], .text-destructive, input[required]:invalid');
        if (firstInvalidElement) {
          firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-3xl p-8 sm:p-12 max-w-xl w-full text-center shadow-2xl border border-slate-100 space-y-6">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 uppercase tracking-widest mb-2">
              <Globe className="w-3.5 h-3.5" /> Folio Oficial #{String(successData.folio).padStart(6, '0')}
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">¡Inscripción Confirmada!</h1>
            <p className="text-slate-500 mt-2">
              Bienvenido(a), <strong className="text-slate-800">{successData.clientName}</strong>. Tu contrato ya fue registrado formalmente en nuestro sistema.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Plan Seleccionado:</span>
              <span className="font-bold text-slate-900">{successData.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Número de Folio:</span>
              <span className="font-bold text-blue-700">#{String(successData.folio).padStart(6, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Estado del Registro:</span>
              <span className="font-bold text-green-600">Activo en Base de Datos</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-400 font-medium">
              Por favor, ponte en contacto con tu asesor por WhatsApp para activar tu plan y coordinar el inicio de tus clases.
            </p>
            <a
              href={`https://wa.me/50763814115?text=${encodeURIComponent(
                `Hola, acabo de inscribirme en la web. Mi folio es el #${String(successData.folio).padStart(6, '0')} a nombre de ${successData.clientName} para el ${successData.plan}.`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" className="w-full h-12 text-base font-bold rounded-xl border-emerald-500 text-emerald-700 hover:bg-emerald-50">
                <MessageCircle className="w-5 h-5 mr-2" /> Contactar por WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO INTERACTIVO */}
          <div className="w-full lg:w-[65%] p-6 lg:p-12 xl:p-16">
            <div className="max-w-3xl mx-auto space-y-12">
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white font-bold text-xs gap-1">
                    <Globe className="w-3.5 h-3.5" /> MATRÍCULA ONLINE CONTRACTTIME
                  </Badge>
                </div>
                <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">Inscripción Online</h1>
                <p className="text-lg text-slate-500">Selecciona tu plan y verifica disponibilidad de cupos por cada fecha en tiempo real.</p>
              </div>

              {step === 1 && (
                <>
                  {/* SECCIÓN 1: DATOS PERSONALES */}
              <section className="space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">1</div>
                  <h2 className="text-lg font-bold text-slate-800">Tus Datos Personales</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem>
                      <Label className="text-slate-600 font-semibold text-xs ml-1">Nombre Completo</Label>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input {...field} className="h-11 pl-10 rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-blue-600 text-sm" placeholder="Ej. Juan Pérez" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                    <FormItem>
                      <Label className="text-slate-600 font-semibold text-xs ml-1">Cédula / Pasaporte</Label>
                      <FormControl>
                        <div className="relative">
                          <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input {...field} className="h-11 pl-10 rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-blue-600 text-sm" placeholder="8-000-0000" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="clientEmail" render={({ field }) => (
                    <FormItem>
                      <Label className="text-slate-600 font-semibold text-xs ml-1">Correo Electrónico</Label>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input {...field} className="h-11 pl-10 rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-blue-600 text-sm" placeholder="correo@ejemplo.com" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                    <FormItem>
                      <Label className="text-slate-600 font-semibold text-xs ml-1">Celular (WhatsApp)</Label>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input {...field} className="h-11 pl-10 rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-blue-600 text-sm" placeholder="6000-0000" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="studentAddress" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <Label className="text-slate-600 font-semibold text-xs ml-1">Dirección Residencial</Label>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input {...field} className="h-11 pl-10 rounded-xl bg-white border-slate-200 shadow-2xs focus-visible:ring-blue-600 text-sm" placeholder="Barrio, Calle, Casa..." />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </section>

              {/* SECCIÓN 2: PLAN Y VEHÍCULO */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">2</div>
                  <h2 className="text-lg font-bold text-slate-800">Selección de Curso y Plan</h2>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold text-xs ml-1">Transmisión del Vehículo</Label>
                  <div className="flex gap-3">
                    {['Automático', 'Manual', 'Moto'].map((type) => (
                      <div 
                        key={type}
                        onClick={() => {
                          setValue('vehicleTransmission', type as any);
                          setValue('coursePlan', ''); // Limpiar para obligar a elegir un plan correcto
                        }}
                        className={`flex-1 py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 ${currentValues.vehicleTransmission === type ? 'border-blue-600 bg-blue-50/20 text-blue-900 font-bold shadow-2xs' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600 font-semibold'}`}
                      >
                        <Car className={`w-4 h-4 ${currentValues.vehicleTransmission === type ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-sm">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold text-xs ml-1">Planes Disponibles (Ajusta Clases Requeridas)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {plansList.map((plan) => (
                      <div 
                        key={plan.name}
                        onClick={() => setValue('coursePlan', plan.name)}
                        className={`relative cursor-pointer rounded-xl border p-4 transition-all duration-200 flex flex-col ${currentValues.coursePlan === plan.name ? 'border-blue-600 bg-blue-50/5 ring-1 ring-blue-600/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        {plan.tag && (
                          <div className={`absolute -top-2.5 left-4 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${currentValues.coursePlan === plan.name ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {plan.tag}
                          </div>
                        )}
                        <h3 className={`text-sm font-bold mb-0.5 mt-1.5 ${currentValues.coursePlan === plan.name ? 'text-blue-900' : 'text-slate-800'}`}>{plan.title}</h3>
                        <p className="text-[11px] font-semibold text-blue-700 mb-2">{plan.hoursText} ({plan.classCount} Clases)</p>
                        <div className="mt-auto">
                          <span className="text-lg font-black text-slate-900">${plan.price}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{plan.desc}</p>
                      </div>
                    ))}
                  </div>
                  {form.formState.errors.coursePlan && <p className="text-red-500 text-xs font-medium mt-1">{form.formState.errors.coursePlan.message}</p>}
                </div>
              </section>

              {/* SECCIÓN 3: AGENDA TEÓRICA */}
              {!currentValues.coursePlan?.includes('Reforzamiento') && !currentValues.coursePlan?.includes('manejar') && filteredTheoreticalSchedules.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">3</div>
                    <h2 className="text-lg font-bold text-slate-800">Horario Teórico Presencial</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTheoreticalSchedules.map((sched) => (
                      <div 
                        key={sched.id}
                        onClick={() => setValue('theoreticalClassSchedule', sched.id)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 flex flex-col gap-1.5 ${currentValues.theoreticalClassSchedule === sched.id ? 'border-blue-600 bg-blue-50/20 shadow-2xs' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className={`w-4 h-4 ${currentValues.theoreticalClassSchedule === sched.id ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className={`font-bold text-sm leading-tight ${currentValues.theoreticalClassSchedule === sched.id ? 'text-blue-900' : 'text-slate-700'}`}>{sched.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 ml-7">{sched.desc}</p>
                      </div>
                    ))}
                  </div>

                  {currentValues.theoreticalClassDates && currentValues.theoreticalClassDates.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex gap-4 items-center">
                      <div className="w-10 h-10 bg-white rounded-lg shadow-2xs border border-slate-200 flex items-center justify-center shrink-0">
                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 text-xs mb-1.5">Fechas Teóricas Asignadas:</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {currentValues.theoreticalClassDates.map((d, i) => (
                            <span key={i} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 shadow-2xs">
                              {format(d, "EEE d MMM", { locale: es })}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* SECCIÓN 4: AGENDA DE CADA CLASE PRÁCTICA INDIVIDUAL */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">4</div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Agenda de Clases Prácticas ({selectedPlan ? `${selectedPlan.classCount} Clases` : 'Selecciona un Plan'})
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const event = new CustomEvent('openAvailabilityWidget');
                      window.dispatchEvent(event);
                    }}
                    className="gap-1.5 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50 h-8"
                  >
                    <CalendarSearch className="w-3.5 h-3.5 text-blue-600" /> Ver Libreta Completa en Vivo
                  </Button>
                </div>

                {!selectedPlan ? (
                  <div className="p-8 text-center bg-slate-100 rounded-2xl text-slate-500 font-medium border border-dashed border-slate-300">
                    👆 Selecciona arriba un Plan de Curso para habilitar las fechas y horarios de cada clase.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Selector de Modalidad (Semanal / Sabatino) */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 shadow-2xs">
                      <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        📅 Modalidad del Curso Práctico
                      </Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setValue('practicalType', 'semanal')}
                          className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                            currentValues.practicalType === 'semanal'
                              ? 'border-blue-600 bg-blue-50/50 text-blue-800 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          💼 Semanal (Lun a Vie)
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue('practicalType', 'sabatino')}
                          className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                            currentValues.practicalType === 'sabatino'
                              ? 'border-blue-600 bg-blue-50/50 text-blue-800 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          🎉 Sabatino (Sábados)
                        </button>
                      </div>
                    </div>

                    {/* ACORDEÓN DE CLASES PRÁCTICAS */}
                    <Accordion type="single" collapsible defaultValue="class-0" className="space-y-2.5">
                      {fields.map((fieldItem: any, index: number) => {
                        const classDate = form.watch(`practicalClassSchedules.${index}.date`);
                        const classTime = form.watch(`practicalClassSchedules.${index}.time`) || '';
                        const chosenTransmission = form.watch('vehicleTransmission');
                        const currentSlotOcc = getSlotOccupancy(
                          classDate || '', 
                          classTime, 
                          availability.globalCounts, 
                          availability.blockedSlots, 
                          availability.slotCapacities,
                          availability.transmissionCounts,
                          availability.activeVehiclesByTransmission,
                          chosenTransmission,
                          availability.practicaSlots,
                          availability.teoricoSlots,
                          availability.practicaCapacities,
                          availability.teoricoCapacities
                        );

                        const dateFormatted = classDate 
                          ? format(new Date(classDate + 'T12:00:00'), "EEE dd/MM", { locale: es }) 
                          : null;

                        return (
                          <AccordionItem 
                            key={fieldItem.id} 
                            value={`class-${index}`}
                            className={`bg-white border rounded-xl shadow-2xs transition-colors overflow-hidden ${currentSlotOcc.isFull ? 'border-red-200 bg-red-50/5' : 'border-slate-200 hover:border-blue-200'}`}
                          >
                            <AccordionTrigger className="hover:no-underline px-4 py-3 text-left">
                              <div className="flex items-center justify-between w-full pr-4 gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                    #{index + 1}
                                  </div>
                                  <span className="font-bold text-slate-800 text-xs shrink-0">Clase {index + 1}</span>
                                  {dateFormatted && classTime && (
                                    <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded ml-2 hidden sm:inline-block">
                                      📅 {dateFormatted} — ⏰ {classTime}
                                    </span>
                                  )}
                                </div>

                                <div className="shrink-0">
                                  {currentSlotOcc.isEmpty ? (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 text-[10px] font-medium px-1.5 py-0">
                                      ⚪ Por programar
                                    </Badge>
                                  ) : currentSlotOcc.isFull ? (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold px-1.5 py-0">
                                      {currentSlotOcc.label}
                                    </Badge>
                                  ) : currentSlotOcc.available === 1 ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-bold px-1.5 py-0">
                                      🟡 Último cupo
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold px-1.5 py-0">
                                      {currentSlotOcc.label}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-1 border-t border-slate-100">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                {/* Selector de Fecha */}
                                <div className="space-y-1">
                                  <Label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Fecha</Label>
                                  <Input
                                    type="date"
                                    className="h-10 rounded-lg border-slate-200 bg-slate-50/80 font-bold text-xs text-slate-800 focus:bg-white"
                                    value={classDate || ''}
                                    onChange={(e) => {
                                      const selectedVal = e.target.value;
                                      if (!selectedVal) {
                                        form.setValue(`practicalClassSchedules.${index}.date`, '');
                                        return;
                                      }
                                      
                                      const dateObj = new Date(selectedVal + 'T12:00:00');
                                      const dayOfWeek = dateObj.getDay();
                                      const type = currentValues.practicalType || 'semanal';
                                      
                                      if (dayOfWeek === 0) {
                                        toast({
                                          title: "Día no laborable",
                                          description: "La escuela de manejo no opera los domingos.",
                                          variant: "destructive"
                                        });
                                        form.setValue(`practicalClassSchedules.${index}.date`, '');
                                        return;
                                      }
                                      
                                      if (type === 'semanal' && dayOfWeek === 6) {
                                        toast({
                                          title: "Horario Semanal Seleccionado",
                                          description: "Has elegido la modalidad Semanal (Lunes a Viernes). Por favor selecciona un día de semana.",
                                          variant: "destructive"
                                        });
                                        form.setValue(`practicalClassSchedules.${index}.date`, '');
                                        return;
                                      }
                                      
                                      if (type === 'sabatino' && dayOfWeek !== 6) {
                                        toast({
                                          title: "Horario Sabatino Seleccionado",
                                          description: "Has elegido la modalidad Sabatina (Sábados). Por favor selecciona un día sábado.",
                                          variant: "destructive"
                                        });
                                        form.setValue(`practicalClassSchedules.${index}.date`, '');
                                        return;
                                      }
                                      
                                      form.setValue(`practicalClassSchedules.${index}.date`, selectedVal);
                                    }}
                                  />
                                </div>

                                {/* Selector de Horario con Estatus en cada Opción */}
                                <div className="space-y-1">
                                  <Label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Horario</Label>
                                  <select
                                    className={`w-full h-10 rounded-lg border px-2.5 font-bold text-xs outline-none focus:ring-1 focus:ring-blue-600 ${currentSlotOcc.isFull ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50/80 text-slate-800 focus:bg-white'}`}
                                    value={classTime}
                                    onChange={(e) => {
                                      form.setValue(`practicalClassSchedules.${index}.time`, e.target.value);
                                    }}
                                  >
                                    <option value="" className="text-slate-500">-- Selecciona Horario --</option>
                                    {TIME_SLOTS.map(t => {
                                      const occ = getSlotOccupancy(
                                        classDate || '', 
                                        t.id, 
                                        availability.globalCounts, 
                                        availability.blockedSlots, 
                                        availability.slotCapacities,
                                        availability.transmissionCounts,
                                        availability.activeVehiclesByTransmission,
                                        chosenTransmission,
                                        availability.practicaSlots,
                                        availability.teoricoSlots,
                                        availability.practicaCapacities,
                                        availability.teoricoCapacities
                                      );
                                      return (
                                        <option 
                                          key={t.id} 
                                          value={t.id}
                                          disabled={occ.isFull}
                                          className={occ.isFull ? 'text-red-600 font-bold bg-red-100' : 'text-slate-900'}
                                        >
                                          {t.label} — {occ.label}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </section>
            </>
          )}

          {step === 2 && (
            <>
              {/* SECCIÓN DE AVISO DE RESERVA EXITOSA */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-slate-800 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-lg shrink-0 shadow-inner">
                      🎉
                    </div>
                    <div>
                      <h3 className="font-extrabold text-emerald-950 text-sm">¡Cupo Reservado con Éxito!</h3>
                      <p className="text-xs text-emerald-700">Folio Oficial Provisional: <strong className="text-emerald-950">#{String(savedFolio).padStart(6, '0')}</strong></p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="h-8 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-200 bg-white"
                  >
                    ✏️ Modificar Registro
                  </Button>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed pt-1.5 border-t border-emerald-100">
                  Tus horarios de clases prácticas y teóricas han sido bloqueados y reservados en nuestro sistema. Para activar formalmente tu matrícula, por favor realiza tu pago a continuación e ingresa el número de referencia.
                </p>
              </div>

              {/* SECCIÓN 5: PAGO */}
              <section className="space-y-5 pb-16">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">5</div>
                  <h2 className="text-lg font-bold text-slate-800">Método de Pago</h2>
                </div>

                {/* Selector de Método de Pago */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setValue('paymentType', 'yappy');
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      currentValues.paymentType === 'yappy'
                        ? 'border-[#004fb9] bg-[#004fb9]/5 ring-1 ring-[#004fb9] shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                      currentValues.paymentType === 'yappy' ? 'bg-[#004fb9] text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      Y
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                        Yappy
                      </h4>
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Directo / Celular</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setValue('paymentType', 'cubo');
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      currentValues.paymentType === 'cubo'
                        ? 'border-[#16a34a] bg-[#16a34a]/5 ring-1 ring-[#16a34a] shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      currentValues.paymentType === 'cubo' ? 'bg-[#16a34a] text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      💳
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                        Tarjeta (Cubo)
                      </h4>
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">Pago online seguro</p>
                    </div>
                  </button>
                </div>

                {currentValues.paymentType === 'yappy' && (
                  <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
                    <div className="text-[11px] text-blue-950 leading-relaxed font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-100/30 p-3 rounded-lg border border-blue-100/60">
                      <span>
                        📱 Envía tu pago por Yappy buscando al comercio: <span className="font-bold text-[#004fb9] bg-blue-100/60 px-1.5 py-0.5 rounded">Freeway Escuela de Manejo</span> (o al número celular <span className="font-bold text-[#004fb9] bg-blue-100/60 px-1.5 py-0.5 rounded">6381-4115</span>).
                      </span>
                      <Button
                        type="button"
                        onClick={() => window.open('https://link.yappy.com.pa/stc/dgXr5v%2BGA2xDgGKBkz%2BnBhSk16Vdr9BZvaim7nGhYrA%3D', '_blank')}
                        className="bg-[#004fb9] hover:bg-[#003da1] text-white font-bold text-[11px] h-8 px-3 rounded-lg flex items-center gap-1 shrink-0 self-start sm:self-auto shadow-sm active:scale-95 transition-transform"
                      >
                        Pagar con Yappy 📱
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Campo de Referencia */}
                      <div className="space-y-1.5">
                        <Label htmlFor="yappyReference" className="text-[11px] font-bold text-slate-700">
                          Número de Referencia de Yappy <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="yappyReference"
                          type="text"
                          placeholder="Ej. 12345678"
                          {...form.register('yappyReference')}
                          className="h-10 text-xs rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      {/* Adjuntar Comprobante */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Captura del Comprobante (Opcional)
                        </Label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            id="voucherFile"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          {voucherBase64 ? (
                            <div className="flex items-center justify-between border border-blue-200 bg-white p-2 rounded-lg text-xs">
                              <span className="text-blue-700 font-semibold truncate max-w-[150px]">
                                📸 Comprobante listo
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setVoucherBase64(null);
                                  setVoucherMime(null);
                                }}
                                className="h-6 text-[10px] text-red-500 hover:text-red-700 p-1"
                              >
                                Quitar
                              </Button>
                            </div>
                          ) : (
                            <label
                              htmlFor="voucherFile"
                              className="flex items-center justify-center border border-dashed border-slate-300 bg-white hover:bg-slate-50 cursor-pointer p-2 rounded-lg text-xs text-slate-500 font-medium h-10 transition-all gap-1.5"
                            >
                              <span>Upload</span> Subir Comprobante
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentValues.paymentType === 'cubo' && (
                  <div className="bg-green-50/30 border border-green-100 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
                    <div className="text-[11px] text-green-950 leading-relaxed font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-green-100/30 p-3 rounded-lg border border-green-100/60">
                      <span>
                        💳 Puedes pagar en línea con tu **tarjeta de crédito o débito** (Visa / Mastercard) a través del portal de procesamiento seguro de **Cubo**.
                      </span>
                      <Button
                        type="button"
                        onClick={() => window.open('https://link.cubopago.com/m_JPusnlxKnM', '_blank')}
                        className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-[11px] h-8 px-3 rounded-lg flex items-center gap-1 shrink-0 self-start sm:self-auto shadow-sm active:scale-95 transition-transform"
                      >
                        Pagar con Tarjeta (Cubo) 💳
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Campo de Referencia */}
                      <div className="space-y-1.5">
                        <Label htmlFor="cuboReference" className="text-[11px] font-bold text-slate-700">
                          Número de Confirmación / Referencia <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="cuboReference"
                          type="text"
                          placeholder="Ej. ID de Transacción / Referencia"
                          {...form.register('yappyReference')}
                          className="h-10 text-xs rounded-lg border-slate-200 focus:border-green-500 focus:ring-green-500"
                        />
                      </div>

                      {/* Adjuntar Comprobante */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-700">
                          Captura del Comprobante (Opcional)
                        </Label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            id="voucherFileCubo"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          {voucherBase64 ? (
                            <div className="flex items-center justify-between border border-green-200 bg-white p-2 rounded-lg text-xs">
                              <span className="text-green-700 font-semibold truncate max-w-[150px]">
                                📸 Comprobante listo
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setVoucherBase64(null);
                                  setVoucherMime(null);
                                }}
                                className="h-6 text-[10px] text-red-500 hover:text-red-700 p-1"
                              >
                                Quitar
                              </Button>
                            </div>
                          ) : (
                            <label
                              htmlFor="voucherFileCubo"
                              className="flex items-center justify-center border border-dashed border-slate-300 bg-white hover:bg-slate-50 cursor-pointer p-2 rounded-lg text-xs text-slate-500 font-medium h-10 transition-all gap-1.5"
                            >
                              <span>Upload</span> Subir Comprobante
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}


              </section>
            </>
          )}
            </div>
          </div>

          {/* COLUMNA DERECHA: RESUMEN FIJO Y DINÁMICO */}
          <div className="w-full lg:w-[32%] bg-slate-900 lg:min-h-screen p-6 lg:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="sticky top-8 z-10 space-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h3 className="text-white font-bold text-lg mb-4">Tu Resumen</h3>
                
                <div className="space-y-4">
                  {/* Vehículo */}
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <div>
                      <p className="text-slate-400 text-xs font-medium">Vehículo</p>
                      <p className="text-white font-semibold text-sm">{currentValues.vehicleTransmission}</p>
                    </div>
                    <Car className="text-blue-400 w-4 h-4" />
                  </div>

                  {/* Plan */}
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <div>
                      <p className="text-slate-400 text-xs font-medium">Plan Seleccionado</p>
                      {selectedPlan ? (
                        <p className="text-white font-semibold text-sm">{selectedPlan.title} ({selectedPlan.hoursText})</p>
                      ) : (
                        <p className="text-slate-500 italic text-xs">Pendiente...</p>
                      )}
                    </div>
                  </div>

                  {/* Teoría */}
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <div>
                      <p className="text-slate-400 text-xs font-medium">Teoría</p>
                      {!currentValues.coursePlan?.includes('Reforzamiento') && !currentValues.coursePlan?.includes('manejar') ? (
                        currentValues.theoreticalClassSchedule ? (
                          <p className="text-white font-semibold text-xs mt-0.5">{currentValues.theoreticalClassSchedule}</p>
                        ) : (
                          <p className="text-slate-500 italic text-xs">Pendiente...</p>
                        )
                      ) : (
                        <p className="text-white font-semibold text-xs mt-0.5">No aplica</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Práctica */}
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <div>
                      <p className="text-slate-400 text-xs font-medium">Clases Prácticas ({selectedPlan ? `${selectedPlan.classCount} Clases` : 'Pref.'})</p>
                      {fields.length > 0 ? (
                        <p className="text-white font-semibold text-xs mt-0.5">{fields.length} Sesiones Agendadas</p>
                      ) : (
                        <p className="text-slate-500 italic text-xs">Pendiente...</p>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="pt-3">
                    <p className="text-slate-400 text-xs font-medium mb-0.5">Total a pagar</p>
                    <p className="text-white font-black text-3xl">
                      ${selectedPlan?.price || '0'}<span className="text-sm text-slate-400 font-normal">.00</span>
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || (step === 1 && (!currentValues.coursePlan || (!currentValues.coursePlan?.includes('Reforzamiento') && !currentValues.coursePlan?.includes('manejar') && filteredTheoreticalSchedules.length > 0 && !currentValues.theoreticalClassSchedule)))}
                    className={`w-full h-12 text-sm font-bold rounded-xl text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${step === 2 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                  >
                    {isSubmitting 
                      ? (step === 1 ? 'Reservando...' : 'Procesando...') 
                      : (step === 1 ? 'Reservar Cupo y Proceder al Pago' : 'Confirmar y Completar Inscripción')}
                    {!isSubmitting && <ChevronRight className="w-4 h-4 ml-2" />}
                  </Button>
                  <p className="text-center text-slate-400 text-xs mt-3 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Genera Contrato en Tiempo Real
                  </p>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="bg-blue-950/40 border border-blue-900/40 rounded-xl p-4 backdrop-blur-sm flex items-start gap-3">
                <Info className="text-blue-400 w-4.5 h-4.5 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200 leading-normal">
                  {step === 1 
                    ? "Al reservar tu cupo, tus horarios quedarán bloqueados y se asignará tu Folio Oficial provisional en nuestra base de datos."
                    : "Al confirmar tu pago, tu matrícula quedará formalmente activada y se enviará la notificación a tu asesor asignado."}
                </p>
              </div>
            </div>
          </div>

        </form>
      </Form>
    </div>
  );
}
