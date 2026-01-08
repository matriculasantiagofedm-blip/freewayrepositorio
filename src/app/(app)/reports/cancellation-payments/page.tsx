'use client';

import { useState, useEffect, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Printer, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import type { Payment } from '@/lib/types';
import { useCollection } from '@/hooks/use-firestore';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

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

export default function CancellationPaymentsReportPage() {
  const { role } = useCurrentRole();
  const db = useDb();
  const { user, isUserLoading } = useUser();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const paymentsQuery = useMemo(() => {
    if (!db || !dateRange?.from || !dateRange.to) return null;
    return query(
      collection(db, 'payments'),
      where('paymentDate', '>=', Timestamp.fromDate(dateRange.from)),
      where('paymentDate', '<=', Timestamp.fromDate(dateRange.to)),
      orderBy('paymentDate', 'desc')
    );
  }, [db, dateRange]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);
  
  const totalAmount = useMemo(() => {
    return payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  }, [payments]);

  const handlePrint = () => {
    window.print();
  };
  
  if (isUserLoading) return <p>Cargando...</p>;
  if (role && role !== 'Administrador') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
        <h3 className="mt-4 text-lg font-semibold text-foreground">Acceso Restringido</h3>
        <p className="mt-2 text-sm text-muted-foreground">No tienes permiso para ver esta sección.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Volver al Panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold font-headline">Listado de Pagos de Cancelación</h1>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Seleccionar rango de fechas</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={es}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
      </div>
      
       <div className="print:block hidden text-center mb-4">
            <h1 className="text-xl font-bold">Listado de Pagos de Cancelación</h1>
            <p className="text-sm text-muted-foreground">
                {dateRange?.from && dateRange?.to ? 
                    `Del ${format(dateRange.from, "P", { locale: es })} al ${format(dateRange.to, "P", { locale: es })}` 
                    : 'Sin rango de fechas seleccionado'}
            </p>
       </div>

      <div className="rounded-lg border">
        {isLoading ? (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Cargando pagos...</p>
            </div>
        ) : payments && payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha de Pago</TableHead>
                <TableHead>Folio Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead className="text-right">Monto Pagado</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{format(toDate(payment.paymentDate), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="font-medium">{String(payment.contractFolio).padStart(6, '0')}</TableCell>
                  <TableCell>{payment.clientName}</TableCell>
                  <TableCell>{payment.studentIdNumber}</TableCell>
                  <TableCell className="text-right">{currencyFormatter.format(payment.amount)}</TableCell>
                  <TableCell>{payment.userId}</TableCell> {/* Placeholder, assuming userId is what's needed */}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
                <TableRow className="font-bold text-base">
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(totalAmount)}</TableCell>
                    <TableCell>({payments.length} pagos)</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No se encontraron pagos para el rango de fechas seleccionado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
