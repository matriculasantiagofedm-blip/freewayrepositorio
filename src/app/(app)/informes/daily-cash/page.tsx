'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, CalendarIcon, ChevronLeft, Download, Plus, Trash2, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLUMNS = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'T. Débito', label: 'T. Débito' },
  { id: 'T. Crédito', label: 'T. Crédito' },
  { id: 'BAC', label: 'BAC' },
  { id: 'Gral', label: 'Gral' },
  { id: 'Cheque', label: 'Cheque' },
];

const BILLS = [
  { val: 100, label: 'B/. 100.00' },
  { val: 50, label: 'B/. 50.00' },
  { val: 20, label: 'B/. 20.00' },
  { val: 10, label: 'B/. 10.00' },
  { val: 5, label: 'B/. 5.00' },
  { val: 1, label: 'B/. 1.00' },
];

const COINS = [
  { val: 1.00, label: 'B/. 1.00' },
  { val: 0.50, label: 'B/. 0.50' },
  { val: 0.25, label: 'B/. 0.25' },
  { val: 0.10, label: 'B/. 0.10' },
  { val: 0.05, label: 'B/. 0.05' },
  { val: 0.01, label: 'B/. 0.01' },
];

export default function DailyCashReport() {
  const db = useDb();
  const { role: userRole } = useCurrentRole();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [coinCounts, setCoinCounts] = useState<Record<number, number>>({});
  const [expenses, setExpenses] = useState<{ id: string; desc: string; amount: number }[]>([]);

  const start = startOfDay(selectedDate);
  const end = endOfDay(selectedDate);

  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('activatedAt', '>=', Timestamp.fromDate(start)), where('activatedAt', '<=', Timestamp.fromDate(end))) : null), [db, selectedDate]);
  const cancellationsQuery = useMemoQuery(() => (db ? query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end))) : null), [db, selectedDate]);
  const updatesQuery = useMemoQuery(() => (db ? query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end))) : null), [db, selectedDate]);
  const bookSalesQuery = useMemoQuery(() => (db ? query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end))) : null), [db, selectedDate]);

  const { data: contracts, isLoading: loadingC } = useCollection(contractsQuery);
  const { data: cancellations, isLoading: loadingCanc } = useCollection(cancellationsQuery);
  const { data: updates, isLoading: loadingU } = useCollection(updatesQuery);
  const { data: bookSales, isLoading: loadingB } = useCollection(bookSalesQuery);

  const transactions = useMemo(() => {
    let list: any[] = [];
    
    const addContract = (c: any) => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      if (Number(details?.downPayment) > 0) {
        list.push({
          id: c.id,
          folio: String(c.folioNumber || 'S-N').padStart(6, '0'),
          cedula: details?.studentIdNumber || '---',
          client: c.clientName,
          service: c.type,
          amount: Number(details?.downPayment) || 0,
          method: mapMethod(details?.paymentType),
          date: toDate(c.activatedAt || c.createdAt),
          seller: c.createdBy || 'Sistema'
        });
      }
    };

    contracts?.forEach(addContract);
    cancellations?.forEach(p => {
      list.push({
        id: p.id,
        folio: String(p.contractFolio || '').padStart(6, '0'),
        cedula: p.studentIdNumber || '---',
        client: p.clientName,
        service: 'Abono/Saldos',
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja'
      });
    });

    updates?.forEach(p => {
      list.push({
        id: p.id,
        folio: String(p.updateFolio || '').padStart(6, '0'),
        cedula: p.studentIdNumber || '---',
        client: p.clientName,
        service: 'Actualización',
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja'
      });
    });

    bookSales?.forEach(p => {
      list.push({
        id: p.id,
        folio: String(p.bookSaleFolio || '').padStart(6, '0'),
        cedula: p.studentIdNumber || '---',
        client: p.clientName,
        service: `Libro: ${p.bookTitle}`,
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja'
      });
    });

    if (filterRole !== 'all') {
      list = list.filter(t => t.seller === filterRole);
    }

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [contracts, cancellations, updates, bookSales, filterRole]);

  function mapMethod(m?: string) {
    if (!m) return 'Efectivo';
    const lower = m.toLowerCase();
    if (lower.includes('cash') || lower.includes('efectivo')) return 'Efectivo';
    if (lower.includes('debit') || lower.includes('débito')) return 'T. Débito';
    if (lower.includes('credit') || lower.includes('crédito')) return 'T. Crédito';
    if (lower.includes('bac')) return 'BAC';
    if (lower.includes('yappy') || lower.includes('general') || lower.includes('gral')) return 'Gral';
    if (lower.includes('cheque')) return 'Cheque';
    return 'Gral';
  }

  const totalsByMethod = useMemo(() => {
    const res: Record<string, number> = {};
    COLUMNS.forEach(c => res[c.id] = 0);
    transactions.forEach(t => {
      if (res[t.method] !== undefined) res[t.method] += t.amount;
    });
    return res;
  }, [transactions]);

  const totalFacturado = Object.values(totalsByMethod).reduce((a, b) => a + b, 0);
  const totalEfectivoSistema = totalsByMethod['Efectivo'] || 0;
  const totalFisico = BILLS.reduce((sum, b) => sum + (billCounts[b.val] || 0) * b.val, 0) + 
                      COINS.reduce((sum, c) => sum + (coinCounts[c.val] || 0) * c.val, 0);
  const totalGastos = expenses.reduce((sum, e) => sum + e.amount, 0);
  const efectivoEsperado = totalEfectivoSistema - totalGastos;
  const diferencia = totalFisico - efectivoEsperado;

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: 0,
        filename: `Caja_Freeway_${format(selectedDate, 'yyyy-MM-dd')}_${filterRole}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 816 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) { console.error(e); } finally { setIsDownloading(false); }
  };

  const isLoading = loadingC || loadingCanc || loadingU || loadingB;

  return (
    <div className="flex flex-col gap-4 bg-slate-100 min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-white border-b sticky top-0 z-50 shadow-sm print:hidden gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild><Link href="/dashboard"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Cierre de Caja</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-8 w-[160px] bg-white text-[10px] font-bold uppercase border-none shadow-none focus:ring-0">
                <SelectValue placeholder="Filtrar por Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-bold uppercase">Todos los Roles</SelectItem>
                <SelectItem value="Ventas" className="text-[10px] font-bold uppercase">Ventas</SelectItem>
                <SelectItem value="Ventas Externas" className="text-[10px] font-bold uppercase">Ventas Externas</SelectItem>
                <SelectItem value="Administrador" className="text-[10px] font-bold uppercase">Administración</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-44 justify-start text-left font-bold uppercase text-[10px] h-9">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {format(selectedDate, "PPP", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
          
          <Button onClick={() => window.print()} variant="outline" size="sm" className="font-bold h-9 border-2 border-slate-800"><Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isDownloading} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 font-bold shadow-md">
            {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />} PDF
          </Button>
        </div>
      </div>

      <div className="w-full flex justify-center p-2 md:p-4 print:p-0">
        <div id="report-to-print" className="bg-white w-full max-w-[8.5in] p-6 flex flex-col font-sans text-black min-h-[10.5in] shadow-lg print:shadow-none print:m-0 print:p-0 box-border overflow-hidden">
          
          <div className="text-center mb-4">
            <h1 className="text-xl font-black uppercase tracking-widest leading-none mb-1">FREEWAY ESCUELA DE MANEJO</h1>
            <p className="text-[7pt] font-bold uppercase mb-2 opacity-60">PH Green Plaza, La Chorrera • RUC 155628022-2-2016 DV 2</p>
            <h2 className="text-[9pt] font-black uppercase border-y border-black py-1.5 bg-slate-50 tracking-[0.2em]">
              REPORTE DE CAJA - {filterRole === 'all' ? 'CONSOLIDADO' : filterRole.toUpperCase()}
            </h2>
            <p className="text-[8pt] font-bold mt-1">{format(selectedDate, "EEEE d 'DE' MMMM 'DE' yyyy", { locale: es }).toUpperCase()}</p>
          </div>

          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse border border-black text-[6.5pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-1 text-left w-[45px] font-black uppercase">Folio</th>
                  <th className="border border-black p-1 text-left w-[70px] font-black uppercase">Cédula</th>
                  <th className="border border-black p-1 text-left font-black uppercase">Cliente</th>
                  <th className="border border-black p-1 text-left font-black uppercase">Rol</th>
                  {COLUMNS.map(c => (
                    <th key={c.id} className="border border-black p-1 text-right w-[45px] font-black uppercase">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={11} className="p-8 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></td></tr>
                ) : transactions.length > 0 ? (
                  transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-black p-1 font-black text-slate-600">{t.folio}</td>
                      <td className="border border-black p-1 font-mono">{t.cedula}</td>
                      <td className="border border-black p-1 font-bold uppercase truncate max-w-[80px]">{t.client}</td>
                      <td className="border border-black p-1 text-blue-700 font-bold uppercase truncate max-w-[60px]">{t.seller}</td>
                      {COLUMNS.map(c => (
                        <td key={c.id} className={cn("border border-black p-1 text-right", t.method === c.id ? "font-bold bg-slate-50/50 text-slate-900" : "text-slate-300")}>
                          {t.method === c.id ? t.amount.toFixed(2) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={11} className="p-10 text-center italic text-slate-400 font-bold uppercase text-[8pt]">No hay transacciones para el filtro seleccionado.</td></tr>
                )}
                <tr className="bg-slate-200 text-black font-black text-[7.5pt]">
                  <td colSpan={4} className="border border-black p-2 text-right tracking-widest uppercase">Total Facturado ({filterRole === 'all' ? 'General' : filterRole}):</td>
                  {COLUMNS.map(c => (
                    <td key={c.id} className="border border-black p-2 text-right">{totalsByMethod[c.id].toFixed(2)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-6 mt-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-black p-3 rounded-sm bg-white shadow-sm">
                <h3 className="font-black text-[9pt] uppercase border-b border-black mb-3 pb-0.5 flex justify-between">
                    <span>Arqueo de Efectivo Físico</span>
                    <span className="text-slate-400 font-bold text-[7pt] tracking-widest">(Manual)</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                    {BILLS.map(b => (
                        <div key={b.val} className="flex items-center justify-between gap-2">
                        <span className="text-[7pt] font-bold w-16">{b.label}:</span>
                        <input 
                            type="number" 
                            className="w-10 h-5 border border-slate-200 rounded text-center text-[7.5pt] font-black focus:border-black print:border-black"
                            value={billCounts[b.val] || ''}
                            onChange={(e) => setBillCounts({ ...billCounts, [b.val]: parseInt(e.target.value) || 0 })}
                        />
                        </div>
                    ))}
                    </div>
                    <div className="space-y-1">
                    {COINS.map(c => (
                        <div key={c.val} className="flex items-center justify-between gap-2">
                        <span className="text-[7pt] font-bold w-16">{c.label}:</span>
                        <input 
                            type="number" 
                            className="w-10 h-5 border border-slate-200 rounded text-center text-[7.5pt] font-black focus:border-black print:border-black"
                            value={coinCounts[c.val] || ''}
                            onChange={(e) => setCoinCounts({ ...coinCounts, [c.val]: parseInt(e.target.value) || 0 })}
                        />
                        </div>
                    ))}
                    </div>
                </div>
                <div className="mt-4 pt-2 border-t-2 border-black flex justify-between items-center bg-slate-50 p-2">
                    <span className="font-black text-[8.5pt] uppercase">Total Físico en Caja:</span>
                    <span className="font-black text-[12pt] px-3 border border-black bg-white">B/. {totalFisico.toFixed(2)}</span>
                </div>
                </div>

                <div className="flex flex-col gap-4">
                <div className="border border-black p-3 rounded-sm flex-1 bg-white shadow-sm">
                    <div className="flex justify-between items-center border-b border-black mb-2 pb-0.5">
                    <h3 className="font-black text-[9pt] uppercase">Egresos / Gastos</h3>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[7pt] font-black border border-slate-200 print:hidden" onClick={() => setExpenses([...expenses, { id: Math.random().toString(), desc: '', amount: 0 }])}>
                        <Plus className="h-3 w-3 mr-1" /> Gasto
                    </Button>
                    </div>
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto mb-2">
                    {expenses.map(e => (
                        <div key={e.id} className="flex gap-2 items-center group">
                        <input 
                            className="flex-1 h-6 border-b border-slate-100 text-[7.5pt] font-bold uppercase placeholder:text-slate-300 italic px-1 focus:border-black transition-all print:border-black"
                            placeholder="Descripción..."
                            value={e.desc}
                            onChange={(v) => setExpenses(expenses.map(ex => ex.id === e.id ? { ...ex, desc: v.target.value } : ex))}
                        />
                        <input 
                            type="number"
                            className="w-14 h-6 border border-slate-200 rounded text-right pr-1 text-[7.5pt] font-black focus:border-black print:border-black"
                            value={e.amount || ''}
                            onChange={(v) => setExpenses(expenses.map(ex => ex.id === e.id ? { ...ex, amount: parseFloat(v.target.value) || 0 } : ex))}
                        />
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 opacity-0 group-hover:opacity-100 print:hidden" onClick={() => setExpenses(expenses.filter(ex => ex.id !== e.id))}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                        </div>
                    ))}
                    </div>
                    <div className="mt-auto pt-1.5 border-t border-black flex justify-between font-black text-[8pt] bg-slate-50 px-2">
                    <span>Total Gastos:</span>
                    <span className="text-red-600">B/. {totalGastos.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bg-white text-black p-4 rounded-sm border-2 border-black shadow-sm">
                    <div className="space-y-2 text-[8pt]">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="opacity-60 uppercase font-bold text-[7pt]">Facturado ({filterRole === 'all' ? 'Total' : filterRole}):</span>
                        <span className="font-black">B/. {totalFacturado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="opacity-60 uppercase font-bold text-[7pt]">Efectivo Esperado:</span>
                        <span className="font-black text-blue-700">B/. {efectivoEsperado.toFixed(2)}</span>
                    </div>
                    <div className={cn(
                        "flex justify-between mt-3 p-2 rounded border-2",
                        diferencia >= 0 ? "border-green-600 text-green-700 bg-green-50" : "border-red-600 text-red-700 bg-red-50"
                    )}>
                        <span className="font-black uppercase text-[9pt]">Diferencia:</span>
                        <span className="font-black text-[13pt]">
                        {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)}
                        </span>
                    </div>
                    </div>
                </div>
                </div>
            </div>

            <div className="mt-8 pt-6 grid grid-cols-2 gap-12 px-12 pb-4">
                <div className="text-center">
                <div className="border-t border-black mb-1"></div>
                <p className="text-[8pt] font-black uppercase">Firma del Cajero</p>
                <p className="text-[6pt] font-bold text-slate-400 uppercase tracking-tighter">{filterRole !== 'all' ? filterRole : (userRole || 'Responsable')}</p>
                </div>
                <div className="text-center">
                <div className="border-t border-black mb-1"></div>
                <p className="text-[8pt] font-black uppercase">Firma Administración</p>
                <p className="text-[6pt] font-bold text-slate-400 uppercase tracking-tighter">Auditoría Interna</p>
                </div>
            </div>
          </div>

          <div className="text-center text-[6pt] text-slate-400 font-bold uppercase mt-4 tracking-[0.2em] border-t pt-2">
            SISTEMA CONTRACTTIME • AUDITORÍA DE CAJA • {format(new Date(), 'PPpp', { locale: es })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter portrait; margin: 0; }
          body { background: white !important; margin: 0 !important; }
          header, footer, nav, .print-hidden { display: none !important; }
          #report-to-print { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important; 
            width: 100% !important; 
            max-width: none !important;
            padding: 0 !important;
          }
          input { border: none !important; background: transparent !important; outline: none !important; padding: 0 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
