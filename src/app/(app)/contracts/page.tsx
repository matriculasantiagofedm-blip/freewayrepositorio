'use client';
import { collection, query, where, orderBy } from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Eye, Search, CheckCircle, XCircle } from 'lucide-react';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

const getBalance = (contract: Contract): number => {
    if (contract.autoMotoDetails) return contract.autoMotoDetails.balance || 0;
    if (contract.ampliacionesDetails) return contract.ampliacionesDetails.balance || 0;
    return 0;
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;
    const balance = getBalance(contract);
    if (balance <= 0) return false;
    let deadline = contract.autoMotoDetails?.paymentDeadline || contract.ampliacionesDetails?.paymentDeadline;
    if (deadline) {
        const paymentDate = toDate(deadline);
        return !isNaN(paymentDate.getTime()) && isPast(paymentDate);
    }
    return false;
}

function AllContractsContent() {
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

  const filteredContracts = allContracts?.filter((contract) => {
      const folio = String(contract.folioNumber || '').padStart(6, '0');
      const client = contract.clientName.toLowerCase();
      const idNumber = contract.autoMotoDetails?.studentIdNumber || contract.deluxeDetails?.studentIdNumber || contract.ampliacionesDetails?.studentIdNumber || '';
      const type = contract.type.toLowerCase();
      const search = searchTerm.toLowerCase();
      
      if (filter === 'overdue' && !isOverdue(contract)) return false;
      
      if (searchTerm) {
          return folio.includes(search) || 
                 client.includes(search) || 
                 idNumber.includes(search) || 
                 type.includes(search);
      }
      return true;
    }) || [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">{filter === 'overdue' ? 'Contratos por Cobrar' : 'Todos los Contratos'}</h1>
         <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por folio, cliente..."
            className="pl-8 sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Cargando contratos...</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead>Fecha</TableHead>
                {filter === 'overdue' && <TableHead className="text-right">Monto Adeudado</TableHead>}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow key={contract.id} className={cn(contract.status === 'expired' && 'bg-muted/50')}>
                  <TableCell className="font-medium text-primary">{String(contract.folioNumber || '').padStart(6, '0')}</TableCell>
                  <TableCell>{contract.clientName}</TableCell>
                  <TableCell>{contract.type}</TableCell>
                  <TableCell>
                    {contract.certificateGeneratedAt ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell>{format(toDate(contract.createdAt), 'dd/MM/yyyy', { locale: es })}</TableCell>
                  {filter === 'overdue' && (
                    <TableCell className="text-right font-semibold text-destructive">B/. {getBalance(contract).toFixed(2)}</TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/contracts/${contract.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={filter === 'overdue' ? 7 : 6} className="text-center py-10 text-muted-foreground">
                    No se encontraron contratos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function AllContractsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando lista de contratos...</div>}>
      <AllContractsContent />
    </Suspense>
  );
}
