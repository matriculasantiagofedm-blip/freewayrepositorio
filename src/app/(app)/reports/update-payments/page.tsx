
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import type { Payment } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';

export default function UpdatePaymentsPage() {
  const db = useDb();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());

  const paymentsQuery = useMemoQuery(() => {
    if (!db || !user || !reportDate) return null;
    
    const start = startOfDay(reportDate);
    const end = endOfDay(reportDate);

    return query(
        collection(db, 'update_payments'), 
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end)),
        orderBy('paymentDate', 'desc')
    );
  }, [db, user, reportDate]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (!searchTerm) return payments;

    const search = searchTerm.toLowerCase();

    return payments.filter((payment) => {
      const updateFolio = String(payment.updateFolio || '').padStart(6, '0');
      const contractFolio = String(payment.contractFolio || '').padStart(6, '0');
      const clientName = payment.clientName?.toLowerCase() || '';
      const studentId = payment.studentIdNumber?.toLowerCase() || '';

      return (
        updateFolio.includes(search) ||
        contractFolio.includes(search) ||
        clientName.includes(search) ||
        studentId.includes(search)
      );
    });
  }, [payments, searchTerm]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando pagos...</p>
        </div>
      );
    }
    
    if (!user && !isLoading) {
        return (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                    Acceso Denegado
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Debes iniciar sesión para ver este reporte.
                </p>
                <Button asChild className="mt-4">
                    <Link href="/">Iniciar Sesión</Link>
                </Button>
            </div>
        );
    }

    if (filteredPayments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                    No se encontraron pagos
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    {searchTerm ? "Intenta con otro término de búsqueda." : "No se han registrado pagos de actualización para la fecha seleccionada."}
                </p>
            </div>
        );
    }

    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio Actualización</TableHead>
              <TableHead>Folio Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Fecha de Pago</TableHead>
              <TableHead className="text-right">Monto (B/.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.map((payment) => {
              const paymentDate = toDate(payment.paymentDate);
              return (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium text-primary">
                      {String(payment.updateFolio).padStart(6, '0')}
                  </TableCell>
                  <TableCell>
                      {payment.contractId === 'MANUAL' ? (
                          <span className="text-muted-foreground">Manual</span>
                      ) : (
                          <Link href={`/contracts/${payment.contractId}`} className="hover:underline text-blue-600">
                              {String(payment.contractFolio).padStart(6, '0')}
                          </Link>
                      )}
                  </TableCell>
                  <TableCell>{payment.clientName}</TableCell>
                  <TableCell>{payment.studentIdNumber}</TableCell>
                  <TableCell>
                    {!isNaN(paymentDate.getTime()) ? format(paymentDate, 'dd/MM/yyyy HH:mm', { locale: es }) : 'Fecha inválida'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {payment.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">Listado de Pagos de Actualización</h1>
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !reportDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={(date) => setReportDate(date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Buscar por folio, cliente..."
                className="pl-8 sm:w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

    
