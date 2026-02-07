'use client';
import { collection, query, orderBy } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Eye, Search, CheckCircle, XCircle } from 'lucide-react';
import { useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDb } from '@/components/firebase-provider';
import { useCollection } from '@/hooks/use-firestore';

const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return details?.balance || 0;
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;
    const balance = getBalance(contract);
    return balance > 0;
}

function AllContractsContent() {
  const db = useDb();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const filter = searchParams.get('filter');

  const contractsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'contracts'), orderBy('folioNumber', 'desc'));
  }, [db]);

  const { data: allContracts, isLoading } = useCollection<Contract>(contractsQuery);

  const filteredContracts = useMemo(() => {
    if (!allContracts) return [];
    return allContracts.filter((contract) => {
      const folio = String(contract.folioNumber || '').padStart(6, '0');
      const client = contract.clientName?.toLowerCase() || '';
      const type = contract.type?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      
      // Aplicar filtro de saldo si se solicita desde el Dashboard
      if (filter === 'overdue' && !isOverdue(contract)) return false;
      
      if (searchTerm) {
          return folio.includes(search) || client.includes(search) || type.includes(search);
      }
      return true;
    });
  }, [allContracts, searchTerm, filter]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">{filter === 'overdue' ? 'Contratos por Cobrar' : 'Listado Global de Contratos'}</h1>
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
        <div className="flex items-center justify-center p-12">
            <p className="animate-pulse font-medium">Cargando base de datos...</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead>Fecha</TableHead>
                {(filter === 'overdue' || true) && <TableHead className="text-right">Saldo (B/.)</TableHead>}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => (
                  <TableRow key={contract.id} className={cn(contract.status === 'expired' && 'bg-muted/50')}>
                    <TableCell className="font-medium text-primary">
                        {String(contract.folioNumber || '').padStart(6, '0')}
                    </TableCell>
                    <TableCell className="font-semibold">{contract.clientName}</TableCell>
                    <TableCell>{contract.type}</TableCell>
                    <TableCell>
                      {contract.certificateGeneratedAt ? (
                        <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-[10px] font-bold">EMITIDO</span>
                        </div>
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground opacity-50" />
                      )}
                    </TableCell>
                    <TableCell>{format(toDate(contract.createdAt), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell className={cn("text-right font-bold", getBalance(contract) > 0 ? "text-destructive" : "text-green-600")}>
                        {getBalance(contract).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/contracts/${contract.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {searchTerm ? "No se encontraron contratos con ese criterio." : "No hay contratos registrados."}
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
    <Suspense fallback={<div className="p-8 text-center">Cargando listado...</div>}>
      <AllContractsContent />
    </Suspense>
  );
}