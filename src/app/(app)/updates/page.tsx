'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Contract, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Save, Printer, PlusCircle, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const updateOptions = [
    { id: '1', label: '1 Certificado', price: 59.00 },
    { id: '2', label: '2 Certificados', price: 79.00 },
    { id: '3', label: '3 Certificados', price: 107.00 },
];

const paymentMethodOptions = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'Tarjeta Débito' },
    { value: 'credit', label: 'Tarjeta Crédito' },
    { value: 'bac', label: 'BAC' },
    { value: 'general', label: 'General' },
    { value: 'cheques', label: 'Cheque' },
];

export default function UpdatesPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [mounted, setMounted] = useState(false);
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [foundContract, setFoundContract] = useState<Contract | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<(typeof updateOptions)[0] | null>(null);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [savedPaymentData, setSavedPaymentData] = useState<Partial<Payment> | null>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const resetFormState = () => {
    setStudentIdNumber(''); 
    setManualName(''); 
    setManualAddress('');
    setPaymentType('cash');
    setFoundContract(null); 
    setSearched(false); 
    setSelectedUpdate(null);
    setPaymentSaved(false); 
    setSavedPaymentData(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Introduce cédula.' }); return;
    }
    setFoundContract(null); setManualName(''); setManualAddress('');
    setSelectedUpdate(null); setPaymentSaved(false); setSavedPaymentData(null);
    setIsLoading(true); setSearched(true);

    try {
      const contractsRef = collection(db, 'contracts');
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber));
      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      const contractsMap = new Map<string, Contract>();
      const processSnapshot = (snapshot: any) => { snapshot.forEach((doc: any) => { if (!contractsMap.has(doc.id)) contractsMap.set(doc.id, { id: doc.id, ...doc.data() } as Contract); }); };
      processSnapshot(snapshot1); processSnapshot(snapshot2); processSnapshot(snapshot3);
      setFoundContract(contractsMap.size > 0 ? Array.from(contractsMap.values())[0] : null);
    } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Fallo en búsqueda.' }); } finally { setIsLoading(false); }
  };

  const handleSaveUpdate = async () => {
    const isManualEntry = !foundContract;
    if (!db || !user || !selectedUpdate) { toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Selecciona opción.' }); return; }
    if (isManualEntry && (!manualName || !manualAddress)) { toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Faltan datos manuales.' }); return; }

    setIsSaving(true);
    try {
      const savedPaymentDataResult = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'update_folio');
        const counterDoc = await transaction.get(counterRef);
        let newUpdateFolio = counterDoc.exists() ? counterDoc.data().count + 1 : 1;
        transaction.set(counterRef, { count: newUpdateFolio }, { merge: true });

        const paymentRef = doc(collection(db, 'update_payments'));
        const paymentData: Partial<Payment> = {
          amount: selectedUpdate.price, 
          contractId: foundContract?.id || 'MANUAL', 
          contractFolio: foundContract?.folioNumber || 0,
          updateFolio: newUpdateFolio, 
          clientId: foundContract?.clientId || 'MANUAL', 
          clientName: foundContract?.clientName || manualName,
          clientAddress: foundContract ? (foundContract.autoMotoDetails?.studentAddress || foundContract.ampliacionesDetails?.studentAddress || foundContract.deluxeDetails?.studentAddress) : manualAddress,
          studentIdNumber: studentIdNumber, 
          paymentDate: serverTimestamp() as any, 
          userId: user.uid, 
          type: 'actualizacion', 
          paymentType: paymentType,
          createdBy: role || undefined,
        };
        transaction.set(paymentRef, paymentData);
        return { ...paymentData, id: paymentRef.id, paymentDate: new Date() as any };
      });
      setSavedPaymentData(savedPaymentDataResult); setPaymentSaved(true);
      toast({ title: 'Registrada', description: 'Actualización guardada.' });
    } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Fallo al guardar.' }); } finally { setIsSaving(false); }
  };
  
  const handlePrint = () => {
    if (!savedPaymentData || !selectedUpdate) return;
    const queryParams = new URLSearchParams({
        folio: String(savedPaymentData.updateFolio).padStart(6, '0'), date: format(new Date(), 'PPP', { locale: es }),
        name: savedPaymentData.clientName || '', idNumber: savedPaymentData.studentIdNumber || '', address: savedPaymentData.clientAddress || '',
        concept: `Actualización - ${selectedUpdate.label}`, amount: String(selectedUpdate.price.toFixed(2)),
    });
    window.open(`/print-receipt?${queryParams.toString()}`, '_blank');
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-8">
        <h1 className="font-headline text-3xl font-bold">Actualización de Certificados</h1>
        <Card>
          <CardHeader><CardTitle>Buscar Estudiante</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input type="text" placeholder="Cédula" value={studentIdNumber} onChange={(e) => setStudentIdNumber(e.target.value)} className="max-w-xs" />
              <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <Search />} Buscar</Button>
            </form>
          </CardContent>
        </Card>

        {searched && !isLoading && (
            <Card className="animate-in fade-in-50">
                <CardHeader><CardTitle>{foundContract ? 'Estudiante Encontrado' : 'Registro Manual'}</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    {!foundContract && (
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Nombre del Cliente</Label>
                                <Input placeholder="Nombre" value={manualName} onChange={(e) => setManualName(e.target.value)} disabled={paymentSaved} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Dirección</Label>
                                <Input placeholder="Dirección" value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} disabled={paymentSaved} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Método de Pago</Label>
                        <Select 
                            onValueChange={setPaymentType} 
                            value={paymentType}
                            disabled={paymentSaved}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Seleccionar método..." />
                            </SelectTrigger>
                            <SelectContent>
                                {paymentMethodOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Seleccionar Opción de Actualización</Label>
                        <RadioGroup 
                            onValueChange={(v) => setSelectedUpdate(updateOptions.find(o => o.id === v) || null)} 
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                            disabled={paymentSaved}
                            value={selectedUpdate?.id}
                        >
                            {updateOptions.map(o => (
                                <Label key={o.id} className="flex flex-col items-center p-4 border-2 border-muted rounded-md cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    <RadioGroupItem value={o.id} className="sr-only" />
                                    <CreditCard className="h-6 w-6 mb-2" />
                                    <span className="font-semibold">{o.label}</span>
                                    <span className="text-2xl font-bold mt-1">B/.{o.price.toFixed(2)}</span>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>
                </CardContent>
                <CardFooter>
                    {!paymentSaved ? (
                        <Button onClick={handleSaveUpdate} size="lg" disabled={isSaving || !selectedUpdate}>
                            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} 
                            Registrar Actualización
                        </Button>
                    ) : (
                        <div className='flex gap-2 w-full'>
                            <Button variant="outline" onClick={handlePrint} className="flex-1">
                                <Printer className="mr-2 h-4 w-4" /> Imprimir Recibo
                            </Button>
                            <Button onClick={resetFormState} className="flex-1">
                                <PlusCircle className="mr-2 h-4 w-4" /> Nueva Actualización
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        )}
    </div>
  );
}
