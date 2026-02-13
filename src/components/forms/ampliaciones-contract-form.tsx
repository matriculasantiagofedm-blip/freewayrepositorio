'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { UserCircle, Settings2, Save, DollarSign, Clock, Loader2, CalendarIcon } from 'lucide-react';
import { toDate } from '@/lib/utils';
import { Timestamp, collection, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useDb, useUser } from '../firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useToast } from '@/hooks/use-toast';
import type { Contract } from '@/lib/types';

const calculatePrice = (cats: string[]) => {
  const s = new Set(cats.map(c => c.toUpperCase()));
  // Combos de descuento automáticos
  if (s.has('B') && s.has('D') && s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 200;
  if ((s.has('B') || s.has('D')) && s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 150;
  if (s.has('E1') && s.has('E2') && s.has('E3') && s.has('F')) return 95;
  if (s.has('E1') && s.has('E2') && s.has('E3')) return 85;
  if (s.has('D') && s.has('E1')) return 85;
  if (s.has('E1') && s.has('E2')) return 75;
  
  // Suma individual si no hay combo
  let total = 0;
  s.forEach(c => {
    if (['B', 'C', 'D', 'E1'].includes(c)) total += 57;
    else if (['E2', 'E3'].includes(c)) total += 75;
    else if (c === 'F') total += 85;
  });
  return total;
};

const schema = z.object({
  clientName: z.string().min(1, 'Requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(1, 'Requerido'),
  studentAddress: z.string().min(1, 'Requerido'),
  studentPhone1: z.string().min(1, 'Requerido'),
  licenseCategory: z.string().min(1, 'Seleccione categorías'),
  courseValue: z.coerce.number().min(0),
  downPayment: z.coerce.number().min(0),
  balance: z.coerce.number().min(0),
  paymentDeadline: z.date().optional().nullable(),
  paymentType: z.string().default('cash'),
  theoreticalClassDate: z.date().optional().nullable(),
  theoreticalClassTime: z.string().optional(),
});

export function AmpliacionesContractForm({ initialContract }: { initialContract?: Contract }) {
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
      idType: initialContract.ampliacionesDetails?.idType || 'C.I.P.',
      studentIdNumber: initialContract.ampliacionesDetails?.studentIdNumber || '',
      studentAddress: initialContract.ampliacionesDetails?.studentAddress || '',
      studentPhone1: initialContract.ampliacionesDetails?.studentPhone1 || '',
      licenseCategory: initialContract.ampliacionesDetails?.licenseCategory || '',
      courseValue: initialContract.ampliacionesDetails?.courseValue || 0,
      downPayment: initialContract.ampliacionesDetails?.downPayment || 0,
      balance: initialContract.ampliacionesDetails?.balance || 0,
      paymentDeadline: initialContract.ampliacionesDetails?.paymentDeadline ? toDate(initialContract.ampliacionesDetails.paymentDeadline) : null,
      paymentType: initialContract.ampliacionesDetails?.paymentType || 'cash',
      theoreticalClassDate: initialContract.ampliacionesDetails?.theoreticalClassDate ? toDate(initialContract.ampliacionesDetails.theoreticalClassDate) : null,
      theoreticalClassTime: initialContract.ampliacionesDetails?.theoreticalClassTime || '',
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '', studentAddress: '', studentPhone1: '',
      licenseCategory: '', courseValue: 0, downPayment: 0, balance: 0, paymentType: 'cash',
    },
  });

  const watchCats = form.watch('licenseCategory');
  const watchValue = form.watch('courseValue');
  const watchDown = form.watch('downPayment');

  useEffect(() => {
    if (!initialContract) {
        const cats = watchCats ? watchCats.split(',').map(c => c.trim()).filter(c => c) : [];
        form.setValue('courseValue', calculatePrice(cats));
    }
  }, [watchCats, form, initialContract]);

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
            id: contractId, 
            folioNumber: folio, 
            title: 'Ampliaciones', 
            clientName: values.clientName, 
            clientEmail: values.clientEmail,
            clientId: values.studentIdNumber, 
            type: 'Ampliaciones', 
            status: initialContract?.status || 'active',
            userId: user.uid, 
            createdBy: initialContract?.createdBy || role || 'Sistema', 
            updatedAt: serverTimestamp(),
            createdAt: initialContract?.createdAt || serverTimestamp(),
            ampliacionesDetails: {
                idType: values.idType, 
                studentIdNumber: values.studentIdNumber, 
                studentAddress: values.studentAddress,
                studentPhone1: values.studentPhone1, 
                licenseCategory: values.licenseCategory, 
                courseValue: values.courseValue,
                downPayment: values.downPayment, 
                balance: values.balance, 
                paymentType: values.paymentType,
                paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
                theoreticalClassDate: values.theoreticalClassDate ? Timestamp.fromDate(values.theoreticalClassDate) : null,
                theoreticalClassTime: values.theoreticalClassTime,
            }
        };
        
        if (!initialContract) transaction.set(contractRef, finalData);
        else transaction.update(contractRef, finalData);
      });
      toast({ title: 'Éxito', description: 'Trámite de ampliación guardado correctamente.' });
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
        <Card className="border-t-4 border-t-indigo-600 shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5 text-indigo-600" />
                    <CardTitle className="text-sm font-bold uppercase">Datos del Estudiante (Compacto)</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-12 gap-4 pt-6">
                <div className="col-span-8">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Nombre Completo</FormLabel>
                            <FormControl><Input {...field} className="h-9 font-semibold" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="col-span-4">
                    <FormField control={form.control} name="clientEmail" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel>
                            <FormControl><Input {...field} className="h-9" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                <div className="col-span-2">
                    <FormField control={form.control} name="idType" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Tipo ID</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="C.I.P.">C.I.P.</SelectItem>
                                    <SelectItem value="PASS">PASS</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
                <div className="col-span-4">
                    <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Identificación</FormLabel>
                            <FormControl><Input {...field} className="h-9 font-mono" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="col-span-6">
                    <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono</FormLabel>
                            <FormControl><Input {...field} className="h-9" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                <div className="col-span-12">
                    <FormField control={form.control} name="studentAddress" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Dirección Residencial</FormLabel>
                            <FormControl><Input {...field} className="h-9 text-xs" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-indigo-600" /><CardTitle className="text-sm font-bold uppercase">Configuración de Ampliación</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <FormField control={form.control} name="licenseCategory" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Categorías a Ampliar (Ej: D, E1, F)</FormLabel><FormControl><Input {...field} className="h-10 font-bold" /></FormControl></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="theoreticalClassDate" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Fecha Teoría</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-10 text-xs"><CalendarIcon className="mr-2 h-3 w-3" /> {field.value ? format(toDate(field.value), "dd/MM/yy") : "Seleccionar"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>)} />
                    <FormField control={form.control} name="theoreticalClassTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Horario</FormLabel><FormControl><Input {...field} placeholder="Ej: 8:00 am" className="h-10" /></FormControl></FormItem>)} />
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-md border-b-4 border-b-indigo-600/20">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-indigo-600" /><CardTitle className="text-sm font-bold uppercase">Información de Pago</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6">
                <FormField control={form.control} name="courseValue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Total (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="downPayment" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 text-green-700 font-bold" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="balance" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</FormLabel><FormControl><Input className="h-10 bg-muted font-black text-destructive" readOnly {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="paymentDeadline" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Límite</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-10 text-xs">{field.value ? format(toDate(field.value), "dd/MM/yy") : "Fecha"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus /></PopoverContent></FormItem>)} />
                <FormField control={form.control} name="paymentType" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Método</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">T.Débito</SelectItem><SelectItem value="credit">T.Crédito</SelectItem></Select></FormControl></FormItem>)} />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" size="lg" className="px-12 h-14 text-lg font-bold shadow-xl bg-indigo-600 hover:bg-indigo-700" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                {initialContract ? 'Actualizar Ampliación' : 'Generar Ampliación'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
