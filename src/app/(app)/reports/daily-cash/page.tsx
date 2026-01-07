
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
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Contract } from '@/lib/types';


interface Transaction {
  id: number;
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

  // Fetch contracts based on selected date
  useEffect(() => {
    if (!db || !reportDate || role !== 'Administrador') return;

    const fetchContracts = async () => {
      setIsLoading(true);
      const startOfReportDay = startOfDay(reportDate);
      const endOfReportDay = endOfDay(reportDate);
      
      const contractsRef = collection(db, 'contracts');
      const q = query(
        contractsRef,
        where('createdAt', '>=', Timestamp.fromDate(startOfReportDay)),
        where('createdAt', '<=', Timestamp.fromDate(endOfReportDay))
      );

      try {
        const querySnapshot = await getDocs(q);
        const fetchedContracts = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Contract))
            .filter(contract => contract.status !== 'expired'); // Filter out annulled contracts here
        
        const newTransactions = fetchedContracts.map((contract, index) => {
            let details: any = null;
            let studentIdNumber = '';
            let studentPhone1 = '';
            let downPayment = 0;

            if (contract.type === 'Curso Auto' || contract.type === 'Curso Moto' || contract.type === 'Curso Mixto' || contract.type === 'Curso Solo Practica') {
                details = contract.autoMotoDetails;
            } else if (contract.type === 'Curso Deluxe') {
                details = contract.deluxeDetails;
            } else if (contract.type === 'Ampliaciones') {
                details = contract.ampliacionesDetails;
            }

            studentIdNumber = details?.studentIdNumber || '';
            studentPhone1 = details?.studentPhone1 || '';
            downPayment = details?.downPayment || 0;

            return {
                id: index + 1,
                invoice: '', // Manual field
                contrato: String(contract.folioNumber || ''),
                cedula: studentIdNumber,
                clientName: contract.clientName || '',
                phone: studentPhone1,
                service: contract.type || '',
                amount: downPayment,
                paymentType: '', // User will select this
                cash: 0,
                debit: 0,
                credit: 0,
                global: 0,
                bac: 0,
                general: 0,
                cheques: 0,
            };
        });
        
        setTransactions(newTransactions);
        setIsDataLoaded(true);
      } catch (error) {
        console.error("Error fetching contracts for report:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContracts();
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

    // Si se cambia el tipo de pago o el monto, recalcular las columnas de pago
    if (field === 'paymentType' || field === 'amount') {
        // Reset all payment columns
        newTransaction.cash = 0;
        newTransaction.debit = 0;
        newTransaction.credit = 0;
        newTransaction.global = 0;
        newTransaction.bac = 0;
        newTransaction.general = 0;
        newTransaction.cheques = 0;

        // Set the correct payment column based on paymentType
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
      { id: transactions.length + 1, invoice: '', contrato: '', cedula: '', clientName: '', phone: '', service: '', amount: 0, paymentType: '', cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0 },
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


  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-styles-report';
    style.innerHTML = `@page { size: landscape; margin: 0.5in; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print-hide { display: none !important; }`;
    document.head.appendChild(style);

    return () => {
      const styleTag = document.getElementById('print-styles-report');
      if (styleTag) {
        document.head.removeChild(styleTag);
      }
    };
  }, []);


  if (role && role !== 'Administrador') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
        <h3 className="mt-4 text-lg font-semibold text-foreground">Acceso Restringido</h3>
        <p className="mt-2 text-sm text-muted-foreground">No tienes permiso para ver esta sección.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Volver al Panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-background p-4 rounded-lg">
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

      <div className="p-2 bg-yellow-300 text-center font-bold text-sm">
        {format(reportDate, "EEEE d 'DE' LLLL 'DE' yyyy", { locale: es }).toUpperCase()}
      </div>

       {isLoading && (
         <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando contratos del día...</p>
         </div>
       )}

      {/* Main Transactions Table */}
      {!isLoading && (
        <>
            <div className="overflow-x-auto">
                <Table className="min-w-full text-xs border-collapse border border-black">
                <TableHeader>
                    <TableRow>
                    {['#', 'FACTURA', 'Contrato', 'Cédula', 'Nombre del cliente', 'Teléfono', 'Servicio', 'Monto', 'Tipo de Pago', 'Efectivo', 'T.Débito', 'T.Crédito', 'GLOBAL', 'BAC', 'GENERAL', 'Cheques'].map(header => (
                        <TableHead key={header} className="border border-black p-1 text-center font-bold bg-gray-100">{header}</TableHead>
                    ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transactions.map((transaction, index) => (
                    <TableRow key={transaction.id}>
                        <TableCell className="border border-black p-0.5 text-center">{index + 1}</TableCell>
                        <TableCell className="border border-black p-0"><Input type="text" value={transaction.invoice} onChange={e => handleTransactionChange(index, 'invoice', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="text" value={transaction.contrato} onChange={e => handleTransactionChange(index, 'contrato', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="text" value={transaction.cedula} onChange={e => handleTransactionChange(index, 'cedula', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="text" value={transaction.clientName} onChange={e => handleTransactionChange(index, 'clientName', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="text" value={transaction.phone} onChange={e => handleTransactionChange(index, 'phone', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="text" value={transaction.service} onChange={e => handleTransactionChange(index, 'service', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" value={transaction.amount} onChange={e => handleTransactionChange(index, 'amount', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                        <TableCell className="border border-black p-0">
                            <Select value={transaction.paymentType} onValueChange={value => handleTransactionChange(index, 'paymentType', value)}>
                                <SelectTrigger className="w-full h-full border-none rounded-none text-xs p-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {paymentTypes.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.cash} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.debit} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.credit} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.global} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.bac} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.general} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                        <TableCell className="border border-black p-0"><Input type="number" readOnly value={transaction.cheques} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/50" /></TableCell>
                    </TableRow>
                    ))}
                    {isDataLoaded && transactions.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={16} className="text-center text-muted-foreground p-4 border border-black">
                                No se encontraron contratos para la fecha seleccionada.
                            </TableCell>
                        </TableRow>
                    )}
                    {/* Totals Row */}
                    <TableRow className="bg-yellow-200 font-bold">
                        <TableCell colSpan={9} className="text-right p-1 border border-black">TOTAL</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.cash)}</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.debit)}</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.credit)}</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.global)}</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.bac)}</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.general)}</TableCell>
                        <TableCell className="border border-black p-1">{currencyFormatter.format(transactionTotals.cheques)}</TableCell>
                    </TableRow>
                </TableBody>
                </Table>
            </div>
            <Button size="sm" variant="outline" onClick={addTransactionRow} className="mt-2 print-hide"><PlusCircle className="mr-2 h-4 w-4" />Añadir Fila Manual</Button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {/* Cash Breakdown */}
                <div className="md:col-span-2 space-y-4">
                    <h3 className="font-bold text-center">DESGLOSE DE EFECTIVO</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Table className="text-xs border-collapse border border-black">
                            <TableHeader><TableRow><TableHead className="border border-black p-1 font-bold">Cant.</TableHead><TableHead className="border border-black p-1 font-bold">Billetes</TableHead><TableHead className="border border-black p-1 font-bold">Monto</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.keys(billQuantities).map(bill => (
                                    <TableRow key={bill}>
                                        <TableCell className="border border-black p-0"><Input type="number" onChange={e => handleCashChange('bill', bill, e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(bill))}</TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(bill) * (billQuantities[bill] || 0))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold bg-gray-100"><TableCell colSpan={2} className="text-right p-1 border border-black">TOTAL</TableCell><TableCell className="p-1 border border-black text-right">{currencyFormatter.format(cashBreakdownTotals.billTotal)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                        <Table className="text-xs border-collapse border border-black">
                            <TableHeader><TableRow><TableHead className="border border-black p-1 font-bold">Cant.</TableHead><TableHead className="border border-black p-1 font-bold">Monedas</TableHead><TableHead className="border border-black p-1 font-bold">Monto</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.keys(coinQuantities).map(coin => (
                                    <TableRow key={coin}>
                                        <TableCell className="border border-black p-0"><Input type="number" onChange={e => handleCashChange('coin', coin, e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(coin))}</TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(coin) * (coinQuantities[coin] || 0))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold bg-gray-100"><TableCell colSpan={2} className="text-right p-1 border border-black">TOTAL</TableCell><TableCell className="p-1 border border-black text-right">{currencyFormatter.format(cashBreakdownTotals.coinTotal)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div className="text-right font-bold">TOTAL BILLETES Y MONEDAS: {currencyFormatter.format(cashBreakdownTotals.total)}</div>
                </div>

                {/* Totals and Expenses */}
                <div className="space-y-4">
                    <Table className="text-xs border-collapse border border-black">
                        <TableHeader><TableRow><TableHead colSpan={2} className="text-center font-bold p-1 bg-gray-100 border border-black">Totales</TableHead></TableRow></TableHeader>
                        <TableBody>
                            <TableRow><TableCell className="border border-black p-1">Total tarjetas CRÉDITO</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.credit)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Total tarjetas DÉBITO</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.debit)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">GLOBAL</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.global)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">BAC</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.bac)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">GENERAL</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.general)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Cheques</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.cheques)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Total Efectivo</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(cashBreakdownTotals.total)}</TableCell></TableRow>
                            <TableRow className="font-bold bg-yellow-200"><TableCell className="border border-black p-1">Total Facturado</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(grandTotals.totalFacturado)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <Table className="text-xs border-collapse border border-black">
                        <TableHeader><TableRow><TableHead colSpan={3} className="text-center font-bold p-1 bg-gray-100 border border-black">GASTOS DEL DIA</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {expenses.map((expense, index) => (
                                <TableRow key={index}>
                                    <TableCell className="border border-black p-0"><Input placeholder="Descripción" value={expense.description} onChange={e => handleExpenseChange(index, 'description', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                                    <TableCell className="border border-black p-0 w-28"><Input type="number" value={expense.amount || ''} onChange={e => handleExpenseChange(index, 'amount', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 text-right" /></TableCell>
                                    <TableCell className="p-0.5 border-black border w-8 text-center print-hide"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExpenseRow(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}
                            <TableRow><TableCell colSpan={3} className="p-1 print-hide"><Button size="sm" variant="outline" onClick={addExpenseRow}><PlusCircle className="mr-2 h-4 w-4"/>Añadir Gasto</Button></TableCell></TableRow>
                            <TableRow className="font-bold bg-gray-100"><TableCell className="border border-black p-1">Total de Gastos</TableCell><TableCell colSpan={2} className="border border-black p-1 text-right">{currencyFormatter.format(totalExpenses)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <Table className="text-xs border-collapse border border-black">
                        <TableBody>
                            <TableRow><TableCell className="border border-black p-1">TOTAL EFECTIVO MENOS GASTOS</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(grandTotals.totalEfectivoMenosGastos)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Total / Deposito</TableCell><TableCell className="border border-black p-0 w-28"><Input type="number" onChange={e => setTotalDeposit(parseFloat(e.target.value) || 0)} className="w-full h-full border-none rounded-none text-xs p-1 text-right" /></TableCell></TableRow>
                            <TableRow className={cn("font-bold", grandTotals.diferencia !== 0 ? 'bg-red-200' : 'bg-green-200')}><TableCell className="border border-black p-1">Diferencia</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(grandTotals.diferencia)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
      )}
    </div>
  );
}
