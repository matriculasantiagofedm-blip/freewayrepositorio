
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CancellationsPage() {
  const db = useDb();
  const { toast } = useToast();
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);
  const today = new Date();

  const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) {
        return contract.autoMotoDetails.balance || 0;
    }
    if (contract.deluxeDetails) {
        return 0; // Deluxe might have a different balance calculation, assuming 0 for now
    }
    if (contract.ampliacionesDetails) {
        return contract.ampliacionesDetails.balance || 0;
    }
    return 0;
  }
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    setIsLoading(true);
    setFoundContracts(null);
    setSearched(true);

    try {
      const contractsRef = collection(db, 'contracts');
      
      const queries = [
        query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber)),
        query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber)),
        query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber))
      ];

      const querySnapshots = await Promise.all(queries.map(q => getDocs(q)));
      
      let allContracts: Contract[] = [];
      querySnapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
            const contractData = { id: doc.id, ...doc.data() } as Contract;
            // Evitar duplicados si una cédula está en más de un details object
            if (!allContracts.some(c => c.id === contractData.id)) {
                allContracts.push(contractData);
            }
        });
      });

      // Filtrar contratos que no estén anulados (status !== 'expired')
      const activeContracts = allContracts.filter(contract => contract.status !== 'expired');

      if (activeContracts.length === 0) {
        setFoundContracts(null);
      } else {
        setFoundContracts(activeContracts);
      }
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col print-hide">
        <h1 className="font-headline text-3xl font-bold">Cancelaciones de Contrato</h1>
        <p className="text-muted-foreground">
          {format(today, "d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      <Card className="print-hide">
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
        <div className='space-y-4'>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Contratos Encontrados para "{foundContracts[0].clientName}"</h2>
              <Button variant="outline" onClick={handlePrint} className="print-hide">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
                {foundContracts.map(contract => (
                     <Card key={contract.id} className="animate-in fade-in-50 print:border print:shadow-none">
                        <CardHeader>
                            <CardTitle>Contrato N° {String(contract.folioNumber).padStart(6, '0')}</CardTitle>
                            <CardDescription>{contract.type}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Saldo Pendiente</p>
                                <p className="font-bold text-xl text-destructive">B/. {getBalance(contract).toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
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
  );
}
