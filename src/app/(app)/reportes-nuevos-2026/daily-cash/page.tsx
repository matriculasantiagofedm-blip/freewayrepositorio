'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, Wallet, CalendarIcon, ChevronLeft, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'bac', label: 'BAC' },
  { id: 'yappy', label: 'Yappy' },
  { id: 'debit', label: 'Tarjeta Débito' },
  { id: 'credit', label: 'Tarjeta Crédito' },
  { id: 'general', label: 'General' },
  { id: 'cheques', label: 'Cheque' },
];

export default function DailyCashReport() {
  const db = useDb();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);

  // Consultas unificadas para arqueo
  const contractsQuery = useMemoQuery(() => {
    if (!db) return null;
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, 'contracts'),
      where('activatedAt', '>=', Timestamp.fromDate(start)),
      where('activatedAt', '<=', Timestamp.fromDate(end))
    );
  }, [db, selectedDate]);

  const cancellationsQuery = useMemoQuery(() => {
    if (!db) return null;
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, 'cancellation_payments'),
      where('paymentDate', '>=', Timestamp.fromDate(start)),
      where('paymentDate', '<=', Timestamp.fromDate(end))
    );
  }, [db, selectedDate]);

  const updatesQuery = useMemoQuery(() => {
    if (!db) return null;
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, 'update_payments'),
      where('paymentDate', '>=', Timestamp.fromDate(start)),
      where('paymentDate', '<=', Timestamp.fromDate(end))
    );
  }, [db, selectedDate]);

  const { data: contracts, isLoading: loadingC } = useCollection(contractsQuery);
  const { data: cancellations, isLoading: loadingCanc } = useCollection(cancellationsQuery);
  const { data: updates, isLoading: loadingU } = useCollection(updatesQuery);

  const transactions = useMemo(() => {
    const list: any[] = [];

    contracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      list.push({
        id: c.id,
        folio: String(c.folioNumber).padStart(6, '0'),
        client: c.clientName,
        service: c.type,
        amount: Number(details?.downPayment) || 0,
        method: details?.paymentType || 'cash',
        date: toDate(c.activatedAt),
        user: c.createdBy
      });
    });

    cancellations?.forEach(p => {
      list.push({
        id: p.id,
        folio: `C-${String(p.cancellationFolio || '').padStart(4, '0')}`,
        client: p.clientName,
        service: 'Abono / Saldo',
        amount: Number(p.amount) || 0,
        method: p.paymentType || 'cash',
        date: toDate(p.paymentDate),
        user: p.createdBy
      });
    });

    updates?.forEach(p => {
      list.push({
        id: p.id,
        folio: `U-${String(p.updateFolio || '').padStart(4, '0')}`,
        client: p.clientName,
        service: 'Actualización',
        amount: Number(p.amount) || 0,
        method: p.paymentType || 'cash',
        date: toDate(p.paymentDate),
        user: p.createdBy
      });
    });

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [contracts, cancellations, updates]);

  const totalsByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    PAYMENT_METHODS.forEach(m => totals[m.id] = 0);
    
    transactions.forEach(t => {
      if (totals[t.method] !== undefined) {
        totals[t.method] += t.amount;
      } else {
        totals['general'] = (totals['general'] || 0) + t.amount;
      }
    });
    
    return totals;
  }, [transactions]);

  const totalGeneral = Object.values(totalsByMethod).reduce((sum, val) => sum + val, 0);

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0.5,
        filename: `Caja_Freeway_${format(selectedDate, 'yyyy-MM-dd')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const isLoading = loadingC || loadingCanc || loadingU;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/reportes-nuevos-2026"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Reporte de Caja Diario</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Arqueo físico por métodos de pago.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-48 justify-start text-left font-bold uppercase text-[10px]", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Elegir día"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
          <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-blue-600 hover:bg-blue-700">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Descargar PDF
          </Button>
        </div>
      </div>

      <div id="report-to-print" className="bg-white p-0 space-y-8">
        <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-xl font-black uppercase tracking-[0.2em]">FREEWAY ESCUELA DE MANEJO S.A.</h1>
          <h2 className="text-sm font-bold uppercase mt-1 text-slate-600">Reporte de Arqueo Diario • {format(selectedDate, "PPP", { locale: es })}</h2>
        </div>

        {/* Resumen de Totales */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {PAYMENT_METHODS.map(m => (
            <Card key={m.id} className="border-slate-200 shadow-none">
              <CardContent className="p-3 text-center">
                <p className="text-[8px] font-black uppercase text-slate-400 mb-1 truncate">{m.label}</p>
                <p className={cn("text-sm font-black", totalsByMethod[m.id] > 0 ? "text-primary" : "text-slate-200")}>
                  B/. {totalsByMethod[m.id].toFixed(2)}
                </p>
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-2 bg-slate-900 text-white border-none">
            <CardContent className="p-3 flex flex-col justify-center items-center h-full">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">TOTAL GENERAL</p>
              <p className="text-2xl font-black">B/. {totalGeneral.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Listado de Transacciones */}
        <Card className="border-slate-200 shadow-none">
          <CardHeader className="py-3 px-6 bg-slate-50/50 border-b">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">Desglose de Movimientos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-200" /></div>
            ) : transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-[10px] font-black uppercase">Folio</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Concepto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">M. Pago</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Usuario</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/50 border-b">
                      <TableCell className="text-xs font-black text-blue-600">{t.folio}</TableCell>
                      <TableCell className="text-[10px] font-bold uppercase truncate max-w-[150px]">{t.client}</TableCell>
                      <TableCell className="text-[9px] font-medium text-slate-500">{t.service}</TableCell>
                      <TableCell className="text-[9px] font-black uppercase">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{t.method}</span>
                      </TableCell>
                      <TableCell className="text-[9px] font-bold text-slate-400">{t.user || '---'}</TableCell>
                      <TableCell className="text-xs font-black text-right">B/. {t.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-12 text-center text-xs font-bold text-slate-400 italic">No hay transacciones registradas para este día.</div>
            )}
          </CardContent>
        </Card>

        {/* Sección de Firmas (Solo para impresión) */}
        <div className="hidden print:grid grid-cols-2 gap-20 pt-20 px-10">
          <div className="text-center">
            <div className="border-t-2 border-black mb-1"></div>
            <p className="text-[10px] font-black uppercase">Elaborado por:</p>
            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">{format(new Date(), 'PPpp', { locale: es })}</p>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black mb-1"></div>
            <p className="text-[10px] font-black uppercase">Visto Bueno Administración</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; padding: 0 !important; }
          .print-hidden { display: none !important; }
          .header, footer, nav, button { display: none !important; }
          #report-to-print { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
