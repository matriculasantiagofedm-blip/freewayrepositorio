'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Printer } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Transaction {
  id: number;
  invoice: string;
  cedula: string;
  clientName: string;
  phone: string;
  service: string;
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

export default function DailyCashReportPage() {
  const { role } = useCurrentRole();
  const [reportDate, setReportDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 1, invoice: '', cedula: '', clientName: '', phone: '', service: '', cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0 },
  ]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [totalDeposit, setTotalDeposit] = useState(0);

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
    const numericFields = ['cash', 'debit', 'credit', 'global', 'bac', 'general', 'cheques'];
    if (numericFields.includes(field)) {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setTransactions(updated);
  };

  const addTransactionRow = () => {
    setTransactions([
      ...transactions,
      { id: transactions.length + 1, invoice: '', cedula: '', clientName: '', phone: '', service: '', cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0 },
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
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
      </div>

      <div className="p-2 bg-yellow-300 text-center font-bold text-sm">
        {format(reportDate, "EEEE d 'DE' LLLL 'DE' yyyy", { locale: es }).toUpperCase()}
      </div>

      {/* Main Transactions Table */}
      <div className="overflow-x-auto">
        <Table className="min-w-full text-xs border-collapse border border-black">
          <TableHeader>
            <TableRow>
              {['#', 'FACTURA', 'Cédula', 'Nombre del cliente', 'Teléfono', 'Servicio', 'Efectivo', 'T.Débito', 'T.Crédito', 'GLOBAL', 'BAC', 'GENERAL', 'Cheques'].map(header => (
                <TableHead key={header} className="border border-black p-1 text-center font-bold bg-gray-100">{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => (
              <TableRow key={transaction.id}>
                <TableCell className="border border-black p-0.5 text-center">{index + 1}</TableCell>
                {(Object.keys(transaction) as Array<keyof Transaction>).filter(k => k !== 'id').map(key => (
                  <TableCell key={key} className="border border-black p-0">
                    <Input
                      type={typeof transaction[key] === 'number' ? 'number' : 'text'}
                      value={transaction[key]}
                      onChange={e => handleTransactionChange(index, key, e.target.value)}
                      className="w-full h-full border-none rounded-none text-xs p-1"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {/* Totals Row */}
            <TableRow className="bg-yellow-200 font-bold">
                <TableCell colSpan={6} className="text-right p-1 border border-black">TOTAL</TableCell>
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
        <Button size="sm" variant="outline" onClick={addTransactionRow} className="mt-2 print-hide"><PlusCircle className="mr-2 h-4 w-4" />Añadir Fila</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    </div>
  );
}
