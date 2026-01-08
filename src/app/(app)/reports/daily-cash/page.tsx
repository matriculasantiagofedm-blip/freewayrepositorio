
'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Printer, CalendarIcon, Loader2 } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDb } from '@/components/firebase-provider';
import { collection, query, where, getDocs, Timestamp, CollectionReference, Query } from 'firebase/firestore';
import type { Contract, Payment } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


interface Transaction {
  id: string; // Use a unique ID like contract id or payment id
  invoice: string;
  contrato: string;
  cedula: string;
  clientName: string;
  phone: string;
  service: string;
  amount: number;
  paymentType: string;
  cash: number;
  debit: number;
  credit: number;
  global: number;
  bac: number;
  general: number;
  cheques: number;
}

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

const paymentTypes = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'debit', label: 'T.Débito' },
    { value: 'credit', label: 'T.Crédito' },
    { value: 'global', label: 'GLOBAL' },
    { value: 'bac', label: 'BAC' },
    { value: 'general', label: 'GENERAL' },
    { value: 'cheques', label: 'Cheques' },
];

// Helper to get path from a query for error reporting
const getQueryPath = (q: Query | CollectionReference): string => {
    try {
        if ('path' in q) return (q as CollectionReference).path;
        // This is a private property but often the only way to get path from a query
        return (q as any)._query.path.segments.join('/');
    } catch {
        return 'unknown path';
    }
};


