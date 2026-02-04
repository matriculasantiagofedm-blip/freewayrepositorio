
'use client';
import { collection, query, where, orderBy, Timestamp, doc, runTransaction } from 'firebase/firestore';
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
import { format, isPast, differenceInDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Eye, Search, CheckCircle, XCircle, Ban } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) {
        return contract.autoMotoDetails.balance || 0;
    }
    if (contract.ampliacionesDetails) {
        return contract.ampliacionesDetails.balance || 0;
    }
    return 0;
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;

    const balance = getBalance(contract);
    if (balance <= 0) return false;

    let deadline: Date | undefined | null = undefined;
    if (contract.autoMotoDetails?.paymentDeadline) {
        deadline = contract.autoMotoDetails.paymentDeadline;
    } else if (contract.ampliacionesDetails?.paymentDeadline) {
        deadline = contract.ampliacionesDetails.paymentDeadline;
    }

    if (deadline) {
        const paymentDate = toDate(deadline);
        if (!isNaN(paymentDate.getTime()) && isPast(paymentDate)) {
            return true;
        }
    }

    return false;
}

const getDebtAgeInfo = (contract: Contract): { category: string; days: number } | null => {
    if (!isOverdue(contract)) return null;

    let deadline: Date | undefined | null = undefined;
    if (contract.autoMotoDetails?.paymentDeadline) {
        deadline = contract.autoMotoDetails.paymentDeadline;
    } else if (contract.ampliacionesDetails?.paymentDeadline) {
        deadline = contract.ampliacionesDetails.paymentDeadline;
    }

    if (!deadline) return null;

    const paymentDate = toDate(deadline);
    if (isNaN(paymentDate.getTime())) return null;
    const daysOverdue = differenceInDays(new Date(), paymentDate);

    if (daysOverdue <= 30) {
        return { category: '0-30 días', days: daysOverdue };
    }
    if (daysOverdue <= 60) {
        return { category: '31-60 días', days: daysOverdue };
    }
    if (daysOverdue <= 90) {
        return { category: '61-90 días', days: daysOverdue };
    }
    return { category: '90+ días', days: daysOverdue };
};


export default function AllContractsPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');

  const filter = searchParams.get('filter');

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;

    let q = query(collection(db, 'contracts'), orderBy('folioNumber', 'desc'));

    if (role !== 'Administrador' && role !== 'Ventas') {
      q = query(q, where('userId', '==', user.uid));
    }
    
    return q;
  }, [db, user, role]);

  const { data: allContracts, isLoading } = useCollection<Contract>(contractsQuery);

  const statusColors: { [key: string]: string } = {
    active: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    completed: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    overdue: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
  };

  const ageCategoryColors: { [key: string]: string } = {
    '0-30 días': 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    '31-60 días': 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700',
    '61-90 días': 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    '90+ días': 'bg-red-200 text-red-900 border-red-400 font-bold dark:bg-red-900 dark:text-red-200 dark:border-red-700',
  };

  const statusTranslations: { [key: string]: string } = {
    active: 'Activo',
    draft: 'Borrador',
    completed: 'Completado',
    expired: 'Anulado', // Changed for display
    overdue: 'Vencido',
  }
  
  const getPaymentDeadline = (contract: Contract): Date | null => {
    let deadline: Date | undefined | null = undefined;
    if (contract.autoMotoDetails?.paymentDeadline) {
        deadline = contract.autoMotoDetails.paymentDeadline;
    } else if (contract.ampliacionesDetails?.paymentDeadline) {
        deadline = contract.ampliacionesDetails.paymentDeadline;
    }

    if (deadline) {
        const paymentDate = toDate(deadline);
        if (!isNaN(paymentDate.getTime())) {
            return paymentDate;
        }
    }
    return null;
  };

  const filteredContracts =
    allContracts?.map(contract => {
        const debtInfo = getDebtAgeInfo(contract);
        return { ...contract, debtInfo };
    }).filter((contract) => {
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">{filter === 'overdue' ? 'Contratos por Cobrar' : 'Todos los Contratos'}</h1>
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
      {!isLoading && allContracts && (
        <>
            {filteredContracts.length > 0 ? (
                 <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Folio</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Certificado</TableHead>
                                <TableHead>Fecha de Creación</TableHead>
                                {filter === 'overdue' && <TableHead>Fecha de Cancelación</TableHead>}
                                {filter === 'overdue' && <TableHead>Antigüedad</TableHead>}
                                {filter === 'overdue' && <TableHead className="text-right">Monto Adeudado</TableHead>}
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredContracts.map((contract) => {
                                const isAnnulled = contract.status === 'expired';
                                const balance = getBalance(contract);
                                const paymentDeadline = getPaymentDeadline(contract);
                                const creationDate = toDate(contract.createdAt);
                                
                                return (
                                <TableRow key={contract.id} className={cn(isAnnulled && 'bg-muted/50 hover:bg-muted/60')}>
                                    <TableCell className="font-medium text-primary">
                                        {String(contract.folioNumber || '').padStart(6, '0')}
                                    </TableCell>
                                    <TableCell>{contract.clientName}</TableCell>
                                    <TableCell>{contract.type}</TableCell>
                                    <TableCell>
                                        {isAnnulled ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Ban className="h-4 w-4" />
                                                <span>Anulado</span>
                                            </div>
                                        ) : contract.certificateGeneratedAt ? (
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
                                        {!isNaN(creationDate.getTime()) ? format(creationDate, 'dd/MM/yyyy', { locale: es }) : 'Fecha inválida'}
                                    </TableCell>
                                    {filter === 'overdue' && (
                                        <TableCell className='text-muted-foreground'>
                                            {paymentDeadline ? format(paymentDeadline, 'dd/MM/yyyy') : 'N/A'}
                                        </TableCell>
                                    )}
                                    {filter === 'overdue' && (
                                        <TableCell>
                                            {contract.debtInfo && (
                                                <Badge variant="outline" className={cn(ageCategoryColors[contract.debtInfo.category])}>
                                                    {contract.debtInfo.category}
                                                </Badge>
                                            )}
                                        </TableCell>
                                    )}
                                     {filter === 'overdue' && (
                                        <TableCell className="text-right font-semibold text-destructive">
                                            B/. {balance.toFixed(2)}
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="icon" title="Ver Contrato">
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
                        {searchTerm ? 'Intenta con otro término de búsqueda.' : (filter === 'overdue' ? 'No hay contratos por cobrar.' : 'Comienza creando un nuevo contrato para verlo aquí.')}
                    </p>
                </div>
            )}
        </>
      )}
    </div>
  );
}

    
