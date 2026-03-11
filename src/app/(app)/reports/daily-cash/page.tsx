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
import { Printer, CalendarIcon, Loader2, Download, RefreshCw } from 'lucide-react';
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
import { collection, query, getDocs, Timestamp, where } from 'firebase/firestore';
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
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReportDate(new Date());
  }, []);

  const fetchDailyData = async () => {
    if (!db || !user || !reportDate) return;
    
    setIsLoading(true);
    setIsReady(false);
    
    const fetchedTransactionsMap = new Map<string, any>();

    try {
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      
      contractsSnap.docs.forEach(docSnap => {
          const contract = { id: docSnap.id, ...docSnap.data() } as Contract;
          
          if (contract.status === 'expired') return;

          const createdDate = toDate(contract.createdAt);
          const activatedDate = contract.activatedAt ? toDate(contract.activatedAt) : null;
          
          const isMatch = isSameDay(createdDate, reportDate) || (activatedDate && isSameDay(activatedDate, reportDate));

          if (!isMatch || fetchedTransactionsMap.has(contract.id)) return;

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
                  service: contract.type === 'Curso Deluxe' ? 'Matrícula Deluxe' : `Abono ${contract.type}`,
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

      const qUpdates = query(
        collection(db, 'update_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );
      const updatesSnap = await getDocs(qUpdates);
      updatesSnap.docs.forEach(docSnap => {
          const payment = docSnap.data() as Payment;
          const pType = payment.paymentType || 'cash';
          const transaction: any = {
              id: docSnap.id,
              contrato: String(payment.updateFolio || '').padStart(6, '0'),
              cedula: payment.studentIdNumber || '',
              clientName: payment.clientName || '',
              service: 'Actualización Certificado',
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
      setIsReady(true);
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al cargar reporte.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && reportDate && !isUserLoading && !isRoleLoading && user) {
      fetchDailyData();
    }
  }, [reportDate, user, isUserLoading, isRoleLoading, mounted]);

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

  const handleCashChange = (type: 'bill' | 'coin', value: string, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    if (type === 'bill') setBillQuantities(prev => ({ ...prev, [value]: qty }));
    else setCoinQuantities(prev => ({ ...prev, [value]: qty }));
  };

  const handleExpenseChange = (index: number, field: 'description' | 'amount', value: any) => {
    const updated = [...expenses];
    if (field === 'amount') updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    else updated[index] = { ...updated[index], [field]: value };
    setExpenses(updated);
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-export');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0,
        filename: `Caja_Freeway_${reportDate ? format(reportDate, 'dd-MM-yyyy') : ''}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', width: 816 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error PDF" });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 print:bg-white min-h-screen pb-12">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
            @page { size: letter portrait; margin: 0; }
            header, footer, nav, aside, .print-hide { display: none !important; }
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            .print-container { width: 8.5in !important; height: 11in !important; margin: 0 auto !important; padding: 0.5in !important; }
            table { border-collapse: collapse !important; width: 100% !important; border: 1px solid black !important; }
            th, td { border: 1px solid black !important; color: black !important; padding: 2px 4px !important; }
            input, select, button { display: none !important; }
            .print-show-val { display: block !important; }
        }
        .print-show-val { display: none; }
      `}} />
      
      <div className="flex flex-col gap-4 print-hide">
        <div className="flex justify-between items-center">
            <div className='flex flex-col'>
                <h1 className="text-2xl font-bold font-headline text-slate-900">Reporte de Caja Diario</h1>
                <p className="text-xs text-muted-foreground">Sistema de Control Freeway</p>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={fetchDailyData} variant="ghost" size="icon" className="h-9 w-9"><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
                {role === 'Administrador' && (
                  <Select value={sellerFilter} onValueChange={setSellerFilter}>
                      <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Vendedor..." /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos los Vendedores</SelectItem>
                          <SelectItem value="Ventas">Ventas</SelectItem>
                          <SelectItem value="Ventas Externas">Ventas Externas</SelectItem>
                          <SelectItem value="Web Pública">Inscripción Web</SelectItem>
                      </SelectContent>
                  </Select>
                )}
                <Popover>
                    <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-[220px] h-9 justify-start text-left font-normal text-xs", !reportDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Elegir fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={reportDate} onSelect={(date) => setReportDate(date || new Date())} initialFocus />
                    </PopoverContent>
                </Popover>
                <Button onClick={handleDownloadPdf} disabled={isDownloading || !isReady} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 px-4">
                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="mr-2 h-4 w-4 mr-2" />}
                    Descargar PDF
                </Button>
            </div>
        </div>
      </div>

      <div id="report-to-export" className="print-container bg-white mx-auto p-8 border shadow-sm" style={{ width: '8.5in', height: '11in', maxWidth: '8.5in', boxSizing: 'border-box' }}>
        <div className="text-center mb-6 border-b-4 border-black pb-2">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-black">FREEWAY ESCUELA DE MANEJO</h2>
          <p className="text-[11px] font-black uppercase tracking-widest text-black">REPORTE DE CAJA DIARIO - {reportDate ? format(reportDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase() : ''}</p>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden border border-black rounded-sm">
              <Table className="border-collapse">
              <TableHeader>
                  <TableRow className="bg-slate-100 font-bold h-8 border-b-2 border-black">
                  <TableHead className="text-black p-1 text-[8pt] text-center font-black">Contrato</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-center font-black">Cédula</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] font-black">Cliente</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] font-black">Servicio</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-center font-black">Vendedor</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-center font-black">Web</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-right font-black">Efectivo</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-right font-black">T.Débito</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-right font-black">T.Crédito</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-right font-black">BAC</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-right font-black">Gral/Yappy</TableHead>
                  <TableHead className="text-black p-1 text-[8pt] text-right font-black">Cheque</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                  <TableRow key={t.id} className="h-7 border-black hover:bg-transparent">
                      <TableCell className="p-1 text-[7.5pt] font-bold text-center text-black">{t.contrato}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-center text-black">{t.cedula}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] uppercase font-bold max-w-[100px] truncate text-black">{t.clientName}</TableCell>
                      <TableCell className="p-1 text-[7pt] italic max-w-[100px] truncate text-black">{t.service}</TableCell>
                      <TableCell className="p-1 text-[7pt] text-center uppercase font-bold text-black">{t.vendedor}</TableCell>
                      <TableCell className="p-1 text-[7pt] text-center">
                          {t.isWeb ? <span className="bg-blue-100 text-blue-800 px-1 rounded font-black">SÍ</span> : '-'}
                      </TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-right font-medium text-black">{t.cash > 0 ? t.cash.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-right text-black">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-right text-black">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-right text-black">{t.bac > 0 ? t.bac.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-right text-black">{t.general > 0 ? t.general.toFixed(2) : '-'}</TableCell>
                      <TableCell className="p-1 text-[7.5pt] text-right text-black">{t.cheques > 0 ? t.cheques.toFixed(2) : '-'}</TableCell>
                  </TableRow>
                  )) : (
                  <TableRow className="h-20"><TableCell colSpan={12} className="text-center italic text-slate-400">Sin transacciones registradas.</TableCell></TableRow>
                  )}
                  <TableRow className="bg-slate-50 font-black border-t-2 border-black h-8">
                  <TableCell colSpan={6} className="p-1 text-[8pt] text-right uppercase text-black">TOTALES POR MÉTODO</TableCell>
                  <TableCell className="p-1 text-[8pt] text-right text-black">{transactionTotals.cash.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[8pt] text-right text-black">{transactionTotals.debit.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[8pt] text-right text-black">{transactionTotals.credit.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[8pt] text-right text-black">{transactionTotals.bac.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[8pt] text-right text-black">{transactionTotals.general.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[8pt] text-right text-black">{transactionTotals.cheques.toFixed(2)}</TableCell>
                  </TableRow>
              </TableBody>
              </Table>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="border border-black p-3 rounded-sm space-y-3 bg-white">
              <h3 className="text-[10px] font-black uppercase bg-slate-100 p-1.5 border-b border-black text-center text-black">DESGLOSE DE EFECTIVO</h3>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="space-y-1.5">
                  {Object.keys(billQuantities).map(val => (
                    <div key={val} className="flex justify-between items-center text-[8pt]">
                      <span className="font-bold text-black">B/. {val}:</span>
                      <div className="flex items-center gap-1">
                          <Input type="number" className="h-5 w-10 text-[8pt] p-1 border-black print-hide" value={billQuantities[val] || ''} onChange={(e) => handleCashChange('bill', val, e.target.value)} />
                          <span className="print-show-val text-black">{billQuantities[val]}</span>
                          <span className="w-12 text-right text-black">{(parseFloat(val) * (billQuantities[val] || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 border-l border-black pl-6">
                  {Object.keys(coinQuantities).map(val => (
                    <div key={val} className="flex justify-between items-center text-[8pt]">
                      <span className="font-bold text-black">B/. {val}:</span>
                      <div className="flex items-center gap-1">
                          <Input type="number" className="h-5 w-10 text-[8pt] p-1 border-black print-hide" value={coinQuantities[val] || ''} onChange={(e) => handleCashChange('coin', val, e.target.value)} />
                          <span className="print-show-val text-black">{coinQuantities[val]}</span>
                          <span className="w-12 text-right text-black">{(parseFloat(val) * (coinQuantities[val] || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center font-black text-[10pt] pt-2 border-t-2 border-black text-black">
                <span>TOTAL FÍSICO:</span>
                <span>B/. {cashBreakdownTotals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-black p-3 rounded-sm bg-white">
                <h3 className="text-[10px] font-black uppercase bg-slate-100 p-1.5 border-b border-black flex justify-between text-black">
                  <span>GASTOS DEL DÍA</span>
                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0 print-hide" onClick={() => setExpenses([...expenses, { description: '', amount: 0 }])}>+</Button>
                </h3>
                <div className="space-y-1.5 pt-2">
                  {expenses.map((exp, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input placeholder="Descripción..." className="h-5 text-[8pt] p-1 border-black flex-1 print-hide" value={exp.description} onChange={(e) => handleExpenseChange(idx, 'description', e.target.value)} />
                      <span className="print-show-val flex-1 uppercase text-[8pt] text-black">{exp.description}</span>
                      <Input type="number" placeholder="0.00" className="h-5 w-16 text-[8pt] p-1 border-black print-hide" value={exp.amount || ''} onChange={(e) => handleExpenseChange(idx, 'amount', e.target.value)} />
                      <span className="print-show-val w-16 text-right text-[8pt] text-black">{Number(exp.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center font-black text-[9pt] pt-2 border-t border-black mt-2 text-black">
                  <span>TOTAL GASTOS:</span>
                  <span>B/. {totalExpenses.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-4 border-black p-4 bg-slate-50 space-y-2 rounded-sm">
                <div className="flex justify-between text-[10pt] font-black border-b border-slate-300 pb-1 text-black">
                  <span>Total Facturado:</span>
                  <span className="text-xl">{currencyFormatter.format(grandTotals.totalFacturado)}</span>
                </div>
                <div className="flex justify-between text-[9pt] font-bold text-black">
                  <span>Efectivo en Sistema:</span>
                  <span>{grandTotals.efectivoEnSistema.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9pt] font-bold text-red-600">
                  <span>(-) Gastos:</span>
                  <span>- {totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11pt] font-black border-t-2 border-black pt-2 bg-slate-200 px-1 text-black">
                  <span>Efectivo Esperado:</span>
                  <span>B/. {grandTotals.efectivoEsperado.toFixed(2)}</span>
                </div>
                <div className={cn("flex justify-between text-[12pt] font-black p-2 rounded-sm mt-2 border-2", Math.abs(grandTotals.diferencia) < 0.01 ? "bg-green-100 text-green-800 border-green-600" : "bg-red-100 text-red-800 border-red-600")}>
                  <span>DIFERENCIA:</span>
                  <span>B/. {grandTotals.diferencia.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20 pt-12 pb-6">
              <div className="text-center">
                  <div className="border-t-2 border-black w-full mx-auto"></div>
                  <p className="text-[10pt] font-black uppercase mt-1 text-black">FIRMA DEL CAJERO</p>
              </div>
              <div className="text-center">
                  <div className="border-t-2 border-black w-full mx-auto"></div>
                  <p className="text-[10pt] font-black uppercase mt-1 text-black">FIRMA DEL ADMINISTRADOR</p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
      <DailyCashReportContent />
    </Suspense>
  );
}