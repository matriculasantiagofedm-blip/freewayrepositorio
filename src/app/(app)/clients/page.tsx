'use client';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Client, Contract } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useState, useEffect } from 'react';

export default function ClientsPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();
  const [clientIds, setClientIds] = useState<string[] | null>(null);

  useEffect(() => {
    async function fetchClientIds() {
      if (!firestore || !user || role === 'Administrador' || role === null) {
        setClientIds([]); // Reset for admin or if user/role is not ready
        return;
      }
      
      try {
        const contractsRef = collection(firestore, 'contracts');
        const q = query(contractsRef, where('userId', '==', user.uid));
        const contractsSnapshot = await getDocs(q);
        const ids = contractsSnapshot.docs.map(doc => (doc.data() as Contract).clientId);
        // Get unique client IDs
        const uniqueIds = [...new Set(ids)];
        setClientIds(uniqueIds.length > 0 ? uniqueIds : ['__EMPTY__']); // Use a placeholder for empty queries
      } catch (error) {
        console.error("Error fetching client IDs:", error);
        setClientIds(['__EMPTY__']); // Set to avoid invalid query
      }
    }

    fetchClientIds();
  }, [firestore, user, role]);


  const clientsQuery = useMemoFirebase(() => {
    if (!firestore || !role) return null;
    
    // Admin can see all clients
    if (role === 'Administrador') {
      return collection(firestore, 'clients');
    }
    
    // For non-admin roles, wait until we have the client IDs
    if (clientIds === null) {
        return null; // Query is not ready yet
    }
    
    if (clientIds.length === 0 || (clientIds.length === 1 && clientIds[0] === '__EMPTY__')) {
        return null; // No clients to fetch, so no query needed.
    }
    
    // Fetch only the clients associated with the user's contracts
    return query(collection(firestore, 'clients'), where('id', 'in', clientIds));
    
  }, [firestore, role, clientIds]);

  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);
  const isInitialLoading = clientIds === null && role !== 'Administrador';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Clientes</h1>
      </div>
      {(isLoading || isInitialLoading) && <p>Cargando clientes...</p>}
      {!isLoading && !isInitialLoading && clients && clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`} className="no-underline">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div>
                            <CardTitle>{client.name}</CardTitle>
                            <CardDescription>{client.email}</CardDescription>
                            {client.idNumber && <CardDescription className="font-medium text-foreground pt-1">Cédula: {client.idNumber}</CardDescription>}
                        </div>
                    </CardHeader>
                </Card>
            </Link>
          ))}
        </div>
      ) : (
        !isLoading && !isInitialLoading && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No tienes clientes todavía
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea un contrato para añadir tu primer cliente.
            </p>
          </div>
        )
      )}
    </div>
  );
}
