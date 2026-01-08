
'use client';
import { collection, query } from 'firebase/firestore';
import type { Client } from '@/lib/types';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useState } from 'react';
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
import { useDb } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

export default function ClientsPage() {
  const db = useDb();
  const { role } = useCurrentRole();
  const [searchTerm, setSearchTerm] = useState('');

  // 'Administrador' puede ver todos los clientes directamente.
  const clientsQuery = useMemoQuery(() => {
    if (!db || !role || role !== 'Administrador') return null;
    return collection(db, 'clients');
  }, [db, role]);

  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

  const filteredClients =
    clients?.filter((client) => {
      const name = client.name.toLowerCase();
      const idNumber = client.idNumber?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();

      return name.includes(search) || idNumber.includes(search);
    }) || [];

  const renderContent = () => {
    // Si no es un administrador, mostrar acceso restringido de inmediato.
    if (role && role !== 'Administrador') {
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
      );
    }
    
    if (isLoading) {
      return <p>Cargando clientes...</p>;
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
      );
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
          Cuando se cree el primer contrato, el cliente aparecerá aquí.
        </p>
      </div>
    );
  };

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
