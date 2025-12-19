'use client';
import { ContractCard } from '@/components/contract-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useCollection, useFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useMemo } from 'react';

export default function ContractsAutoPremiumPage() {
    const { firestore, user } = useFirebase();

    const contractsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'contracts'),
            where('userId', '==', user.uid),
            where('type', '==', 'Curso Auto Premium')
        );
    }, [firestore, user]);

    const { data: autoContracts, isLoading } = useCollection<Contract>(contractsQuery);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Volver</span>
                    </Link>
                </Button>
                <h1 className="font-headline text-3xl font-bold">Contratos de Curso Auto Premium</h1>
            </div>
            {isLoading && <p>Cargando contratos...</p>}
            {!isLoading && autoContracts && autoContracts.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {autoContracts.map((contract) => (
                        <ContractCard key={contract.id} contract={contract} />
                    ))}
                </div>
            ) : (
                !isLoading && (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                        <h3 className="mt-4 text-lg font-semibold text-foreground">
                            No hay contratos de Curso Auto Premium
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
