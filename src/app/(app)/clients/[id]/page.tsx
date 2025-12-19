'use client';
import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import type { Client, Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ContractCard } from '@/components/contract-card';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { firestore, user } = useFirebase();

  const clientId = Array.isArray(id) ? id[0] : id;

  const clientRef = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, `clients`, clientId);
  }, [firestore, clientId]);

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !clientId) return null;
    return query(
        collection(firestore, `clients/${user.uid}/contracts`),
    );
  }, [firestore, user, clientId]);

  const { data: client, isLoading: isClientLoading } = useDoc<Client>(clientRef);
  const { data: contracts, isLoading: areContractsLoading } = useCollection<Contract>(contractsQuery);

  const clientContracts = contracts?.filter(c => c.clientId === clientId);

  return (
    <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4 print:hidden">
            <Button variant="outline" size="icon" asChild>
            <Link href="/clients">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Volver a Clientes</span>
            </Link>
            </Button>
      </div>

      {isClientLoading && <p>Cargando cliente...</p>}
      {client && (
        <div className="flex flex-col gap-2 items-center text-center">
            <h1 className="font-headline text-3xl font-bold">{client.name}</h1>
            <p className="text-muted-foreground">{client.email}</p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-headline text-2xl font-bold mb-4">Contratos Asociados</h2>
        {areContractsLoading && <p>Cargando contratos...</p>}
        {!areContractsLoading && clientContracts && clientContracts.length > 0 ? (
             <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {clientContracts.map((contract) => (
                    <Link key={contract.id} href={`/contracts/${contract.id}`} className="no-underline">
                        <ContractCard contract={contract} />
                    </Link>
                ))}
            </div>
        ) : (
             !areContractsLoading && (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                        No hay contratos para este cliente
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Crea un nuevo contrato para este cliente para verlo aquí.
                    </p>
                </div>
             )
        )}
      </div>
    </div>
  );
}
