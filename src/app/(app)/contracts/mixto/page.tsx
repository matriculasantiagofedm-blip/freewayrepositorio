'use client';
import { ContractCard } from '@/components/contract-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

export default function ContractsMixtoPage() {
  const db = useDb();
  const { user } = useUser();

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'contracts'),
      where('type', '==', 'Curso Mixto'),
      orderBy('folioNumber', 'desc')
    );
  }, [db, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <h1 className="font-headline text-3xl font-bold">Contratos de Curso Mixto</h1>
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
                No hay contratos de Curso Mixto
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
