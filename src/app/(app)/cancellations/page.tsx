'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CancellationsPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [payments, setPayments] = useState<{ [key: string]: number }>({});

  const today = new Date();

  const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) {
        return contract.autoMotoDetails.balance || 0;
    }
    if (contract.deluxeDetails) {
        return 0;
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

    setIsLoading(true);
    setFoundContracts(null);
    setSearched(true);
    setPayments({});

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
              // Filter out annulled contracts and only add if not already in the map
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print:flex print:flex-col print:min-h-screen">
      <div className="print:flex-grow"></div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col print:flex">
          <h1 className="font-headline text-3xl font-bold">Cancelaciones de Contrato</h1>
          <p className="text-muted-foreground">
            {format(today, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        <Card className="print:block">
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
              <Button type="submit" disabled={isLoading} className="print-hide">
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
          <div className='space-y-4 print:block'>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Contratos Encontrados para "{foundContracts[0].clientName}"</h2>
                <Button variant="outline" onClick={handlePrint} className="print-hide">
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Cancelación
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
                  {foundContracts.map(contract => {
                      const balance = getBalance(contract);
                      const payment = payments[contract.id] || 0;
                      const currentBalance = balance - payment;

                      return (
                      <Card key={contract.id} className="animate-in fade-in-50 print:border print:shadow-none flex flex-col">
                          <CardHeader>
                              <CardTitle>Contrato N° {String(contract.folioNumber).padStart(6, '0')}</CardTitle>
                              <CardDescription>{contract.type}</CardDescription>
                          </CardHeader>
                          <CardContent className="flex-grow space-y-4">
                              <div>
                                  <p className="text-sm font-medium text-muted-foreground">Saldo Pendiente</p>
                                  <p className="font-bold text-xl text-destructive">B/. {balance.toFixed(2)}</p>
                              </div>
                              <div>
                                  <Label htmlFor={`payment-${contract.id}`}>Monto a Pagar</Label>
                                  <Input 
                                    id={`payment-${contract.id}`} 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="mt-1" 
                                    onChange={(e) => handlePaymentChange(contract.id, e.target.value)}
                                  />
                              </div>
                               <div>
                                  <p className="text-sm font-medium text-muted-foreground">Saldo Actual</p>
                                  <p className="font-bold text-xl">B/. {currentBalance.toFixed(2)}</p>
                              </div>
                          </CardContent>
                      </Card>
                  )})}
              </div>
          </div>
        )}

        {searched && !isLoading && (!foundContracts || foundContracts.length === 0) && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center print-hide">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No se encontraron contratos activos
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifica el número de cédula o puede que no haya contratos vigentes para este cliente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
