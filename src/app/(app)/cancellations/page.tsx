'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Contract, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, Save, PlusCircle, UserPlus } from 'lucide-react';
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

const paymentMethodOptions = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'Tarjeta Débito' },
    { value: 'credit', label: 'Tarjeta Crédito' },
    { value: 'bac', label: 'BAC' },
    { value: 'general', label: 'General' },
    { value: 'cheques', label: 'Cheque' },
];

export default function CancellationsPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [mounted, setMounted] = useState(false);
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);
  
  const [payments, setPayments] = useState<{ [key: string]: number }>({});
  const [paymentMethods, setPaymentMethods] = useState<{ [key: string]: string }>({});
  const [savedPayments, setSavedPayments] = useState<{ [contractId: string]: Partial<Payment> }>({});
  
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualPayment, setManualPayment] = useState(0);
  const [manualPaymentMethod, setManualPaymentMethod] = useState('cash');
  const [manualPaymentSaved, setManualPaymentSaved] = useState(false);
  const [manualSavedPaymentData, setManualSavedPaymentData] = useState<Partial<Payment> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const resetForm = () => {
    setStudentIdNumber('');
    setFoundContracts(null);
    setSearched(false);
    setPayments({});
    setPaymentMethods({});
    setSavedPayments({});
    setManualName('');
    setManualAddress('');
    setManualPayment(0);
    setManualPaymentMethod('cash');
    setManualPaymentSaved(false);
    setManualSavedPaymentData(null);
  };

  const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return details?.balance || 0;
  }

  const handlePaymentChange = (contractId: string, amount: string) => {
    const numericAmount = parseFloat(amount) || 0;
    setPayments(prev => ({ ...prev, [contractId]: numericAmount }));
  };

  const handleMethodChange = (contractId: string, method: string) => {
    setPaymentMethods(prev => ({ ...prev, [contractId]: method }));
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    const currentId = studentIdNumber;
    resetForm();
    setIsLoading(true);
    setSearched(true);
    setStudentIdNumber(currentId);

    try {
      const contractsRef = collection(db, 'contracts');
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', currentId));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', currentId));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', currentId));

      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      const contractsMap = new Map<string, Contract>();

      const processSnapshot = (snapshot: any) => {
          snapshot.forEach((doc: any) => {
              const contractData = { id: doc.id, ...doc.data() } as Contract;
              if (contractData.status !== 'expired' && !contractsMap.has(doc.id)) {
                contractsMap.set(doc.id, contractData);
              }
          });
      };
      
      processSnapshot(snapshot1);
      processSnapshot(snapshot2);
      processSnapshot(snapshot3);

      const allContracts = Array.from(contractsMap.values());
      setFoundContracts(allContracts.length > 0 ? allContracts : null);
      
    } catch (error) {
      console.error("Error searching for contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda. Inténtalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePayment = async (contract: Contract | null) => {
    const isManual = contract === null;
    const paymentAmount = isManual ? manualPayment : payments[contract!.id];
    const paymentType = isManual ? manualPaymentMethod : (paymentMethods[contract!.id] || 'cash');
    
    if (!db || !user || !paymentAmount || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: 'Monto Inválido', description: 'Introduce un monto a pagar válido para registrar.' });
      return;
    }
    if (isManual && (!manualName || !manualAddress)) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Completa el nombre y la dirección del estudiante.' });
      return;
    }

    setIsSaving(true);
    try {
      const savedPaymentDataResult = await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, 'counters', 'cancellation_folio');
          const counterDoc = await transaction.get(counterRef);
          
          let newCancellationFolio = counterDoc.exists() ? counterDoc.data().count + 1 : 1;
          transaction.set(counterRef, { count: newCancellationFolio }, { merge: true });

          const paymentRef = doc(collection(db, 'cancellation_payments'));
          const paymentData = {
              amount: paymentAmount,
              contractId: contract?.id || 'MANUAL',
              contractFolio: contract?.folioNumber || 0,
              cancellationFolio: newCancellationFolio,
              clientId: contract?.clientId || 'MANUAL',
              clientName: contract?.clientName || manualName,
              studentIdNumber: studentIdNumber,
              paymentDate: serverTimestamp() as any,
              userId: user.uid,
              type: 'cancelacion',
              contractType: contract?.type || 'Curso Auto',
              paymentType: paymentType,
              clientAddress: contract ? (contract.autoMotoDetails?.studentAddress || contract.ampliacionesDetails?.studentAddress || contract.deluxeDetails?.studentAddress || '') : manualAddress,
              createdBy: role || undefined,
          };
          
          transaction.set(paymentRef, paymentData);
          
          if (contract) {
              const contractRef = doc(db, 'contracts', contract.id);
              const currentBalance = getBalance(contract);
              const newBalance = Math.max(0, currentBalance - paymentAmount);
              const contractUpdateForTransaction: any = {};
              if (newBalance <= 0) contractUpdateForTransaction.status = 'completed';
              
              if (contract.autoMotoDetails) {
                  contractUpdateForTransaction['autoMotoDetails.balance'] = newBalance;
                  contractUpdateForTransaction['autoMotoDetails.downPayment'] = (contract.autoMotoDetails.downPayment || 0) + paymentAmount;
                  if (contract.autoMotoDetails.initialDownPayment === undefined) {
                      contractUpdateForTransaction['autoMotoDetails.initialDownPayment'] = contract.autoMotoDetails.downPayment || 0;
                  }
              } else if (contract.ampliacionesDetails) {
                  contractUpdateForTransaction['ampliacionesDetails.balance'] = newBalance;
                  contractUpdateForTransaction['ampliacionesDetails.downPayment'] = (contract.ampliacionesDetails.downPayment || 0) + paymentAmount;
                  if (contract.ampliacionesDetails.initialDownPayment === undefined) {
                      contractUpdateForTransaction['ampliacionesDetails.initialDownPayment'] = contract.ampliacionesDetails.downPayment || 0;
                  }
              } else if (contract.deluxeDetails) {
                  contractUpdateForTransaction['deluxeDetails.balance'] = newBalance;
                  contractUpdateForTransaction['deluxeDetails.downPayment'] = (contract.deluxeDetails.downPayment || 0) + paymentAmount;
                  if (contract.deluxeDetails.initialDownPayment === undefined) {
                      contractUpdateForTransaction['deluxeDetails.initialDownPayment'] = contract.deluxeDetails.downPayment || 0;
                  }
              }
              transaction.update(contractRef, contractUpdateForTransaction);
          }

          return { ...paymentData, id: paymentRef.id, paymentDate: new Date() as any };
      });
      
      if (isManual) {
          setManualSavedPaymentData(savedPaymentDataResult);
          setManualPaymentSaved(true);
      } else if (contract) {
          setSavedPayments(prev => ({ ...prev, [contract.id]: savedPaymentDataResult }));
      }
      toast({ title: 'Pago Registrado', description: 'El pago ha sido guardado exitosamente.' });

    } catch (error) {
        console.error("Error saving payment transaction:", error);
        toast({ variant: 'destructive', title: 'Error en la Transacción', description: 'No se pudo completar la operación.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handlePrint = (contractId: string) => {
    const isManual = contractId === 'MANUAL';
    const payment = isManual ? manualSavedPaymentData : savedPayments[contractId];
    if (!payment || !payment.cancellationFolio) return;

    const queryParams = new URLSearchParams({
        folio: String(payment.cancellationFolio).padStart(6, '0'),
        date: format(new Date(), 'PPP', { locale: es }),
        name: payment.clientName || '',
        idNumber: payment.studentIdNumber || '',
        address: payment.clientAddress || '',
        concept: `Cancelación/Abono a Contrato N° ${payment.contractFolio ? String(payment.contractFolio).padStart(6, '0') : '(Manual)'}`,
        amount: String(payment.amount?.toFixed(2)),
    });

    window.open(`/print-receipt?${queryParams.toString()}`, '_blank');
  };

  if (!mounted) return null;

  return (
    <div className="print:w-1/2 print:mx-auto print:mt-8">
      <div className="flex flex-col gap-8 print:gap-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="font-headline text-3xl font-bold print:text-lg">Gestión de Saldos</h1>
            <p className="text-muted-foreground print:text-sm">
              {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
           <Button onClick={resetForm} className="print-hide">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Búsqueda
            </Button>
        </div>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Buscar Contrato por Cédula</CardTitle>
            <CardDescription>Introduce el número de cédula o pasaporte del cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Ej: 8-123-456"
                value={studentIdNumber}
                onChange={(e) => setStudentIdNumber(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

        {searched && !isLoading && foundContracts && (
          <Card className='print:border-none print:shadow-none'>
              <CardHeader className='print:p-2'>
                <h2 className="text-xl font-bold">Contratos Encontrados</h2>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {foundContracts.map(contract => (
                      <div key={contract.id} className="animate-in fade-in-50 space-y-4 border p-4 rounded-lg">
                          <div className='flex flex-col gap-1'>
                            <p className="font-bold">Contrato N° {String(contract.folioNumber).padStart(6, '0')}</p>
                            <p className="text-xs text-muted-foreground">{contract.type}</p>
                          </div>
                          
                          <div className="bg-muted/30 p-2 rounded-md">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Pendiente</p>
                              <p className="font-bold text-xl text-destructive">B/. {getBalance(contract).toFixed(2)}</p>
                          </div>

                          <div className='space-y-3'>
                              <div className='space-y-1.5'>
                                  <Label className='text-[10px] uppercase font-bold text-muted-foreground'>Método de Pago</Label>
                                  <Select 
                                    onValueChange={(v) => handleMethodChange(contract.id, v)} 
                                    defaultValue="cash"
                                    disabled={!!savedPayments[contract.id]}
                                  >
                                      <SelectTrigger className="h-9 text-xs">
                                          <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {paymentMethodOptions.map(opt => (
                                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                              </div>
                              <div className='space-y-1.5'>
                                  <Label className='text-[10px] uppercase font-bold text-muted-foreground'>Monto a Pagar (B/.)</Label>
                                  <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    onChange={(e) => handlePaymentChange(contract.id, e.target.value)} 
                                    disabled={!!savedPayments[contract.id]} 
                                    className="h-9 font-bold"
                                  />
                              </div>
                          </div>

                          <CardFooter className="p-0 pt-2 print-hide">
                            {!savedPayments[contract.id] ? (
                                <Button size="sm" onClick={() => handleSavePayment(contract)} disabled={isSaving || !(payments[contract.id] > 0)} className='w-full'>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Registrar Pago
                                </Button>
                            ) : (
                                <Button size="sm" onClick={() => handlePrint(contract.id)} className='w-full' variant="outline">
                                    <Printer className="mr-2 h-4 w-4" /> Imprimir Recibo
                                </Button>
                            )}
                          </CardFooter>
                      </div>
                  ))}
              </CardContent>
          </Card>
        )}

        {searched && !isLoading && !foundContracts && (
            <Card className="animate-in fade-in-50 max-w-2xl mx-auto w-full">
                <CardHeader>
                    <div className='flex items-center gap-2 text-amber-600 mb-2'>
                        <UserPlus className="h-5 w-5" />
                        <h2 className="text-lg font-bold">Estudiante no encontrado</h2>
                    </div>
                    <CardDescription>
                        No se encontraron contratos activos para la cédula <strong>{studentIdNumber}</strong>. 
                        Puedes registrar un abono o cancelación manual a continuación.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!manualPaymentSaved ? (
                        <div className='grid grid-cols-1 gap-6'>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="manual-name" className="text-xs uppercase font-bold text-muted-foreground">Nombre Completo del Cliente</Label>
                                    <Input 
                                        id="manual-name"
                                        placeholder="Introducir nombre" 
                                        value={manualName} 
                                        onChange={(e) => setManualName(e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="manual-address" className="text-xs uppercase font-bold text-muted-foreground">Dirección de Residencia</Label>
                                    <Input 
                                        id="manual-address"
                                        placeholder="Ciudad, Calle, Casa..." 
                                        value={manualAddress} 
                                        onChange={(e) => setManualAddress(e.target.value)} 
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Método de Pago</Label>
                                    <Select 
                                        onValueChange={setManualPaymentMethod} 
                                        defaultValue="cash"
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentMethodOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="manual-amount" className="text-xs uppercase font-bold text-muted-foreground">Monto a Pagar (B/.)</Label>
                                    <div className='relative'>
                                        <span className='absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground'>B/.</span>
                                        <Input 
                                            id="manual-amount"
                                            type="number" 
                                            placeholder="0.00" 
                                            value={manualPayment || ''} 
                                            onChange={(e) => setManualPayment(parseFloat(e.target.value) || 0)} 
                                            className="pl-10 font-bold text-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center gap-2 text-center">
                            <div className="bg-green-100 p-2 rounded-full">
                                <Save className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="font-bold text-green-800">Pago Manual Registrado</p>
                                <p className="text-sm text-green-700">Se ha generado el folio de pago N° {String(manualSavedPaymentData?.cancellationFolio).padStart(6, '0')}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    {!manualPaymentSaved ? (
                        <Button 
                            onClick={() => handleSavePayment(null)} 
                            disabled={isSaving || !manualName || !manualAddress || manualPayment <= 0}
                            className="w-full sm:w-auto h-11 px-8 font-bold"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Registrar Pago Manual
                        </Button>
                    ) : (
                        <div className='flex gap-2 w-full sm:w-auto'>
                            <Button variant="outline" onClick={() => handlePrint('MANUAL')} className="h-11 px-6">
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Recibo
                            </Button>
                            <Button onClick={resetForm} className="h-11 px-6">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Nueva Búsqueda
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        )}
      </div>
    </div>
  );
}
