'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDb, useUser } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarIcon, Printer, Save, Plus, Trash2, Banknote, Landmark } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import type { Contract, Payment, BookSalePayment, DailyCashReport } from '@/lib/types';

interface CashTransaction {
  id: string;
  folio: string;
  cedula: string;
  clientName: string;
  service: string;
  createdBy: string;
  cash: number;
  debit: number;
  credit: number;
  bac: number;
  general: number;
  cheque: number;
  total: number;
}

const denominations = [
  { value: 100, label: 'B/. 100.00' },
  { value: 50, label: 'B/. 50.00' },
  { value: 20, label: 'B/. 20.00' },
  { value: 10, label: 'B/. 10.00' },
  { value: 5, label: 'B/. 5.00' },
  { value: 1, label: 'B/. 1.00' },
];

const coins = [
  { value: 1, label: 'B/. 1.00' },
  { value: 0.50, label: 'B/. 0.50' },
  { value: 0.25, label: 'B/. 0.25' },
  { value: 0.10, label: 'B/. 0.10' },
  { value: 0.05, label: 'B/. 0.05' },
  { value: 0.01, label: 'B/. 0.01' },
];

export default function DailyCashReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Arqueo físico
  const [billQuantities, setBillQuantities] = useState<Record<number, number>>({});
  const [coinQuantities, setCoinQuantities] = useState<Record<number, number>>({});
  const [expenses, setExpenses] = useState<{ description: string; amount: number }[]>([]);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '' });

  const fetchData = async () => {
    if (!db || !user) return;
    setIsLoading(true);
    try {
      const start = startOfDay(reportDate);
      const end = endOfDay(reportDate);

      // Cargar reporte guardado si existe
      const reportId = format(reportDate, 'yyyy-MM-dd');
      const savedReportRef = doc(db, 'daily_cash_reports', reportId);
      const savedSnap = await getDoc(savedReportRef);
      
      if (savedSnap.exists()) {
        const data = savedSnap.data() as DailyCashReport;
        setBillQuantities(data.billQuantities || {});
        setCoinQuantities(data.coinQuantities || {});
        setExpenses(data.expenses || []);
      } else {
        setBillQuantities({});
        setCoinQuantities({});
        setExpenses([]);
      }

      // Consultar transacciones
      const contractsQ = query(collection(db, 'contracts'), where('activatedAt', '>=', Timestamp.fromDate(start)), where('activatedAt', '<=', Timestamp.fromDate(end)));
      const cancellationsQ = query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));
      const updatesQ = query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));
      const booksQ = query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));

      const [cSnap, canSnap, uSnap, bSnap] = await Promise.all([getDocs(contractsQ), getDocs(cancellationsQ), getDocs(updatesQ), getDocs(booksQ)]);

      const list: CashTransaction[] = [];

      cSnap.forEach(d => {
        const data = d.data() as Contract;
        if (data.status === 'expired') return;
        const details = data.autoMotoDetails || data.deluxeDetails || data.ampliacionesDetails;
        const pt = (details as any)?.paymentType || 'cash';
        const amount = details?.downPayment || 0;
        if (amount > 0) {
          list.push({
            id: d.id,
            folio: String(data.folioNumber || '').padStart(6, '0'),
            cedula: details?.studentIdNumber || '',
            clientName: data.clientName,
            service: data.type,
            createdBy: data.createdBy || 'Sistema',
            cash: pt === 'cash' ? amount : 0,
            debit: pt === 'debit' ? amount : 0,
            credit: pt === 'credit' ? amount : 0,
            bac: pt === 'bac' ? amount : 0,
            general: (pt === 'general' || pt === 'yappy') ? amount : 0,
            cheque: pt === 'cheques' ? amount : 0,
            total: amount
          });
        }
      });

      canSnap.forEach(d => {
        const data = d.data() as Payment;
        const pt = data.paymentType || 'cash';
        list.push({
          id: d.id,
          folio: `P-${String(data.cancellationFolio || '').padStart(6, '0')}`,
          cedula: data.studentIdNumber || '',
          clientName: data.clientName,
          service: 'Abono/Canc.',
          createdBy: data.createdBy || 'Sistema',
          cash: pt === 'cash' ? data.amount : 0,
          debit: pt === 'debit' ? data.amount : 0,
          credit: pt === 'credit' ? data.amount : 0,
          bac: pt === 'bac' ? data.amount : 0,
          general: (pt === 'general' || pt === 'yappy') ? data.amount : 0,
          cheque: pt === 'cheques' ? data.amount : 0,
          total: data.amount
        });
      });

      uSnap.forEach(d => {
        const data = d.data() as Payment;
        const pt = data.paymentType || 'cash';
        list.push({
          id: d.id,
          folio: `U-${String(data.updateFolio || '').padStart(6, '0')}`,
          cedula: data.studentIdNumber || '',
          clientName: data.clientName,
          service: 'Actualización',
          createdBy: data.createdBy || 'Sistema',
          cash: pt === 'cash' ? data.amount : 0,
          debit: pt === 'debit' ? data.amount : 0,
          credit: pt === 'credit' ? data.amount : 0,
          bac: pt === 'bac' ? data.amount : 0,
          general: (pt === 'general' || pt === 'yappy') ? data.amount : 0,
          cheque: pt === 'cheques' ? data.amount : 0,
          total: data.amount
        });
      });

      bSnap.forEach(d => {
        const data = d.data() as BookSalePayment;
        const pt = data.paymentType || 'cash';
        list.push({
          id: d.id,
          folio: `L-${String(data.bookSaleFolio || '').padStart(6, '0')}`,
          cedula: data.studentIdNumber || '',
          clientName: data.clientName,
          service: `Libro: ${data.bookTitle}`,
          createdBy: data.createdBy || 'Sistema',
          cash: pt === 'cash' ? data.amount : 0,
          debit: pt === 'debit' ? data.amount : 0,
          credit: pt === 'credit' ? data.amount : 0,
          bac: pt === 'bac' ? data.amount : 0,
          general: (pt === 'general' || pt === 'yappy') ? data.amount : 0,
          cheque: pt === 'cheques' ? data.amount : 0,
          total: data.amount
        });
      });

      setTransactions(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [reportDate, db, user]);

  const totals = useMemo(() => {
    return transactions.reduce((acc, curr) => ({
      cash: acc.cash + curr.cash,
      debit: acc.debit + curr.debit,
      credit: acc.credit + curr.credit,
      bac: acc.bac + curr.bac,
      general: acc.general + curr.general,
      cheque: acc.cheque + curr.cheque,
      total: acc.total + curr.total,
    }), { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheque: 0, total: 0 });
  }, [transactions]);

  const physicalCashTotal = useMemo(() => {
    const billsTotal = Object.entries(billQuantities).reduce((sum, [val, qty]) => sum + (Number(val) * qty), 0);
    const coinsTotal = Object.entries(coinQuantities).reduce((sum, [val, qty]) => sum + (Number(val) * qty), 0);
    return billsTotal + coinsTotal;
  }, [billQuantities, coinQuantities]);

  const expensesTotal = useMemo(() => expenses.reduce((sum, exp) => sum + exp.amount, 0), [expenses]);
  
  const balance = physicalCashTotal - (totals.cash - expensesTotal);

  const handleSaveReport = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      const reportId = format(reportDate, 'yyyy-MM-dd');
      await setDoc(doc(db, 'daily_cash_reports', reportId), {
        reportDate: reportId,
        billQuantities,
        coinQuantities,
        expenses,
        totals: { ...totals, physicalCashTotal, expensesTotal, balance },
        savedAt: serverTimestamp(),
        savedBy: user?.uid,
      });
      toast({ title: 'Caja Cerrada', description: 'El reporte diario ha sido guardado exitosamente.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el reporte.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg text-white"><Landmark className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Reporte de Caja Diario</h1>
            <p className="text-xs text-muted-foreground font-bold">{format(reportDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 font-bold"><CalendarIcon className="mr-2 h-4 w-4" /> {format(reportDate, 'dd/MM/yyyy')}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={reportDate} onSelect={(d) => d && setReportDate(d)} initialFocus /></PopoverContent>
          </Popover>
          <Button onClick={() => window.print()} variant="outline" className="h-11 font-bold"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
          <Button onClick={handleSaveReport} disabled={isSaving} className="h-11 font-bold bg-green-600 hover:bg-green-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Cerrar Caja
          </Button>
        </div>
      </div>

      <div className="bg-white border-2 border-black p-4 shadow-sm">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-slate-100 hover:bg-slate-100 h-10 border-black">
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1">Contrato</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1">Cédula</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1">Cliente</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1">Servicio</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1">Vendedor</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-center">Efectivo</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-center">T. Débito</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-center">T. Crédito</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-center">BAC</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-center">Gral/Yappy</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-center">Cheque</TableHead>
              <TableHead className="border border-black font-black text-black text-[8px] uppercase p-1 text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="text-center py-12"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : transactions.map((t) => (
              <TableRow key={t.id} className="h-8 border-black hover:bg-slate-50">
                <TableCell className="border border-black font-bold text-[8px] text-primary p-1">{t.folio}</TableCell>
                <TableCell className="border border-black text-[8px] p-1">{t.cedula}</TableCell>
                <TableCell className="border border-black text-[8px] font-bold uppercase p-1 truncate max-w-[120px]">{t.clientName}</TableCell>
                <TableCell className="border border-black text-[8px] p-1 truncate max-w-[80px]">{t.service}</TableCell>
                <TableCell className="border border-black text-[8px] p-1">{t.createdBy}</TableCell>
                <TableCell className="border border-black text-[8px] text-center p-1">{t.cash > 0 ? t.cash.toFixed(2) : ''}</TableCell>
                <TableCell className="border border-black text-[8px] text-center p-1">{t.debit > 0 ? t.debit.toFixed(2) : ''}</TableCell>
                <TableCell className="border border-black text-[8px] text-center p-1">{t.credit > 0 ? t.credit.toFixed(2) : ''}</TableCell>
                <TableCell className="border border-black text-[8px] text-center p-1">{t.bac > 0 ? t.bac.toFixed(2) : ''}</TableCell>
                <TableCell className="border border-black text-[8px] text-center p-1 font-bold text-blue-700">{t.general > 0 ? t.general.toFixed(2) : ''}</TableCell>
                <TableCell className="border border-black text-[8px] text-center p-1">{t.cheque > 0 ? t.cheque.toFixed(2) : ''}</TableCell>
                <TableCell className="border border-black text-[8px] text-right font-black p-1">B/. {t.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="h-10 bg-slate-100 font-black border-black">
              <TableCell colSpan={5} className="border border-black text-[9px] uppercase text-right">Totales por Método:</TableCell>
              <TableCell className="border border-black text-[9px] text-center">{totals.cash.toFixed(2)}</TableCell>
              <TableCell className="border border-black text-[9px] text-center">{totals.debit.toFixed(2)}</TableCell>
              <TableCell className="border border-black text-[9px] text-center">{totals.credit.toFixed(2)}</TableCell>
              <TableCell className="border border-black text-[9px] text-center">{totals.bac.toFixed(2)}</TableCell>
              <TableCell className="border border-black text-[9px] text-center text-blue-700">{totals.general.toFixed(2)}</TableCell>
              <TableCell className="border border-black text-[9px] text-center">{totals.cheque.toFixed(2)}</TableCell>
              <TableCell className="border border-black text-[10px] text-right bg-slate-900 text-white">B/. {totals.total.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 print:mt-10">
        <Card className="border-2 border-black rounded-none shadow-none">
          <CardHeader className="bg-slate-50 border-b-2 border-black py-3"><CardTitle className="text-xs font-black uppercase">Arqueo Físico de Efectivo</CardTitle></CardHeader>
          <CardContent className="p-4 grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase border-b border-black pb-1 mb-3">Billetes</p>
              {denominations.map(d => (
                <div key={d.value} className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] font-bold w-20">{d.label}</Label>
                  <Input 
                    type="number" 
                    className="h-7 w-16 text-[10px] text-center border-black" 
                    value={billQuantities[d.value] || ''} 
                    onChange={(e) => setBillQuantities(prev => ({ ...prev, [d.value]: parseInt(e.target.value) || 0 }))} 
                  />
                  <span className="text-[10px] font-mono w-16 text-right">B/. {( (billQuantities[d.value] || 0) * d.value ).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase border-b border-black pb-1 mb-3">Monedas</p>
              {coins.map(c => (
                <div key={c.value} className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] font-bold w-20">{c.label}</Label>
                  <Input 
                    type="number" 
                    className="h-7 w-16 text-[10px] text-center border-black" 
                    value={coinQuantities[c.value] || ''} 
                    onChange={(e) => setCoinQuantities(prev => ({ ...prev, [c.value]: parseInt(e.target.value) || 0 }))} 
                  />
                  <span className="text-[10px] font-mono w-16 text-right">B/. {( (coinQuantities[c.value] || 0) * c.value ).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <div className="border-t-2 border-black bg-slate-900 text-white p-3 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest">Total Efectivo en Caja:</span>
            <span className="text-xl font-black font-mono">B/. {physicalCashTotal.toFixed(2)}</span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-2 border-black rounded-none shadow-none h-fit">
            <CardHeader className="bg-slate-50 border-b-2 border-black py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase">Gastos del Día</CardTitle>
              <div className="flex gap-2 print:hidden">
                <Input placeholder="Desc." className="h-7 text-[10px] w-24" value={newExpense.description} onChange={e => setNewExpense(p => ({...p, description: e.target.value}))} />
                <Input type="number" placeholder="B/." className="h-7 text-[10px] w-16" value={newExpense.amount} onChange={e => setNewExpense(p => ({...p, amount: e.target.value}))} />
                <Button size="icon" className="h-7 w-7" onClick={() => { if(newExpense.description && newExpense.amount) { setExpenses(prev => [...prev, { description: newExpense.description, amount: parseFloat(newExpense.amount) }]); setNewExpense({description: '', amount: ''}); } }}><Plus className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {expenses.map((exp, idx) => (
                    <TableRow key={idx} className="h-8 border-black">
                      <TableCell className="text-[10px] font-bold uppercase p-2">{exp.description}</TableCell>
                      <TableCell className="text-[10px] font-mono text-right p-2 w-24">B/. {exp.amount.toFixed(2)}</TableCell>
                      <TableCell className="w-8 p-0 print:hidden">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => setExpenses(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses.length === 0 && <TableRow><TableCell className="text-[10px] text-center py-4 text-slate-400 italic">No hay gastos registrados</TableCell></TableRow>}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-slate-50 border-t-2 border-black font-black">
                    <TableCell className="text-[10px] uppercase p-2">Total Gastos:</TableCell>
                    <TableCell className="text-[10px] font-mono text-right p-2">B/. {expensesTotal.toFixed(2)}</TableCell>
                    <TableCell className="print:hidden"></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card className={cn("border-4 rounded-none shadow-xl", balance === 0 ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50")}>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Resumen de Cuadre</p>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400">Diferencia (Sobrante/Faltante):</span>
                <span className={cn("text-4xl font-black font-mono", balance >= 0 ? "text-green-700" : "text-red-700")}>
                  B/. {balance.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-px bg-slate-200 my-2"></div>
              <div className="grid grid-cols-2 w-full gap-4 text-[9px] font-bold uppercase">
                <div className="flex flex-col">
                  <span>Esperado (Neto):</span>
                  <span className="text-sm font-black">B/. {(totals.cash - expensesTotal).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span>Físico en Caja:</span>
                  <span className="text-sm font-black">B/. {physicalCashTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: letter landscape; margin: 5mm; }
          header, footer, nav, aside, .print-hidden, button { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .bg-white { border: none !important; box-shadow: none !important; }
          table { width: 100% !important; font-size: 7pt !important; border: 1px solid black !important; }
          td, th { border: 1px solid black !important; padding: 1px 2px !important; }
          .text-blue-700 { color: black !important; font-weight: bold !important; }
        }
      `}</style>
    </div>
  );
}
