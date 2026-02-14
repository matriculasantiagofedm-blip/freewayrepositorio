'use client';

/**
 * FORMULARIO DE CONTRATO: AMPLIACIONES DE LICENCIA
 * Soporta creación y edición.
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
  RefreshCw
} from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import type { Contract } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const LICENSE_CATEGORIES = ['B', 'C', 'D', 'E1', 'E2', 'E3', 'F'];

const CATEGORY_PRICES: Record<string, number> = {
  'B': 57.00, 'C': 57.00, 'D': 57.00, 'E1': 57.00,
  'E2': 75.00, 'E3': 75.00, 'F': 85.00
};

const COMBINATION_PRICES: Record<string, number> = {
  'D, E1': 85.00, 'E1, E2': 75.00, 'E1, E2, E3': 85.00,
  'E1, E2, E3, F': 95.00, 'D, E1, E2, E3, F': 150.00,
  'B, E1, E2, E3, F': 150.00, 'B, D': 85.00, 'B, E1': 85.00,
  'E2, E3': 85.00, 'B, F': 85.00, 'B, D, E1, E2, E3, F': 200.00
};

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
  theoreticalClassTime: z.string().default('Semanal 8:00 am a 10:00 am'),
});

type FormValues = z.infer<typeof ampliacionesSchema>;

export function AmpliacionesContractForm({ contract }: { contract?: Contract }) {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!contract;

  const form = useForm<FormValues>({
    resolver: zodResolver(ampliacionesSchema),
    defaultValues: isEdit ? {
      ...contract.ampliacionesDetails,
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      paymentDeadline: toDate(contract.ampliacionesDetails?.paymentDeadline),
      theoreticalClassDate: toDate(contract.ampliacionesDetails?.theoreticalClassDate),
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '',
      studentAddress: '', studentPhone1: '', licenseCategory: '',
      courseValue: 0, downPayment: 0, paymentType: 'cash',
      theoreticalClassTime: 'Semanal 8:00 am a 10:00 am',
    },
  });

  const watchCategories = form.watch('licenseCategory');

  useEffect(() => {
    if (!isEdit) {
        const categories = watchCategories ? watchCategories.split(', ').filter(c => c) : [];
        if (categories.length === 0) { form.setValue('courseValue', 0); return; }
        const sortedKey = [...categories].sort().join(', ');
        if (COMBINATION_PRICES[sortedKey]) {
          form.setValue('courseValue', COMBINATION_PRICES[sortedKey]);
        } else {
          const total = categories.reduce((sum, cat) => sum + (CATEGORY_PRICES[cat] || 0), 0);
          form.setValue('courseValue', total);
        }
    }
  }, [watchCategories, form, isEdit]);

  const toggleCategory = (category: string) => {
    const current = form.getValues('licenseCategory');
    const categories = current ? current.split(', ').filter(c => c) : [];
    let newCategories = categories.includes(category) ? categories.filter(c => c !== category) : [...categories, category].sort();
    form.setValue('licenseCategory', newCategories.join(', '), { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      const balance = values.courseValue - values.downPayment;
      const { clientName, clientEmail, ...detailsOnly } = values;

      if (isEdit) {
        const contractRef = doc(db, 'contracts', contract.id);
        const updateData = {
          clientName: clientName,
          clientEmail: clientEmail,
          status: balance <= 0 ? 'completed' : contract.status,
          ampliacionesDetails: {
            ...detailsOnly,
            paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
            theoreticalClassDate: values.theoreticalClassDate ? Timestamp.fromDate(values.theoreticalClassDate) : null,
            balance: balance,
          },
          updatedAt: serverTimestamp(),
          updatedBy: role || 'Sistema',
        };

        updateDoc(contractRef, updateData)
          .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: contractRef.path,
              operation: 'update',
              requestResourceData: updateData
            }));
          });

        toast({ title: 'Ampliación Actualizada' });
        router.push(`/contracts/${contract.id}`);
      } else {
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
          transaction.set(contractRef, {
            title: `Contrato de Ampliación - Folio ${nextFolio}`,
            clientName: clientName,
            clientEmail: clientEmail,
            clientId: clientRef.id,
            folioNumber: nextFolio,
            type: 'Ampliaciones',
            status: balance <= 0 ? 'completed' : 'active',
            userId: user.uid,
            createdBy: role || 'Sistema',
            createdAt: serverTimestamp(),
            ampliacionesDetails: {
              ...detailsOnly,
              paymentDeadline: values.paymentDeadline ? Timestamp.fromDate(values.paymentDeadline) : null,
              theoreticalClassDate: values.theoreticalClassDate ? Timestamp.fromDate(values.theoreticalClassDate) : null,
              balance: balance,
            }
          });
        });
        toast({ title: 'Ampliación Guardada' });
        router.push('/dashboard');
      }
    } catch (error) {
      console.error("Error al guardar ampliación:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = form.watch('courseValue') - form.watch('downPayment');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-20">
        <Card className="border-t-4 border-t-amber-600 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Ficha (Ampliación)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-8">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre</FormLabel><FormControl><Input placeholder="Nombre..." {...field} className="h-9 uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Email</FormLabel><FormControl><Input type="email" placeholder="ejemplo@correo.com" {...field} className="h-9" /></FormControl></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentIdNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Cédula</FormLabel><FormControl><Input placeholder="8-000-000" {...field} className="h-9 font-mono" readOnly={isEdit} /></FormControl></FormItem>
                )} />
              </div>
              <div className="col-span-12 md:col-span-6">
                <FormField control={form.control} name="studentPhone1" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono</FormLabel><FormControl><Input placeholder="6000-0000" {...field} className="h-9" /></FormControl></FormItem>
                )} />
              </div>
              <div className="col-span-12">
                <FormField control={form.control} name="studentAddress" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</FormLabel><FormControl><Input placeholder="Ubicación..." {...field} className="h-9 uppercase" /></FormControl></FormItem>
                )} />
              </div>
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
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Valor (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-black text-amber-900 bg-amber-50/30" readOnly={!isEdit} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="downPayment" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Abono (B/.)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-10 font-bold text-green-600" /></FormControl></FormItem>
              )} />
              <div className="flex flex-col gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Saldo</Label><div className="flex items-center h-10 px-4 bg-red-50 rounded-md border border-red-100"><span className="text-lg font-black text-red-900">B/. {currentBalance.toFixed(2)}</span></div></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={isSaving} className={cn("min-w-[220px]", isEdit ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700")}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEdit ? <RefreshCw className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isEdit ? 'Actualizar Ampliación' : 'Guardar Ampliación'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
