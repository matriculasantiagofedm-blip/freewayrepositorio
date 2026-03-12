
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Printer, CalendarIcon, Loader2, Download, RefreshCw, Save, Search } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import { cn, toDate } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDb, useUser } from '@/firebase';
import { collection, query, getDocs, Timestamp, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Contract, Payment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const initialBillQuantities: { [key: string]: number } = {
  '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
};
const initialCoinQuantities: { [key: string]: number } = {
  '1.00': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0,
};
const initialExpenses = [{ description: '', amount: 0 }];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function DailyCashReportContent() {
  const { role } = useCurrentRole();
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [isReportSaved, setIsReportSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReportDate(new Date());
  }, []);

  const fetchDailyData = async () => {
    if (!db || !user || !reportDate) return;
    
    setIsLoading(true);
    const fetchedTransactionsMap = new Map<string, any>();

    try {
      const dateKey = format(reportDate, 'yyyy-MM-dd');
      const savedReportRef = doc(db, 'daily_cash_reports', dateKey);
      const savedSnap = await getDocs(query(collection(db, 'daily_cash_reports'), where('reportDate', '==', dateKey)));

      if (!savedSnap.empty) {
          const savedData = savedSnap.docs[0].data();
          setBillQuantities(savedData.billQuantities || initialBillQuantities);
          setCoinQuantities(savedData.coinQuantities || initialCoinQuantities);
          setExpenses(savedData.expenses || initialExpenses);
          setIsReportSaved(true);
      } else {
          setBillQuantities(initialBillQuantities);
          setCoinQuantities(initialCoinQuantities);
          setExpenses(initialExpenses);
          setIsReportSaved(false);
      }

      const contractsSnap = await getDocs(collection(db, 'contracts'));
      
      contractsSnap.docs.forEach(docSnap => {
          const contract = { id: docSnap.id, ...docSnap.data() } as Contract;
          if (contract.status === 'expired') return;

          const createdDate = toDate(contract.createdAt);
          const activatedDate = contract.activatedAt ? toDate(contract.activatedAt) : null;
          const isMatch = isSameDay(createdDate, reportDate) || (activatedDate && isSameDay(activatedDate, reportDate));

          if (!isMatch) return;

          const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
          if (!details) return;

          const pType = (details as any).paymentType || 'cash';
          const amount = Number(details.downPayment) || 0;
          const isWeb = contract.createdBy === 'Web Pública';

          if (amount > 0) {
              const transaction: any = {
                  id: contract.id,
                  contrato: String(contract.folioNumber || '').padStart(6, '0'),
                  cedula: details.studentIdNumber || contract.studentIdNumber || '',
                  clientName: contract.clientName || '',
                  service: contract.type,
                  vendedor: contract.createdBy || 'Sistema',
                  isWeb: isWeb,
                  cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0
              };

              if (pType === 'cash') transaction.cash = amount;
              else if (pType === 'debit') transaction.debit = amount;
              else if (pType === 'credit') transaction.credit = amount;
              else if (pType === 'bac') transaction.bac = amount;
              else if (pType === 'yappy' || pType === 'general') transaction.general = amount;
              else if (pType === 'cheques') transaction.cheques = amount;
              else transaction.cash = amount;

              fetchedTransactionsMap.set(contract.id, transaction);
          }
      });

      const start = startOfDay(reportDate);
      const end = endOfDay(reportDate);
      
      const qCancellations = query(
        collection(db, 'cancellation_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );
      const cancellationsSnap = await getDocs(qCancellations);
      cancellationsSnap.docs.forEach(docSnap => {
          const payment = docSnap.data() as Payment;
          const pType = payment.paymentType || 'cash';
          const transaction: any = {
              id: docSnap.id,
              contrato: String(payment.cancellationFolio || '').padStart(6, '0'),
              cedula: payment.studentIdNumber || '',
              clientName: payment.clientName || '',
              service: 'Abono Saldo',
              vendedor: payment.createdBy || 'Sistema',
              isWeb: false,
              cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0
          };
          if (pType === 'cash') transaction.cash = payment.amount;
          else if (pType === 'debit') transaction.debit = payment.amount;
          else if (pType === 'credit') transaction.credit = payment.amount;
          else if (pType === 'bac') transaction.bac = payment.amount;
          else if (pType === 'yappy' || pType === 'general') transaction.general = payment.amount;
          else if (pType === 'cheques') transaction.cheques = payment.amount;
          fetchedTransactionsMap.set(docSnap.id, transaction);
      });

      setTransactions(Array.from(fetchedTransactionsMap.values()));
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar datos.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && reportDate && user) {
      fetchDailyData();
    }
  }, [reportDate, user, mounted]);

  const filteredTransactions = useMemo(() => {
    if (role !== 'Administrador') return transactions.filter(t => t.vendedor === role);
    if (sellerFilter === 'all') return transactions;
    return transactions.filter(t => t.vendedor === sellerFilter);
  }, [transactions, sellerFilter, role]);

  const transactionTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, curr) => ({
        cash: acc.cash + Number(curr.cash),
        debit: acc.debit + Number(curr.debit),
        credit: acc.credit + Number(curr.credit),
        bac: acc.bac + Number(curr.bac),
        general: acc.general + Number(curr.general),
        cheques: acc.cheques + Number(curr.cheques),
      }),
      { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 }
    );
  }, [filteredTransactions]);

  const cashBreakdownTotals = useMemo(() => {
    const billTotal = Object.entries(billQuantities).reduce((acc, [bill, qty]) => acc + parseFloat(bill) * qty, 0);
    const coinTotal = Object.entries(coinQuantities).reduce((acc, [coin, qty]) => acc + parseFloat(coin) * qty, 0);
    return { billTotal, coinTotal, total: billTotal + coinTotal };
  }, [billQuantities, coinQuantities]);
  
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0), [expenses]);
  
  const grandTotals = useMemo(() => {
    const totalFacturado = Object.values(transactionTotals).reduce((sum, val) => sum + val, 0);
    const efectivoEnSistema = transactionTotals.cash;
    const efectivoEsperado = efectivoEnSistema - totalExpenses;
    const diferencia = cashBreakdownTotals.total - efectivoEsperado;
    return { totalFacturado, efectivoEnSistema, efectivoEsperado, diferencia };
  }, [transactionTotals, totalExpenses, cashBreakdownTotals.total]);

  const handleSaveReport = async () => {
    if (!db || !reportDate || !user) return;
    setIsSaving(true);
    try {
        const dateKey = format(reportDate, 'yyyy-MM-dd');
        const reportRef = doc(db, 'daily_cash_reports', dateKey);
        await setDoc(reportRef, {
            reportDate: dateKey,
            billQuantities,
            coinQuantities,
            expenses,
            totals: grandTotals,
            savedAt: serverTimestamp(),
            savedBy: role || 'Sistema',
            userId: user.uid
        }, { merge: true });
        setIsReportSaved(true);
        toast({ title: "Caja Guardada", description: "El reporte se ha almacenado en el historial." });
    } catch (err) {
        toast({ variant: "destructive", title: "Error al Guardar" });
    } finally {
        setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 print:bg-white min-h-screen pb-12">
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-black font-headline text-slate-900 uppercase">Caja Diaria</h1>
            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-[220px] text-xs">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Elegir fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={reportDate} onSelect={(date) => setReportDate(date || new Date())} initialFocus />
                    </PopoverContent>
                </Popover>
                <Button onClick={handleSaveReport} disabled={isSaving || isReportSaved} className="bg-green-600 h-9 font-black text-[10px] uppercase">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {isReportSaved ? 'Caja Cerrada' : 'Cerrar Caja'}
                </Button>
            </div>
        </div>
      </div>

      <div id="report-to-export" className="bg-white mx-auto p-8 border shadow-sm max-w-[8.5in]">
        <div className="text-center mb-6 border-b-2 border-black pb-2">
          <h2 className="text-xl font-black uppercase text-black">FREEWAY ESCUELA DE MANEJO</h2>
          <p className="text-[10px] font-bold text-black">REPORTE DE CAJA - {reportDate ? format(reportDate, "PPP", { locale: es }).toUpperCase() : ''}</p>
        </div>

        <div className="space-y-6">
          <div className="border border-black">
              <Table>
              <TableHeader>
                  <TableRow className="bg-slate-100 font-bold border-b border-black">
                  <TableHead className="text-black p-1 text-[7pt] text-center">Contrato</TableHead>
                  <TableHead className="text-black p-1 text-[7pt]">Cliente</TableHead>
                  <TableHead className="text-black p-1 text-[7pt] text-center">Web</TableHead>
                  <TableHead className="text-black p-1 text-[7pt] text-right">Efectivo</TableHead>
                  <TableHead className="text-black p-1 text-[7pt] text-right">BAC</TableHead>
                  <TableHead className="text-black p-1 text-[7pt] text-right">Gral/Yappy</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {filteredTransactions.map((t) => (
                  <TableRow key={t.id} className="h-6 border-b border-black hover:bg-transparent">
                      <TableCell className="p-1 text-[7pt] text-center text-black font-bold">{t.contrato}</TableCell>
                      <TableCell className="p-1 text-[7pt] uppercase text-black">{t.clientName}</TableCell>
                      <TableCell className="p-1 text-[7pt] text-center">{t.isWeb ? 'SÍ' : '-'}</TableCell>
                      <TableCell className="p-1 text-[7pt] text-right text-black">{t.cash > 0 ? t.cash.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7pt] text-right text-black">{t.bac > 0 ? t.bac.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7pt] text-right text-black">{t.general > 0 ? t.general.toFixed(2) : '-'}</TableCell>
                  </TableRow>
                  ))}
              </TableBody>
              </Table>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="border border-black p-3 space-y-2">
              <h3 className="text-[9px] font-black uppercase bg-slate-100 p-1 border-b border-black text-center">DESGLOSE EFECTIVO</h3>
              {Object.keys(billQuantities).map(val => (
                <div key={val} className="flex justify-between items-center text-[8pt]">
                  <span className="font-bold">B/. {val}:</span>
                  <div className="flex gap-4">
                      <Input type="number" className="h-5 w-12 text-[8pt] p-1 border-black print:hidden" value={billQuantities[val] || ''} onChange={(e) => setBillQuantities(prev => ({ ...prev, [val]: parseInt(e.target.value) || 0 }))} />
                      <span className="w-12 text-right">{(parseFloat(val) * (billQuantities[val] || 0)).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between font-black border-t border-black pt-1">
                <span>TOTAL FÍSICO:</span>
                <span>B/. {cashBreakdownTotals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-2 border-black p-4 bg-slate-50 space-y-2">
                <div className="flex justify-between font-black text-black">
                  <span>TOTAL FACTURADO:</span>
                  <span>{currencyFormatter.format(grandTotals.totalFacturado)}</span>
                </div>
                <div className="flex justify-between text-[9pt] font-bold text-red-600">
                  <span>(-) GASTOS:</span>
                  <span>- {totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10pt] font-black border-t border-black pt-1">
                  <span>EFECTIVO ESPERADO:</span>
                  <span>B/. {grandTotals.efectivoEsperado.toFixed(2)}</span>
                </div>
                <div className={cn("flex justify-between text-[11pt] font-black p-1", grandTotals.diferencia === 0 ? "text-green-700" : "text-red-700")}>
                  <span>DIFERENCIA:</span>
                  <span>B/. {grandTotals.diferencia.toFixed(2)}</span>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>}>
      <DailyCashReportContent />
    </Suspense>
  );
}
