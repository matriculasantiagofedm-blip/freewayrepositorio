'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { UserCircle, Settings2, Save, DollarSign, Loader2, CalendarIcon } from 'lucide-react';
import { toDate } from '@/lib/utils';
import { Timestamp, collection, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useDb, useUser } from '../firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useToast } from '@/hooks/use-toast';
import type { Contract } from '@/lib/types';

const schema = z.object({
  clientName: z.string().min(1, 'Requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(1, 'Requerido'),
  studentAddress: z.string().min(1, 'Requerido'),
  studentPhone1: z.string().min(1, 'Requerido'),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional().nullable(),
  paymentType: z.string().default('cash'),
  vehicleTransmission: z.enum(['Automático', 'Manual', 'Moto']).default('Automático'),
});

export function SoloPracticaContractForm({ initialContract }: { initialContract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: initialContract ? {
      clientName: initialContract.clientName,
      clientEmail: initialContract.clientEmail,
      idType: initialContract.autoMotoDetails?.idType || 'C.I.P.',
      studentIdNumber: initialContract.autoMotoDetails?.studentIdNumber || '',
      studentAddress: initialContract.autoMotoDetails?.studentAddress || '',
      studentPhone1: initialContract.autoMotoDetails?.studentPhone1 || '',
      courseValue: initialContract.autoMotoDetails?.courseValue || 0,
      downPayment: initialContract.autoMotoDetails?.downPayment || 0,
      balance: initialContract.autoMotoDetails?.balance || 0,
      paymentDeadline: initialContract.autoMotoDetails?.paymentDeadline ? toDate(initialContract.autoMotoDetails.paymentDeadline) : null,
      paymentType: initialContract.autoMotoDetails?.paymentType || 'cash',
      vehicleTransmission: (initialContract.autoMotoDetails?.vehicleTransmission as any) || 'Automático',
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '', studentAddress: '', studentPhone1: '',
      courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash', vehicleTransmission: 'Automático',
    },
  });

  const watchValue = form.watch('courseValue');
  const watchDown = form.watch('downPayment');

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
            id: contractId, folioNumber: folio, title: 'Curso Solo Practica', clientName: values.clientName, clientEmail: values.clientEmail,
            clientId: values.studentIdNumber, type: 'Curso Solo Practica', status: initialContract?.status || 'active',
            userId: user.uid, createdBy: initialContract?.createdBy || role || 'Sistema', updatedAt: serverTimestamp(),
            createdAt: initialContract?.createdAt || serverTimestamp(),
            autoMotoDetails: {
                idType: values.idType, studentIdNumber: values.studentIdNumber, studentAddress: values.studentAddress,
                studentPhone1: values.studentPhone1, courseValue: values.courseValue, downPayment: values.downPayment,
                balance: values.balance, paymentType: values.paymentType,
                paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
                vehicleTransmission: values.vehicleTransmission, licenseCategory: 'No Aplica'
            }
        };
        
        if (!initialContract) transaction.set(contractRef, finalData);
        else transaction.update(contractRef, finalData);
      });
      toast({ title: 'Éxito', description: 'Registro guardado.' });
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
        <Card className="border-t-4 border-t-teal-600 shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-teal-600" /><CardTitle className="text-sm font-bold uppercase">Datos del Estudiante (Compacto)</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-12 gap-x-4 gap-y-3 pt-6">
                <div className="col-span-8"><FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo</FormLabel><FormControl><Input {...field} className="h-9 font-semibold" /></FormControl></FormItem>)} /></div>
                <div className="col-span-4"><FormField control={form.control} name="clientEmail" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl></FormItem>)} /></div>
                <div className="col-span-2"><FormField control={form.control} name="idType" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Tipo ID</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="C.I.P.">C.I.P.</SelectItem><SelectItem value="PASS">PASS</SelectItem></Select></FormItem>)} /></div>
                <div className="col-span-4"><FormField control={form.control} name="studentIdNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Identificación</FormLabel><FormControl><Input {...field} className="h-9 font-mono" /></FormControl></FormItem>)} /></div>
                <div className="col-span-6"><FormField control={form.control} name="studentPhone1" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono</FormLabel><FormControl><Input {...field} className="h-9" /></FormControl></FormItem>)} /></div>
                <div className="col-span-12"><FormField control={form.control} name="studentAddress" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Dirección Residencial</FormLabel><FormControl><Input {...field} className="h-9 text-xs" /></FormControl></FormItem>)} /></div>
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-teal-600" /><CardTitle className="text-sm font-bold uppercase">Configuración Solo Práctica</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <FormField control={form.control} name="vehicleTransmission" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Tipo de Vehículo / Transmisión</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Automático">Automático</SelectItem><SelectItem value="Manual">Manual</SelectItem><SelectItem value="Moto">Moto</SelectItem></Select></FormControl></FormItem>)} />
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-teal-600" /><CardTitle className="text-sm font-bold uppercase">Información de Pago</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6">
                <FormField control={form.control} name="courseValue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Total (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="downPayment" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 text-green-700 font-bold" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="balance" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</FormLabel><FormControl><Input className="h-10 bg-muted font-black text-destructive" readOnly {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Límite</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-10 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></FormItem>)} />
                <FormField control={form.control} name="paymentType" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Método</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">T.Débito</SelectItem><SelectItem value="credit">T.Crédito</SelectItem></Select></FormControl></FormItem>)} />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" size="lg" className="px-12 h-14 text-lg font-bold shadow-xl bg-teal-600 hover:bg-teal-700" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                {initialContract ? 'Actualizar Registro' : 'Generar Solo Práctica'}
            </Button>
        </div>
      </form>
    </Form>
  );
}