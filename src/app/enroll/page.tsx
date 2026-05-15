'use client';

/**
 * FORMULARIO PÚBLICO DE AUTO-INSCRIPCIÓN AUTOMÁTICA
 */

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

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
  GanttChart,
  UserPlus,
  ArrowRight,
  Lock,
  ShieldCheck,
  Loader2,
  CalendarIcon,
  CalendarDays,
  CreditCard,
  Smartphone,
  Hash,
  Car,
  Info,
  DollarSign,
  Camera,
  BookOpen,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useFirebase } from '@/components/firebase-provider';
import Link from 'next/link';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useSettingsPrices } from '@/hooks/use-settings-prices';
import { isPanamaHoliday } from '@/lib/holidays';
import { validatePaymentFlow } from '@/ai/flows/validate-payment';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AUTO_PLANS = [
  "Curso Auto Básico (8 Hrs)",
  "Curso Auto Plus (10 Hrs)",
  "Curso Auto Premium (12 Hrs)"
];

const PLAN_PRACTICAL_COUNTS: Record<string, number> = {
  "Curso Auto Básico (8 Hrs)": 4,
  "Curso Auto Plus (10 Hrs)": 5,
  "Curso Auto Premium (12 Hrs)": 6
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

const enrollmentSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  coursePlan: z.string({ required_error: "Seleccione un plan" }),
  theoreticalClassSchedule: z.enum(['Sabados 3:00 pm a 5:00 pm', 'Semanal 8:00 am a 10:00 am'], { required_error: "Seleccione un horario teórico" }),
  theoreticalClassDates: z.array(z.date()).min(3, 'Seleccione las fechas de sus sesiones teóricas'),
  practicalClassSchedules: z.array(z.object({
    date: z.date({ required_error: 'Fecha requerida' }),
    time: z.string().min(1, 'Hora requerida'),
  })).min(1, 'Debe elegir su horario'),
  paymentMethod: z.enum(['yappy', 'credit_card', 'paypal']).default('yappy'),
  paymentReference: z.string().min(6, 'Ingresa el número de referencia completo'),
  paymentAmount: z.preprocess((val) => Number(val), z.number().min(50, 'Abono min: B/. 50.00')),
});

type FormValues = z.infer<typeof enrollmentSchema>;

