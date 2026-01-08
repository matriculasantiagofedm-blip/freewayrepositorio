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
import { Loader2, Search, Save } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [foundContract, setFoundContract] = useState<Contract | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<(typeof updateOptions)[0] | null>(null);
  
  const today = new Date();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    setIsLoading(true);
    setFoundContract(null);
    setSearched(true);
    setSelectedUpdate(null);

    try {
      const contractsRef = collection(db, 'contracts');
      
      // We'll search across all possible detail fields for the ID number
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

      // We just need one contract to identify the student
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
    if (!db || !user || !foundContract || !selectedUpdate) {
      toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Asegúrate de haber seleccionado un estudiante y una opción de actualización.' });
      return;
    }

    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get and increment the update folio counter
        const counterRef = doc(db, 'counters', 'update_folio');
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          throw new Error("El contador de folios de actualización no existe.");
        }
        const newUpdateFolio = counterDoc.data().count + 1;
        transaction.update(counterRef, { count: newUpdateFolio });

        // 2. Create a new payment document for the update
        const paymentRef = doc(collection(db, 'payments'));
        const paymentData: Partial<Payment> = {
          amount: selectedUpdate.price,
          contractId: foundContract.id,
          contractFolio: foundContract.folioNumber,
          updateFolio: newUpdateFolio,
          clientId: foundContract.clientId,
          clientName: foundContract.clientName,
          studentIdNumber: studentIdNumber,
          paymentDate: serverTimestamp(),
          userId: user.uid,
          type: 'actualizacion',
        };
        transaction.set(paymentRef, paymentData);
      });

      toast({ title: 'Actualización Registrada', description: `El pago de B/.${selectedUpdate.price.toFixed(2)} ha sido guardado.` });
      // Reset the state after saving
      setFoundContract(null);
      setSearched(false);
      setStudentIdNumber('');
      setSelectedUpdate(null);

    } catch (error) {
      console.error("Error saving update:", error);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: 'No se pudo registrar el pago de la actualización. Inténtalo de nuevo.' });
    } finally {
      setIsSaving(false);
    }
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

        {searched && !isLoading && foundContract && (
            <Card className="animate-in fade-in-50">
                <CardHeader>
                    <CardTitle>Estudiante Encontrado</CardTitle>
                    <CardDescription>Selecciona la cantidad de certificados a actualizar para <span className="font-bold text-primary">{foundContract.clientName}</span>.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="font-medium">Nombre: <span className="font-normal">{foundContract.clientName}</span></p>
                        <p className="font-medium">Cédula: <span className="font-normal">{studentIdNumber}</span></p>
                        <p className="font-medium">Contrato Original: <span className="font-normal">{String(foundContract.folioNumber).padStart(6, '0')}</span></p>
                    </div>

                    <RadioGroup 
                        onValueChange={(value) => {
                            const option = updateOptions.find(opt => opt.id === value);
                            setSelectedUpdate(option || null);
                        }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                        {updateOptions.map(option => (
                             <Label key={option.id} htmlFor={option.id} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
                                <span className="text-lg font-semibold">{option.label}</span>
                                <span className="text-2xl font-bold mt-2">B/.{option.price.toFixed(2)}</span>
                            </Label>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveUpdate} disabled={isSaving || !selectedUpdate}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Registrar Actualización y Pago
                    </Button>
                </CardFooter>
            </Card>
        )}

        {searched && !isLoading && !foundContract && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No se encontró ningún estudiante
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifica el número de cédula e inténtalo de nuevo.
            </p>
          </div>
        )}
    </div>
  );
}
