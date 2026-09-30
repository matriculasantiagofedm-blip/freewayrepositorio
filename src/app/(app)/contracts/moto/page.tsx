'use client';
import { useMemo } from 'react';
import { ContractCard } from '@/components/contract-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { collection, query } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useDb } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

export default function ContractsMotoPage() {
  const db = useDb();

  const contractsQuery = useMemoQuery(() => {
    if (!db) return null;
    return query(collection(db, 'contracts'));
  }, [db]);

  const { data: rawContracts, isLoading } = useCollection<Contract>(contractsQuery);

  const motoContracts = useMemo(() => {
    if (!rawContracts) return [];
    return rawContracts
      .filter((c) => {
        const t = (c.type || (c as any).contractType || '').trim().toLowerCase();
        return t.includes('moto');
      })
      .sort((a, b) => (Number(b.folioNumber) || 0) - (Number(a.folioNumber) || 0));
  }, [rawContracts]);

  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <h1 className="font-headline text-3xl font-bold">Contratos de Curso Moto</h1>
      </div>
      {isLoading && <p>Cargando contratos...</p>}
      {!isLoading && motoContracts && motoContracts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {motoContracts.map((contract) => (
            <Link key={contract.id} href={`/contracts/${contract.id}`} className="no-underline">
                <ContractCard contract={contract} />
            </Link>
          ))}
        </div>
      ) : (
         !isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                No hay contratos de Curso Moto
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
