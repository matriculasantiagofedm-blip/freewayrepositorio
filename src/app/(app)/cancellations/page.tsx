'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Contract, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, Save, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function CancellationsPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [payments, setPayments] = useState<{ [key: string]: number }>({});
  const [savedPayments, setSavedPayments] = useState<{ [contractId: string]: Partial<Payment> }>({});
  
  // State for manual entry
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualPayment, setManualPayment] = useState(0);
  const [manualPaymentSaved, setManualPaymentSaved] = useState(false);
  const [manualSavedPaymentData, setManualSavedPaymentData] = useState<Partial<Payment> | null>(null);

  const today = new Date();
  
  const resetForm = () => {
    setStudentIdNumber('');
    setFoundContracts(null);
    setSearched(false);
    setPayments({});
    setSavedPayments({});
    setManualName('');
    setManualAddress('');
    setManualPayment(0);
    setManualPaymentSaved(false);
    setManualSavedPaymentData(null);
  };


  const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) {
        return contract.autoMotoDetails.balance || 0;
    }
    if (contract.deluxeDetails) {
        return 0; // Deluxe no tiene saldo de esta forma
    }
    if (contract.ampliacionesDetails) {
        return contract.ampliacionesDetails.balance || 0;
    }
    return 0;
  }

  const handlePaymentChange = (contractId: string, amount: string) => {
    const numericAmount = parseFloat(amount) || 0;
    setPayments(prev => ({ ...prev, [contractId]: numericAmount }));
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    resetForm();
    setIsLoading(true);
    setSearched(true);
    setStudentIdNumber(studentIdNumber); // Keep the searched ID

    try {
      const contractsRef = collection(db, 'contracts');
      
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber));

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

  const handleSavePayment = (contract: Contract | null) => {
    const isManual = contract === null;
    const paymentAmount = isManual ? manualPayment : payments[contract!.id];
    
    if (!db || !user || !paymentAmount || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: 'Monto Inválido', description: 'Introduce un monto a pagar válido para registrar.' });
      return;
    }
    if (isManual && (!manualName || !manualAddress)) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Completa el nombre y la dirección del estudiante para el registro manual.' });
      return;
    }

    setIsSaving(true);
    
    let paymentDataForTransaction: Partial<Payment> | null = null;
    let contractUpdateForTransaction: any = {};
    if(contract) {
      const newBalance = getBalance(contract) - paymentAmount;
      if (newBalance <= 0) {
        contractUpdateForTransaction.status = 'completed';
      }
      if (contract.autoMotoDetails) {
          contractUpdateForTransaction['autoMotoDetails.balance'] = newBalance > 0 ? newBalance : 0;
          contractUpdateForTransaction['autoMotoDetails.downPayment'] = (contract.autoMotoDetails.downPayment || 0) + paymentAmount;
      } else if (contract.ampliacionesDetails) {
          contractUpdateForTransaction['ampliacionesDetails.balance'] = newBalance > 0 ? newBalance : 0;
          contractUpdateForTransaction['ampliacionesDetails.downPayment'] = (contract.ampliacionesDetails.downPayment || 0) + paymentAmount;
      }
    }

    runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'cancellation_folio');
        const counterDoc = await transaction.get(counterRef);
        
        let newCancellationFolio;
        if (!counterDoc.exists()) {
            newCancellationFolio = 1;
            transaction.set(counterRef, { count: newCancellationFolio });
        } else {
            newCancellationFolio = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: newCancellationFolio });
        }

        const paymentRef = doc(collection(db, 'cancellation_payments'));
        
        const paymentData: Partial<Payment> = {
            amount: paymentAmount,
            contractId: contract?.id || 'MANUAL',
            contractFolio: contract?.folioNumber || 0,
            cancellationFolio: newCancellationFolio,
            clientId: contract?.clientId || 'MANUAL',
            clientName: contract?.clientName || manualName,
            studentIdNumber: studentIdNumber,
            paymentDate: serverTimestamp(),
            userId: user.uid,
            type: 'cancelacion',
            clientAddress: contract ? (contract.autoMotoDetails?.studentAddress || contract.ampliacionesDetails?.studentAddress || contract.deluxeDetails?.studentAddress || '') : manualAddress,
            createdBy: role || undefined,
        };
        paymentDataForTransaction = paymentData;
        transaction.set(paymentRef, paymentData);
        
        if (contract) {
            const contractRef = doc(db, 'contracts', contract.id);
            transaction.update(contractRef, contractUpdateForTransaction);
        }

        return { ...paymentData, id: paymentRef.id, paymentDate: new Date() as any };
    })
    .then((savedPaymentData) => {
        if (isManual) {
            setManualSavedPaymentData(savedPaymentData);
            setManualPaymentSaved(true);
        } else if (contract) {
            setSavedPayments(prev => ({ ...prev, [contract.id]: savedPaymentData }));
        }
        toast({ title: 'Pago Registrado', description: 'El pago ha sido guardado exitosamente.' });
    })
    .catch((serverError) => {
        let errorContextPath = 'cancellation_payments';
        let errorContextOperation: 'create' | 'update' = 'create';
        let errorContextData: any = paymentDataForTransaction;

        if (contract) {
            errorContextPath = `contracts/${contract.id}`;
            errorContextOperation = 'update';
            errorContextData = contractUpdateForTransaction;
        }
        
        const permissionError = new FirestorePermissionError({
            path: errorContextPath,
            operation: errorContextOperation,
            requestResourceData: errorContextData,
        });
        errorEmitter.emit('permission-error', permissionError);

        if (serverError.code !== 'permission-denied') {
            console.error("Error saving payment transaction:", serverError);
            toast({ variant: 'destructive', title: 'Error en la Transacción', description: 'No se pudo completar la operación. Inténtalo de nuevo.' });
        }
    })
    .finally(() => {
        setIsSaving(false);
    });
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

    const printUrl = `/print-receipt?${queryParams.toString()}`;
    window.open(printUrl, '_blank');
  };

  return (
    <div className="print:w-1/2 print:mx-auto print:mt-8">
      <div className="flex flex-col gap-8 print:gap-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="font-headline text-3xl font-bold print:text-lg">Gestión de Saldos</h1>
            <p className="text-muted-foreground print:text-sm">
              {format(today, "d 'de' MMMM 'de' yyyy", { locale: es })}
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

        {isLoading && (
          <div className="flex items-center justify-center p-8 print-hide">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Buscando contratos...</p>
          </div>
        )}

        {searched && !isLoading && foundContracts && foundContracts.length > 0 && (
          <Card className='print:border-none print:shadow-none'>
              <CardHeader className='print:p-2'>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold print:text-base">Contratos Encontrados para "{foundContracts[0].clientName}"</h2>
                    <p className="hidden print:block text-xs">Cédula: {studentIdNumber}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-1 print:gap-2 print:p-2">
                  {foundContracts.map(contract => {
                      const balance = getBalance(contract);
                      const paymentAmount = payments[contract.id] || 0;
                      const currentBalance = balance - paymentAmount;
                      const isPaymentSaved = !!savedPayments[contract.id];

                      return (
                      <div key={contract.id} className="animate-in fade-in-50 print:border-t print:pt-2 space-y-2 border p-4 rounded-lg">
                          <div className='flex justify-between'>
                            <p className="font-bold print:text-sm">Contrato N° {String(contract.folioNumber).padStart(6, '0')}</p>
                            <p className="text-sm text-muted-foreground print:text-xs">{contract.type}</p>
                          </div>
                          <div className="flex justify-between items-end">
                              <div>
                                  <p className="text-xs font-medium text-muted-foreground">Saldo Pendiente</p>
                                  <p className="font-bold text-lg text-destructive print:text-base">B/. {balance.toFixed(2)}</p>
                              </div>
                              <div className='w-28'>
                                  <Label htmlFor={`payment-${contract.id}`} className='text-xs'>Monto a Pagar</Label>
                                  <Input 
                                    id={`payment-${contract.id}`} 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="mt-1 h-8 print:text-sm" 
                                    onChange={(e) => handlePaymentChange(contract.id, e.target.value)}
                                    disabled={isPaymentSaved}
                                  />
                              </div>
                               <div className='text-right'>
                                  <p className="text-xs font-medium text-muted-foreground">Saldo Actual</p>
                                  <p className="font-bold text-lg print:text-base">B/. {currentBalance.toFixed(2)}</p>
                              </div>
                          </div>
                          <CardFooter className="p-0 pt-2 print-hide">
                            {!isPaymentSaved ? (
                                <Button
                                size="sm"
                                onClick={() => handleSavePayment(contract)}
                                disabled={isSaving || !(payments[contract.id] > 0)}
                                className='w-full'
                                >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Registrar Pago
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={() => handlePrint(contract.id)}
                                    className='w-full'
                                    variant="outline"
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Imprimir Recibo N° {String(savedPayments[contract.id]?.cancellationFolio).padStart(6, '0')}
                                </Button>
                            )}
                          </CardFooter>
                      </div>
                  )})}
              </CardContent>
          </Card>
        )}
        
        {searched && !isLoading && !foundContracts && (
          <Card className="animate-in fade-in-50 print-hide">
            <CardHeader>
                <CardTitle>Registro de Pago Manual</CardTitle>
                <CardDescription>No se encontraron contratos. Introduce los datos para registrar un pago manual para la cédula <span className="font-bold text-primary">{studentIdNumber}</span>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className="space-y-2">
                        <Label htmlFor="manual-name">Nombre Completo del Estudiante</Label>
                        <Input id="manual-name" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Introducir nombre" disabled={manualPaymentSaved}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="manual-address">Dirección del Estudiante</Label>
                        <Input id="manual-address" value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} placeholder="Introducir dirección" disabled={manualPaymentSaved}/>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="manual-payment">Monto a Pagar</Label>
                    <Input id="manual-payment" type="number" placeholder="0.00" onChange={(e) => setManualPayment(parseFloat(e.target.value) || 0)} disabled={manualPaymentSaved}/>
                </div>
            </CardContent>
            <CardFooter>
                {!manualPaymentSaved ? (
                     <Button
                        onClick={() => handleSavePayment(null)}
                        disabled={isSaving || manualPayment <= 0 || !manualName || !manualAddress}
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Registrar Pago Manual
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => handlePrint('MANUAL')}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Recibo N° {String(manualSavedPaymentData?.cancellationFolio).padStart(6, '0')}
                    </Button>
                )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
