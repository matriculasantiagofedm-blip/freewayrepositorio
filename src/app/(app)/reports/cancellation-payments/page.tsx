'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
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
import { Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function toDate(date: any): Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (date && typeof date.toDate === 'function') return date.toDate();
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

export default function CancellationPaymentsPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const [searchTerm, setSearchTerm] = useState('');

  const paymentsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;
    
    // Admins and Ventas can see all cancellation payments
    if (role === 'Administrador' || role === 'Ventas') {
        return query(
            collection(db, 'cancellation_payments'), 
            orderBy('paymentDate', 'desc')
        );
    }
    
    // Other roles see nothing.
    return null; 
  }, [db, user, role]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (!searchTerm) return payments;

    const search = searchTerm.toLowerCase();

    return payments.filter((payment) => {
      const cancellationFolio = String(payment.cancellationFolio || '').padStart(6, '0');
      const contractFolio = String(payment.contractFolio || '').padStart(6, '0');
      const clientName = payment.clientName?.toLowerCase() || '';
      const studentId = payment.studentIdNumber?.toLowerCase() || '';

      return (
        cancellationFolio.includes(search) ||
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
    
    // This condition is met if the query is explicitly set to null (e.g., for roles without permission)
    if (!paymentsQuery && !isLoading) {
        return (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                    Acceso Denegado o sin Permisos
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    No tienes los permisos necesarios para ver este reporte.
                </p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard">Volver al Panel</Link>
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
                    {searchTerm ? "Intenta con otro término de búsqueda." : "No se han registrado pagos de cancelación."}
                </p>
            </div>
        );
    }

    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio Pago</TableHead>
              <TableHead>Folio Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Fecha de Pago</TableHead>
              <TableHead className="text-right">Monto (B/.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium text-primary">
                    {String(payment.cancellationFolio).padStart(6, '0')}
                </TableCell>
                <TableCell>
                    <Link href={`/contracts/${payment.contractId}`} className="hover:underline text-blue-600">
                        {String(payment.contractFolio).padStart(6, '0')}
                    </Link>
                </TableCell>
                <TableCell>{payment.clientName}</TableCell>
                <TableCell>{payment.studentIdNumber}</TableCell>
                <TableCell>
                  {format(toDate(payment.paymentDate), 'dd/MM/yyyy HH:mm', { locale: es })}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {payment.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Listado de Pagos de Cancelación</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por folio, cliente o cédula..."
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
