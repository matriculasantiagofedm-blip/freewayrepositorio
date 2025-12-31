'use client';
import { collection, query, where } from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';
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
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Eye, Search, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';


function toDate(date: any): Date {
  if (!date) return new Date(0); // Return an invalid date if input is null/undefined
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date(0);
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;

    const hasOverdueGeneralDeadline = (contract.deadlines as Deadline[] || [])
        .some(d => d && d.date && isPast(toDate(d.date)));
    
    if (hasOverdueGeneralDeadline) return true;

    if ((contract.type === 'Curso Auto' || contract.type === 'Curso Moto') && contract.autoMotoDetails?.paymentDeadline) {
        const paymentDate = toDate(contract.autoMotoDetails.paymentDeadline);
        if (paymentDate.getTime() > 0 && isPast(paymentDate)) {
            return true;
        }
    }
    
    return false;
}

export default function AllContractsPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');

  const filter = searchParams.get('filter');

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;
    
    if (role === 'Administrador' || role === 'Ventas') {
      return collection(db, 'contracts');
    }
    
    // Fallback for other roles to see only their contracts
    return query(collection(db, 'contracts'), where('userId', '==', user.uid));
  }, [db, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const statusColors: { [key: string]: string } = {
    active: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    completed: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    overdue: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
  };

  const statusTranslations: { [key: string]: string } = {
    active: 'Activo',
    draft: 'Borrador',
    completed: 'Completado',
    expired: 'Expirado',
    overdue: 'Vencido',
  }
  
  const filteredContracts =
    contracts?.filter((contract) => {
      const folio = String(contract.folioNumber || '').padStart(6, '0');
      const client = contract.clientName.toLowerCase();
      const type = contract.type.toLowerCase();
      const cedula = contract.studentIdNumber || '';
      const search = searchTerm.toLowerCase();

      // Apply filter from URL param
      if (filter === 'overdue' && !isOverdue(contract)) {
        return false;
      }
      
      // Apply search term
      if (searchTerm) {
          return folio.includes(search) || client.includes(search) || type.includes(search) || cedula.includes(search);
      }

      return true; // if no filter or search, show all (or all overdue if filter is set)
    }) || [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">{filter === 'overdue' ? 'Contratos Vencidos' : 'Todos los Contratos'}</h1>
         <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por folio, cliente, tipo, cédula..."
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
                                <TableHead className="hidden">Estado</TableHead>
                                <TableHead>Certificado</TableHead>
                                <TableHead>Fecha de Creación</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredContracts.map((contract) => {
                                const contractIsOverdue = isOverdue(contract);
                                const status = contractIsOverdue ? 'overdue' : contract.status;
                                
                                return (
                                <TableRow key={contract.id}>
                                    <TableCell className="font-medium text-primary">
                                        {String(contract.folioNumber || '').padStart(6, '0')}
                                    </TableCell>
                                    <TableCell>{contract.clientName}</TableCell>
                                    <TableCell>{contract.type}</TableCell>
                                    <TableCell className="hidden">
                                        <Badge variant="outline" className={cn("capitalize", statusColors[status])}>
                                            {statusTranslations[status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {contract.certificateGeneratedAt ? (
                                            <div className="flex items-center gap-2 text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Sí</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <XCircle className="h-4 w-4" />
                                                <span>No</span>
                                            </div>
                                        )}
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
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                        {searchTerm ? 'No se encontraron contratos' : 'No hay contratos para mostrar'}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {searchTerm ? 'Intenta con otro término de búsqueda.' : (filter === 'overdue' ? 'No hay contratos vencidos.' : 'Comienza creando un nuevo contrato para verlo aquí.')}
                    </p>
                </div>
            )}
        </>
      )}
    </div>
  );
}
