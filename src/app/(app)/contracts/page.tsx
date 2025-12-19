'use client';
import { ContractCard } from '@/components/contract-card';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Contract } from '@/lib/types';

export default function AllContractsPage() {
  const { firestore, user } = useFirebase();

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `clients/${user.uid}/contracts`);
  }, [firestore, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Todos los Contratos</h1>
      </div>
      {isLoading && <p>Cargando contratos...</p>}
      {!isLoading && contracts && contracts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <Link key={contract.id} href={`/contracts/${contract.id}`} className="no-underline">
                <ContractCard contract={contract} />
            </Link>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                No tienes contratos todavía
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Comienza creando un nuevo contrato para verlo aquí.
              </p>
          </div>
        )
      )}
    </div>
  );
}
