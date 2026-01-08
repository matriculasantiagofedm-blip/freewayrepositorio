'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Contract, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Save, UserPlus, Printer, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const updateOptions = [
    { id: '1', label: '1 Certificado', price: 59.00 },
    { id: '2', label: '2 Certificados', price: 79.00 },
    { id: '3', label: '3 Certificados', price: 107.00 },
];

export default function UpdatesPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [foundContract, setFoundContract] = useState<Contract | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<(typeof updateOptions)[0] | null>(null);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [savedPaymentData, setSavedPaymentData] = useState<Partial<Payment> | null>(null);
  
  const today = new Date();

  const resetFormState = () => {
    setStudentIdNumber('');
    setManualName('');
    setManualAddress('');
    setFoundContract(null);
    setSearched(false);
    setSelectedUpdate(null);
    setPaymentSaved(false);
    setSavedPaymentData(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    // Reset part of the state for a new search
    setFoundContract(null);
    setManualName('');
    setManualAddress('');
    setSelectedUpdate(null);
    setPaymentSaved(false);
    setSavedPaymentData(null);
    setIsLoading(true);
    setSearched(true);

    try {
      const contractsRef = collection(db, 'contracts');
      
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber));
      
      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      
      const contractsMap = new Map<string, Contract>();

      const processSnapshot = (snapshot: any) => {
          snapshot.forEach((doc: any) => {
              if (!contractsMap.has(doc.id)) {
                contractsMap.set(doc.id, { id: doc.id, ...doc.data() } as Contract);
              }
          });
      };
      
      processSnapshot(snapshot1);
      processSnapshot(snapshot2);
      processSnapshot(snapshot3);

      const firstContract = contractsMap.size > 0 ? Array.from(contractsMap.values())[0] : null;
      setFoundContract(firstContract);
      
    } catch (error) {
      console.error("Error searching for contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda. Inténtalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUpdate = async () => {
    const isManualEntry = !foundContract;
    if (!db || !user || !selectedUpdate) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Selecciona una opción de actualización.' });
      return;
    }
    if (isManualEntry && (!manualName || !manualAddress)) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Completa el nombre y la dirección del estudiante.' });
      return;
    }

    setIsSaving(true);
    try {
      const paymentDataToSave: Partial<Payment> = {};

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'update_folio');
        const counterDoc = await transaction.get(counterRef);
        
        let newUpdateFolio;
        if (!counterDoc.exists()) {
          newUpdateFolio = 1;
          transaction.set(counterRef, { count: newUpdateFolio });
        } else {
          newUpdateFolio = counterDoc.data().count + 1;
          transaction.update(counterRef, { count: newUpdateFolio });
        }

        const paymentRef = doc(collection(db, 'payments'));
        const paymentData: Partial<Payment> = {
          amount: selectedUpdate.price,
          contractId: foundContract?.id || 'MANUAL',
          contractFolio: foundContract?.folioNumber || 0,
          updateFolio: newUpdateFolio,
          clientId: foundContract?.clientId || 'MANUAL',
          clientName: foundContract?.clientName || manualName,
          clientAddress: foundContract ? (foundContract.autoMotoDetails?.studentAddress || foundContract.ampliacionesDetails?.studentAddress || foundContract.deluxeDetails?.studentAddress) : manualAddress,
          studentIdNumber: studentIdNumber,
          paymentDate: serverTimestamp(),
          userId: user.uid,
          type: 'actualizacion',
        };
        transaction.set(paymentRef, paymentData);

        // Store data for printing
        Object.assign(paymentDataToSave, { ...paymentData, id: paymentRef.id, paymentDate: new Date() as any });
      });

      setSavedPaymentData(paymentDataToSave);
      toast({ title: 'Actualización Registrada', description: `El pago de B/.${selectedUpdate.price.toFixed(2)} ha sido guardado. Ahora puedes imprimir el recibo.` });
      setPaymentSaved(true);

    } catch (error) {
      console.error("Error saving update:", error);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo registrar el pago de la actualización. Inténtalo de nuevo.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePrint = () => {
    if (!savedPaymentData || !selectedUpdate) return;
    
    const queryParams = new URLSearchParams({
        folio: String(savedPaymentData.updateFolio).padStart(6, '0'),
        date: format(new Date(), 'PPP', { locale: es }),
        name: savedPaymentData.clientName || '',
        idNumber: savedPaymentData.studentIdNumber || '',
        address: savedPaymentData.clientAddress || '',
        concept: `Actualización - ${selectedUpdate.label}`,
        amount: String(selectedUpdate.price.toFixed(2)),
    });

    const printUrl = `/print-receipt?${queryParams.toString()}`;
    window.open(printUrl, '_blank');
  };

  return (
    <div className="flex flex-col gap-8">
        <div className="flex flex-col">
          <h1 className="font-headline text-3xl font-bold">Actualización de Certificados</h1>
          <p className="text-muted-foreground">
            {format(today, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buscar Estudiante por Cédula</CardTitle>
            <CardDescription>Introduce el número de cédula o pasaporte del estudiante para iniciar el proceso de actualización.</CardDescription>
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
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Buscando estudiante...</p>
          </div>
        )}

        {searched && !isLoading && (
            <Card className="animate-in fade-in-50">
                <CardHeader>
                    <div className='flex justify-between items-start'>
                        <div>
                            <CardTitle>
                                {foundContract ? 'Estudiante Encontrado' : 'Registrar Actualización Manual'}
                            </CardTitle>
                            <CardDescription>
                            {foundContract 
                                ? `Selecciona la cantidad de certificados a actualizar para ${foundContract.clientName}.`
                                : `No se encontró un contrato para la cédula ingresada. Completa los datos para registrar el pago manualmente.`
                            }
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className='border rounded-lg p-4 bg-muted/50'>
                        <p className="font-medium">Cédula / Pasaporte: <span className="font-normal text-primary">{studentIdNumber}</span></p>
                        {foundContract ? (
                          <>
                            <p className="font-medium">Nombre: <span className="font-normal">{foundContract.clientName}</span></p>
                            <p className="font-medium">Contrato Original: <span className="font-normal">{String(foundContract.folioNumber).padStart(6, '0')}</span></p>
                          </>
                        ) : (
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-4'>
                             <div className="space-y-2">
                                <Label htmlFor="manual-name">Nombre Completo del Estudiante</Label>
                                <Input id="manual-name" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Introducir nombre"/>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="manual-address">Dirección del Estudiante</Label>
                                <Input id="manual-address" value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} placeholder="Introducir dirección" />
                              </div>
                          </div>
                        )}
                    </div>

                    <RadioGroup 
                        onValueChange={(value) => {
                            const option = updateOptions.find(opt => opt.id === value);
                            setSelectedUpdate(option || null);
                        }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        value={selectedUpdate?.id}
                        disabled={paymentSaved}
                    >
                        {updateOptions.map(option => (
                             <Label key={option.id} htmlFor={option.id} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
                                <span className="text-lg font-semibold">{option.label}</span>
                                <span className="text-2xl font-bold mt-2">B/.{option.price.toFixed(2)}</span>
                            </Label>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter>
                    {!paymentSaved ? (
                        <Button onClick={handleSaveUpdate} disabled={isSaving || !selectedUpdate}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Registrar Actualización y Pago
                        </Button>
                    ) : (
                        <div className='flex gap-2'>
                            <Button variant="outline" onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Recibo
                            </Button>
                            <Button onClick={resetFormState}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Nueva Actualización
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        )}
    </div>
  );
}
