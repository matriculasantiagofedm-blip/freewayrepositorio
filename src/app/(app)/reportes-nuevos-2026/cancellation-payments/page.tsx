'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, CalendarIcon, ChevronLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';

export default function CancellationPaymentsReport() {
  const db = useDb();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const q = useMemoQuery(() => {
    if (!db) return null;
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, 'cancellation_payments'),
      where('paymentDate', '>=', Timestamp.fromDate(start)),
      where('paymentDate', '<=', Timestamp.fromDate(end)),
      orderBy('paymentDate', 'desc')
    );
  }, [db, selectedDate]);

  const { data: payments, isLoading } = useCollection(q);

  const totalAmount = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/reportes-nuevos-2026"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-amber-600">Reporte de Cancelaciones</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Ingresos por pagos de saldos pendientes.</p>
          </div>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48 justify-start text-left font-bold uppercase text-[10px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="py-3 px-6 bg-slate-50/50 border-b">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Listado de Cobros de Saldo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-200" /></div>
            ) : payments && payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-[10px] font-black uppercase">Folio Pago</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Contrato</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Método</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 border-b">
                      <TableCell className="text-xs font-black text-amber-600">#{String(p.cancellationFolio).padStart(6, '0')}</TableCell>
                      <TableCell className="text-[10px] font-bold uppercase truncate max-w-[150px]">{p.clientName}</TableCell>
                      <TableCell className="text-[9px] font-bold text-slate-400">Folio {String(p.contractFolio || '').padStart(6, '0')}</TableCell>
                      <TableCell className="text-[9px] font-black uppercase">{p.paymentType}</TableCell>
                      <TableCell className="text-xs font-black text-right text-green-600">B/. {Number(p.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-12 text-center text-xs font-bold text-slate-400 italic">No hay cancelaciones hoy.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-amber-600 text-white border-none shadow-xl h-fit">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest opacity-70">Total del Día (Saldos)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black">B/. {totalAmount.toFixed(2)}</p>
            <p className="text-[9px] font-bold uppercase mt-2 opacity-60">Sumatoria de todos los abonos realizados hoy.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
