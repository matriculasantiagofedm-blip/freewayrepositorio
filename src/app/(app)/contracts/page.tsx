
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
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Eye, Search, CheckCircle, XCircle, CalendarIcon, X, CalendarClock } from 'lucide-react';
import { useState, Suspense, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection } from '@/hooks/use-firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return Number(details?.balance) || 0;
}

const getPaymentDeadline = (contract: Contract): Date | null => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    if (!details?.paymentDeadline) return null;
    const date = toDate(details.paymentDeadline);
    return isNaN(date.getTime()) ? null : date;
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;
    const balance = getBalance(contract);
    return balance > 0;
}

function AllContractsContent() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const filter = searchParams.get('filter');

  useEffect(() => {
    setMounted(true);
  }, []);

  const contractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), orderBy('folioNumber', 'desc'));
  }, [db, user]);

  const { data: allContracts, isLoading } = useCollection<Contract>(contractsQuery);

  const filteredContracts = useMemo(() => {
    if (!allContracts || !mounted) return [];
    return allContracts.filter((contract) => {
      if (contract.isManualPrint) return false;

      const folio = String(contract.folioNumber || '').padStart(6, '0');
      const client = contract.clientName?.toLowerCase() || '';
      const type = contract.type?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      
      const contractDate = toDate(contract.createdAt);

      if (selectedDate && !isSameDay(contractDate, selectedDate)) return false;
      if (filter === 'overdue' && !isOverdue(contract)) return false;
      if (filter === 'today' && !isToday(contractDate)) return false;
      
      if (searchTerm) {
          return folio.includes(search) || client.includes(search) || type.includes(search);
      }
      return true;
    });
  }, [allContracts, searchTerm, filter, selectedDate, mounted]);

  if (!mounted) return null;

  const getTitle = () => {
      if (filter === 'overdue') return 'Contratos por Cobrar (Saldos)';
      if (filter === 'today') return 'Trámites Realizados Hoy';
      return 'Listado Global de Contratos';
  };

  const showActions = role === 'Administrador';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className='flex flex-col'>
            <h1 className="font-headline text-3xl font-bold">{getTitle()}</h1>
            <p className='text-sm text-muted-foreground'>Consulta y gestiona los registros de la escuela.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por folio, cliente..."
              className="pl-8 sm:w-[250px] h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[200px] h-10 justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : <span>Filtrar por día</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {selectedDate && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(undefined)} title="Limpiar fecha">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
            <p className="animate-pulse font-medium">Cargando base de datos...</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[100px] font-bold text-black">Folio</TableHead>
                <TableHead className="font-bold text-black">Estado</TableHead>
                <TableHead className="font-bold text-black">Cliente</TableHead>
                <TableHead className="font-bold text-black">Tipo de Trámite</TableHead>
                <TableHead className="font-bold text-black">Certificado</TableHead>
                <TableHead className="font-bold text-black">Fecha Registro</TableHead>
                <TableHead className="text-right font-bold text-black">Saldo (B/.)</TableHead>
                <TableHead className="font-bold text-black">Límite Pago</TableHead>
                {showActions && <TableHead className="text-right font-bold text-black">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => {
                  const contractDate = toDate(contract.createdAt);
                  const isCreatedToday = isToday(contractDate);
                  const balance = getBalance(contract);
                  const deadline = getPaymentDeadline(contract);

                  return (
                    <TableRow key={contract.id} className={cn(contract.status === 'expired' && 'bg-muted/50', isCreatedToday && "bg-primary/5")}>
                      <TableCell className="font-black text-primary">
                          {String(contract.folioNumber || '').padStart(6, '0')}
                      </TableCell>
                      <TableCell>
                        {contract.status === 'expired' ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">ANULADO</Badge>
                        ) : contract.status === 'completed' ? (
                          <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200">COMPLETADO</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold bg-green-50 text-green-700 border-green-200">ACTIVO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold uppercase text-xs">{contract.clientName}</TableCell>
                      <TableCell className="text-xs">{contract.type}</TableCell>
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
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                            {format(contractDate, 'dd/MM/yyyy', { locale: es })}
                            {isCreatedToday && <Badge className="h-4 px-1 text-[8px] bg-primary">HOY</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right font-bold", balance > 0 ? "text-destructive" : "text-green-600")}>
                          {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {balance > 0 ? (
                          deadline ? (
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
                              {format(deadline, 'dd/MM/yyyy', { locale: es })}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">No definida</span>
                          )
                        ) : (
                          <span className="text-green-600 font-black text-[9px] uppercase tracking-widest">Paz y Salvo</span>
                        )}
                      </TableCell>
                      {showActions && (
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/contracts/${contract.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={showActions ? 9 : 8} className="h-32 text-center text-muted-foreground italic">
                    {searchTerm || selectedDate ? "No se encontraron contratos con ese criterio." : "No hay trámites registrados para el filtro seleccionado."}
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
