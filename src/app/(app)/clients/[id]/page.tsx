'use client';
import { useParams, useRouter } from 'next/navigation';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Client, Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, ShieldAlert } from 'lucide-react';
import { ContractCard } from '@/components/contract-card';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useDoc, useMemoDoc, useMemoQuery } from '@/hooks/use-firestore';
import { useEffect } from 'react';

export default function ClientDetailPage() {
  const { id } = useParams();
  const db = useDb();
  const { user } = useUser();
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const router = useRouter();

  const clientId = Array.isArray(id) ? id[0] : id;

  // SEGURIDAD: Solo Administrador
  const isAdmin = role === 'Administrador';

  const clientRef = useMemoDoc(() => {
    if (!db || !clientId || !user || !isAdmin) return null;
    return doc(db, `clients`, clientId);
  }, [db, clientId, user, isAdmin]);

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !isAdmin) return null;
    return query(collection(db, 'contracts'), where('clientId', '==', clientId));
  }, [db, user, clientId, isAdmin]);

  const { data: client, isLoading: isClientLoading } = useDoc<Client>(clientRef);
  const { data: contracts, isLoading: areContractsLoading } = useCollection<Contract>(contractsQuery);

  if (!isRoleLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <div className="bg-red-100 p-4 rounded-full mb-4">
            <ShieldAlert className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Acceso Restringido</h3>
        <p className="text-slate-600 mt-2 max-w-sm font-medium">No tienes permisos administrativos para visualizar fichas de clientes.</p>
        <Button asChild className="mt-8 h-12 px-8 font-bold" variant="default">
            <Link href="/dashboard">Volver al Panel Principal</Link>
        </Button>
      </div>
    );
  }

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
       {!client && !isClientLoading && isAdmin && (
         <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
                Cliente no encontrado
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
                El cliente solicitado no existe en la base de datos.
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
             !areContractsLoading && isAdmin && (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                        No hay contratos para este cliente
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        No se han registrado trámites vinculados a esta ficha.
                    </p>
                </div>
             )
        )}
      </div>
    </div>
  );
}
