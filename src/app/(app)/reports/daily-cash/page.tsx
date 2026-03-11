'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
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
import { Printer, CalendarIcon, Loader2, Download } from 'lucide-react';
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
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Contract, Payment, Transaction, BookSalePayment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const initialBillQuantities: { [key: string]: number } = {
  '100.00': 0,
  '50.00': 0,
  '20.00': 0,
  '10.00': 0,
  '5.00': 0,
  '1.00': 0,
};
const initialCoinQuantities: { [key: string]: number } = {
  '1.00': 0,
  '0.50': 0,
  '0.25': 0,
  '0.10': 0,
  '0.05': 0,
  '0.01': 0,
};
const initialExpenses = [{ description: '', amount: 0 }];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function DailyCashReportPage() {
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  useEffect(() => {
    if (role && role !== 'Administrador') {
      setSellerFilter(role);
    }
  }, [role]);

  useEffect(() => {
    if (!db || isUserLoading || isRoleLoading || !user || !role || !reportDate || !mounted) {
        return;
    }

    const fetchDailyData = async () => {
      setIsLoading(true);
      setIsReady(false);
      
      const start = startOfDay(reportDate);
      const end = endOfDay(reportDate);
      const fetchedTransactionsMap = new Map<string, any>();

      try {
        // Consultas por creación y por activación (crucial para contratos de todo tipo)
        const qContractsCreated = query(collection(db, 'contracts'), where('createdAt', '>=', Timestamp.fromDate(start)), where('createdAt', '<=', Timestamp.fromDate(end)));
        const qContractsActivated = query(collection(db, 'contracts'), where('activatedAt', '>=', Timestamp.fromDate(start)), where('activatedAt', '<=', Timestamp.fromDate(end)));
        const qCancellations = query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));
        const qUpdates = query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));
        const qBookSales = query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));

        const [snapCreated, snapActivated, snapCancellations, snapUpdates, snapBookSales] = await Promise.all([
            getDocs(qContractsCreated),
            getDocs(qContractsActivated),
            getDocs(qCancellations),
            getDocs(qUpdates),
            getDocs(qBookSales)
        ]);

        const processContract = (docSnap: any) => {
            const contract = { id: docSnap.id, ...docSnap.data() } as Contract;
            if (contract.status === 'expired' || fetchedTransactionsMap.has(contract.id)) return;

            const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
            if (!details) return;

            let paymentType = (details as any).paymentType || 'cash';
            let amount = Number(details.downPayment) || 0;
            let concept = contract.type === 'Curso Deluxe' ? 'Matrícula Deluxe' : `Abono ${contract.type}`;
            let studentId = details.studentIdNumber || contract.studentIdNumber || '';

            if (amount > 0) {
                const transaction: any = {
                    id: contract.id,
                    contrato: String(contract.folioNumber || '').padStart(6, '0'),
                    cedula: studentId,
                    clientName: contract.clientName || '',
                    service: concept,
                    amount: amount,
                    paymentType: paymentType,
                    createdBy: contract.createdBy || 'Sistema',
                    cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0, yappy: 0
                };

                const pKey = paymentType && transaction.hasOwnProperty(paymentType) ? paymentType : 'cash';
                transaction[pKey] = amount;
                fetchedTransactionsMap.set(contract.id, transaction);
            }
        };

        snapCreated.docs.forEach(processContract);
        snapActivated.docs.forEach(processContract);

        snapCancellations.docs.forEach((docSnap: any) => {
            const payment = docSnap.data() as Payment;
            const pType = payment.paymentType || 'cash';
            const transaction: any = {
                id: docSnap.id,
                contrato: String(payment.cancellationFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: 'Abono/Cancelación de Saldo',
                amount: payment.amount,
                paymentType: pType,
                createdBy: payment.createdBy || 'Sistema',
                cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0, yappy: 0
            };
            const pKey = pType && transaction.hasOwnProperty(pType) ? pType : 'cash';
            transaction[pKey] = payment.amount;
            fetchedTransactionsMap.set(docSnap.id, transaction);
        });

        snapUpdates.docs.forEach((docSnap: any) => {
            const payment = docSnap.data() as Payment;
            const pType = payment.paymentType || 'cash';
            const transaction: any = {
                id: docSnap.id,
                contrato: String(payment.updateFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: 'Actualización de Certificado',
                amount: payment.amount,
                paymentType: pType,
                createdBy: payment.createdBy || 'Sistema',
                cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0, yappy: 0
            };
            const pKey = pType && transaction.hasOwnProperty(pType) ? pType : 'cash';
            transaction[pKey] = payment.amount;
            fetchedTransactionsMap.set(docSnap.id, transaction);
        });

        snapBookSales.docs.forEach((docSnap: any) => {
            const payment = docSnap.data() as BookSalePayment;
            const pType = payment.paymentType || 'cash';
            const transaction: any = {
                id: docSnap.id,
                contrato: String(payment.bookSaleFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: `Libro: ${payment.bookTitle}`,
                amount: payment.amount,
                paymentType: pType,
                createdBy: payment.createdBy || 'Sistema',
                cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0, yappy: 0
            };
            const pKey = pType && transaction.hasOwnProperty(pType) ? pType : 'cash';
            transaction[pKey] = payment.amount;
            fetchedTransactionsMap.set(docSnap.id, transaction);
        });

        setTransactions(Array.from(fetchedTransactionsMap.values()));
        setIsReady(true);
      } catch (err: any) {
        console.error("Error en reporte de caja:", err);
        toast({ variant: 'destructive', title: 'Error', description: 'Fallo al cargar transacciones.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [db, reportDate, user, role, isUserLoading, isRoleLoading, mounted]);

  const filteredTransactions = useMemo(() => {
    if (role !== 'Administrador') return transactions.filter(t => t.createdBy === role);
    if (sellerFilter === 'all') return transactions;
    return transactions.filter(t => t.createdBy === sellerFilter);
  }, [transactions, sellerFilter, role]);

  const transactionTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, curr) => ({
        cash: acc.cash + (Number(curr.cash) || 0),
        debit: acc.debit + (Number(curr.debit) || 0),
        credit: acc.credit + (Number(curr.credit) || 0),
        bac: acc.bac + (Number(curr.bac) || 0),
        general: acc.general + (Number(curr.general) || 0),
        cheques: acc.cheques + (Number(curr.cheques) || 0),
        yappy: acc.yappy + (Number(curr.yappy) || 0),
      }),
      { cash: 0, debit: 0, credit: 0, core: 0, bac: 0, general: 0, cheques: 0, yappy: 0 }
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
    const totalEfectivoMenosGastos = (transactionTotals.cash || 0) - totalExpenses;
    const diferencia = cashBreakdownTotals.total - totalEfectivoMenosGastos;
    return { totalFacturado, totalEfectivoMenosGastos, diferencia };
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
        margin: [0.3, 0.7, 0.3, 0.3],
        filename: `Caja_Freeway_${reportDate ? format(reportDate, 'dd-MM-yyyy') : ''}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', width: 820 },
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
    <div className="space-y-6 rounded-lg print:bg-white min-h-screen pb-12">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
            @page { size: letter portrait; margin: 5mm; }
            header, footer, nav, aside, .print-hide { display: none !important; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: white !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
            .print-container { width: 100% !important; max-width: none !important; margin: 0 auto !important; padding: 0 !important; }
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
                <p className="text-xs text-muted-foreground">{role === 'Administrador' ? 'Visualizando transacciones globales.' : `Visualizando tus transacciones.`}</p>
            </div>
            <div className="flex items-center gap-2">
                {role === 'Administrador' && (
                  <Select value={sellerFilter} onValueChange={setSellerFilter}>
                      <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Vendedor..." /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos los Vendedores</SelectItem>
                          <SelectItem value="Administrador">Administrador</SelectItem>
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
                        {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={reportDate} onSelect={(date) => setReportDate(date || new Date())} initialFocus />
                    </PopoverContent>
                </Popover>
                <Button onClick={handleDownloadPdf} disabled={isDownloading || !isReady} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 px-4">
                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Descargar PDF
                </Button>
            </div>
        </div>
      </div>

      <div id="report-to-export" className="print-container bg-white mx-auto p-0" style={{ maxWidth: '820px' }}>
        <div className="text-center mb-4 border-b-2 border-black pb-2">
          <h2 className="text-xl font-black uppercase">FREEWAY ESCUELA DE MANEJO</h2>
          <p className="text-[10px] font-bold">REPORTE DE CAJA DIARIO - {reportDate ? format(reportDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase() : ''}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-20" /></div>
        ) : (
          <div className="space-y-4">
            <Table className="border-collapse border border-black">
              <TableHeader>
                <TableRow className="bg-slate-100 font-bold border-b-2 border-black">
                  <TableHead className="text-black p-1 h-auto text-[9px]">Folio</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px]">Cliente</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px]">Servicio</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">Efectivo</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">Débito</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">Crédito</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">BAC</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">Gral</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">Cheque</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[9px] text-right">Yappy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                  <TableRow key={t.id} className="h-auto border-black">
                    <TableCell className="p-1 text-[8.5px] font-bold">{t.contrato}</TableCell>
                    <TableCell className="p-1 text-[8.5px] uppercase font-medium max-w-[120px] truncate">{t.clientName}</TableCell>
                    <TableCell className="p-1 text-[8.5px] italic max-w-[120px] truncate">{t.service}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.cash > 0 ? t.cash.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.bac > 0 ? t.bac.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.general > 0 ? t.general.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.cheques > 0 ? t.cheques.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[8.5px] text-right">{t.yappy > 0 ? t.yappy.toFixed(2) : '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow className="h-20"><TableCell colSpan={10} className="text-center italic text-slate-400">No hay transacciones registradas para este día.</TableCell></TableRow>
                )}
                <TableRow className="bg-slate-50 font-bold border-t-2 border-black h-auto">
                  <TableCell colSpan={3} className="p-1 text-[9px] text-right uppercase">Totales</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.cash.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.debit.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.credit.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.bac.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.general.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.cheques.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[9px] text-right">{transactionTotals.yappy.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-black p-2 rounded-sm space-y-2">
                <h3 className="text-[9px] font-black uppercase bg-slate-100 p-1 border-b border-black">Desglose de Efectivo</h3>
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="space-y-1">
                    {Object.keys(billQuantities).map(val => (
                      <div key={val} className="flex justify-between items-center text-[8px]">
                        <span>B/. {val}:</span>
                        <div className="flex items-center gap-1">
                            <Input type="number" className="h-4 w-8 text-[8px] p-0.5 border-black print-hide" value={billQuantities[val] || ''} onChange={(e) => handleCashChange('bill', val, e.target.value)} />
                            <span className="print-show-val">{billQuantities[val]}</span>
                            <span className="w-10 text-right">{(parseFloat(val) * (billQuantities[val] || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 border-l border-black pl-4">
                    {Object.keys(coinQuantities).map(val => (
                      <div key={val} className="flex justify-between items-center text-[8px]">
                        <span>B/. {val}:</span>
                        <div className="flex items-center gap-1">
                            <Input type="number" className="h-4 w-8 text-[8px] p-0.5 border-black print-hide" value={coinQuantities[val] || ''} onChange={(e) => handleCashChange('coin', val, e.target.value)} />
                            <span className="print-show-val">{coinQuantities[val]}</span>
                            <span className="w-10 text-right">{(parseFloat(val) * (coinQuantities[val] || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center font-bold text-[9px] pt-1 border-t border-black">
                  <span>TOTAL FÍSICO:</span>
                  <span>B/. {cashBreakdownTotals.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border border-black p-2 rounded-sm">
                  <h3 className="text-[9px] font-black uppercase bg-slate-100 p-1 border-b border-black flex justify-between">
                    <span>Gastos del Día</span>
                    <Button variant="ghost" size="sm" className="h-3 w-3 p-0 print-hide" onClick={() => setExpenses([...expenses, { description: '', amount: 0 }])}>+</Button>
                  </h3>
                  <div className="space-y-1 pt-1">
                    {expenses.map((exp, idx) => (
                      <div key={idx} className="flex gap-1 items-center">
                        <Input placeholder="Descripción" className="h-4 text-[8px] p-0.5 border-black flex-1 print-hide" value={exp.description} onChange={(e) => handleExpenseChange(idx, 'description', e.target.value)} />
                        <span className="print-show-val flex-1">{exp.description}</span>
                        <Input type="number" placeholder="0.00" className="h-4 w-12 text-[8px] p-0.5 border-black print-hide" value={exp.amount || ''} onChange={(e) => handleExpenseChange(idx, 'amount', e.target.value)} />
                        <span className="print-show-val w-12 text-right">{Number(exp.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center font-bold text-[9px] pt-1 border-t border-black mt-1">
                    <span>TOTAL GASTOS:</span>
                    <span>B/. {totalExpenses.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-2 border-black p-3 bg-slate-50 space-y-1">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span>Total Facturado:</span>
                    <span>{currencyFormatter.format(grandTotals.totalFacturado)}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>Efectivo Sistema:</span>
                    <span>{transactionTotals.cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-red-600">
                    <span>(-) Gastos:</span>
                    <span>- {totalExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black border-t border-black pt-1">
                    <span>Efectivo Neto:</span>
                    <span>B/. {grandTotals.totalEfectivoMenosGastos.toFixed(2)}</span>
                  </div>
                  <div className={cn("flex justify-between text-[11px] font-black p-1 rounded-sm mt-1", grandTotals.diferencia === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                    <span>DIFERENCIA:</span>
                    <span>B/. {grandTotals.diferencia.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-8 pb-4">
                <div className="text-center">
                    <div className="border-t border-black w-40 mx-auto"></div>
                    <p className="text-[9px] font-bold uppercase">Cajero</p>
                </div>
                <div className="text-center">
                    <div className="border-t border-black w-40 mx-auto"></div>
                    <p className="text-[9px] font-bold uppercase">Administración</p>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
