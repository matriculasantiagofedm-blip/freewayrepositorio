'use client';

/**
 * FORMULARIO DE CONTRATO: AMPLIACIONES DE LICENCIA
 * Reintegra botones de selección por letras y lógica de precios por combinación.
 * Soporta descarga de PDF en tiempo real.
 */

import { useState, useEffect } from 'react';
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
  Timestamp,
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
  RefreshCw,
  Tag,
  Download
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import type { Contract } from '@/lib/types';
import { AmpliacionesContractTemplate } from '@/components/ampliaciones-contract';
import { CameraCapture } from '@/components/camera-capture';

import { useSettingsPrices } from '@/hooks/use-settings-prices';

const LICENSE_CATEGORIES = ['B', 'C', 'D', 'E1', 'E2', 'E3', 'F'];

const CATEGORY_PRICES: Record<string, number> = {
  'B': 57.00, 'C': 57.00, 'D': 57.00, 'E1': 57.00,
  'E2': 75.00, 'E3': 75.00, 'F': 85.00
};

const COMBINATION_PRICES: Record<string, number> = {
  'D, E1': 85.00,
  'E1, E2': 75.00,
  'E1, E2, E3': 85.00,
  'E1, E2, E3, F': 95.00,
  'D, E1, E2, E3, F': 150.00,
  'B, E1, E2, E3, F': 150.00,
  'B, D': 85.00,
  'B, E1': 85.00,
  'E2, E3': 85.00,
  'B, F': 85.00,
  'B, D, E1, E2, E3, F': 200.00
};

const ampliacionesSchema = z.object({
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
  studentAddressLocality: z.string().optional(),
  studentPhone1: z.string().min(7, 'Teléfono requerido'),
  studentPhone2: z.string().optional(),
  licenseCategory: z.string().min(1, 'Seleccione al menos una categoría'),
  courseValue: z.coerce.number().min(1, 'Monto inválido'),
  downPayment: z.coerce.number().min(0),
  paymentDeadline: z.date({ required_error: 'Fecha límite requerida' }).optional().nullable(),
  paymentType: z.string().default('cash'),
  theoreticalClassDate: z.date({ required_error: 'Fecha de teoría requerida' }).optional().nullable(),
  theoreticalClassTime: z.string().default('Semanal 8:00 am a 10:00 am'),
  photoDataUri: z.string().optional(),
  idCardDataUri: z.string().optional(),
  licenseDataUri: z.string().optional(),
});

type FormValues = z.infer<typeof ampliacionesSchema>;

