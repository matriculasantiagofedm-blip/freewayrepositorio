'use client';
import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Client, Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ContractCard } from '@/components/contract-card';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();

  const clientId = Array.isArray(id) ? id[0] : id;

  const clientRef = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    // The security rules for `clients` are owner-only, so this will only work
    // if the current user is the one who created the client.
    return doc(firestore, `clients`, clientId);
  }, [firestore, clientId]);

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;

    const contractsCollection = collection(firestore, 'contracts');

    // ALL users, including Admins, can only see contracts for this client
    // that they themselves have created. This aligns with the security rules.
    // An admin wanting to see all contracts for a client would need a different view/tool.
    return query(
      contractsCollection,
      where('clientId', '==', clientId),
      where('userId', '==', user.uid)
    );
  }, [firestore, user, clientId]);

  const { data: client, isLoading: isClientLoading } = useDoc<Client>(clientRef);
  const { data: contracts, isLoading: areContractsLoading } = useCollection<Contract>(contractsQuery);

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
       {!client && !isClientLoading && (
         <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
                Cliente no encontrado
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
                No tienes permiso para ver este cliente o no existe.
            </p>
        </div>
       )}


      <div className="mt-8">
        <h2 className="font-headline text-2xl font-bold mb-4">Contratos Asociados</h2>
        {areContractsLoading && <p>Cargando contratos...</p>}
        {!areContractsLoading && contracts && contracts.length > 0 ? (
             <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {contracts.map((contract) => (
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
                        No has creado contratos para este cliente.
                    </p>
                </div>
             )
        )}
      </div>
    </div>
  );
}
