'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addWeeks } from 'date-fns';
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

const deluxePlans = [
    { id: 'premium', label: 'Deluxe Premium (12 semanas)', price: 201.00, installments: 33.50 },
    { id: 'full', label: 'Deluxe Full (16 semanas)', price: 270.00, installments: 45.00 },
];

const schema = z.object({
  clientName: z.string().min(1, 'Requerido'),
  clientEmail: z.string().email('Email inválido'),
  idType: z.string().default('C.I.P.'),
  studentIdNumber: z.string().min(1, 'Requerido'),
  studentAddress: z.string().min(1, 'Requerido'),
  studentPhone1: z.string().min(1, 'Requerido'),
  coursePlan: z.string().min(1, 'Seleccione plan'),
  courseValue: z.coerce.number().min(0),
  vehicleTransmission: z.enum(['Automático', 'Manual']).default('Automático'),
  licenseCategory: z.string().default('A, C'),
  theoreticalClassSchedule: z.string().default('Lunes'),
  startDate: z.date({ required_error: 'Fecha de inicio requerida' }),
});

export function DeluxeContractForm({ initialContract }: { initialContract?: Contract }) {
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
      idType: initialContract.deluxeDetails?.idType || 'C.I.P.',
      studentIdNumber: initialContract.deluxeDetails?.studentIdNumber || '',
      studentAddress: initialContract.deluxeDetails?.studentAddress || '',
      studentPhone1: initialContract.deluxeDetails?.studentPhone1 || '',
      coursePlan: initialContract.deluxeDetails?.courseValue === 201 ? 'premium' : 'full',
      courseValue: initialContract.deluxeDetails?.courseValue || 201,
      vehicleTransmission: (initialContract.deluxeDetails?.vehicleTransmission as any) || 'Automático',
      licenseCategory: initialContract.deluxeDetails?.licenseCategory || 'A, C',
      theoreticalClassSchedule: initialContract.deluxeDetails?.theoreticalClassSchedule || 'Lunes',
      startDate: initialContract.createdAt ? toDate(initialContract.createdAt) : new Date(),
    } : {
      clientName: '', clientEmail: '', idType: 'C.I.P.', studentIdNumber: '', studentAddress: '', studentPhone1: '',
      coursePlan: 'premium', courseValue: 201, vehicleTransmission: 'Automático', licenseCategory: 'A, C', 
      theoreticalClassSchedule: 'Lunes', startDate: new Date(),
    },
  });

  const watchPlan = form.watch('coursePlan');

  useEffect(() => {
    const pkg = deluxePlans.find(p => p.id === watchPlan);
    if (pkg) form.setValue('courseValue', pkg.price);
  }, [watchPlan, form]);

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
        
        const instAmount = values.coursePlan === 'premium' ? 33.50 : 45.00;
        const installments = Array.from({ length: 6 }).map((_, i) => Timestamp.fromDate(addWeeks(values.startDate, (i + 1) * 2)));
        const theoryClasses = Array.from({ length: 10 }).map((_, i) => Timestamp.fromDate(addWeeks(values.startDate, i + 1)));

        const contractId = initialContract?.id || doc(collection(db, 'contracts')).id;
        const contractRef = doc(db, 'contracts', contractId);
        
        const finalData = {
            id: contractId, folioNumber: folio, title: 'Curso Deluxe', clientName: values.clientName, clientEmail: values.clientEmail,
            clientId: values.studentIdNumber, type: 'Curso Deluxe', status: initialContract?.status || 'active',
            userId: user.uid, createdBy: initialContract?.createdBy || role || 'Sistema', updatedAt: serverTimestamp(),
            createdAt: Timestamp.fromDate(values.startDate),
            deluxeDetails: {
                idType: values.idType, studentIdNumber: values.studentIdNumber, studentAddress: values.studentAddress,
                studentPhone1: values.studentPhone1, courseValue: values.courseValue, paymentAmount: instAmount,
                paymentDetails: values.coursePlan === 'premium' ? 'Premium B/ 201.00' : 'Deluxe B/ 270.00',
                paymentInstallments: installments, theoreticalClasses: theoryClasses,
                theoreticalClassSchedule: values.theoreticalClassSchedule, vehicleTransmission: values.vehicleTransmission,
                licenseCategory: values.licenseCategory, balance: values.courseValue, downPayment: 0
            }
        };
        
        if (!initialContract) transaction.set(contractRef, finalData);
        else transaction.update(contractRef, finalData);
      });
      toast({ title: 'Éxito', description: 'Contrato Deluxe guardado.' });
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
        <Card className="border-t-4 border-t-yellow-600 shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-yellow-600" /><CardTitle className="text-sm font-bold uppercase">Datos del Estudiante (Compacto)</CardTitle></div></CardHeader>
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
            <CardHeader className="bg-slate-50/50 border-b py-3 px-6"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-yellow-600" /><CardTitle className="text-sm font-bold uppercase">Configuración Paquete Deluxe</CardTitle></div></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                <FormField control={form.control} name="coursePlan" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Plan Deluxe</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl><SelectContent>{deluxePlans.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="theoreticalClassSchedule" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Día Clase Teórica</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Lunes">Lunes (8-10am)</SelectItem><SelectItem value="Miércoles">Miércoles (7-9pm)</SelectItem></Select></FormControl></FormItem>)} />
                <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-muted-foreground">Fecha de Inicio</FormLabel><Popover modal={true}><PopoverTrigger asChild><FormControl><Button variant="outline" className="w-full h-10 text-xs">{field.value ? format(field.value, "dd/MM/yyyy") : "Elegir"}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>)} />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" size="lg" className="px-12 h-14 text-lg font-bold shadow-xl bg-yellow-600 hover:bg-yellow-700" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                {initialContract ? 'Actualizar Deluxe' : 'Generar Contrato Deluxe'}
            </Button>
        </div>
      </form>
    </Form>
  );
}