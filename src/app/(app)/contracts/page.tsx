
'use client';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Eye, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';


function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  return new Date();
}

export default function AllContractsPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();
  const [searchTerm, setSearchTerm] = useState('');

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    
    if (role === 'Administrador') {
      return collection(firestore, `contracts`);
    }
    
    return query(collection(firestore, 'contracts'), where('userId', '==', user.uid));
  }, [firestore, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const statusColors: { [key: string]: string } = {
    active: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    completed: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
  };

  const statusTranslations: { [key: string]: string } = {
    active: 'Activo',
    draft: 'Borrador',
    completed: 'Completado',
    expired: 'Expirado',
  }
  
  const filteredContracts =
    contracts?.filter((contract) => {
      const folio = String(contract.folioNumber || '').padStart(6, '0');
      const client = contract.clientName.toLowerCase();
      const type = contract.type.toLowerCase();
      const search = searchTerm.toLowerCase();

      return folio.includes(search) || client.includes(search) || type.includes(search);
    }) || [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">Todos los Contratos</h1>
         <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por folio, cliente, tipo..."
            className="pl-8 sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      {isLoading && <p>Cargando contratos...</p>}
      {!isLoading && contracts && (
        <>
            {filteredContracts.length > 0 ? (
                 <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Folio</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha de Creación</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredContracts.map((contract) => (
                                <TableRow key={contract.id}>
                                    <TableCell className="font-medium text-primary">
                                        {String(contract.folioNumber || '').padStart(6, '0')}
                                    </TableCell>
                                    <TableCell>{contract.clientName}</TableCell>
                                    <TableCell>{contract.type}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("capitalize", statusColors[contract.status])}>
                                            {statusTranslations[contract.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {format(toDate(contract.createdAt), 'dd/MM/yyyy', { locale: es })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="icon">
                                            <Link href={`/contracts/${contract.id}`}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Ver Contrato</span>
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
                        {searchTerm ? 'No se encontraron contratos' : 'No tienes contratos todavía'}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Comienza creando un nuevo contrato para verlo aquí.'}
                    </p>
                </div>
            )}
        </>
      )}
    </div>
  );
}