function EnrollmentContent() {
  const db = useDb();
  const { auth } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [submittedFolio, setSubmittedFolio] = useState<number | null>(null);
  const [showCuboModal, setShowCuboModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptMime, setReceiptMime] = useState<string>('image/jpeg');
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const searchParams = useSearchParams();
  const { prices } = useSettingsPrices();

  useEffect(() => { setMounted(true); }, []);

  // Detectar retorno de PayPal (?paypal=success&token=ORDEN_ID)
  useEffect(() => {
    const paypalStatus = searchParams?.get('paypal');
    const token = searchParams?.get('token'); // PayPal devuelve ?token=ORDER_ID
    if (paypalStatus === 'success' && token) {
      // Capturar el pago automáticamente
      (async () => {
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: token })
          });
          const data = await res.json();
          if (data.ok && data.reference) {
            form.setValue('paymentMethod', 'paypal');
            form.setValue('paymentAmount', data.amount || 50);
            form.setValue('paymentReference', data.reference);
            toast({
              title: '✅ Pago de PayPal Confirmado',
              description: `Monto: $${data.amount} — Ref: ${data.reference}`,
              duration: 8000
            });
          } else {
            toast({ variant: 'destructive', title: 'Error al capturar pago PayPal', description: data.error || 'Intenta de nuevo.' });
          }
        } catch (e) {
          console.error('PayPal capture error:', e);
        }
      })();
    } else if (paypalStatus === 'cancel') {
      toast({ variant: 'destructive', title: 'Pago cancelado', description: 'Cancelaste el pago con PayPal. Puedes intentar de nuevo.' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Iniciar pago PayPal
  const handlePayPal = async () => {
    if (!paypalEmail || !paypalEmail.includes('@')) {
      setPaypalError('Por favor ingresa un email válido.'); return;
    }
    const plan = form.getValues('coursePlan');
    if (!plan) { setPaypalError('⚠ Selecciona un plan de curso en la sección 2 antes de pagar.'); return; }

    // Calcular precio real del plan seleccionado
    const coursePrice = prices?.auto?.[plan] || 0;
    if (coursePrice <= 0) { setPaypalError('No se pudo obtener el precio del plan. Intenta de nuevo.'); return; }

    setPaypalError('');
    setPaypalLoading(true);

    // Actualizar el monto en el formulario con el precio real
    form.setValue('paymentAmount', coursePrice);

    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: coursePrice, coursePlan: plan, email: paypalEmail })
      });
      const data = await res.json();
      if (data.approveUrl) {
        // Guardar datos del formulario + email en sessionStorage antes de redirigir
        sessionStorage.setItem('fw_enroll_draft', JSON.stringify(form.getValues()));
        sessionStorage.setItem('fw_paypal_email', paypalEmail);
        window.location.href = data.approveUrl;
      } else {
        setPaypalError(data.error || 'No se pudo iniciar PayPal. Intenta de nuevo.');
        setPaypalLoading(false);
      }
    } catch { setPaypalError('Error de conexión con PayPal. Verifica tu internet e intenta de nuevo.'); setPaypalLoading(false); }
  };

  const activeContractsQuery = useMemoQuery(() => (db && auth.currentUser) ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null, [db, auth.currentUser]);
  const manualEntriesQuery = useMemoQuery(() => (db && auth.currentUser) ? query(collection(db, 'manual_schedules')) : null, [db, auth.currentUser]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

  const availabilityData = useMemo(() => {
    const globalCounts: Record<string, number> = {};
    const processEntry = (date: any, slotString: string) => {
        if (!date || !slotString) return;
        const dObj = toDate(date);
        if (isNaN(dObj.getTime())) return;
        const dateKey = format(dObj, 'yyyy-MM-dd');
        const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString;
        const sKey = `${dateKey}|${slotId}`;
        globalCounts[sKey] = (globalCounts[sKey] || 0) + 1;
    };
    allManualEntries?.forEach(entry => { if (entry.classType !== 'Teórica') processEntry(entry.date, entry.timeSlot); });
    allContracts?.forEach(c => {
        const proc = (arr: any[]) => arr?.forEach(s => processEntry(s.date, s.time));
        if (c.autoMotoDetails?.practicalClassSchedules) proc(c.autoMotoDetails.practicalClassSchedules);
        if (c.autoMotoDetails?.motoPracticalClassSchedules) proc(c.autoMotoDetails.motoPracticalClassSchedules);
        if (c.deluxeDetails?.classSchedules) proc(c.deluxeDetails.classSchedules);
    });
    return { globalCounts };
  }, [allContracts, allManualEntries]);

  useEffect(() => {
    if (auth && !auth.currentUser) signInAnonymously(auth).catch(console.error);
  }, [auth]);

  const form = useForm<FormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '', studentAddress: '', studentPhone1: '',
      vehicleTransmission: 'Automático', coursePlan: '', theoreticalClassSchedule: 'Sabados 3:00 pm a 5:00 pm',
      theoreticalClassDates: [], practicalClassSchedules: [], paymentMethod: 'yappy', paymentReference: '', paymentAmount: 50,
    },
  });

  // Restaurar formulario tras retorno de PayPal
  useEffect(() => {
    const draft = sessionStorage.getItem('fw_enroll_draft');
    if (draft && searchParams?.get('paypal') === 'success') {
      try {
        const saved = JSON.parse(draft);
        Object.entries(saved).forEach(([k, v]) => form.setValue(k as any, v));
        sessionStorage.removeItem('fw_enroll_draft');
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fields: practicalFields, replace: replacePractical } = useFieldArray({ control: form.control, name: "practicalClassSchedules" });
  const watchPlan = form.watch('coursePlan');
  const watchTheorySchedule = form.watch('theoreticalClassSchedule');
  const watchPaymentMethod = form.watch('paymentMethod');

  useEffect(() => {
    if (watchPlan && mounted) {
      const count = PLAN_PRACTICAL_COUNTS[watchPlan] || 0;
      const current = form.getValues('practicalClassSchedules') || [];
      replacePractical(Array.from({ length: count }, (_, i) => current[i] || { date: new Date(), time: '08:00am a 10:00am' }));
    }
  }, [watchPlan, replacePractical, form, mounted]);

  useEffect(() => {
    if (watchPlan && watchTheorySchedule) {
        // Placeholder for logic to generate dates based on schedule
    }
  }, [watchTheorySchedule, form, mounted]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsReadingImage(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Ref = reader.result as string;
        const mimeType = file.type;
        const base64Image = base64Ref.split(',')[1];
        
        // Guardar imagen para enviar al asesor después
        setReceiptBase64(base64Image);
        setReceiptMime(mimeType);

        toast({ title: 'Analizando Comprobante...', description: 'Nuestra Inteligencia Artificial está validando tu pago...' });

        const result = await validatePaymentFlow({ base64Image, mimeType });
        if (result.isValid) {
          form.setValue('paymentAmount', result.amount || 50);
          form.setValue('paymentReference', result.reference || '');
          toast({ title: '✅ Comprobante Aprobado!', description: `Monto detectado: B/. ${result.amount}. Referencia: ${result.reference}`, duration: 7000 });
        } else {
          form.setValue('paymentReference', '');
          toast({ variant: 'destructive', title: 'Comprobante Denegado', description: result.reason || 'Por favor sube una captura válida y exitosa.', duration: 7000 });
        }
        setIsReadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error de IA', description: 'No pudimos analizar el comprobante. Por favor rellena los datos a mano.' });
      setIsReadingImage(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!db || !auth.currentUser) return;
    
    const hasInvalidSlot = values.practicalClassSchedules.some(s => {
      const dObj = s.date;
      if (!dObj || isNaN(dObj.getTime())) return false;
      const slotId = TIME_STRING_TO_SLOT_MAP[s.time] || s.time;
      const dateKey = format(dObj, 'yyyy-MM-dd');
      const capacity = getGlobalCapacity(dObj, slotId);
      const isFull = (availabilityData.globalCounts[`${dateKey}|${slotId}`] || 0) >= capacity;
      return isFull || isPanamaHoliday(dObj) || dObj.getDay() === 0;
    });

    if (hasInvalidSlot) {
      toast({ variant: 'destructive', title: 'Horarios Inválidos', description: 'Uno o más horarios seleccionados están llenos, son Feriados o Domingo. Por favor ajusta las casillas marcadas en amarillo / rojo.', duration: 5000 });
      return;
    }

    setIsSaving(true);
    try {
      const qCheck = query(collection(db, 'contracts'), where('paymentReference', '==', values.paymentReference));
      const snapCheck = await getDocs(qCheck);
      
      if (!snapCheck.empty) {
        toast({ variant: 'destructive', title: 'Referencia Duplicada', description: 'Este número de confirmación ya ha sido validado anteriormente.' });
        setIsSaving(false);
        return;
      }

      let finalFolio = 0;
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contracts_folio');
        const counterDoc = await transaction.get(counterRef);
        let nextFolio = counterDoc.exists() ? Math.max(counterDoc.data().count + 1, 18) : 18;
        transaction.set(counterRef, { count: nextFolio }, { merge: true });
        finalFolio = nextFolio;

        const clientRef = doc(collection(db, 'clients'));
        transaction.set(clientRef, {
          name: values.clientName, email: values.clientEmail, idNumber: values.studentIdNumber,
          phone: values.studentPhone1, createdAt: serverTimestamp(), userId: auth.currentUser?.uid,
        });

        const courseValue = prices?.auto?.[values.coursePlan] || 0;
        const balance = courseValue - values.paymentAmount;
        const isPayPal = values.paymentMethod === 'paypal';
        const isYappy = values.paymentMethod === 'yappy';
        const paymentType = isYappy ? 'yappy' : isPayPal ? 'paypal' : 'credit';

        const contractRef = doc(collection(db, 'contracts'));
        transaction.set(contractRef, {
          title: `Curso de Auto - Folio ${nextFolio}`,
          clientName: values.clientName, 
          clientEmail: values.clientEmail, 
          clientId: clientRef.id,
          folioNumber: nextFolio,
          type: 'Curso Auto', 
          status: 'active',
          userId: auth.currentUser?.uid, 
          createdBy: 'Web Pública', 
          createdAt: serverTimestamp(),
          activatedAt: serverTimestamp(),
          paymentReference: values.paymentReference,
          // PayPal: pago ya confirmado electrónicamente por PayPal
          ...(isPayPal && {
            paypalConfirmed: true,
            paypalCaptureId: values.paymentReference,
            paymentVerified: true,
          }),
          autoMotoDetails: {
            ...values, 
            licenseCategory: 'A, C',
            theoreticalClassDates: values.theoreticalClassDates.map(d => Timestamp.fromDate(d)),
            practicalClassSchedules: values.practicalClassSchedules.map(s => ({ ...s, date: Timestamp.fromDate(s.date) })),
            paymentType,
            courseValue: courseValue, 
            downPayment: values.paymentAmount, 
            balance: balance,
            paymentDeadline: serverTimestamp()
          }
        });
        // Guardar contractId para la notificación
        (finalFolio as any)._contractId = contractRef.id;
      });
      
      setSubmittedFolio(finalFolio);
      toast({ title: '¡Inscripción Exitosa!', description: `Se ha generado el Folio ${finalFolio}` });

      // 🔔 Notificar al asesor
      const isPayPalPayment = values.paymentMethod === 'paypal';
      try {
        await fetch('/api/contracts/notify-advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folio: finalFolio,
            clientName: values.clientName,
            clientPhone: values.studentPhone1,
            clientEmail: values.clientEmail,
            coursePlan: values.coursePlan,
            vehicleTransmission: values.vehicleTransmission,
            paymentReference: values.paymentReference,
            paymentAmount: values.paymentAmount,
            paymentMethod: values.paymentMethod,
            paypalConfirmed: isPayPalPayment, // PayPal ya confirmó el pago
            base64Image: isPayPalPayment ? null : receiptBase64, // No hay imagen si pagó con PayPal
            mimeType: receiptMime,
          })
        });
      } catch (notifyErr) {
        console.warn('Notificación al asesor falló (no crítico):', notifyErr);
      }
    } catch (error) { 
      console.error(error);
      toast({ variant: 'destructive', title: 'Error en el procesamiento' }); 
    } finally { setIsSaving(false); }
  };

  const handleOpenCubo = () => {
    window.open("https://link.cubopago.com/m_JPusnlxKnM", "_blank");
  };

  if (!mounted) return null;

  if (submittedFolio) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-green-100 flex flex-col items-center">
          <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6"><CheckCircle2 className="h-10 w-10 text-green-600" /></div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">¡Inscripción Completada!</h1>
          <div className="bg-blue-50 p-4 rounded-2xl mb-6 w-full border border-blue-100">
            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Tu Folio Oficial es:</p>
            <p className="text-4xl font-black text-blue-900">{String(submittedFolio).padStart(6, '0')}</p>
          </div>
          <p className="text-slate-600 mb-8 font-medium">Tu cupo ha sido reservado automáticamente. Por favor guarda tu número de folio para el día de inicio.</p>
          <Button asChild className="w-full h-12 text-lg font-bold"><Link href="/">Volver al Inicio</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 bg-white border-b flex items-center px-6 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900"><GanttChart className="h-6 w-6 text-primary" /><span>Freeway Escuela de Manejo</span></Link>
      </header>
      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900 font-headline uppercase tracking-tight">Inscripción Online Directa</h1>
          <p className="text-slate-500 font-medium">Automatiza tu ingreso: elige tu horario, paga y obtén tu folio oficial al instante.</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-primary text-white"><CardTitle className="text-lg font-bold uppercase">1. Información Personal</CardTitle></CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre Completo</FormLabel><FormControl><Input placeholder="Nombre..." {...field} className="h-11 uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Email</FormLabel><FormControl><Input type="email" placeholder="ejemplo@correo.com" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Cédula / ID</FormLabel><FormControl><Input placeholder="0-000-000" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Celular</FormLabel><FormControl><Input placeholder="6000-0000" {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="md:col-span-2"><FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</FormLabel><FormControl><Input placeholder="Ubicación..." {...field} className="h-11" /></FormControl><FormMessage /></FormItem>
                )} /></div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-slate-800 text-white"><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><BookOpen className="h-5 w-5" /> 2. Capacitación Teórica</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField control={form.control} name="coursePlan" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase">Plan Deseado</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent>{AUTO_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase">Tipo de Transmisión</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem></SelectContent></Select></FormItem>
                  )} />
                  <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold uppercase">Horario Teórico</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sabados 3:00 pm a 5:00 pm">Sábados 3:00 pm a 5:00 pm</SelectItem><SelectItem value="Semanal 8:00 am a 10:00 am">Semanal 8:00 am a 10:00 am</SelectItem></SelectContent></Select></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  {(form.watch('theoreticalClassDates') || []).map((_, i) => (
                    <FormField key={i} control={form.control} name={`theoreticalClassDates.${i}`} render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-500">Sesión {i + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-10 text-xs text-left">{field.value ? format(toDate(field.value), "dd/MM/yy") : 'Elegir'}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ? toDate(field.value) : undefined} onSelect={(date) => { if (date) field.onChange(date); }} initialFocus /></PopoverContent></Popover></FormItem>
                    )} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-blue-600 text-white"><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><Car className="h-5 w-5" /> 3. Propuesta Práctica</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6">
                {!watchPlan ? (
                  <div className="p-12 text-center border-2 border-dashed rounded-xl text-slate-400 font-bold uppercase text-xs">Elige un plan arriba para programar horas</div>
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
                      const isFull = (availabilityData.globalCounts[`${dateKey}|${slotId}`] || 0) >= (isValidDate ? getGlobalCapacity(dObj, slotId) : 3);

                      return (
                        <div key={field.id} className={cn("p-4 border rounded-2xl bg-white relative", (isFull || holiday || isSunday) ? "border-amber-500 bg-amber-50/10" : "border-slate-200")}>
                          <div className="absolute -top-2 right-3 flex gap-1 z-10">
                            {isSunday && <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Domingo</div>}
                            {holiday && !isSunday && <div className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Feriado</div>}
                            {isFull && !holiday && !isSunday && <div className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Lleno</div>}
                          </div>
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.date`} render={({ field: f }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-500">Clase {index + 1}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="h-10 w-full text-xs text-left">{f.value ? format(toDate(f.value), "PPP", { locale: es }) : "Elegir día"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={f.value ? toDate(f.value) : undefined} onSelect={(date) => { if (date) f.onChange(date); }} initialFocus disabled={(d) => d < new Date() || d.getDay() === 0} /></PopoverContent></Popover></FormItem>
                          )} />
                          <FormField control={form.control} name={`practicalClassSchedules.${index}.time`} render={({ field: f }) => (
                            <FormItem><Select onValueChange={f.onChange} value={f.value}><FormControl><SelectTrigger className="h-10 text-xs mt-2"><SelectValue /></SelectTrigger></FormControl><SelectContent>{TIME_OPTIONS.map(t => {
                              const tSlotId = TIME_STRING_TO_SLOT_MAP[t] || t;
                              const isSlotFull = isValidDate && (availabilityData.globalCounts[`${dateKey}|${tSlotId}`] || 0) >= getGlobalCapacity(dObj, tSlotId);
                              return <SelectItem key={t} value={t} disabled={isSlotFull} className={cn("text-xs", isSlotFull && "text-red-500 font-bold")}>{t}{isSlotFull ? ' (Lleno)' : ''}</SelectItem>;
                            })}</SelectContent></Select></FormItem>
                          )} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none overflow-hidden">
              <CardHeader className="bg-slate-900 text-white"><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><CreditCard className="h-5 w-5" /> 4. Pago de Reserva Automatizado</CardTitle></CardHeader>
              <CardContent className="p-6">
                <Tabs value={watchPaymentMethod} onValueChange={(v: any) => form.setValue('paymentMethod', v)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-100 rounded-xl p-1">
                    <TabsTrigger value="yappy" className="rounded-lg data-[state=active]:bg-[#004fb9] data-[state=active]:text-white font-bold gap-1 text-xs"><Smartphone className="h-4 w-4" /> Yappy</TabsTrigger>
                    <TabsTrigger value="credit_card" className="rounded-lg data-[state=active]:bg-[#16a34a] data-[state=active]:text-white font-bold gap-1 text-xs"><CreditCard className="h-4 w-4" /> Tarjeta</TabsTrigger>
                    <TabsTrigger value="paypal" className="rounded-lg data-[state=active]:bg-[#003087] data-[state=active]:text-white font-bold gap-1 text-xs"><Globe className="h-4 w-4" /> PayPal</TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-6 p-6 bg-slate-50 border rounded-2xl space-y-6">
                    <TabsContent value="yappy" className="m-0 space-y-6">
                      <div className="space-y-4">
                        <h4 className="font-black text-[#004fb9] uppercase tracking-tight">Instrucciones Yappy:</h4>
                        <ol className="text-xs space-y-2 text-slate-700 font-medium list-decimal pl-4">
                            <li>Haz clic en el botón inferior para realizar tu pago de reserva.</li>
                            <li>Al completar la transacción en tu App, **copia el número de confirmación**.</li>
                            <li>Ingresa el número abajo para que el sistema valide tu inscripción.</li>
                        </ol>
                        <Button asChild className="w-full bg-[#004fb9] hover:bg-[#003a8c] font-bold h-12 shadow-md">
                          <a href="https://link.yappy.com.pa/stc/dgXr5v%2BGA2xDgGKBkz%2BnBhSk16Vdr9BZvaim7nGhYrA%3D" target="_blank" rel="noopener noreferrer">
                            <Smartphone className="mr-2 h-5 w-5" /> Pagar con Yappy
                          </a>
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="credit_card" className="m-0 space-y-6">
                      <div className="space-y-4">
                        <h4 className="font-black text-[#16a34a] uppercase tracking-tight">Pago con Tarjeta (Cubo):</h4>
                        <ol className="text-xs space-y-2 text-slate-700 font-medium list-decimal pl-4">
                            <li>Haz clic en el botón inferior para pagar de forma segura.</li>
                            <li>Al finalizar, copia el **Número de comprobante** que genera Cubo.</li>
                            <li>Ingresa dicho número abajo para activar tu folio.</li>
                        </ol>
                        <Button type="button" onClick={() => setShowCuboModal(true)} className="w-full bg-[#16a34a] hover:bg-[#11823b] font-bold h-12 shadow-md">
                          <CreditCard className="mr-2 h-5 w-5" /> Pagar con Tarjeta
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="paypal" className="m-0 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 bg-[#003087]/5 border border-[#003087]/20 rounded-xl p-4">
                          <div className="w-10 h-10 rounded-lg bg-[#003087] flex items-center justify-center flex-shrink-0">
                            <Globe className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-[#003087] text-sm uppercase">PayPal</p>
                            <p className="text-xs text-slate-500">Tarjeta de crédito, débito o saldo PayPal</p>
                          </div>
                          {watchPlan && prices?.auto?.[watchPlan] && (
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Total</p>
                              <p className="text-xl font-black text-[#003087]">B/. {prices.auto[watchPlan].toFixed(2)}</p>
                            </div>
                          )}
                        </div>

                        {!watchPlan && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-medium">
                            ⚠ Primero selecciona un plan de curso en la Sección 2 para ver el precio total.
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Tu email de contacto</label>
                          <input
                            type="email"
                            placeholder="correo@ejemplo.com"
                            value={paypalEmail}
                            onChange={e => { setPaypalEmail(e.target.value); setPaypalError(''); }}
                            className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]/30"
                          />
                          <p className="text-[10px] text-slate-400">Lo usamos para enviarte el recibo de tu inscripción.</p>
                        </div>
                        {paypalError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-medium">{paypalError}</div>
                        )}
                        <Button
                          type="button"
                          onClick={handlePayPal}
                          disabled={paypalLoading}
                          className="w-full h-12 bg-[#003087] hover:bg-[#002060] font-bold shadow-md text-white disabled:opacity-70"
                        >
                          {paypalLoading
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando con PayPal...</>
                            : <><Globe className="mr-2 h-5 w-5" /> {watchPlan && prices?.auto?.[watchPlan] ? `Pagar B/. ${prices.auto[watchPlan].toFixed(2)} con PayPal` : 'Pagar con PayPal'}</>
                          }
                        </Button>
                        <p className="text-[9px] text-center text-slate-400 uppercase font-bold tracking-widest">🔒 Pago 100% seguro procesado por PayPal</p>
                      </div>
                    </TabsContent>

                    <div className="pt-4 border-t border-slate-200">
                      
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-4 mb-4 text-center">
                        <Camera className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
                        <h4 className="font-black text-indigo-900 uppercase text-xs">Validación por Inteligencia Artificial</h4>
                        <p className="text-[10px] text-indigo-700 font-medium mb-3">Sube la captura de pantalla de tu pago y la IA completará los datos.</p>
                        
                        <label className={cn("cursor-pointer bg-white hover:bg-slate-50 border-2 border-dashed border-indigo-300 rounded-lg h-12 flex items-center justify-center gap-2 font-bold text-xs uppercase text-indigo-700 transition", isReadingImage && "opacity-50 pointer-events-none")}>
                            {isReadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                            {isReadingImage ? 'Analizando...' : (form.watch('paymentReference') ? 'Subir Otra Captura' : 'Subir Screenshot de Pago')}
                            <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleImageUpload} disabled={isReadingImage} />
                        </label>
                      </div>

                      {form.watch('paymentReference') ? (
                         <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center mb-4 shadow-sm">
                           <div className="flex items-center justify-center gap-2 text-green-700 font-black text-sm mb-1 uppercase tracking-tight">
                             <ShieldCheck className="h-5 w-5" /> Comprobante Verificado
                           </div>
                           <p className="text-green-800 text-xs font-medium text-center">
                             Depósito validado por <b>B/. {form.watch('paymentAmount')}</b> con la ref: <b className="font-mono">{form.watch('paymentReference')}</b>.
                           </p>
                         </div>
                      ) : null}

                      <div className="hidden">
                      <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                          <FormItem><FormControl><Input type="number" step="0.01" min="50" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="paymentReference" render={({ field }) => (
                          <FormItem><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      </div>
                    </div>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            <Button type="submit" disabled={isSaving || !watchPlan || !form.watch('paymentReference')} className="w-full h-16 text-xl font-black shadow-xl uppercase tracking-widest bg-blue-600 hover:bg-blue-700">
              {isSaving ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Validando...</> : <><ShieldCheck className="mr-2 h-6 w-6" /> Finalizar Inscripción Ahora</>}
            </Button>
          </form>
        </Form>
      </main>

      <AlertDialog open={showCuboModal} onOpenChange={setShowCuboModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-2">
              <Info className="h-8 w-8 text-green-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-black uppercase text-slate-900">Instrucciones del Pago</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-4 pt-2">
              <p className="font-medium text-slate-700">Para finalizar tu inscripción, el sistema te pedirá el <span className="font-bold text-green-700">Número de Comprobante</span> de Cubo.</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2">
                <p className="font-bold text-slate-900">¿Dónde encontrarlo?</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>En la pantalla de <span className="font-bold">"Pago Exitoso"</span> al finalizar la transacción.</li>
                  <li>En el <span className="font-bold">correo electrónico</span> de confirmación que te enviará Cubo.</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground italic">Por favor, cópialo antes de cerrar la pestaña de pago para pegarlo en esta página.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleOpenCubo} className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold uppercase tracking-wider">
              Entendido, ir a pagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PublicEnrollmentPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <EnrollmentContent />
    </Suspense>
  );
}
