'use client';
import { collection } from 'firebase/firestore';
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

  // DESBLOQUEO TOTAL: Todos los roles operativos ven el listado completo de clientes
  const clientsQuery = useMemoQuery(() => {
    if (!db || !role || (role !== 'Administrador' && role !== 'Ventas' && role !== 'Ventas Externas')) return null;
    return collection(db, 'clients');
  }, [db, role]);

  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

  const isAdmin = role === 'Administrador';

  const filteredClients =
    clients?.filter((client) => {
      const name = client.name.toLowerCase();
      const idNumber = client.idNumber?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return name.includes(search) || idNumber.includes(search);
    }) || [];

  const renderContent = () => {
    if (role && (role !== 'Administrador' && role !== 'Ventas' && role !== 'Ventas Externas')) {
      return (
        <div className="p-12 text-center border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-semibold">Acceso Restringido</h3>
          <Button asChild className="mt-4"><Link href="/dashboard">Volver al Panel</Link></Button>
        </div>
      );
    }
    
    if (isLoading) return <p>Cargando clientes...</p>;

    if (filteredClients.length > 0) {
      return (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cédula / Pasaporte</TableHead>
                {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.idNumber || 'No disponible'}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/clients/${client.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    return (
      <div className="p-12 text-center border-2 border-dashed rounded-lg">
        <h3 className="text-lg font-semibold">{searchTerm ? 'No se encontraron resultados' : 'No hay clientes registrados'}</h3>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Clientes</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Nombre o cédula..." className="pl-8 sm:w-[300px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
