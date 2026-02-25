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
import { Trash2, Printer, CalendarIcon, Loader2, AlertCircle, User, CheckCircle2, Download } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Contract, Payment, Transaction, BookSalePayment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

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

const paymentTypes = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'T.Débito' },
    { value: 'credit', label: 'T.Crédito' },
    { value: 'bac', label: 'BAC' },
    { value: 'general', label: 'General' },
    { value: 'cheques', label: 'Cheques' },
];

export default function DailyCashReportPage() {
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');

  useEffect(() => {
    if (!db || isUserLoading || isRoleLoading || !user || !role) {
        return;
    };

    const fetchDailyData = async () => {
      setIsLoading(true);
      setError(null);
      setIsDataLoaded(false);
      setIsReady(false);
      
      const startOfReportDay = startOfDay(reportDate);
      const endOfReportDay = endOfDay(reportDate);
      const fetchedTransactions: Transaction[] = [];

      try {
        const createDateQuery = (collName: string) => {
            const baseRef = collection(db, collName);
            const dateField = (collName === 'contracts') ? 'createdAt' : 'paymentDate';
            
            return query(
                baseRef, 
                where(dateField, '>=', Timestamp.fromDate(startOfReportDay)), 
                where(dateField, '<=', Timestamp.fromDate(endOfReportDay))
            );
        };
        
        const [
            contractsSnapshot,
            cancellationSnapshot,
            updateSnapshot,
            bookSaleSnapshot
        ] = await Promise.all([
            getDocs(createDateQuery('contracts')),
            getDocs(createDateQuery('cancellation_payments')),
            getDocs(createDateQuery('update_payments')),
            getDocs(createDateQuery('book_sale_payments'))
        ]);

        contractsSnapshot.docs.forEach((doc: any) => {
            const contract = { id: doc.id, ...doc.data() } as Contract;
            if (contract.status === 'expired') return;

            let paymentType: string = 'cash';
            let amount: number = 0;
            let paymentColumns: any = { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 };
            
            const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
            let studentId = details?.studentIdNumber || contract.studentIdNumber || '';

            if (contract.type === 'Curso Deluxe') {
                paymentType = contract.deluxeDetails?.paymentType || 'cash';
                amount = 15.00;
            } else {
                paymentType = (details as any)?.paymentType || 'cash';
                amount = details?.downPayment || 0;
            }

            if(amount > 0) {
                const pKey = paymentType && paymentColumns.hasOwnProperty(paymentType) ? paymentType : 'cash';
                paymentColumns[pKey] = amount;

                fetchedTransactions.push({
                    id: contract.id,
                    contrato: String(contract.folioNumber || '').padStart(6, '0'),
                    cedula: studentId,
                    clientName: contract.clientName || '',
                    service: contract.type === 'Curso Deluxe' ? 'Matrícula Deluxe' : `Abono ${contract.type}`,
                    amount: amount,
                    paymentType: paymentType,
                    createdBy: contract.createdBy || 'Sistema',
                    ...paymentColumns,
                });
            }
        });

        cancellationSnapshot.docs.forEach((doc: any) => {
            const payment = doc.data() as Payment;
            const amount = payment.amount || 0;
            const pType = payment.paymentType || 'cash';
            
            let paymentColumns: any = { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 };
            const pKey = pType && paymentColumns.hasOwnProperty(pType) ? pType : 'cash';
            paymentColumns[pKey] = amount;

            fetchedTransactions.push({
                id: doc.id,
                contrato: String(payment.cancellationFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: 'Abono/Cancelación de Saldo',
                amount: amount,
                paymentType: pType,
                createdBy: payment.createdBy || 'Sistema',
                ...paymentColumns,
            });
        });

        updateSnapshot.docs.forEach((doc: any) => {
            const payment = doc.data() as Payment;
            const amount = payment.amount || 0;
            const pType = payment.paymentType || 'cash';

            let paymentColumns: any = { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 };
            const pKey = pType && paymentColumns.hasOwnProperty(pType) ? pType : 'cash';
            paymentColumns[pKey] = amount;

            fetchedTransactions.push({
                id: doc.id,
                contrato: String(payment.updateFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: 'Actualización de Certificado',
                amount: amount,
                paymentType: pType,
                createdBy: payment.createdBy || 'Sistema',
                ...paymentColumns,
            });
        });

        bookSaleSnapshot.docs.forEach((doc: any) => {
            const payment = doc.data() as BookSalePayment;
            const amount = payment.amount || 0;
            const pType = payment.paymentType || 'cash';

            let paymentColumns: any = { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 };
            const pKey = pType && paymentColumns.hasOwnProperty(pType) ? pType : 'cash';
            paymentColumns[pKey] = amount;

            fetchedTransactions.push({
                id: doc.id,
                contrato: String(payment.bookSaleFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: `Libro: ${payment.bookTitle}`,
                amount: amount,
                paymentType: pType,
                createdBy: payment.createdBy || 'Sistema',
                ...paymentColumns,
            });
        });

        setTransactions(fetchedTransactions);
        setIsDataLoaded(true);

        // Estabilización para PDF en Tablet
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 4000);
        return () => clearTimeout(timer);

      } catch (err: any) {
        console.error("Error fetching report data:", err);
        setError("No se pudieron cargar los datos del reporte.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [db, reportDate, user, role, isUserLoading, isRoleLoading]);

  const filteredTransactions = useMemo(() => {
    if (sellerFilter === 'all') {
      return transactions;
    }
    return transactions.filter(t => t.createdBy === sellerFilter);
  }, [transactions, sellerFilter]);

  const transactionTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, curr) => ({
        cash: acc.cash + (curr.cash || 0),
        debit: acc.debit + (curr.debit || 0),
        credit: acc.credit + (curr.credit || 0),
        bac: acc.bac + (curr.bac || 0),
        general: acc.general + (curr.general || 0),
        cheques: acc.cheques + (curr.cheques || 0),
      }),
      { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 }
    );
  }, [filteredTransactions]);

  const cashBreakdownTotals = useMemo(() => {
    const billTotal = Object.entries(billQuantities).reduce((acc, [bill, qty]) => acc + parseFloat(bill) * qty, 0);
    const coinTotal = Object.entries(coinQuantities).reduce((acc, [coin, qty]) => acc + parseFloat(coin) * qty, 0);
    return { billTotal, coinTotal, total: billTotal + coinTotal };
  }, [billQuantities, coinQuantities]);
  
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0), [expenses]);
  
  const grandTotals = useMemo(() => {
    const totalFacturado = Object.values(transactionTotals).reduce((sum, val) => sum + val, 0);
    const totalEfectivoMenosGastos = transactionTotals.cash - totalExpenses;
    const diferencia = cashBreakdownTotals.total - totalEfectivoMenosGastos;
    return { totalFacturado, totalEfectivoMenosGastos, diferencia };
  }, [transactionTotals, totalExpenses, cashBreakdownTotals.total]);
  

  const handleTransactionChange = (index: number, field: keyof Transaction, value: any) => {
    const transactionId = filteredTransactions[index].id;
    const originalIndex = transactions.findIndex(t => t.id === transactionId);
    if (originalIndex === -1) return;

    const updated = [...transactions];
    let newTransaction = { ...updated[originalIndex] };
    
    if (field === 'amount') {
        newTransaction.amount = parseFloat(value) || 0;
    } else if (field === 'paymentType') {
        newTransaction.paymentType = value;
    }

    newTransaction.cash = 0; newTransaction.debit = 0; newTransaction.credit = 0;
    newTransaction.bac = 0; newTransaction.general = 0; newTransaction.cheques = 0;
    
    const pType = newTransaction.paymentType;
    if (pType && newTransaction.hasOwnProperty(pType)) {
        (newTransaction as any)[pType] = newTransaction.amount;
    } else {
        newTransaction.cash = newTransaction.amount;
    }

    updated[originalIndex] = newTransaction;
    setTransactions(updated);
  };

  const handleCashChange = (type: 'bill' | 'coin', value: string, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    if (type === 'bill') {
      setBillQuantities(prev => ({ ...prev, [value]: qty }));
    } else {
      setCoinQuantities(prev => ({ ...prev, [value]: qty }));
    }
  };

  const handleExpenseChange = (index: number, field: 'description' | 'amount', value: any) => {
    const updated = [...expenses];
    if (field === 'amount') {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setExpenses(updated);
  };

  const addExpenseRow = () => {
    setExpenses([...expenses, { description: '', amount: 0 }]);
  };
  
  const handlePrint = () => {
    window.print();
  }

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-export');
    if (!element) return;

    setIsDownloading(true);
    try {
      // Dynamic import to avoid SSR issues
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [0.3, 0.3],
        filename: `Reporte_Caja_Freeway_${format(reportDate, 'dd-MM-yyyy')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "El reporte se ha descargado correctamente." });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  if (isUserLoading || isRoleLoading) {
    return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="ml-4 text-muted-foreground font-medium animate-pulse">Cargando reporte...</p>
        </div>
    );
  }

  const isAdmin = role === 'Administrador';

  return (
    <div className="space-y-6 rounded-lg print:bg-white min-h-screen pb-12">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
            @page { 
                size: letter landscape; 
                margin: 5mm; 
            }
            header, footer, nav, aside, .print-hide { 
                display: none !important; 
            }
            body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
                background-color: white !important; 
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
            }
            .print-container {
                width: 10in !important;
                max-width: none !important;
                margin: 0 auto !important;
                padding: 0 !important;
            }
            table {
                border-collapse: collapse !important;
                width: 100% !important;
                border: 1px solid black !important;
            }
            th, td {
                border: 1px solid black !important;
                color: black !important;
                padding: 2px 4px !important;
            }
            .bg-muted\\/50 {
                background-color: #f1f5f9 !important;
            }
            input, select, button {
                display: none !important;
            }
            .print-show-val {
                display: block !important;
            }
        }
        .print-show-val {
            display: none;
        }
      `}} />
      
      <div className="flex flex-col gap-4 print-hide">
        <div className="flex justify-between items-center">
            <div className='flex flex-col'>
                <h1 className="text-2xl font-bold font-headline text-slate-900">Reporte de Caja Diario</h1>
                <p className="text-xs text-muted-foreground">Ingresos registrados en el sistema.</p>
            </div>
            <div className="flex items-center gap-2">
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
                <Popover>
                    <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-[220px] h-9 justify-start text-left font-normal text-xs", !reportDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={reportDate} onSelect={(date) => setReportDate(date || new Date())} initialFocus />
                    </PopoverContent>
                </Popover>
            </div>
        </div>

        {/* ÁREA DE IMPRESIÓN OPTIMIZADA PARA TABLET */}
        <div className="bg-white p-4 border-2 border-dashed rounded-xl flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-3 text-blue-800 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <AlertCircle className="h-5 w-5" />
                <p className="text-xs font-bold uppercase">Optimización para Tablet: Si la impresión directa falla, usa el botón de Descargar PDF.</p>
            </div>
            
            {!isReady ? (
                <div className="bg-slate-100 text-slate-500 p-8 rounded-xl text-center font-black uppercase text-lg flex items-center justify-center gap-3 border-2 border-slate-200 animate-pulse">
                    <Loader2 className="animate-spin h-6 w-6" />
                    Preparando Contenido (4s)...
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                        onClick={handlePrint} 
                        className={cn(
                            "flex-1 font-black shadow-xl uppercase tracking-widest border-4",
                            isMobile ? "h-24 text-2xl bg-blue-600 hover:bg-blue-700 border-blue-400" : "h-14 text-lg"
                        )}
                    >
                        <Printer className="mr-4 h-8 w-8" />
                        IMPRIMIR EN CANON
                    </Button>
                    <Button 
                        onClick={handleDownloadPdf} 
                        disabled={isDownloading}
                        variant="outline"
                        className={cn(
                            "flex-1 font-black shadow-lg uppercase tracking-widest border-4 border-green-600 text-green-700 hover:bg-green-50",
                            isMobile ? "h-24 text-2xl" : "h-14 text-lg"
                        )}
                    >
                        {isDownloading ? <Loader2 className="animate-spin mr-4 h-8 w-8" /> : <Download className="mr-4 h-8 w-8" />}
                        DESCARGAR EN PDF
                    </Button>
                </div>
            )}
        </div>
      </div>

      <div id="report-to-export" className="print-container space-y-4 bg-white p-2">
        <div className="p-2 text-center font-bold text-lg border-b-2 border-black mb-4 uppercase flex flex-col">
            <span className="text-black">FREEWAY ESCUELA DE MANEJO</span>
            <span className="text-sm text-black">CONTROL DE CAJA - {format(reportDate, "EEEE d 'DE' LLLL 'DE' yyyy", { locale: es })}</span>
        </div>

        {!isLoading && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
                <div className="overflow-x-auto border border-black rounded-sm">
                    <Table className="min-w-full text-[9px] border-collapse">
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black w-6">#</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black w-14">Folio</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black w-20">Cédula</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[120px]">Cliente</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[120px]">Servicio</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">Monto</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">Efectivo</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">T.Débito</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">T.Crédito</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">BAC</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">General</TableHead>
                        <TableHead className="p-1 text-center font-bold text-black">Cheques</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.map((transaction, index) => (
                        <TableRow key={transaction.id} className="hover:bg-transparent h-7">
                            <TableCell className="border-r border-black p-1 text-center text-black">{index + 1}</TableCell>
                            <TableCell className="border-r border-black p-1 font-bold text-black">{transaction.contrato}</TableCell>
                            <TableCell className="border-r border-black p-1 text-black">{transaction.cedula}</TableCell>
                            <TableCell className="border-r border-black p-1 truncate max-w-[150px] uppercase font-medium text-black">{transaction.clientName}</TableCell>
                            <TableCell className="border-r border-black p-1 uppercase text-[8px] text-black">{transaction.service}</TableCell>
                            <TableCell className="border-r border-black p-0 text-right pr-1 text-black">
                                <span className={cn(isDownloading ? "block" : "print-show-val")}>{transaction.amount.toFixed(2)}</span>
                                {!isDownloading && (
                                    <Input 
                                        type="number" 
                                        value={transaction.amount} 
                                        onChange={e => handleTransactionChange(index, 'amount', e.target.value)} 
                                        disabled={!isAdmin}
                                        className="w-full h-7 border-none rounded-none text-[10px] p-1 text-right focus-visible:ring-0 disabled:opacity-100 print:hidden" 
                                    />
                                )}
                            </TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transaction.cash > 0 ? transaction.cash.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transaction.debit > 0 ? transaction.debit.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transaction.credit > 0 ? transaction.credit.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transaction.bac > 0 ? transaction.bac.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transaction.general > 0 ? transaction.general.toFixed(2) : '-'}</TableCell>
                            <TableCell className="p-1 text-right text-black">{transaction.cheques > 0 ? transaction.cheques.toFixed(2) : '-'}</TableCell>
                        </TableRow>
                        ))}
                        <TableRow className="font-bold bg-slate-100 hover:bg-slate-100 border-t border-black h-8">
                            <TableCell colSpan={6} className="text-right p-1 pr-4 border-r border-black uppercase text-black">TOTALES POR CATEGORÍA:</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transactionTotals.cash.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transactionTotals.debit.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transactionTotals.credit.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transactionTotals.bac.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right text-black">{transactionTotals.general.toFixed(2)}</TableCell>
                            <TableCell className="p-1 text-right text-black">{transactionTotals.cheques.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableBody>
                    </Table>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="font-bold text-center text-[10px] uppercase tracking-wider bg-slate-100 border border-black p-1 text-black">Desglose de Efectivo Físico</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Table className="text-[9px] border border-black">
                                <TableHeader className="bg-slate-50"><TableRow><TableHead className="border-r border-black p-1 font-bold text-black h-6">Cant.</TableHead><TableHead className="border-r border-black p-1 font-bold text-black h-6 text-right">Billetes</TableHead><TableHead className="p-1 font-bold text-black h-6 text-right">Monto</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {Object.keys(billQuantities).map(bill => (
                                        <TableRow key={bill} className="h-6 hover:bg-transparent">
                                            <TableCell className="border-r border-black p-0 text-black">
                                                <span className={cn(isDownloading ? "block text-center" : "print-show-val text-center w-full")}>{billQuantities[bill] || '0'}</span>
                                                {!isDownloading && (
                                                    <Input type="number" value={billQuantities[bill] || ''} onChange={e => handleCashChange('bill', bill, e.target.value)} className="w-full h-6 border-none rounded-none text-[10px] p-1 text-center focus:ring-0 print:hidden" />
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r border-black p-1 text-right text-black">{currencyFormatter.format(parseFloat(bill))}</TableCell>
                                            <TableCell className="p-1 text-right font-semibold text-black">{currencyFormatter.format(parseFloat(bill) * (billQuantities[bill] || 0))}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-slate-50"><TableCell colSpan={2} className="text-right p-1 border-r border-black uppercase text-black">SUB-TOTAL</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(cashBreakdownTotals.billTotal)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                            <Table className="text-[9px] border border-black">
                                <TableHeader className="bg-slate-50"><TableRow><TableHead className="border-r border-black p-1 font-bold text-black h-6">Cant.</TableHead><TableHead className="border-r border-black p-1 font-bold text-black h-6 text-right">Monedas</TableHead><TableHead className="p-1 font-bold text-black h-6 text-right">Monto</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {Object.keys(coinQuantities).map(coin => (
                                        <TableRow key={coin} className="h-6 hover:bg-transparent">
                                            <TableCell className="border-r border-black p-0 text-black">
                                                <span className={cn(isDownloading ? "block text-center" : "print-show-val text-center w-full")}>{coinQuantities[coin] || '0'}</span>
                                                {!isDownloading && (
                                                    <Input type="number" value={coinQuantities[coin] || ''} onChange={e => handleCashChange('coin', coin, e.target.value)} className="w-full h-6 border-none rounded-none text-[10px] p-1 text-center focus:ring-0 print:hidden" />
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r border-black p-1 text-right text-black">{currencyFormatter.format(parseFloat(coin))}</TableCell>
                                            <TableCell className="p-1 text-right font-semibold text-black">{currencyFormatter.format(parseFloat(coin) * (coinQuantities[coin] || 0))}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-slate-50"><TableCell colSpan={2} className="text-right p-1 border-r border-black uppercase text-black">SUB-TOTAL</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(cashBreakdownTotals.coinTotal)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <div className="text-right font-bold text-[11px] bg-slate-100 p-2 rounded border border-black uppercase text-black">TOTAL FÍSICO: {currencyFormatter.format(cashBreakdownTotals.total)}</div>
                    </div>

                    <div className="space-y-4">
                        <Table className="text-[9px] border border-black">
                            <TableHeader className="bg-slate-100 border-b border-black"><TableRow><TableHead colSpan={2} className="text-center font-bold p-1 h-6 uppercase text-black">Consolidado Sistema</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow className="hover:bg-transparent h-6"><TableCell className="border-r border-black p-1 text-black">TOTAL CRÉDITO</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(transactionTotals.credit)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent h-6"><TableCell className="border-r border-black p-1 text-black">TOTAL DÉBITO</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(transactionTotals.debit)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent h-6"><TableCell className="border-r border-black p-1 text-black">BAC</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(transactionTotals.bac)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent h-6"><TableCell className="border-r border-black p-1 text-black">GENERAL</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(transactionTotals.general)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent h-6"><TableCell className="border-r border-black p-1 text-black">CHEQUES</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(transactionTotals.cheques)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent bg-slate-50 h-6"><TableCell className="border-r border-black p-1 font-bold text-black">TOTAL EFECTIVO (SISTEMA)</TableCell><TableCell className="p-1 text-right font-black text-black">{currencyFormatter.format(transactionTotals.cash)}</TableCell></TableRow>
                            </TableBody>
                        </Table>

                        <Table className="text-[9px] border border-black">
                            <TableHeader className="bg-slate-100 border-b border-black"><TableRow><TableHead colSpan={2} className="text-center font-bold p-1 h-6 uppercase text-black">Gastos Menores</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {expenses.map((expense, index) => (
                                    <TableRow key={index} className="hover:bg-transparent h-6">
                                        <TableCell className="border-r border-black p-0 text-black">
                                            <span className={cn(isDownloading ? "block px-1" : "print-show-val px-1")}>{expense.description || '-'}</span>
                                            {!isDownloading && (
                                                <Input placeholder="Descripción..." value={expense.description} onChange={e => handleExpenseChange(index, 'description', e.target.value)} className="w-full h-6 border-none rounded-none text-[10px] p-1 focus:ring-0 print:hidden" />
                                            )}
                                        </TableCell>
                                        <TableCell className="p-0 w-20 text-black">
                                            <span className={cn(isDownloading ? "block text-right px-1" : "print-show-val text-right px-1 w-full")}>{expense.amount > 0 ? expense.amount.toFixed(2) : '0.00'}</span>
                                            {!isDownloading && (
                                                <Input type="number" value={expense.amount || ''} onChange={e => handleExpenseChange(index, 'amount', e.target.value)} className="w-full h-6 border-none rounded-none text-[10px] p-1 text-right focus:ring-0 print:hidden" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold bg-slate-50 border-t border-black h-6"><TableCell className="border-r border-black p-1 uppercase text-black">TOTAL GASTOS</TableCell><TableCell className="p-1 text-right text-black">{currencyFormatter.format(totalExpenses)}</TableCell></TableRow>
                            </TableBody>
                        </Table>

                        <div className="border border-black p-2 bg-slate-100 rounded-sm space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold text-black"><span>EFECTIVO NETO (SISTEMA - GASTOS):</span><span>{currencyFormatter.format(grandTotals.totalEfectivoMenosGastos)}</span></div>
                            <div className="flex justify-between items-center text-[10px] font-bold"><span>DIFERENCIA / FALTANTE:</span><span className={cn(grandTotals.diferencia < 0 ? "text-red-600" : "text-green-600")}>{currencyFormatter.format(grandTotals.diferencia)}</span></div>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-around items-center pt-8 print:pt-12">
                    <div className="text-center w-48 border-t border-black pt-1"><p className="text-[8px] font-bold uppercase text-black">Recibido por</p></div>
                    <div className="text-center w-48 border-t border-black pt-1"><p className="text-[8px] font-bold uppercase text-black">Entregado por</p></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
