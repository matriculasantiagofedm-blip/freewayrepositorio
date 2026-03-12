
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, CalendarIcon, ChevronLeft, Download, Plus, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';

// Métodos de pago según la imagen
const COLUMNS = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'T. Débito', label: 'T. Débito' },
  { id: 'T. Crédito', label: 'T. Crédito' },
  { id: 'BAC', label: 'BAC' },
  { id: 'Gral', label: 'Gral' },
  { id: 'Cheque', label: 'Cheque' },
];

const BILLS = [
  { val: 100, label: 'B/. 100.00:' },
  { val: 50, label: 'B/. 50.00:' },
  { val: 20, label: 'B/. 20.00:' },
  { val: 10, label: 'B/. 10.00:' },
  { val: 5, label: 'B/. 5.00:' },
  { val: 1, label: 'B/. 1.00:' },
];

const COINS = [
  { val: 1.00, label: 'B/. 1.00:' },
  { val: 0.50, label: 'B/. 0.50:' },
  { val: 0.25, label: 'B/. 0.25:' },
  { val: 0.10, label: 'B/. 0.10:' },
  { val: 0.05, label: 'B/. 0.05:' },
  { val: 0.01, label: 'B/. 0.01:' },
];

export default function DailyCashReport() {
  const db = useDb();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados para el desglose manual
  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [coinCounts, setCoinCounts] = useState<Record<number, number>>({});
  const [expenses, setExpenses] = useState<{ id: string; desc: string; amount: number }[]>([]);

  // Consultas de Firestore
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

  // Procesamiento de transacciones unificado
  const transactions = useMemo(() => {
    const list: any[] = [];
    
    contracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      list.push({
        id: c.id,
        folio: String(c.folioNumber).padStart(6, '0'),
        cedula: details?.studentIdNumber || '---',
        client: c.clientName,
        service: c.type,
        amount: Number(details?.downPayment) || 0,
        method: mapMethod(details?.paymentType),
        date: toDate(c.activatedAt),
        seller: c.createdBy || 'Sistema'
      });
    });

    cancellations?.forEach(p => {
      list.push({
        id: p.id,
        folio: String(p.contractFolio || '').padStart(6, '0'),
        cedula: p.studentIdNumber || '---',
        client: p.clientName,
        service: 'Abono/Cancelación de Saldo',
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
        service: 'Actualización de Certificado',
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja'
      });
    });

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [contracts, cancellations, updates]);

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

  // Cálculos de Totales
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

  const totalBillCash = BILLS.reduce((sum, b) => sum + (billCounts[b.val] || 0) * b.val, 0);
  const totalCoinCash = COINS.reduce((sum, c) => sum + (coinCounts[c.val] || 0) * c.val, 0);
  const totalFisico = totalBillCash + totalCoinCash;

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
        margin: 0.3, 
        filename: `Caja_Freeway_${format(selectedDate, 'yyyy-MM-dd')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) { console.error(e); } finally { setIsDownloading(false); }
  };

  const addExpense = () => {
    setExpenses([...expenses, { id: Math.random().toString(), desc: '', amount: 0 }]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, field: 'desc' | 'amount', value: any) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const isLoading = loadingC || loadingCanc || loadingU;

  return (
    <div className="flex flex-col gap-6 bg-slate-50 min-h-screen pb-20">
      {/* UI DE CONTROL (No se imprime) */}
      <div className="flex items-center justify-between p-6 bg-white border-b sticky top-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Cierre de Caja Diario</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Procesamiento de arqueo físico y digital.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-blue-600 hover:bg-blue-700 shadow-md">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* ÁREA DEL REPORTE (Lo que se imprime) */}
      <div id="report-to-print" className="bg-white mx-auto p-[0.4in] w-[8.5in] flex flex-col font-sans text-black min-h-[11in] shadow-xl print:shadow-none print:m-0 print:w-full">
        
        {/* Header Empresa */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-[0.1em]">FREEWAY ESCUELA DE MANEJO</h1>
          <h2 className="text-sm font-bold uppercase border-y border-black py-1 mt-1 bg-slate-50">
            REPORTE DE CAJA DIARIO - {format(selectedDate, "EEEE d 'DE' MMMM 'DE' yyyy", { locale: es }).toUpperCase()}
          </h2>
        </div>

        {/* Tabla de Movimientos */}
        <div className="mb-6">
          <table className="w-full border-collapse border-2 border-black text-[7pt]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1 text-left w-[50px]">Contrato</th>
                <th className="border border-black p-1 text-left w-[70px]">Cédula</th>
                <th className="border border-black p-1 text-left">Cliente</th>
                <th className="border border-black p-1 text-left">Servicio</th>
                <th className="border border-black p-1 text-left w-[80px]">Vendedor</th>
                {COLUMNS.map(c => (
                  <th key={c.id} className="border border-black p-1 text-right w-[50px]">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></td></tr>
              ) : transactions.length > 0 ? (
                transactions.map((t, i) => (
                  <tr key={i}>
                    <td className="border border-black p-1 font-bold">{t.folio}</td>
                    <td className="border border-black p-1">{t.cedula}</td>
                    <td className="border border-black p-1 font-bold uppercase truncate max-w-[120px]">{t.client}</td>
                    <td className="border border-black p-1 italic truncate max-w-[120px]">{t.service}</td>
                    <td className="border border-black p-1 uppercase">{t.seller}</td>
                    {COLUMNS.map(c => (
                      <td key={c.id} className="border border-black p-1 text-right">
                        {t.method === c.id ? t.amount.toFixed(2) : '-'}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={11} className="p-8 text-center italic text-slate-400">Sin movimientos para hoy.</td></tr>
              )}
              {/* Totales por Método */}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={5} className="border border-black p-1 text-right uppercase tracking-widest">TOTALES POR MÉTODO</td>
                {COLUMNS.map(c => (
                  <td key={c.id} className="border border-black p-1 text-right bg-white">{totalsByMethod[c.id].toFixed(2)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Columna Izquierda: Desglose de Efectivo */}
          <div className="border-2 border-black p-3 rounded-sm">
            <h3 className="font-black text-[9pt] uppercase border-b-2 border-black mb-3">DESGLOSE DE EFECTIVO</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[7pt] font-black italic mb-1">Billetes</p>
                {BILLS.map(b => (
                  <div key={b.val} className="flex items-center justify-between gap-2">
                    <span className="text-[8pt] font-bold w-16">{b.label}</span>
                    <input 
                      type="number" 
                      className="w-12 h-6 border border-black rounded-sm text-center text-[8pt] print:border-slate-300"
                      value={billCounts[b.val] || ''}
                      onChange={(e) => setBillCounts({ ...billCounts, [b.val]: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-[8pt] font-bold w-12 text-right">{((billCounts[b.val] || 0) * b.val).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-[7pt] font-black italic mb-1">Monedas</p>
                {COINS.map(c => (
                  <div key={c.val} className="flex items-center justify-between gap-2">
                    <span className="text-[8pt] font-bold w-16">{c.label}</span>
                    <input 
                      type="number" 
                      className="w-12 h-6 border border-black rounded-sm text-center text-[8pt] print:border-slate-300"
                      value={coinCounts[c.val] || ''}
                      onChange={(e) => setCoinCounts({ ...coinCounts, [c.val]: parseInt(e.target.value) || 0 })}
                    />
                    <span className="text-[8pt] font-bold w-12 text-right">{((coinCounts[c.val] || 0) * c.val).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-2 border-t-2 border-black flex justify-between items-center">
              <span className="font-black text-[10pt] uppercase">TOTAL FÍSICO:</span>
              <span className="font-black text-[12pt] bg-slate-50 px-3 border border-black">B/. {totalFisico.toFixed(2)}</span>
            </div>
          </div>

          {/* Columna Derecha: Gastos y Resumen */}
          <div className="flex flex-col gap-4">
            {/* Gastos del Día */}
            <div className="border-2 border-black p-3 rounded-sm flex-1">
              <div className="flex justify-between items-center border-b-2 border-black mb-3">
                <h3 className="font-black text-[9pt] uppercase">GASTOS DEL DÍA</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6 print:hidden" onClick={addExpense}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {expenses.map(e => (
                  <div key={e.id} className="flex gap-2 items-center">
                    <input 
                      className="flex-1 h-6 border-b border-black text-[8pt] font-medium uppercase placeholder:text-slate-300 italic px-1 print:border-dotted"
                      placeholder="Descripción del gasto..."
                      value={e.desc}
                      onChange={(v) => updateExpense(e.id, 'desc', v.target.value)}
                    />
                    <input 
                      type="number"
                      className="w-16 h-6 border border-black rounded-sm text-center text-[8pt] font-bold print:border-slate-300"
                      value={e.amount || ''}
                      onChange={(v) => updateExpense(e.id, 'amount', parseFloat(v.target.value) || 0)}
                    />
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 print:hidden" onClick={() => removeExpense(e.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {expenses.length === 0 && <div className="h-20 border-b border-black border-dotted opacity-20"></div>}
              </div>
              <div className="mt-4 flex justify-between font-black text-[9pt]">
                <span>TOTAL GASTOS:</span>
                <span className="underline">B/. {totalGastos.toFixed(2)}</span>
              </div>
            </div>

            {/* Cuadre Final */}
            <div className="bg-slate-900 text-white p-4 rounded-sm border-2 border-black">
              <div className="space-y-2 text-[9pt]">
                <div className="flex justify-between border-b border-white/20 pb-1">
                  <span className="font-bold opacity-70">Total Facturado:</span>
                  <span className="font-black text-[11pt]">B/. {totalFacturado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-1">
                  <span className="font-bold opacity-70">Efectivo en Sistema:</span>
                  <span className="font-black">B/. {totalEfectivoSistema.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-1">
                  <span className="font-bold text-red-400">(-) Gastos:</span>
                  <span className="font-black text-red-400">-{totalGastos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-black text-blue-400 uppercase">Efectivo Esperado:</span>
                  <span className="font-black text-[12pt] text-blue-400">B/. {efectivoEsperado.toFixed(2)}</span>
                </div>
                <div className={cn("flex justify-between mt-2 p-2 rounded-sm", diferencia >= 0 ? "bg-green-600" : "bg-red-600")}>
                  <span className="font-black uppercase tracking-widest">DIFERENCIA:</span>
                  <span className="font-black text-[14pt]">B/. {diferencia.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Firmas */}
        <div className="mt-auto pt-16 grid grid-cols-2 gap-20 px-10">
          <div className="text-center">
            <div className="border-t-2 border-black mb-1"></div>
            <p className="text-[8pt] font-black uppercase">FIRMA DEL CAJERO</p>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black mb-1"></div>
            <p className="text-[8pt] font-black uppercase">FIRMA DEL ADMINISTRADOR</p>
          </div>
        </div>

        {/* Pie de página auditoría */}
        <div className="text-center text-[6pt] text-slate-400 font-bold uppercase mt-8 tracking-[0.2em] border-t pt-2">
          SISTEMA CONTRACTTIME • AUDITORÍA DE CAJA INTERNA • {format(new Date(), 'PPpp', { locale: es })}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter portrait; margin: 0; }
          body { background: white !important; }
          header, footer, nav, .print-hidden { display: none !important; }
          #report-to-print { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important; 
            padding: 0.5in !important;
            width: 100% !important;
          }
          input { border: none !important; background: transparent !important; outline: none !important; }
        }
      `}</style>
    </div>
  );
}