export default function DailyCashReportPage() {
  const { role } = useCurrentRole();
  const db = useDb();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Fetch contracts and payments based on selected date
  useEffect(() => {
    if (!db || !reportDate) {
        setTransactions([]);
        setIsDataLoaded(true);
        setIsLoading(false);
        return;
    };

    const fetchData = async () => {
      setIsLoading(true);
      setIsDataLoaded(false);
      const startOfReportDay = startOfDay(reportDate);
      const endOfReportDay = endOfDay(reportDate);
      
      try {
        const allTransactions: Transaction[] = [];

        // 1. Fetch new contracts for the day (down payments)
        const contractsRef = collection(db, 'contracts');
        const contractsQuery = query(
          contractsRef,
          where('createdAt', '>=', Timestamp.fromDate(startOfReportDay)),
          where('createdAt', '<=', Timestamp.fromDate(endOfReportDay))
        );
        const contractsSnapshot = await getDocs(contractsQuery);

        contractsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Contract))
            .filter(contract => contract.status !== 'expired')
            .forEach((contract) => {
                let details: any = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails || {};
                
                // Add transaction for the down payment
                allTransactions.push({
                    id: contract.id,
                    invoice: '',
                    contrato: String(contract.folioNumber || ''),
                    cedula: details.studentIdNumber || contract.studentIdNumber || '',
                    clientName: contract.clientName || '',
                    phone: details.studentPhone1 || '',
                    service: contract.type || '',
                    amount: details.downPayment || 0,
                    paymentType: '',
                    cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0,
                });
                
                // If it's a Deluxe contract, add a separate transaction for the enrollment fee
                if (contract.type === 'Curso Deluxe') {
                    allTransactions.push({
                        id: `${contract.id}-matricula`,
                        invoice: '',
                        contrato: String(contract.folioNumber || ''),
                        cedula: details.studentIdNumber || contract.studentIdNumber || '',
                        clientName: contract.clientName || '',
                        phone: details.studentPhone1 || '',
                        service: 'Matrícula', // Specific service name for the fee
                        amount: 15.00, // Fixed enrollment fee
                        paymentType: '',
                        cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0,
                    });
                }
            });

        // 2. Fetch 'actualizacion' and 'cancelacion' payments for the day
        const paymentsRef = collection(db, 'payments');
        const paymentsQuery = query(
          paymentsRef,
          where('paymentDate', '>=', Timestamp.fromDate(startOfReportDay)),
          where('paymentDate', '<=', Timestamp.fromDate(endOfReportDay)),
          where('type', 'in', ['actualizacion', 'cancelacion'])
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        paymentsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Payment))
          .forEach((payment) => {
            allTransactions.push({
                id: payment.id,
                invoice: '',
                contrato: String(payment.updateFolio || payment.cancellationFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                phone: '', // Phone not available on payment record
                service: payment.type === 'actualizacion' ? 'Actualización Certificado' : 'Cancelación de Saldo',
                amount: payment.amount,
                paymentType: '',
                cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0,
            });
          });
        
        setTransactions(allTransactions);
        setIsDataLoaded(true);
      } catch (error: any) {
        if (error.code === 'permission-denied') {
            const failedQuery = error.message.includes('contracts') ? 'contracts' : 'payments';
            const permissionError = new FirestorePermissionError({
                path: failedQuery,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             // Handle other errors (e.g., network issues)
            console.error("Error fetching data for report:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [db, reportDate, role]);


  // Totales de Transacciones
  const transactionTotals = useMemo(() => {
    return transactions.reduce(
      (acc, curr) => ({
        cash: acc.cash + (curr.cash || 0),
        debit: acc.debit + (curr.debit || 0),
        credit: acc.credit + (curr.credit || 0),
        global: acc.global + (curr.global || 0),
        bac: acc.bac + (curr.bac || 0),
        general: acc.general + (curr.general || 0),
        cheques: acc.cheques + (curr.cheques || 0),
      }),
      { cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0 }
    );
  }, [transactions]);

  // Totales de Desglose de Efectivo
  const cashBreakdownTotals = useMemo(() => {
    const billTotal = Object.entries(billQuantities).reduce((acc, [bill, qty]) => acc + parseFloat(bill) * qty, 0);
    const coinTotal = Object.entries(coinQuantities).reduce((acc, [coin, qty]) => acc + parseFloat(coin) * qty, 0);
    return { billTotal, coinTotal, total: billTotal + coinTotal };
  }, [billQuantities, coinQuantities]);
  
  // Totales de Gastos
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0), [expenses]);
  
  // Gran Total
  const grandTotals = useMemo(() => {
    const totalFacturado = Object.values(transactionTotals).reduce((sum, val) => sum + val, 0);
    const totalEfectivoMenosGastos = cashBreakdownTotals.total - totalExpenses;
    const diferencia = totalEfectivoMenosGastos - totalDeposit;
    return { totalFacturado, totalEfectivoMenosGastos, diferencia };
  }, [transactionTotals, cashBreakdownTotals, totalExpenses, totalDeposit]);
  

  const handleTransactionChange = (index: number, field: keyof Transaction, value: any) => {
    const updated = [...transactions];
    let newTransaction = { ...updated[index] };

    const numericFields: (keyof Transaction)[] = ['amount', 'cash', 'debit', 'credit', 'global', 'bac', 'general', 'cheques'];
    
    if (field === 'amount') {
      newTransaction.amount = parseFloat(value) || 0;
    } else if (field === 'paymentType') {
      newTransaction.paymentType = value;
    } else if (numericFields.includes(field)) {
      (newTransaction[field] as number) = parseFloat(value) || 0;
    } else {
      (newTransaction[field] as string) = value;
    }

    if (field === 'paymentType' || field === 'amount') {
        newTransaction.cash = 0;
        newTransaction.debit = 0;
        newTransaction.credit = 0;
        newTransaction.global = 0;
        newTransaction.bac = 0;
        newTransaction.general = 0;
        newTransaction.cheques = 0;

        if (newTransaction.paymentType && (paymentTypes.some(pt => pt.value === newTransaction.paymentType))) {
           (newTransaction[newTransaction.paymentType as keyof Transaction] as number) = newTransaction.amount;
        }
    }

    updated[index] = newTransaction;
    setTransactions(updated);
};


  const addTransactionRow = () => {
    setTransactions([
      ...transactions,
      { id: `manual-${transactions.length + 1}`, invoice: '', contrato: '', cedula: '', clientName: '', phone: '', service: '', amount: 0, paymentType: '', cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0 },
    ]);
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
  
  const removeExpenseRow = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6 rounded-lg print:bg-white print:scale-90 print:origin-top-left">
      <div className="flex justify-between items-center print-hide">
        <h1 className="text-2xl font-bold font-headline">Reporte de Caja Diario</h1>
        <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !reportDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={(date) => setReportDate(date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
      </div>

      <div className="p-2 text-center font-bold text-sm print:text-xs">
        {format(reportDate, "EEEE d 'DE' LLLL 'DE' yyyy", { locale: es }).toUpperCase()}
      </div>

       {isLoading && (
         <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando datos del día...</p>
         </div>
       )}

      {!isLoading && (
        <div className="space-y-4">
            <div>
                <div className="overflow-x-auto">
                    <Table className="min-w-full text-xs border-collapse border border-black">
                    <TableHeader>
                        <TableRow>
                        {['#', 'FACTURA', 'Contrato', 'Cédula', 'Nombre del cliente', 'Teléfono', 'Servicio', 'Monto', 'Tipo de Pago', 'Efectivo', 'T.Débito', 'T.Crédito', 'GLOBAL', 'BAC', 'GENERAL', 'Cheques'].map(header => (
                            <TableHead key={header} className="border border-black p-1 text-center font-bold print:text-[8px] print:p-0.5">{header}</TableHead>
                        ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((transaction, index) => (
                        <TableRow key={transaction.id}>
                            <TableCell className="border border-black p-0.5 text-center print:text-[8px] print:p-0.5">{index + 1}</TableCell>
                            <TableCell className="border border-black p-0 print:w-16"><Input type="text" value={transaction.invoice} onChange={e => handleTransactionChange(index, 'invoice', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="text" value={transaction.contrato} onChange={e => handleTransactionChange(index, 'contrato', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30 print:text-[8px] print:p-0.5" readOnly /></TableCell>
                            <TableCell className="border border-black p-0 print:w-20"><Input type="text" value={transaction.cedula} onChange={e => handleTransactionChange(index, 'cedula', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30 print:text-[8px] print:p-0.5" readOnly /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="text" value={transaction.clientName} onChange={e => handleTransactionChange(index, 'clientName', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30 print:text-[8px] print:p-0.5" readOnly /></TableCell>
                            <TableCell className="border border-black p-0 print:w-20"><Input type="text" value={transaction.phone} onChange={e => handleTransactionChange(index, 'phone', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30 print:text-[8px] print:p-0.5" readOnly /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="text" value={transaction.service} onChange={e => handleTransactionChange(index, 'service', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30 print:text-[8px] print:p-0.5" readOnly /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" value={transaction.amount} onChange={e => handleTransactionChange(index, 'amount', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0">
                                <Select value={transaction.paymentType} onValueChange={value => handleTransactionChange(index, 'paymentType', value)}>
                                    <SelectTrigger className="w-full h-full border-none rounded-none text-xs p-1 print:text-[8px] print:p-0.5"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent>
                                        {paymentTypes.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.cash} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.debit} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.credit} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.global} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.bac} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.general} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.cheques} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50 print:text-[8px] print:p-0.5" /></TableCell>
                        </TableRow>
                        ))}
                        {isDataLoaded && transactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={16} className="text-center text-muted-foreground p-4 border border-black">
                                    No se encontraron transacciones para la fecha seleccionada.
                                </TableCell>
                            </TableRow>
                        )}
                        {/* Totals Row */}
                        <TableRow className="font-bold">
                            <TableCell colSpan={9} className="text-right p-1 border border-black print:text-[8px] print:p-0.5">TOTAL</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.cash)}</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.debit)}</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.credit)}</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.global)}</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.bac)}</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.general)}</TableCell>
                            <TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.cheques)}</TableCell>
                        </TableRow>
                    </TableBody>
                    </Table>
                </div>
                <Button size="sm" variant="outline" onClick={addTransactionRow} className="mt-2 print-hide"><PlusCircle className="mr-2 h-4 w-4" />Añadir Fila Manual</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {/* Cash Breakdown */}
                <div className="md:col-span-2 space-y-4">
                    <h3 className="font-bold text-center print:text-sm">DESGLOSE DE EFECTIVO</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Table className="text-xs border-collapse border border-black">
                            <TableHeader><TableRow><TableHead className="border border-black p-1 font-bold print:text-[8px] print:p-0.5">Cant.</TableHead><TableHead className="border border-black p-1 font-bold print:text-[8px] print:p-0.5">Billetes</TableHead><TableHead className="border border-black p-1 font-bold print:text-[8px] print:p-0.5">Monto</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.keys(billQuantities).map(bill => (
                                    <TableRow key={bill}>
                                        <TableCell className="border border-black p-0"><Input type="number" onChange={e => handleCashChange('bill', bill, e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 print:text-[8px] print:p-0.5" /></TableCell>
                                        <TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(parseFloat(bill))}</TableCell>
                                        <TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(parseFloat(bill) * (billQuantities[bill] || 0))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell colSpan={2} className="text-right p-1 border border-black print:text-[8px] print:p-0.5">TOTAL</TableCell><TableCell className="p-1 border border-black text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(cashBreakdownTotals.billTotal)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                        <Table className="text-xs border-collapse border border-black">
                            <TableHeader><TableRow><TableHead className="border border-black p-1 font-bold print:text-[8px] print:p-0.5">Cant.</TableHead><TableHead className="border border-black p-1 font-bold print:text-[8px] print:p-0.5">Monedas</TableHead><TableHead className="border border-black p-1 font-bold print:text-[8px] print:p-0.5">Monto</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.keys(coinQuantities).map(coin => (
                                    <TableRow key={coin}>
                                        <TableCell className="border border-black p-0"><Input type="number" onChange={e => handleCashChange('coin', coin, e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 print:text-[8px] print:p-0.5" /></TableCell>
                                        <TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(parseFloat(coin))}</TableCell>
                                        <TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(parseFloat(coin) * (coinQuantities[coin] || 0))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell colSpan={2} className="text-right p-1 border border-black print:text-[8px] print:p-0.5">TOTAL</TableCell><TableCell className="p-1 border border-black text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(cashBreakdownTotals.coinTotal)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div className="text-right font-bold print:text-sm">TOTAL BILLETES Y MONEDAS: {currencyFormatter.format(cashBreakdownTotals.total)}</div>
                </div>

                {/* Totals and Expenses */}
                <div className="space-y-4">
                    <Table className="text-xs border-collapse border border-black">
                        <TableHeader><TableRow><TableHead colSpan={2} className="text-center font-bold p-1 border border-black print:text-sm">Totales</TableHead></TableRow></TableHeader>
                        <TableBody>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Total tarjetas CRÉDITO</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.credit)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Total tarjetas DÉBITO</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.debit)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">GLOBAL</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.global)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">BAC</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.bac)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">GENERAL</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.general)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Cheques</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(transactionTotals.cheques)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Total Efectivo</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(cashBreakdownTotals.total)}</TableCell></TableRow>
                            <TableRow className="font-bold"><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Total Facturado</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(grandTotals.totalFacturado)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <Table className="text-xs border-collapse border border-black">
                        <TableHeader><TableRow><TableHead colSpan={3} className="text-center font-bold p-1 border border-black print:text-sm">GASTOS DEL DIA</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {expenses.map((expense, index) => (
                                <TableRow key={index}>
                                    <TableCell className="border border-black p-0"><Input placeholder="Descripción" value={expense.description} onChange={e => handleExpenseChange(index, 'description', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 print:text-[8px] print:p-0.5" /></TableCell>
                                    <TableCell className="border border-black p-0 w-28"><Input type="number" value={expense.amount || ''} onChange={e => handleExpenseChange(index, 'amount', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 text-right print:text-[8px] print:p-0.5" /></TableCell>
                                    <TableCell className="p-0.5 border-black border w-8 text-center print-hide"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExpenseRow(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}
                            <TableRow><TableCell colSpan={3} className="p-1 print-hide"><Button size="sm" variant="outline" onClick={addExpenseRow}><PlusCircle className="mr-2 h-4 w-4"/>Añadir Gasto</Button></TableCell></TableRow>
                            <TableRow className="font-bold"><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Total de Gastos</TableCell><TableCell colSpan={2} className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(totalExpenses)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <Table className="text-xs border-collapse border border-black">
                        <TableBody>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">TOTAL EFECTIVO MENOS GASTOS</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(grandTotals.totalEfectivoMenosGastos)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Total / Deposito</TableCell><TableCell className="border border-black p-0 w-28"><Input type="number" onChange={e => setTotalDeposit(parseFloat(e.target.value) || 0)} className="w-full h-full border-none rounded-none text-xs p-1 text-right print:text-[8px] print:p-0.5" /></TableCell></TableRow>
                            <TableRow className={cn("font-bold", grandTotals.diferencia !== 0 ? "bg-red-200" : "bg-green-200")}><TableCell className="border border-black p-1 print:text-[8px] print:p-0.5">Diferencia</TableCell><TableCell className="border border-black p-1 text-right print:text-[8px] print:p-0.5">{currencyFormatter.format(grandTotals.diferencia)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
