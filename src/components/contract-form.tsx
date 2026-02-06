'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Timestamp, collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Contract, ContractType } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { ContractView } from './contract-view';
import { useDb, useUser } from './firebase-provider';

const baseClientSchema = z.object({
  clientName: z.string().min(1, 'El nombre completo es requerido.'),
  clientEmail: z.string().email('Debe ser un correo electrónico válido.'),
});

type FormValues = {
  clientName: string;
  clientEmail: string;
  contractType: ContractType;
  deluxeDetails: any;
  autoMotoDetails: any;
  ampliacionesDetails: any;
};

const convertDetailsDatesToTimestamps = (details: any) => {
    if (!details) return {};
    const newDetails = { ...details };
    const toTimestamp = (date: any) => (date instanceof Date && !isNaN(date.getTime())) ? Timestamp.fromDate(date) : null;
    
    if (newDetails.paymentInstallments) newDetails.paymentInstallments = newDetails.paymentInstallments.map(toTimestamp).filter(Boolean);
    if (newDetails.theoreticalClasses) newDetails.theoreticalClasses = newDetails.theoreticalClasses.map(toTimestamp).filter(Boolean);
    if (newDetails.classSchedules) newDetails.classSchedules = newDetails.classSchedules.map((s: any) => ({ ...s, date: toTimestamp(s.date) })).filter((s: any) => s.date);
    if (newDetails.paymentDeadline) newDetails.paymentDeadline = toTimestamp(newDetails.paymentDeadline);
    if (newDetails.theoreticalClassDates) newDetails.theoreticalClassDates = newDetails.theoreticalClassDates.map(toTimestamp).filter(Boolean);
    if (newDetails.practicalClassSchedules) newDetails.practicalClassSchedules = newDetails.practicalClassSchedules.map((s: any) => ({ ...s, date: toTimestamp(s.date) })).filter((s: any) => s.date);
    if (newDetails.theoreticalClassDate) newDetails.theoreticalClassDate = toTimestamp(newDetails.theoreticalClassDate);

    return newDetails;
};

export function ContractForm() {
  const db = useDb();
  const { user } = useUser();
  const { role: currentUserRole } = useCurrentRole();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const contractTypeParam = searchParams.get('type') as ContractType | null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const contractType: ContractType = useMemo(() => contractTypeParam || 'Curso Auto', [contractTypeParam]);

  const form = useForm<FormValues>({
    defaultValues: {
      clientName: '',
      clientEmail: '',
      contractType: contractType,
      deluxeDetails: { studentIdNumber: '', studentAddress: '', studentPhone1: '' },
      autoMotoDetails: { studentIdNumber: '', studentAddress: '', studentPhone1: '', courseValue: 0, downPayment: 0, balance: 0 },
      ampliacionesDetails: { studentIdNumber: '', studentAddress: '', studentPhone1: '', courseValue: 0, downPayment: 0, balance: 0 }
    },
  });

  async function onSubmit(values: FormValues) {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
      const clientsRef = collection(db, 'clients');
      const studentId = values.contractType === 'Curso Deluxe' ? values.deluxeDetails.studentIdNumber : (values.contractType === 'Ampliaciones' ? values.ampliacionesDetails.studentIdNumber : values.autoMotoDetails.studentIdNumber);
      
      const q = query(clientsRef, where('idNumber', '==', studentId));
      const clientSnapshot = await getDocs(q);
      const existingClientDoc = clientSnapshot.docs[0];

      const newContractId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'contract_folio');
        const counterDoc = await transaction.get(counterRef);
        const newFolioNumber = counterDoc.exists() ? counterDoc.data().count + 1 : 1;

        let clientId = existingClientDoc?.id;
        if (!existingClientDoc) {
          const newClientRef = doc(collection(db, 'clients'));
          clientId = newClientRef.id;
          transaction.set(newClientRef, {
            id: clientId, name: values.clientName, email: values.clientEmail, idNumber: studentId, userId: user.uid, createdAt: serverTimestamp() as any
          });
        }

        const newContractRef = doc(collection(db, 'contracts'));
        const contractData: any = {
          id: newContractRef.id, folioNumber: newFolioNumber, title: values.contractType, clientName: values.clientName, clientEmail: values.clientEmail, clientId: clientId,
          type: values.contractType, status: 'active', userId: user.uid, createdAt: serverTimestamp() as any, createdBy: currentUserRole || undefined
        };
        
        if (values.contractType === 'Curso Deluxe') contractData.deluxeDetails = convertDetailsDatesToTimestamps(values.deluxeDetails);
        else if (values.contractType === 'Ampliaciones') contractData.ampliacionesDetails = convertDetailsDatesToTimestamps(values.ampliacionesDetails);
        else contractData.autoMotoDetails = convertDetailsDatesToTimestamps(values.autoMotoDetails);

        transaction.set(newContractRef, contractData);
        transaction.set(counterRef, { count: newFolioNumber }, { merge: true });
        return newContractRef.id;
      });

      router.push(`/contracts/${newContractId}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al Guardar', description: e.message });
    } finally { setIsSubmitting(false); }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader><CardTitle>Datos del Cliente</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
            </CardContent>
        </Card>
        <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setShowPreview(!showPreview)}>Vista Previa</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 animate-spin" />} Guardar</Button>
        </div>
        {showPreview && <ContractView contract={form.getValues() as any} />}
      </form>
    </Form>
  );
}
