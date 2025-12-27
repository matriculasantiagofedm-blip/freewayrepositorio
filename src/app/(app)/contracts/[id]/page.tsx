'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { ContractView } from '@/components/contract-view';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';

export default function ContractDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const { firestore, user } = useFirebase();

  const contractId = Array.isArray(id) ? id[0] : id;
  const shouldPrint = searchParams.get('print') === 'true';

  const contractRef = useMemoFirebase(() => {
    if (!firestore || !user || !contractId) return null;
    return doc(firestore, `contracts`, contractId);
  }, [firestore, user, contractId]);

  const { data: contract, isLoading, error } = useDoc<Contract>(contractRef);

  useEffect(() => {
    // Only trigger print if shouldPrint is true, loading is finished, and the contract data exists.
    if (shouldPrint && contract && !isLoading) {
      // A short delay can help ensure all styles and content are fully rendered before printing.
      const timer = setTimeout(() => {
        window.print();
      }, 500); 
      return () => clearTimeout(timer); // Cleanup the timer if the component unmounts
    }
  }, [shouldPrint, contract, isLoading]);

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4 print:hidden">
            <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Volver</span>
            </Link>
            </Button>
      </div>
      
      {isLoading && <p>Cargando contrato...</p>}
      {error && <p className="text-destructive">Error: {error.message}</p>}
      {contract && <ContractView contract={contract} />}
      {!isLoading && !contract && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center print:hidden">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
                Contrato no encontrado
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
                El contrato que estás buscando no existe o no tienes permiso para verlo.
            </p>
        </div>
      )}
    </div>
  );
}
