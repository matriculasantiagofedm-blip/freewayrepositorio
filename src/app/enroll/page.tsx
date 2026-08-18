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

// --- Mapeo de slots y ocupaciÃ³n ---
const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
  '08:00am a 10:00am': '8am-10am',
  '8:00am a 10:00am': '8am-10am',
  '10:00am a 12:00pm': '10am-12pm',
  '01:00pm a 03:00pm': '1pm-3pm',
  '1:00pm a 3:00pm': '1pm-3pm',
  '03:00pm a 05:00pm': '3pm-5pm',
  '3:00pm a 5:00pm': '3pm-5pm',
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];

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
  if (customStatus === 'teorico') return 3; // Clase TeÃ³rica (1 instructor ocupado)
  if (customStatus === 'practica') return 4; // PrÃ¡ctica normal

  if (day >= 2 && day <= 5 && slotId === '10am-12pm') return 3; // Martes a Viernes 10am-12pm (TeorÃ­a)
  if (day === 6 && slotId === '3pm-5pm') return 3; // SÃ¡bado 3pm-5pm (TeorÃ­a)
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
    return { count, max: 0, available: 0, isFull: true, label: 'ðŸ”´ (CERRADO - Domingo)' };
  }

  const dayName = DAY_NAMES[day];
  const bKey = `${dayName}|${slotKey}`;

  // Comportamiento por defecto
  const defaultPracticaActive = (dayName !== 'Lunes' && dayName !== 'SÃ¡bado' && slotKey === '10am-12pm') || (dayName === 'SÃ¡bado' && slotKey === '3pm-5pm') ? false : true;

  // Determinar si PrÃ¡ctica estÃ¡ activo para este bloque
  let isPracticaActive = defaultPracticaActive;
  if (practicaSlots && practicaSlots[bKey] !== undefined) {
    isPracticaActive = practicaSlots[bKey];
  } else if (blockedSlots && blockedSlots[bKey] !== undefined) {
    isPracticaActive = blockedSlots[bKey] === 'practica';
  }

  if (!isPracticaActive) {
    const defaultTeoricoActive = (dayName !== 'Lunes' && dayName !== 'SÃ¡bado' && slotKey === '10am-12pm') || (dayName === 'SÃ¡bado' && slotKey === '3pm-5pm') ? true : false;
    let isTeoricoActive = defaultTeoricoActive;
    if (teoricoSlots && teoricoSlots[bKey] !== undefined) {
      isTeoricoActive = teoricoSlots[bKey];
    } else if (blockedSlots && blockedSlots[bKey] !== undefined) {
      isTeoricoActive = blockedSlots[bKey] === 'teorico';
    }

    const label = isTeoricoActive ? 'ðŸ”´ (RESERVADO PARA CLASE TEÃ“RICA)' : 'ðŸ”´ (NO DISPONIBLE / BLOQUEADO)';
    return { count, max: 0, available: 0, isFull: true, label };
  }

  // Determinar capacidad de PrÃ¡ctica
  let max = 4;
  if (practicaCapacities && practicaCapacities[bKey] !== undefined) {
    max = practicaCapacities[bKey];
  } else if (slotCapacities && slotCapacities[bKey] !== undefined) {
    max = slotCapacities[bKey];
  }

  // VALIDACIÃ“N POR TRANSMISIÃ“N ESPECÃFICA (AUTOMÃTICO / MANUAL / MOTO)
  if (chosenTransmission && activeVehiclesByTransmission && transmissionCounts) {
    const maxTrans = activeVehiclesByTransmission[chosenTransmission] || 99;
    const countTrans = transmissionCounts[gKey]?.[chosenTransmission] || 0;
    
    if (countTrans >= maxTrans) {
      let suffix = '';
      if (chosenTransmission === 'AutomÃ¡tico') {
        suffix = 'ðŸ”´ (SIN CARROS AUTOMÃTICOS DISPONIBLES)';
      } else if (chosenTransmission === 'Manual') {
        suffix = 'ðŸ”´ (SIN CARROS MANUALES DISPONIBLES)';
      } else if (chosenTransmission === 'Moto') {
        suffix = 'ðŸ”´ (SIN MOTOS DISPONIBLES)';
      } else {
        suffix = `ðŸ”´ (SIN ${chosenTransmission.toUpperCase()}S DISPONIBLES)`;
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

  let label = `ðŸŸ¢ (${available} de ${max} cupos libres)`;
  if (isFull) label = `ðŸ”´ (LLENO - 0 cupos)`;
  else if (available === 1) label = `ðŸŸ¡ (Ãšltimo cupo de ${max})`;

  return { count, max, available, isFull, label, isEmpty: false };
}

// --- Esquema Zod ---
const enrollmentSchema = z.object({
  clientName: z.string().min(3, 'Ingresa tu nombre completo'),
  clientEmail: z.string().email('Email invÃ¡lido'),
  studentIdNumber: z.string().min(5, 'CÃ©dula / ID requerido'),
  studentAddress: z.string().min(5, 'DirecciÃ³n requerida'),
  studentPhone1: z.string().min(7, 'TelÃ©fono requerido'),
  vehicleTransmission: z.enum(['AutomÃ¡tico', 'Manual', 'Moto']).default('AutomÃ¡tico'),
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
  { id: 'Sabados 3:00 pm a 5:00 pm', label: 'SÃ¡bados (3:00 PM - 5:00 PM)', desc: '3 sÃ¡bados consecutivos' },
  { id: 'Semanal 10:00 am a 12:00 pm', label: 'Semanal (10:00 AM - 12:00 PM)', desc: 'Martes a Viernes' }
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
      vehicleTransmission: 'AutomÃ¡tico',
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

  // Lista dinÃ¡mica de planes utilizando los precios oficiales configurados en ContractTime
  const plansList = useMemo(() => {
    const isMoto = currentValues.vehicleTransmission === 'Moto';
    if (isMoto) {
      const motoPrices = settingsPrices?.moto || {};
      return [
        {
          title: "BÃ¡sico (8 Hrs)",
          name: "Curso Moto BÃ¡sico (8 Hrs)",
          hoursText: "8 Horas PrÃ¡cticas",
          classCount: 4,
          price: motoPrices["Curso Moto BÃ¡sico (8 Hrs)"] || 115,
          tag: "",
          desc: "4 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Plus (10 Hrs)",
          name: "Curso Moto Plus (10 Hrs)",
          hoursText: "10 Horas PrÃ¡cticas",
          classCount: 5,
          price: motoPrices["Curso Moto Plus (10 Hrs)"] || 135,
          tag: "MÃ¡s Popular",
          desc: "5 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Premium (12 Hrs)",
          name: "Curso Moto Premium (12 Hrs)",
          hoursText: "12 Horas PrÃ¡cticas",
          classCount: 6,
          price: motoPrices["Curso Moto Premium (12 Hrs)"] || 155,
          tag: "Recomendado",
          desc: "6 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (4 Hrs)",
          name: "Moto Reforzamiento 4 Hrs",
          hoursText: "4 Horas PrÃ¡cticas",
          classCount: 2,
          price: motoPrices["Moto Reforzamiento 4 Hrs"] || 95,
          tag: "",
          desc: "2 clases prÃ¡cticas de 2 horas."
        },
        {
          title: "Reforzamiento (2 Hrs)",
          name: "Moto Reforzamiento 2 Hrs",
          hoursText: "2 Horas PrÃ¡cticas",
          classCount: 1,
          price: motoPrices["Moto Reforzamiento 2 Hrs"] || 75,
          tag: "",
          desc: "1 clase prÃ¡ctica de 2 horas."
        },
        {
          title: "Ya sÃ© manejar",
          name: "Ya se manejar (Moto)",
          hoursText: "EvaluaciÃ³n PrÃ¡ctica",
          classCount: 1,
          price: motoPrices["Ya se manejar (Moto)"] || 57,
          tag: "",
          desc: "1 sesiÃ³n de evaluaciÃ³n de maniobra y parqueo."
        }
      ];
    } else {
      const autoPrices = settingsPrices?.auto || {};
      return [
        {
          title: "BÃ¡sico (8 Hrs)",
          name: "Curso Auto BÃ¡sico (8 Hrs)",
          hoursText: "8 Horas PrÃ¡cticas",
          classCount: 4,
          price: autoPrices["Curso Auto BÃ¡sico (8 Hrs)"] || 133,
          tag: "",
          desc: "4 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Plus (10 Hrs)",
          name: "Curso Auto Plus (10 Hrs)",
          hoursText: "10 Horas PrÃ¡cticas",
          classCount: 5,
          price: autoPrices["Curso Auto Plus (10 Hrs)"] || 155,
          tag: "MÃ¡s Popular",
          desc: "5 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Premium (12 Hrs)",
          name: "Curso Auto Premium (12 Hrs)",
          hoursText: "12 Horas PrÃ¡cticas",
          classCount: 6,
          price: autoPrices["Curso Auto Premium (12 Hrs)"] || 180,
          tag: "Recomendado",
          desc: "6 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (4 Hrs)",
          name: "Reforzamiento 4 Hrs",
          hoursText: "4 Horas PrÃ¡cticas",
          classCount: 2,
          price: autoPrices["Reforzamiento 4 Hrs"] || 95,
          tag: "",
          desc: "2 clases prÃ¡cticas de 2 horas cada una."
        },
        {
          title: "Reforzamiento (2 Hrs)",
          name: "Reforzamiento 2 Hrs",
          hoursText: "2 Horas PrÃ¡cticas",
          classCount: 1,
          price: autoPrices["Reforzamiento 2 Hrs"] || 75,
          tag: "",
          desc: "1 clase prÃ¡ctica de 2 horas."
        },
        {
          title: "Ya sÃ© manejar",
          name: "Ya se manejar",
          hoursText: "EvaluaciÃ³n PrÃ¡ctica",
          classCount: 1,
          price: autoPrices["Ya se manejar"] || 57,
          tag: "",
          desc: "1 sesiÃ³n de evaluaciÃ³n de maniobra y parqueo."
        }
      ];
    }
  }, [settingsPrices, currentValues.vehicleTransmission]);

  const filteredTheoreticalSchedules = useMemo(() => {
    const checkIsTeoricoActive = (day: string, slotId: string) => {
      const bKey = `${day}|${slotId}`;
      const defaultTeoricoActive = (day !== 'Lunes' && day !== 'SÃ¡bado' && slotId === '10am-12pm') || (day === 'SÃ¡bado' && slotId === '3pm-5pm') ? true : false;
      
      if (availability.teoricoSlots && availability.teoricoSlots[bKey] !== undefined) {
        return availability.teoricoSlots[bKey];
      } else if (availability.blockedSlots && availability.blockedSlots[bKey] !== undefined) {
        return availability.blockedSlots[bKey] === 'teorico';
      }
      return defaultTeoricoActive;
    };

    return THEORETICAL_SCHEDULES.filter(sch => {
      // 1. SÃ¡bados 3:00 pm a 5:00 pm
      if (sch.id === 'Sabados 3:00 pm a 5:00 pm') {
        return checkIsTeoricoActive('SÃ¡bado', '3pm-5pm');
      }
      
      // 2. Semanal 10:00 am a 12:00 pm
      if (sch.id === 'Semanal 10:00 am a 12:00 pm') {
        const weekdays = ['Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes'];
        return weekdays.some(day => checkIsTeoricoActive(day, '10am-12pm'));
      }
      
      return true;
    });
  }, [availability.teoricoSlots, availability.blockedSlots]);

  const selectedPlan = plansList.find(p => p.name === currentValues.coursePlan);

  // Al cambiar modalidad (semanal / sabatino), limpiar fechas invÃ¡lidas
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

  // Al cambiar de plan, crear dinÃ¡micamente las N clases requeridas
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

  // Autogenerar 3 fechas de clases teÃ³ricas si selecciona horario
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
      d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
      for (let i = 0; i < 4; i++) {
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
      // Validar que no haya domingos y que todos los cupos seleccionados estÃ©n disponibles
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
            title: "DÃ­a no laborable",
            description: `La Clase ${i + 1} estÃ¡ programada para un domingo. Por favor selecciona otro dÃ­a.`,
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
            title: "InscripciÃ³n Actualizada",
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
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: data.paymentType,
            paymentReference: '',
            totalAmount: price,
            pendingAmount: price,
            payments: [],
            createdAt: serverTimestamp(),
            activatedAt: serverTimestamp(),
            createdBy: 'InscripciÃ³n Web',
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
          title: "Â¡Cupo Reservado!",
          description: "Tu cupo ha sido pre-registrado en el sistema. Procede a realizar tu pago.",
        });

        // Notificar al asesor vÃ­a WhatsApp que hay una nueva pre-inscripciÃ³n
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
            practicalSchedules: (data.practicalClassSchedules || []).map((s: any, idx: number) => ({
              date: s.date,
              time: s.time,
            })),
            contractId: newContractRef.id,
          })
        }).catch(err => console.error('Error notify-new-enrollment:', err));

      } catch (error: any) {
        console.error("Error al pre-registrar cupo:", error);
        toast({ title: "Error de InscripciÃ³n", description: "No se pudo guardar la matrÃ­cula. Revisa tu conexiÃ³n.", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // step === 2
      if (data.paymentType === 'yappy' && !data.yappyReference) {
        toast({
          title: "Referencia de Yappy requerida",
          description: "Por favor ingresa el nÃºmero de referencia de tu pago por Yappy.",
          variant: "destructive"
        });
        return;
      }

      if (data.paymentType === 'cubo' && !data.yappyReference) {
        toast({
          title: "Referencia de pago requerida",
          description: "Por favor ingresa el nÃºmero de referencia de tu transacciÃ³n por tarjeta / Cubo.",
          variant: "destructive"
        });
        return;
      }

      if (!savedContractId) {
        toast({
          title: "Contrato no encontrado",
          description: "No encontramos tu nÃºmero de registro previo. Por favor contacta soporte.",
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const contractRef = doc(db, 'contracts', savedContractId);
        await updateDoc(contractRef, {
          status: 'active',
          paymentMethod: data.paymentType,
          paymentReference: data.yappyReference || '',
          'autoMotoDetails.paymentReference': data.yappyReference || ''
        });

        // NotificaciÃ³n automÃ¡tica al WhatsApp del Asesor con referencia e imagen si hay
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
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Â¡InscripciÃ³n Confirmada!</h1>
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
              <span className="text-slate-500">NÃºmero de Folio:</span>
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


  const handleNextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await form.trigger(['clientName', 'studentIdNumber', 'clientEmail', 'studentPhone1', 'studentAddress']);
    } else if (step === 2) {
      isValid = await form.trigger(['vehicleTransmission', 'coursePlan']);
      if (!currentValues.coursePlan) {
        toast({ title: "Atención", description: "Debes seleccionar un plan.", variant: "destructive" });
        isValid = false;
      }
    } else if (step === 3) {
      isValid = await form.trigger(['theoreticalClassSchedule', 'practicalClassSchedules']);
      if (!currentValues.theoreticalClassSchedule) {
        toast({ title: "Atención", description: "Selecciona el horario teórico.", variant: "destructive" });
        isValid = false;
      } else if (practicalDays.length > 0 && currentValues.practicalClassSchedules?.length !== practicalDays.length) {
        toast({ title: "Atención", description: "Asigna horarios a todas tus clases prácticas.", variant: "destructive" });
        isValid = false;
      }
    }

    if (isValid) setStep(s => (s + 1) as any);
  };

  const handlePrevStep = () => {
    setStep(s => (s - 1) as any);
  };

  const currentPlanObj = plansList.find(p => p.name === currentValues.coursePlan);
  const total = currentPlanObj ? currentPlanObj.price : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto min-h-screen relative">
          
          {/* Main Content Area */}
          <div className="w-full lg:w-[65%] p-6 lg:p-12 xl:p-16 flex flex-col min-h-screen">
            
            {/* Header / Logo */}
            <div className="mb-12 flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">ContractTime</h1>
                <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase mt-1">Matrícula Online</p>
              </div>
            </div>

            {/* Stepper indicator */}
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === num ? 'bg-blue-600 text-white shadow-md' : step > num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {step > num ? <CheckCircle2 className="w-4 h-4" /> : num}
                  </div>
                  {num < 4 && <div className={`h-1 w-8 sm:w-16 rounded-full ${step > num ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="flex-1">
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
                    getSlotOccupancy={(d, s) => getSlotOccupancy(d, s, availability.globalCounts, availability.blockedSlots, availability.slotCapacities, availability.transmissionCounts, availability.activeVehiclesByTransmission, currentValues.vehicleTransmission)}
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

            {/* Navigation Buttons */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={handlePrevStep} className="h-12 px-6 rounded-xl font-bold">
                  Atrás
                </Button>
              ) : <div></div>}
              
              {step < 4 ? (
                <Button type="button" onClick={handleNextStep} className="h-12 px-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-md">
                  Siguiente <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              ) : null}
            </div>
            
            {/* Footer */}
            <div className="mt-16 text-center pb-8">
              <p className="text-xs font-medium text-slate-400">© 2026 Freeway Escuela de Manejo.</p>
              <p className="text-[10px] text-slate-300 mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Transacciones encriptadas de extremo a extremo
              </p>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="w-full lg:w-[35%] bg-slate-900 lg:min-h-screen p-6 lg:p-12 relative overflow-hidden">
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
