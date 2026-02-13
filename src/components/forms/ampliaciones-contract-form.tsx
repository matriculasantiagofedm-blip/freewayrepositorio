'use client';

/**
 * FORMULARIO DE CONTRATO: AMPLIACIONES DE LICENCIA
 * Freeway Escuela de Manejo, S.A.
 * 
 * - Ficha de estudiante técnica (12 columnas) ULTRA COMPACTA.
 * - Selector de categorías por botones (Individuales y Combinaciones).
 * - Programación de sesión teórica única.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  Timestamp 
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
  Repeat, 
  CreditCard, 
  Clock,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';

const LICENSE_CATEGORIES = ['E1', 'E2', 'E3', 'F', 'G', 'H', 'I', 'B', 'C', 'D'];

const ampliacionesSchema = z.object({
  clientName: z.string().min(3, 'El nombre es requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(5, 'ID requerido'),
  studentAddress: z.string().min(5, 'Dirección requerida'),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
  licenseCategory: z.string().min(1, 'Seleccione al menos una categoría'),
  courseValue: z.coerce.number().min(1, 'Monto inválido'),
  downPayment: z.coerce.number().min(0),
  paymentDeadline: z.date({ required_error: 'Fecha límite requerida' }),
  paymentType: z.string().default('cash'),
  theoreticalClassDate: z.date({ required_error: 'Fecha de teoría requerida' }),
  theoreticalClassTime: z.string().default('08:00 am a 10:00 am'),
});

type FormValues = z.infer<typeof ampliacionesSchema>;

export function AmpliacionesContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(ampliacionesSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      idType: 'C.I.P.',
      studentIdNumber: '',
      studentAddress: '',
      studentPhone1: '',
      licenseCategory: '',
      courseValue: 0,
      downPayment: 0,
      paymentType: 'cash',
      theoreticalClassTime: '08:00 am a 10:00 am',
    },
  });

  const toggleCategory = (category: string) => {
    const current = form.getValues('licenseCategory');
    const categories = current ? current.split(', ').filter(c => c) : [];
    
    let newCategories;
    if (categories.includes(category)) {
      newCategories = categories.filter(c => c !== category);
    } else {
      newCategories = [...categories, category].sort();
    }
    
    form.setValue('licenseCategory', newCategories.join(', '), { shouldValidate: true });
  };

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

        transaction.set(contractRef, {
          title: `Ampliación ${values.licenseCategory} - Folio ${nextFolio}`,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientId: clientRef.id,
          folioNumber: nextFolio,
          type: 'Ampliaciones',
          status: balance <= 0 ? 'completed' : 'active',
          userId: user.uid,
          createdBy: role || 'Sistema',
          createdAt: serverTimestamp(),
          ampliacionesDetails: {
            ...values,
            paymentDeadline: Timestamp.fromDate(values.paymentDeadline),
            theoreticalClassDate: Timestamp.fromDate(values.theoreticalClassDate),
            balance: balance,
          }
        });
      });

      toast({ title: 'Ampliación Registrada', description: 'El contrato se ha guardado correctamente.' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error saving contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al procesar el registro.' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = form.watch('courseValue') - form.watch('downPayment');
  const selectedCategories = form.watch('licenseCategory').split(', ').filter(c => c);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-20">
        
        {/* SECCIÓN 1: DATOS DEL ESTUDIANTE (12 COLUMNAS) */}
        <Card className="border-t-4 border-t-amber-600 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Ficha Estudiantil (Ampliación)</CardTitle>
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

        {/* SECCIÓN 2: DETALLES DE LA AMPLIACIÓN (BOTONES) */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Detalles de la Ampliación</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Seleccionar Categorías Destino (Individuales o Combinadas)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                {LICENSE_CATEGORIES.map(cat => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <Button
                      key={cat}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "h-12 font-black transition-all",
                        isSelected && "bg-amber-600 hover:bg-amber-700 scale-105 shadow-md"
                      )}
                      onClick={() => toggleCategory(cat)}
                    >
                      {cat}
                    </Button>
                  );
                })}
              </div>
              <FormField control={form.control} name="licenseCategory" render={({ field }) => (
                <FormItem>
                  <FormControl><Input type="hidden" {...field} /></FormControl>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Selección Actual:</span>
                    <span className="text-sm font-black text-amber-700">{field.value || 'Ninguna'}</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
              <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Fecha Sesión Teórica</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl><Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal text-xs", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Elegir fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Horario del Trámite</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="08:00 am a 10:00 am">08:00 am a 10:00 am</SelectItem>
                      <SelectItem value="10:00 am a 12:00 pm">10:00 am a 12:00 pm</SelectItem>
                      <SelectItem value="01:00 pm a 03:00 pm">01:00 pm a 03:00 pm</SelectItem>
                      <SelectItem value="03:00 pm a 05:00 pm">03:00 pm a 05:00 pm</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN 3: GESTIÓN DE COBRO */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Gestión de Cobro</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <FormField control={form.control} name="courseValue" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor del Trámite (B/.)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold" /></FormControl>
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
                <div className="flex items-center h-10 px-4 bg-amber-50 rounded-md border border-amber-100">
                  <span className="text-lg font-black text-amber-900">B/. {currentBalance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <FormField control={form.control} name="paymentType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago</FormLabel>
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
              
              <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                <FormItem className="flex flex-col">
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

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={isSaving} className="min-w-[220px] bg-amber-600 hover:bg-amber-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar Ampliación
          </Button>
        </div>
      </form>
    </Form>
  );
}
