'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, ChevronLeft, Download, Book, Filter } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function GeneralLedgerPage() {
  const db = useDb();
  
  const [period, setPeriod] = useState<string>('current-month');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  // Determinar fechas
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'current-month') {
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: es }) };
    }
    if (period === 'last-month') {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth), label: format(lastMonth, 'MMMM yyyy', { locale: es }) };
    }
    if (period === 'current-year') {
      return { start: startOfYear(now), end: endOfYear(now), label: format(now, 'yyyy', { locale: es }) };
    }
    // Default
    return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: es }) };
  }, [period]);

  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('createdAt', '>=', Timestamp.fromDate(dateRange.start)), where('createdAt', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const calcQuery = useMemoQuery(() => (db ? query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(dateRange.start)), where('paymentDate', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const updatesQuery = useMemoQuery(() => (db ? query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(dateRange.start)), where('paymentDate', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const expensesQuery = useMemoQuery(() => (db ? query(collection(db, 'expenses'), where('date', '>=', Timestamp.fromDate(dateRange.start)), where('date', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const bookSalesQuery = useMemoQuery(() => (db ? query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(dateRange.start)), where('paymentDate', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);

  const { data: contracts, isLoading: l1 } = useCollection<any>(contractsQuery);
  const { data: cancellations, isLoading: l2 } = useCollection<any>(calcQuery);
  const { data: updates, isLoading: l3 } = useCollection<any>(updatesQuery);
  const { data: expenses, isLoading: l4 } = useCollection<any>(expensesQuery);
  const { data: bookSales, isLoading: l5 } = useCollection<any>(bookSalesQuery);

  const isLoading = l1 || l2 || l3 || l4 || l5;

  // Unificar transacciones
  const transactions = useMemo(() => {
    let all: any[] = [];

    // 1. Contratos (Reconocen ingreso completo devengado)
    contracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      const date = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
      all.push({
        id: c.id,
        date,
        type: 'Venta de Contrato',
        reference: `#${String(c.folioNumber).padStart(6, '0')} - ${c.clientName}`,
        debit: Number(details?.courseValue) || 0, // Ingreso devengado (Aumenta Activos/Ingresos)
        credit: 0,
        cashFlow: Number(details?.downPayment) || 0, // Lo que entra real a caja
        rawDate: date.getTime()
      });
    });

    // 2. Abonos a Saldos (No aumentan ingresos porque ya se reconocieron arriba, solo aumentan caja)
    cancellations?.forEach(c => {
      const date = c.paymentDate?.toDate ? c.paymentDate.toDate() : new Date();
      all.push({
        id: c.id,
        date,
        type: 'Cobro a Cuentas (Abono)',
        reference: `#${String(c.contractFolio).padStart(6, '0')} - ${c.clientName}`,
        debit: 0, // El ingreso es 0 (ya se registró)
        credit: 0, 
        cashFlow: Number(c.amount) || 0, // Entra efectivo a caja, reduce la cuenta por cobrar
        rawDate: date.getTime()
      });
    });

    // 3. Trámites
    updates?.forEach(c => {
      const date = c.paymentDate?.toDate ? c.paymentDate.toDate() : new Date();
      all.push({
        id: c.id,
        date,
        type: 'Gestión / Trámite',
        reference: `#${String(c.contractFolio).padStart(6, '0')} - ${c.clientName}`,
        debit: Number(c.amount) || 0, // Ingreso nuevo
        credit: 0,
        cashFlow: Number(c.amount) || 0, // Entra directo a caja
        rawDate: date.getTime()
      });
    });

    // 4. Libros
    bookSales?.forEach(b => {
      const date = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date();
      all.push({
        id: b.id,
        date,
        type: 'Venta de Librería',
        reference: `F-${String(b.bookSaleFolio).padStart(6, '0')} - ${b.bookTitle}`,
        debit: Number(b.amount) || 0, // Ingreso nuevo
        credit: 0,
        cashFlow: Number(b.amount) || 0, // Entra a caja
        rawDate: date.getTime()
      });
    });

    // 5. Gastos
    expenses?.forEach(e => {
      const date = e.date?.toDate ? e.date.toDate() : new Date();
      all.push({
        id: e.id,
        date,
        type: `Gasto: ${e.category || 'Operativo'}`,
        reference: e.description || e.supplier || 'N/A',
        debit: 0, 
        credit: Number(e.amount) || 0, // Gasto de dinero
        cashFlow: -(Number(e.amount) || 0), // Salida de caja
        rawDate: date.getTime()
      });
    });

    // Ordenar de más reciente a más antiguo
    all.sort((a, b) => b.rawDate - a.rawDate);

    // Aplicar Filtro
    if (filterType !== 'all') {
      if (filterType === 'income') all = all.filter(t => t.debit > 0);
      if (filterType === 'expense') all = all.filter(t => t.credit > 0);
      if (filterType === 'cash') all = all.filter(t => t.cashFlow !== 0);
    }

    return all;
  }, [contracts, cancellations, updates, bookSales, expenses, filterType]);

  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let totalCashIn = 0;
    let totalCashOut = 0;

    transactions.forEach(t => {
      totalDebit += t.debit;
      totalCredit += t.credit;
      if (t.cashFlow > 0) totalCashIn += t.cashFlow;
      if (t.cashFlow < 0) totalCashOut += Math.abs(t.cashFlow);
    });

    return { totalDebit, totalCredit, totalCashIn, totalCashOut };
  }, [transactions]);


  const handleDownloadPdf = async () => {
    const element = document.getElementById('ledger-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: 0.3,
        filename: `Mayor_General_${period}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) { console.error(e); } finally { setIsDownloading(false); }
  };

  return (
    <div className="flex flex-col gap-6 mx-auto pb-20 w-full min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-white border rounded-xl shadow-sm gap-4 mt-6 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900">Libro Mayor General</h1>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">Historial Transaccional Integrado</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          <Select value={filterType} onValueChange={setFilterType}>
             <SelectTrigger className="w-[140px] h-10 font-bold uppercase text-[10px] sm:text-xs bg-slate-50">
               <Filter className="w-3 h-3 mr-2 text-slate-400" />
               <SelectValue placeholder="Filtro" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all" className="font-bold text-xs uppercase">Todos los Asientos</SelectItem>
               <SelectItem value="income" className="font-bold text-xs uppercase text-emerald-600">Solo Ingresos (Devengados)</SelectItem>
               <SelectItem value="cash" className="font-bold text-xs uppercase text-blue-600">Mvto. Efectivo (Caja)</SelectItem>
               <SelectItem value="expense" className="font-bold text-xs uppercase text-red-600">Solo Gastos (Egresos)</SelectItem>
             </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] h-10 font-bold uppercase text-[10px] sm:text-xs">
              <SelectValue placeholder="Seleccionar Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month" className="font-bold text-xs uppercase">Mes Actual</SelectItem>
              <SelectItem value="last-month" className="font-bold text-xs uppercase">Mes Pasado</SelectItem>
              <SelectItem value="current-year" className="font-bold text-xs uppercase">Año Actual</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => window.print()} variant="outline" className="font-bold border-2 border-slate-800 uppercase tracking-widest text-xs hidden lg:flex"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isLoading || isDownloading} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-lg text-[10px] sm:text-xs h-10">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />} Exportar PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="font-bold uppercase tracking-widest text-slate-500 text-xs">Cruzando libros mayores...</p>
        </div>
      ) : (
        <div id="ledger-print" className="w-full bg-white border border-slate-300 shadow-sm print:border-none print:shadow-none p-4 rounded-xl">
          
          <div className="flex justify-between items-end mb-6 border-b pb-4">
            <div>
               <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                 <Book className="h-5 w-5" /> Mayor General de Operaciones
               </h2>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                 Período Auditado: {dateRange.label.toUpperCase()}
               </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Ingresos Generados</span>
                  <span className="text-lg font-black text-slate-800 mt-1">B/. {totals.totalDebit.toFixed(2)}</span>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Gastos Asignados</span>
                  <span className="text-lg font-black text-slate-800 mt-1">B/. {totals.totalCredit.toFixed(2)}</span>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Entradas de Caja Real</span>
                  <span className="text-lg font-black text-emerald-800 mt-1">B/. {totals.totalCashIn.toFixed(2)}</span>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Salidas de Caja Real</span>
                  <span className="text-lg font-black text-red-800 mt-1">B/. {totals.totalCashOut.toFixed(2)}</span>
                </CardContent>
              </Card>
          </div>

          <div className="rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead className="w-[120px] text-xs font-black uppercase tracking-widest">Fecha</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-widest">Concepto / Cuenta</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-widest">Referencia</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-emerald-700">Debe (Ingreso)</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-red-700">Haber (Gasto)</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50">Impacto en Caja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/50 h-10">
                      <TableCell className="font-bold text-[10px] uppercase text-slate-500 whitespace-nowrap">
                        {format(t.date, "dd/MM/yy hh:mm a")}
                      </TableCell>
                      <TableCell className="font-black text-[10px] uppercase text-slate-800">
                        {t.type}
                      </TableCell>
                      <TableCell className="text-[10px] font-medium text-slate-500 uppercase truncate max-w-[200px]">
                        {t.reference}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 text-[11px]">
                        {t.debit > 0 ? `B/. ${t.debit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-black text-red-600 text-[11px]">
                        {t.credit > 0 ? `B/. ${t.credit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className={cn("text-right font-black text-[11px] bg-blue-50/30", t.cashFlow > 0 ? "text-emerald-700" : t.cashFlow < 0 ? "text-red-700" : "text-slate-400")}>
                        {t.cashFlow !== 0 ? `B/. ${t.cashFlow.toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-400 text-xs uppercase font-bold tracking-widest">
                      No hay asientos contables registrados para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>
    </div>
  );
}
