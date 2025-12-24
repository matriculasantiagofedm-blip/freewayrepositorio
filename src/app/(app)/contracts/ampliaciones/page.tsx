'use client';
import { ContractCard } from '@/components/contract-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ContractsAmpliacionesPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;

    if (role === 'Administrador') {
      return null;
    }

    return query(
      collection(firestore, 'contracts'),
      where('userId', '==', user.uid),
      where('type', '==', 'Ampliaciones')
    );
  }, [firestore, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);
  
  const displayContracts = role === 'Administrador' ? [] : contracts;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <h1 className="font-headline text-3xl font-bold">Contratos de Ampliaciones</h1>
      </div>
      {isLoading && role !== 'Administrador' && <p>Cargando contratos...</p>}
      {!isLoading && displayContracts && displayContracts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {displayContracts.map((contract) => (
            <Link key={contract.id} href={`/contracts/${contract.id}`} className="no-underline">
                <ContractCard contract={contract} />
            </Link>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                No hay contratos de Ampliaciones
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Comienza creando un nuevo contrato.
              </p>
          </div>
        )
      )}
    </div>
  );
}
