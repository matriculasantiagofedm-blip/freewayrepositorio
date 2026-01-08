'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Printer, ShieldX } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

export default function CancellationsPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [contractToCancel, setContractToCancel] = useState<Contract | null>(null);

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
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    setIsLoading(true);
    setFoundContracts(null);
    setSearched(true);

    try {
      const contractsRef = collection(db, 'contracts');
      
      // Firestore does not support querying across different fields in nested objects in this manner.
      // We must fetch all contracts for the client based on a common field like clientName or clientId if available,
      // or perform multiple queries and merge, as we are doing.
      const q = query(contractsRef, where('studentIdNumber', '==', studentIdNumber));
      const querySnapshot = await getDocs(q);

      let allContracts: Contract[] = [];
      querySnapshot.forEach(doc => {
          const contractData = { id: doc.id, ...doc.data() } as Contract;
          // Filter out annulled contracts
          if (contractData.status !== 'expired') {
            allContracts.push(contractData);
          }
      });

      setFoundContracts(allContracts.length > 0 ? allContracts : null);
      
    } catch (error) {
      console.error("Error searching for contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda. Inténtalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCancelDialog = (contract: Contract) => {
    setContractToCancel(contract);
  };
  
  const handleConfirmCancellation = async () => {
    if (!contractToCancel || !db) return;
  
    setIsSaving(contractToCancel.id);
  
    try {
      const contractRef = doc(db, 'contracts', contractToCancel.id);
      await updateDoc(contractRef, {
        status: 'expired',
      });
  
      toast({
        title: 'Cancelación Guardada',
        description: `El contrato N° ${String(contractToCancel.folioNumber).padStart(6, '0')} ha sido anulado.`,
      });

      // Print cancellation receipt
      const printUrl = `/print-cancellation/${contractToCancel.id}`;
      window.open(printUrl, '_blank');
  
      // Refresh the list of contracts
      setFoundContracts(prev => prev?.filter(c => c.id !== contractToCancel.id) || null);
      setContractToCancel(null);

    } catch (error) {
      console.error("Error al guardar la cancelación:", error);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: 'No se pudo guardar la cancelación. Inténtalo de nuevo.',
      });
    } finally {
      setIsSaving(null);
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
            <div className="flex justify-between items-center print-hide">
              <h2 className="text-xl font-bold">Contratos Encontrados para "{foundContracts[0].clientName}"</h2>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Lista
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-6">
                {foundContracts.map(contract => (
                    <Card key={contract.id} className="animate-in fade-in-50 print:border print:shadow-none flex flex-col">
                        <CardHeader>
                            <CardTitle>Contrato N° {String(contract.folioNumber).padStart(6, '0')}</CardTitle>
                            <CardDescription>{contract.type}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <p className="text-sm font-medium text-muted-foreground">Saldo Pendiente</p>
                            <p className="font-bold text-xl text-destructive">B/. {getBalance(contract).toFixed(2)}</p>
                        </CardContent>
                        <CardFooter className="print-hide">
                           <Button 
                              variant="destructive" 
                              className="w-full"
                              onClick={() => handleOpenCancelDialog(contract)}
                              disabled={isSaving === contract.id}
                            >
                               {isSaving === contract.id ? (
                                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                               ) : (
                                   <ShieldX className="mr-2 h-4 w-4" />
                               )}
                               Guardar Cancelación
                           </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <AlertDialog open={!!contractToCancel} onOpenChange={(open) => !open && setContractToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de anular este contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. El contrato N° <span className="font-bold">{String(contractToCancel?.folioNumber).padStart(6, '0')}</span> será marcado como ANULADO y no se podrá revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancellation} className="bg-destructive hover:bg-destructive/90">
              Sí, guardar cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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
