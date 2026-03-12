
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
import { useCurrentRole } from '@/hooks/use-current-role';

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
  const { role } = useCurrentRole();
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
    <div className="flex flex-col gap-6 bg-slate-50 min-h-screen">
      {/* HEADER DE CONTROL (No se imprime) */}
      <div className="flex items-center justify-between p-6 bg-white border-b sticky top-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Cierre de Caja Diario</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Formato Operativo Completo</p>
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
          <Button onClick={() => window.print()} variant="outline" className="font-bold"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-blue-600 hover:bg-blue-700 shadow-md font-bold">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* CONTENEDOR DE PANTALLA COMPLETA */}
      <div className="w-full flex justify-center p-0 md:p-6 print:p-0">
        <div id="report-to-print" className="bg-white w-full max-w-[1400px] p-[0.5in] flex flex-col font-sans text-black min-h-[11in] shadow-2xl print:shadow-none print:m-0 print:p-[0.3in] print:max-w-none">
          
          {/* Header Empresa */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black uppercase tracking-[0.15em] leading-none mb-1">FREEWAY ESCUELA DE MANEJO</h1>
            <p className="text-[8pt] font-bold uppercase mb-4 opacity-60">PH Green Plaza, La Chorrera • RUC 155628022-2-2016 DV 2</p>
            <h2 className="text-[11pt] font-black uppercase border-y-2 border-black py-2 bg-slate-50 tracking-widest">
              REPORTE DE CAJA DIARIO - {format(selectedDate, "EEEE d 'DE' MMMM 'DE' yyyy", { locale: es }).toUpperCase()}
            </h2>
          </div>

          {/* Tabla de Movimientos - Pantalla Completa */}
          <div className="mb-10">
            <table className="w-full border-collapse border-2 border-black text-[8pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-2 text-left w-[60px] font-black">FOLIO</th>
                  <th className="border border-black p-2 text-left w-[90px] font-black">CÉDULA</th>
                  <th className="border border-black p-2 text-left font-black">CLIENTE</th>
                  <th className="border border-black p-2 text-left font-black">SERVICIO</th>
                  <th className="border border-black p-2 text-left w-[100px] font-black">VENDEDOR</th>
                  {COLUMNS.map(c => (
                    <th key={c.id} className="border border-black p-2 text-right w-[75px] font-black">{c.label.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={11} className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></td></tr>
                ) : transactions.length > 0 ? (
                  transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-black p-2 font-black text-slate-600">{t.folio}</td>
                      <td className="border border-black p-2 font-mono">{t.cedula}</td>
                      <td className="border border-black p-2 font-black uppercase truncate max-w-[200px]">{t.client}</td>
                      <td className="border border-black p-2 italic truncate max-w-[200px]">{t.service}</td>
                      <td className="border border-black p-2 uppercase font-bold text-[7pt]">{t.seller}</td>
                      {COLUMNS.map(c => (
                        <td key={c.id} className={cn(
                          "border border-black p-2 text-right font-bold",
                          t.method === c.id ? "bg-slate-50/50" : "text-slate-300"
                        )}>
                          {t.method === c.id ? t.amount.toFixed(2) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={11} className="p-16 text-center italic text-slate-400 font-bold uppercase tracking-widest">No se reportan movimientos para esta fecha.</td></tr>
                )}
                {/* Totales por Método */}
                <tr className="bg-slate-900 text-white font-black text-[9pt]">
                  <td colSpan={5} className="border border-black p-3 text-right tracking-[0.2em]">TOTALES POR MÉTODO:</td>
                  {COLUMNS.map(c => (
                    <td key={c.id} className="border border-black p-3 text-right bg-black">{totalsByMethod[c.id].toFixed(2)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            {/* BLOQUE IZQUIERDO: ARQUEO FÍSICO */}
            <div className="border-2 border-black p-5 rounded-sm bg-white">
              <h3 className="font-black text-[11pt] uppercase border-b-2 border-black mb-5 pb-1 flex items-center justify-between">
                DESGLOSE DE EFECTIVO FÍSICO
                <span className="text-[8pt] font-bold text-slate-400 italic">Arqueo Manual</span>
              </h3>
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-2">
                  <p className="text-[8pt] font-black italic mb-2 uppercase text-slate-500 border-b">Billetes</p>
                  {BILLS.map(b => (
                    <div key={b.val} className="flex items-center justify-between gap-3 group">
                      <span className="text-[9pt] font-black w-20">{b.label}</span>
                      <input 
                        type="number" 
                        className="w-16 h-8 border-2 border-slate-200 rounded-md text-center text-[10pt] font-black focus:border-black transition-colors print:border-black"
                        value={billCounts[b.val] || ''}
                        onChange={(e) => setBillCounts({ ...billCounts, [b.val]: parseInt(e.target.value) || 0 })}
                      />
                      <span className="text-[9pt] font-black w-16 text-right text-slate-600">{( (billCounts[b.val] || 0) * b.val ).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[8pt] font-black italic mb-2 uppercase text-slate-500 border-b">Monedas</p>
                  {COINS.map(c => (
                    <div key={c.val} className="flex items-center justify-between gap-3 group">
                      <span className="text-[9pt] font-black w-20">{c.label}</span>
                      <input 
                        type="number" 
                        className="w-16 h-8 border-2 border-slate-200 rounded-md text-center text-[10pt] font-black focus:border-black transition-colors print:border-black"
                        value={coinCounts[c.val] || ''}
                        onChange={(e) => setCoinCounts({ ...coinCounts, [c.val]: parseInt(e.target.value) || 0 })}
                      />
                      <span className="text-[9pt] font-black w-16 text-right text-slate-600">{( (coinCounts[c.val] || 0) * c.val ).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-4 border-t-4 border-black flex justify-between items-center bg-slate-50 p-4">
                <span className="font-black text-[12pt] uppercase tracking-tighter">TOTAL EFECTIVO EN CAJA (FÍSICO):</span>
                <span className="font-black text-[18pt] px-4 border-2 border-black bg-white shadow-sm">B/. {totalFisico.toFixed(2)}</span>
              </div>
            </div>

            {/* BLOQUE DERECHO: GASTOS Y CUADRE FINAL */}
            <div className="flex flex-col gap-6">
              {/* Gastos del Día */}
              <div className="border-2 border-black p-5 rounded-sm flex-1 bg-white">
                <div className="flex justify-between items-center border-b-2 border-black mb-4 pb-1">
                  <h3 className="font-black text-[11pt] uppercase">REGISTRO DE GASTOS (EGRESOS)</h3>
                  <Button variant="outline" size="sm" className="h-8 px-3 font-bold uppercase text-[9px] print:hidden" onClick={addExpense}>
                    <Plus className="h-3 w-3 mr-1" /> Añadir Gasto
                  </Button>
                </div>
                <div className="space-y-3 max-h-[250px] overflow-y-auto mb-4">
                  {expenses.map(e => (
                    <div key={e.id} className="flex gap-3 items-center group">
                      <input 
                        className="flex-1 h-9 border-b-2 border-slate-100 text-[10pt] font-bold uppercase placeholder:text-slate-300 italic px-2 focus:border-black transition-all print:border-black print:border-dotted"
                        placeholder="Descripción del egreso o gasto..."
                        value={e.desc}
                        onChange={(v) => updateExpense(e.id, 'desc', v.target.value)}
                      />
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8pt] font-bold text-slate-400">B/.</span>
                        <input 
                          type="number"
                          className="w-24 h-9 border-2 border-slate-200 rounded-md text-right pr-2 pl-6 text-[10pt] font-black focus:border-black print:border-black"
                          value={e.amount || ''}
                          onChange={(v) => updateExpense(e.id, 'amount', parseFloat(v.target.value) || 0)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" onClick={() => removeExpense(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {expenses.length === 0 && <div className="h-24 border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center text-slate-300 font-bold uppercase text-[9px]">Sin gastos reportados</div>}
                </div>
                <div className="mt-auto pt-3 border-t-2 border-black flex justify-between font-black text-[11pt] bg-slate-50 p-2">
                  <span className="tracking-tight">TOTAL EGRESOS DEL DÍA:</span>
                  <span className="text-red-600">B/. {totalGastos.toFixed(2)}</span>
                </div>
              </div>

              {/* CUADRE FINAL CONSOLIDAD (Visual Imagen) */}
              <div className="bg-slate-900 text-white p-6 rounded-sm border-4 border-black shadow-xl">
                <div className="space-y-4 text-[10pt]">
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="font-bold uppercase opacity-60 tracking-widest">Total Facturado General:</span>
                    <span className="font-black text-[14pt] tabular-nums">B/. {totalFacturado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="font-bold uppercase opacity-60 tracking-widest">Efectivo Reportado (Sistema):</span>
                    <span className="font-black tabular-nums">B/. {totalEfectivoSistema.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-red-400 uppercase tracking-widest">(-) Menos Gastos del Día:</span>
                    <span className="font-black text-red-400 tabular-nums">-{totalGastos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="font-black text-blue-400 uppercase tracking-[0.1em] text-[11pt]">Efectivo Neto Esperado:</span>
                    <span className="font-black text-[16pt] text-blue-400 tabular-nums underline decoration-2 underline-offset-4">B/. {efectivoEsperado.toFixed(2)}</span>
                  </div>
                  
                  <div className={cn(
                    "flex justify-between mt-6 p-4 rounded-md border-2",
                    diferencia >= 0 ? "bg-green-600/20 border-green-500 text-green-400" : "bg-red-600/20 border-red-500 text-red-400"
                  )}>
                    <span className="font-black uppercase tracking-[0.2em] text-[12pt]">Diferencia Final:</span>
                    <span className="font-black text-[22pt] tabular-nums">
                      {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[7pt] font-bold text-center uppercase opacity-40 mt-2 italic">
                    {diferencia === 0 ? 'Caja cuadrada correctamente' : diferencia > 0 ? 'Sobrante detectado en arqueo' : 'Faltante detectado en arqueo'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Firmas de Responsabilidad */}
          <div className="mt-auto pt-24 grid grid-cols-2 gap-32 px-20">
            <div className="text-center">
              <div className="border-t-2 border-black mb-2"></div>
              <p className="text-[9pt] font-black uppercase tracking-widest">Firma del Cajero</p>
              <p className="text-[7pt] font-bold text-slate-400 mt-1 uppercase">{role || 'Responsable'}</p>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-black mb-2"></div>
              <p className="text-[9pt] font-black uppercase tracking-widest">Firma de Administración</p>
              <p className="text-[7pt] font-bold text-slate-400 mt-1 uppercase">Validación de Cierre</p>
            </div>
          </div>

          {/* Pie de página auditoría */}
          <div className="text-center text-[7pt] text-slate-400 font-bold uppercase mt-12 tracking-[0.4em] border-t pt-4">
            FREEWAY SISTEMA CONTRACTTIME • AUDITORÍA INTERNA • {format(new Date(), 'PPpp', { locale: es })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter landscape; margin: 0; }
          body { background: white !important; }
          header, footer, nav, .print-hidden { display: none !important; }
          #report-to-print { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important; 
            padding: 0.4in !important;
            width: 100% !important;
            max-width: none !important;
          }
          input { border: none !important; background: transparent !important; outline: none !important; padding: 0 !important; }
          .bg-slate-900 { background-color: #000 !important; color: white !important; -webkit-print-color-adjust: exact; }
          .text-white { color: white !important; }
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
