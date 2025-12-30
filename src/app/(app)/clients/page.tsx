'use client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Client } from '@/lib/types';
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
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

export default function ClientsPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const [searchTerm, setSearchTerm] = useState('');

  // Admin can see all clients directly.
  const clientsQuery = useMemoQuery(() => {
    if (!db || !role) return null;
    
    if (role === 'Administrador') {
      return collection(db, 'clients');
    }
    
    // For 'Ventas', we will handle it differently below.
    // For any other unhandled role, return null to show loading/empty state safely.
    return null;
    
  }, [db, role]);

  const { data: adminClients, isLoading: isAdminClientsLoading } = useCollection<Client>(clientsQuery);
  const [ventasClients, setVentasClients] = useState<Client[]>([]);
  const [isVentasClientsLoading, setIsVentasClientsLoading] = useState(false);

  useEffect(() => {
    if (role === 'Ventas' && user && db) {
        const fetchVentasClients = async () => {
            setIsVentasClientsLoading(true);
            try {
                // 1. Find all contracts created by the current 'Ventas' user
                const contractsRef = collection(db, 'contracts');
                const userContractsQuery = query(contractsRef, where('userId', '==', user.uid));
                const contractsSnapshot = await getDocs(userContractsQuery);
                
                if (contractsSnapshot.empty) {
                    setVentasClients([]);
                    setIsVentasClientsLoading(false);
                    return;
                }

                // 2. Get the unique client IDs from those contracts
                const clientIds = [...new Set(contractsSnapshot.docs.map(doc => doc.data().clientId))];
                
                // 3. Fetch only those specific clients
                const clientsRef = collection(db, 'clients');
                const clientDocsQuery = query(clientsRef, where('id', 'in', clientIds));
                const clientsSnapshot = await getDocs(clientDocsQuery);

                const clientsData = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
                setVentasClients(clientsData);

            } catch (error) {
                console.error("Error fetching clients for 'Ventas':", error);
                setVentasClients([]); // Clear clients on error
            } finally {
                setIsVentasClientsLoading(false);
            }
        };
        fetchVentasClients();
    }
  }, [role, user, db]);

  const clients = role === 'Administrador' ? adminClients : ventasClients;
  const isLoading = role === 'Administrador' ? isAdminClientsLoading : isVentasClientsLoading;

  const filteredClients =
    clients?.filter((client) => {
      const name = client.name.toLowerCase();
      const idNumber = client.idNumber?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();

      return name.includes(search) || idNumber.includes(search);
    }) || [];

  const renderContent = () => {
    if (isLoading) {
        return <p>Cargando clientes...</p>;
    }

    if (!clients && !isLoading && role !== 'Ventas') {
        return (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                Acceso Restringido
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                No tienes permiso para ver esta sección.
                </p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard">Volver al Panel</Link>
                </Button>
            </div>
        )
    }

    if (filteredClients.length > 0) {
        return (
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
        )
    }

     if (searchTerm) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No se encontraron clientes
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Intenta con otro término de búsqueda.
          </p>
        </div>
      );
    }
    
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
        <h3 className="mt-4 text-lg font-semibold text-foreground">
            No hay clientes para mostrar
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
            {role === 'Ventas' ? 'Los clientes con los que tienes contratos aparecerán aquí.' : 'Cuando se cree el primer contrato, el cliente aparecerá aquí.'}
        </p>
        </div>
    )
  }

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
      {renderContent()}
    </div>
  );
}