export function AmpliacionesContractForm({ contract, initialData }: { contract?: Contract; initialData?: { name?: string; phone?: string } }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { prices: settingsPrices } = useSettingsPrices();
  const isEdit = !!contract;

  const categoryPrices = settingsPrices?.ampliaciones || CATEGORY_PRICES;
  const comboPrices = settingsPrices?.combos || COMBINATION_PRICES;

  const form = useForm<FormValues>({
    resolver: zodResolver(ampliacionesSchema),
    defaultValues: isEdit ? {
      ...contract.ampliacionesDetails,
      clientName: contract.clientName,
      firstName: (contract as any)?.ampliacionDetails?.firstName || (contract as any)?.autoMotoDetails?.firstName || '',
      secondName: (contract as any)?.ampliacionDetails?.secondName || '',
      firstLastName: (contract as any)?.ampliacionDetails?.firstLastName || '',
      secondLastName: (contract as any)?.ampliacionDetails?.secondLastName || '',
      marriedLastName: (contract as any)?.ampliacionDetails?.marriedLastName || '',
      clientEmail: contract.clientEmail,
      paymentDeadline: toDate(contract.ampliacionesDetails?.paymentDeadline),
      theoreticalClassDate: toDate(contract.ampliacionesDetails?.theoreticalClassDate),
      photoDataUri: (contract.ampliacionesDetails as any)?.photoDataUri || '',
      idCardDataUri: (contract.ampliacionesDetails as any)?.idCardDataUri || '',
      licenseDataUri: (contract.ampliacionesDetails as any)?.licenseDataUri || '',
    } : {
      clientName: initialData?.name || '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '',
      studentAddress: '', studentPhone1: initialData?.phone || '', studentPhone2: '', licenseCategory: '',
      courseValue: 0, downPayment: 0, paymentType: 'cash',
      theoreticalClassTime: 'Semanal 8:00 am a 10:00 am',
      photoDataUri: '',
      idCardDataUri: '',
      licenseDataUri: '',
    },
  });

  const watchCategories = form.watch('licenseCategory');

  useEffect(() => {
    if (!isEdit) {
        const categories = watchCategories ? watchCategories.split(', ').filter(c => c) : [];
        if (categories.length === 0) {
          form.setValue('courseValue', 0);
          return;
        }
        
        // Ordenar alfabéticamente para buscar en COMBINATION_PRICES
        const sortedKey = [...categories].sort().join(', ');
        
        if (comboPrices[sortedKey]) {
          form.setValue('courseValue', comboPrices[sortedKey]);
        } else {
          // Si no es una combinación exacta, sumar los precios individuales
          const total = categories.reduce((sum, cat) => sum + (categoryPrices[cat] || 0), 0);
          form.setValue('courseValue', total);
        }
    }
  }, [watchCategories, form, isEdit, categoryPrices, comboPrices]);

  const toggleCategory = (category: string) => {
    const current = form.getValues('licenseCategory');
    const categories = current ? current.split(', ').filter(c => c) : [];
    
    let newCategories: string[];
    if (categories.includes(category)) {
      newCategories = categories.filter(c => c !== category);
    } else {
      newCategories = [...categories, category];
    }
    
    // Mantener orden alfabético
    newCategories.sort();
    
    form.setValue('licenseCategory', newCategories.join(', '), { shouldValidate: true });
  };

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
        filename: `Contrato_Ampliacion_Borrador_${clientFileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', width: 820 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "Borrador de ampliación descargado." });
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
      // Excluir campos que NO van dentro de ampliacionesDetails
      const { 
        clientName, 
        clientEmail, 
        firstName,
        secondName,
        firstLastName,
        secondLastName,
        marriedLastName,
        photoDataUri,
        idCardDataUri,
        licenseDataUri,
        paymentDeadline,
        theoreticalClassDate,
        ...cleanDetails 
      } = values;
      const finalRole = role || 'Sistema';

      const ampliacionesDetailsPayload = {
        ...cleanDetails,
        paymentDeadline: paymentDeadline ? Timestamp.fromDate(paymentDeadline) : null,
        theoreticalClassDate: theoreticalClassDate ? Timestamp.fromDate(theoreticalClassDate) : null,
        balance: balance,
      };

      if (isEdit) {
        const contractRef = doc(db, 'contracts', contract.id);
        await updateDoc(contractRef, {
          clientName,
          clientEmail,
          status: balance <= 0 ? 'completed' : contract.status,
          ampliacionesDetails: ampliacionesDetailsPayload,
          // Fotos guardadas a nivel raíz del contrato (igual que auto/moto)
          ...(photoDataUri ? { photoDataUri } : {}),
          ...(idCardDataUri ? { idCardDataUri } : {}),
          ...(licenseDataUri ? { licenseDataUri } : {}),
          updatedAt: serverTimestamp(),
          updatedBy: finalRole,
        });
        toast({ title: 'Ampliación Actualizada' });
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
            title: `Contrato de Ampliación - Folio ${nextFolio}`,
            clientName,
            clientEmail,
            clientId: clientRef.id,
            folioNumber: nextFolio,
            type: 'Ampliaciones',
            status: balance <= 0 ? 'completed' : 'active',
            userId: user.uid,
            createdBy: finalRole,
            createdAt: serverTimestamp(),
            activatedAt: serverTimestamp(), // Vital para reportes
            // Fotos guardadas a nivel raíz del contrato (igual que auto/moto)
            ...(photoDataUri ? { photoDataUri } : {}),
            ...(idCardDataUri ? { idCardDataUri } : {}),
            ...(licenseDataUri ? { licenseDataUri } : {}),
            ampliacionesDetails: ampliacionesDetailsPayload,
          });
        });
        toast({ title: 'Ampliación Guardada' });
        if (createdId) router.push(`/contracts/${createdId}`);
      }
    } catch (error: any) {
      console.error("Error al guardar ampliación:", error);
      const msg = error?.message || 'No se pudo guardar el registro.';
      toast({ variant: 'destructive', title: 'Error al guardar', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = (Number(form.watch('courseValue')) || 0) - (Number(form.watch('downPayment')) || 0);
  const selectedList = watchCategories ? watchCategories.split(', ').filter(c => c) : [];

  // Dummy contract for PDF
  const watchAll = form.watch();
  const dummyContractForPdf: any = {
    clientName: watchAll.clientName,
    clientEmail: watchAll.clientEmail,
    type: 'Ampliaciones',
    folioNumber: contract?.folioNumber || 0,
    createdAt: contract?.createdAt || new Date(),
    createdBy: role || 'Sistema',
    ampliacionesDetails: {
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
          <AmpliacionesContractTemplate contract={dummyContractForPdf} />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 max-w-5xl mx-auto pb-20">
          <Card className="border-t-4 border-t-amber-600 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Ficha del Estudiante (Ampliación)</CardTitle>
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
                    label="Licencia Actual"
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
                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Email</FormLabel>
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
                          <SelectContent>
                            <SelectItem value="C.I.P.">C.I.P.</SelectItem>
                            <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                          </SelectContent>
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
                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</FormLabel>
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
                <Tag className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Selección de Categorías</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-slate-500">Haz clic en las letras correspondientes:</Label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {LICENSE_CATEGORIES.map(cat => {
                    const isSelected = selectedList.includes(cat);
                    return (
                      <Button 
                        key={cat} 
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "h-12 text-lg font-black transition-all",
                          isSelected ? "bg-amber-600 text-white hover:bg-amber-700" : "hover:border-amber-400 hover:bg-amber-50"
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
                    <FormControl><Input {...field} readOnly className="hidden" /></FormControl>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedList.length > 0 ? selectedList.map(c => (
                        <span key={c} className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded uppercase border border-amber-200">Tipo {c}</span>
                      )) : <span className="text-xs italic text-muted-foreground">Ninguna categoría seleccionada</span>}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Valores y Pagos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <FormField control={form.control} name="courseValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor Total (B/.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-black text-amber-900 bg-amber-50/30" readOnly={!isEdit} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="downPayment" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono Inicial (B/.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl>
                  </FormItem>
                )} />
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Pendiente</Label>
                  <div className="flex items-center h-10 px-4 bg-red-50 rounded-md border border-red-100">
                    <span className="text-lg font-black text-red-900">B/. {currentBalance.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Fecha Límite para Saldo</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(toDate(field.value), "PPP", { locale: es }) : <span>Seleccionar día</span>}
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
                <FormField control={form.control} name="paymentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Programación de Teoría</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Fecha de Clase</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(toDate(field.value), "PPP", { locale: es }) : <span>Elegir fecha</span>}
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
              <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Horario Seleccionado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Semanal 8:00 am a 10:00 am">Semanal 8:00 am a 10:00 am</SelectItem>
                      <SelectItem value="Sabados 3:00 pm a 5:00 pm">Sábados 3:00 pm a 5:00 pm</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

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
            <Button type="submit" size="lg" disabled={isSaving} className={cn("min-w-[220px]", isEdit ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700")}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEdit ? <RefreshCw className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {isEdit ? 'Actualizar Ampliación' : 'Guardar Ampliación'}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
