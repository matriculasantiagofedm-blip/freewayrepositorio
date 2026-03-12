
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, where, Timestamp, getDocs } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
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
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';

export default function CancellationPaymentsPage() {
  const db = useDb();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPayments = async (date: Date) => {
    if (!db || !user) return;
    setIsLoading(true);
    try {
        const start = startOfDay(date);
        const end = endOfDay(date);
        const q = query(
            collection(db, 'cancellation_payments'), 
            where('paymentDate', '>=', Timestamp.fromDate(start)),
            where('paymentDate', '<=', Timestamp.fromDate(end)),
            orderBy('paymentDate', 'desc')
        );
        const snap = await getDocs(q);
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments(reportDate);
  }, [db, user, reportDate]);

  const filteredPayments = useMemo(() => {
    if (!searchTerm) return payments;
    const search = searchTerm.toLowerCase();
    return payments.filter((payment) => {
      const cancellationFolio = String(payment.cancellationFolio || '').padStart(6, '0');
      const clientName = payment.clientName?.toLowerCase() || '';
      const studentId = payment.studentIdNumber?.toLowerCase() || '';
      return cancellationFolio.includes(search) || clientName.includes(search) || studentId.includes(search);
    });
  }, [payments, searchTerm]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold">Pagos de Cancelación</h1>
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className="w-[240px] justify-start text-left font-normal h-11">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(reportDate, "PPP", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={reportDate} onSelect={(date) => date && setReportDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Buscar..." className="pl-8 sm:w-[250px] h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Folio Pago</TableHead>
              <TableHead className="font-bold">Cliente</TableHead>
              <TableHead className="font-bold">Cédula</TableHead>
              <TableHead className="font-bold">Fecha</TableHead>
              <TableHead className="text-right font-bold">Monto (B/.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : filteredPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-black text-primary">{String(p.cancellationFolio || '').padStart(6, '0')}</TableCell>
                  <TableCell className="uppercase text-xs font-bold">{p.clientName}</TableCell>
                  <TableCell>{p.studentIdNumber}</TableCell>
                  <TableCell className="text-xs">{format(toDate(p.paymentDate), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell className="text-right font-black">B/. {p.amount.toFixed(2)}</TableCell>
                </TableRow>
            ))}
            {!isLoading && filteredPayments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No se hallaron registros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
