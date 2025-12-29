'use client';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Client, Contract } from '@/lib/types';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function ClientsPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();
  const [clientIds, setClientIds] = useState<string[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredClients =
    clients?.filter((client) => {
      const name = client.name.toLowerCase();
      const idNumber = client.idNumber?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();

      return name.includes(search) || idNumber.includes(search);
    }) || [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Clientes</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre o cédula..."
            className="pl-8 sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      {(isLoading || isInitialLoading) && <p>Cargando clientes...</p>}
      {!isLoading && !isInitialLoading && clients && clients.length > 0 ? (
        <>
            {filteredClients.length > 0 ? (
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Cédula / Pasaporte</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClients.map((client) => (
                                <TableRow key={client.id}>
                                    <TableCell className="font-medium">{client.name}</TableCell>
                                    <TableCell>{client.email}</TableCell>
                                    <TableCell>{client.idNumber || 'No disponible'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="icon">
                                            <Link href={`/clients/${client.id}`}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Ver Cliente</span>
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                 <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                        No se encontraron clientes
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Intenta con otro término de búsqueda.
                    </p>
                </div>
            )}
        </>
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
