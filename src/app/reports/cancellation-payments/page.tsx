'use client';

import { useState, useMemo, useEffect } from 'react';
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

export default function CancellationPaymentsPage() {
  const db = useDb();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReportDate(new Date());
  }, []);

  const paymentsQuery = useMemoQuery(() => {
    if (!db || !user || !reportDate) return null;
    const start = startOfDay(reportDate);
    const end = endOfDay(reportDate);
    return query(
        collection(db, 'cancellation_payments'), 
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
    return payments.filter((p) => String(p.cancellationFolio).includes(search) || p.clientName?.toLowerCase().includes(search));
  }, [payments, searchTerm]);

  if (!mounted || !reportDate) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">Pagos de Cancelación</h1>
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{format(reportDate, "PPP", { locale: es })}</Button>
              </PopoverTrigger>
              <PopoverContent align="end"><Calendar mode="single" selected={reportDate} onSelect={(d) => d && setReportDate(d)} initialFocus /></PopoverContent>
            </Popover>
            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[200px]" />
        </div>
      </div>
      {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
        <Table className="border rounded-lg">
          <TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredPayments.map(p => (
              <TableRow key={p.id}>
                <TableCell>{String(p.cancellationFolio).padStart(6, '0')}</TableCell>
                <TableCell className="font-bold uppercase">{p.clientName}</TableCell>
                <TableCell className="text-right">B/. {p.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
