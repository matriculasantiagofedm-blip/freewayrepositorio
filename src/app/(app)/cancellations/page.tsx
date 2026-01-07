
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';

export default function CancellationsPage() {
  const db = useDb();
  const { toast } = useToast();
  const [folioNumber, setFolioNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContract, setFoundContract] = useState<Contract | null>(null);
  const [searched, setSearched] = useState(false);

  const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) {
        return contract.autoMotoDetails.balance || 0;
    }
    if (contract.deluxeDetails) {
        // Deluxe might have a different balance calculation, assuming 0 for now
        return 0; 
    }
    if (contract.ampliacionesDetails) {
        return contract.ampliacionesDetails.balance || 0;
    }
    return 0;
  }
  
  const getStudentId = (contract: Contract): string => {
    return contract.autoMotoDetails?.studentIdNumber 
        || contract.deluxeDetails?.studentIdNumber
        || contract.ampliacionesDetails?.studentIdNumber
        || '';
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folioNumber.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de folio.' });
      return;
    }

    setIsLoading(true);
    setFoundContract(null);
    setSearched(true);

    try {
      const contractsRef = collection(db, 'contracts');
      const q = query(contractsRef, where('folioNumber', '==', parseInt(folioNumber, 10)));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setFoundContract(null);
      } else {
        const contractDoc = querySnapshot.docs[0];
        setFoundContract({ id: contractDoc.id, ...contractDoc.data() } as Contract);
      }
    } catch (error) {
      console.error("Error searching for contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda. Inténtalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-headline text-3xl font-bold">Cancelaciones de Contrato</h1>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Contrato por Folio</CardTitle>
          <CardDescription>Introduce el número de folio del contrato que deseas consultar para su cancelación.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Ej: 12345"
              value={folioNumber}
              onChange={(e) => setFolioNumber(e.target.value)}
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
          <p className="ml-4 text-muted-foreground">Buscando contrato...</p>
        </div>
      )}

      {searched && !isLoading && foundContract && (
        <Card className="animate-in fade-in-50">
          <CardHeader>
            <CardTitle>Información del Contrato</CardTitle>
            <CardDescription>Estos son los detalles del contrato encontrado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">N° de Folio</p>
                <p className="font-semibold text-lg">{String(foundContract.folioNumber).padStart(6, '0')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tipo de Contrato</p>
                <p className="font-semibold text-lg">{foundContract.type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nombre del Cliente</p>
                <p className="font-semibold text-lg">{foundContract.clientName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cédula / Pasaporte</p>
                <p className="font-semibold text-lg">{getStudentId(foundContract)}</p>
              </div>
               <div>
                <p className="text-sm font-medium text-muted-foreground">Saldo Pendiente</p>
                <p className="font-bold text-xl text-destructive">B/. {getBalance(foundContract).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {searched && !isLoading && !foundContract && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No se encontró el contrato
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifica el número de folio e inténtalo de nuevo.
          </p>
        </div>
      )}
    </div>
  );
}
