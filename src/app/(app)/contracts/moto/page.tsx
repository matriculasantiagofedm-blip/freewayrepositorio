'use client';
import { ContractCard } from '@/components/contract-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

export default function ContractsMotoPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;
    
    const baseQuery = query(
      collection(db, 'contracts'),
      where('type', '==', 'Curso Moto')
    );

    if (role === 'Administrador' || role === 'Ventas') {
      return baseQuery;
    }
    
    return query(baseQuery, where('userId', '==', user.uid));
  }, [db, user, role]);

  const { data: motoContracts, isLoading } = useCollection<Contract>(contractsQuery);

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
