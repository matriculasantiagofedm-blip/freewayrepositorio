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
import { Trash2, Printer, CalendarIcon, Loader2, AlertCircle, User } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');

  useEffect(() => {
    if (!db || isUserLoading || isRoleLoading || !user || !role) {
        return;
    };

    const fetchDailyData = async () => {
      setIsLoading(true);
      setError(null);
      setIsDataLoaded(false);
      
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
  const removeExpenseRow = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  }
  
  const handlePrint = () => {
    window.print();
  }

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
      <style jsx global>{`
        @media print {
            @page { 
                size: letter landscape; 
                margin: 5mm; 
            }
            header, footer, nav, async, .print-hide { 
                display: none !important; 
            }
            body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
                background-color: white !important; 
                margin: 0 !important;
                padding: 0 !important;
            }
            .print-container {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            table {
                border-collapse: collapse !important;
                width: 100% !important;
            }
            th, td {
                border: 1px solid black !important;
                color: black !important;
            }
            .bg-muted\/50 {
                background-color: #f1f5f9 !important;
            }
            .bg-slate-800 {
                background-color: #1e293b !important;
                color: white !important;
            }
            input {
                border: none !important;
                background: transparent !important;
                padding: 0 !important;
            }
        }
      `}</style>
      
      <div className="flex justify-between items-center print-hide">
        <div className='flex flex-col'>
            <h1 className="text-2xl font-bold font-headline">Reporte de Caja Diario</h1>
            <p className="text-xs text-muted-foreground">Ingresos registrados en el sistema para la fecha seleccionada.</p>
        </div>
        <div className="flex items-center gap-2">
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Vendedor..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los Vendedores</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Ventas">Ventas</SelectItem>
                    <SelectItem value="Ventas Externas">Ventas Externas</SelectItem>
                    <SelectItem value="Web Publica">Inscripción Web</SelectItem>
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
            <Button size="sm" onClick={handlePrint} className="bg-primary hover:bg-primary/90">
                <Printer className="mr-2 h-4 w-4" /> 
                Imprimir Reporte
            </Button>
        </div>
      </div>

      <div className="print-container space-y-4">
        <div className="p-2 text-center font-bold text-lg border-b-2 border-black mb-4 uppercase">
            CONTROL DE CAJA - {format(reportDate, "EEEE d 'DE' LLLL 'DE' yyyy", { locale: es })}
        </div>

        {!isLoading && (
            <div className="space-y-4 animate-in fade-in-50 duration-500">
                <div className="overflow-x-auto border border-black rounded-sm">
                    <Table className="min-w-full text-[10px] border-collapse">
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">#</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[60px]">Contrato</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[70px]">Cédula</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[120px]">Nombre del cliente</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[120px]">Servicio</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">Vendedor</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black">Monto</TableHead>
                        <TableHead className="border-r border-black p-1 text-center font-bold text-black min-w-[80px]">Tipo Pago</TableHead>
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
                        <TableRow key={transaction.id} className="hover:bg-transparent">
                            <TableCell className="border-r border-black p-1 text-center">{index + 1}</TableCell>
                            <TableCell className="border-r border-black p-1 font-bold">{transaction.contrato}</TableCell>
                            <TableCell className="border-r border-black p-1">{transaction.cedula}</TableCell>
                            <TableCell className="border-r border-black p-1 truncate max-w-[150px] uppercase">{transaction.clientName}</TableCell>
                            <TableCell className="border-r border-black p-1 uppercase">{transaction.service}</TableCell>
                            <TableCell className="border-r border-black p-1 text-[8px] uppercase">{transaction.createdBy}</TableCell>
                            <TableCell className="border-r border-black p-0">
                                <Input 
                                    type="number" 
                                    value={transaction.amount} 
                                    onChange={e => handleTransactionChange(index, 'amount', e.target.value)} 
                                    disabled={!isAdmin}
                                    className="w-full h-7 border-none rounded-none text-[10px] p-1 text-center focus-visible:ring-0 disabled:opacity-100" 
                                />
                            </TableCell>
                            <TableCell className="border-r border-black p-0 text-center">
                                {isAdmin ? (
                                    <Select 
                                        value={transaction.paymentType} 
                                        onValueChange={v => handleTransactionChange(index, 'paymentType', v)}
                                    >
                                        <SelectTrigger className="h-7 w-full border-none rounded-none text-[9px] uppercase px-1 focus:ring-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentTypes.map(pt => (
                                                <SelectItem key={pt.value} value={pt.value} className="text-[9px]">{pt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <span className="text-[9px] uppercase px-1">{paymentTypes.find(p => p.value === transaction.paymentType)?.label || transaction.paymentType}</span>
                                )}
                            </TableCell>
                            <TableCell className="border-r border-black p-1 text-right bg-muted/20">{transaction.cash > 0 ? transaction.cash.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right bg-muted/20">{transaction.debit > 0 ? transaction.debit.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right bg-muted/20">{transaction.credit > 0 ? transaction.credit.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right bg-muted/20">{transaction.bac > 0 ? transaction.bac.toFixed(2) : '-'}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right bg-muted/20">{transaction.general > 0 ? transaction.general.toFixed(2) : '-'}</TableCell>
                            <TableCell className="p-1 text-right bg-muted/20">{transaction.cheques > 0 ? transaction.cheques.toFixed(2) : '-'}</TableCell>
                        </TableRow>
                        ))}
                        {isDataLoaded && filteredTransactions.length === 0 && (
                            <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground p-8 italic">No hay movimientos registrados para este día.</TableCell></TableRow>
                        )}
                        <TableRow className="font-bold bg-slate-100 hover:bg-slate-100 border-t border-black">
                            <TableCell colSpan={8} className="text-right p-1 pr-4 border-r border-black uppercase font-bold">TOTALES POR CATEGORÍA:</TableCell>
                            <TableCell className="border-r border-black p-1 text-right">{transactionTotals.cash.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right">{transactionTotals.debit.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right">{transactionTotals.credit.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right">{transactionTotals.bac.toFixed(2)}</TableCell>
                            <TableCell className="border-r border-black p-1 text-right">{transactionTotals.general.toFixed(2)}</TableCell>
                            <TableCell className="p-1 text-right">{transactionTotals.cheques.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableBody>
                    </Table>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="font-bold text-center text-xs uppercase tracking-wider bg-slate-800 text-white p-1 rounded-sm">Desglose de Efectivo Físico</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Table className="text-[10px] border border-black">
                                <TableHeader className="bg-slate-50"><TableRow><TableHead className="border-r border-black p-1 font-bold text-black h-7">Cant.</TableHead><TableHead className="border-r border-black p-1 font-bold text-black h-7">Billetes</TableHead><TableHead className="p-1 font-bold text-black h-7">Monto</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {Object.keys(billQuantities).map(bill => (
                                        <TableRow key={bill} className="h-7 hover:bg-transparent">
                                            <TableCell className="border-r border-black p-0"><Input type="number" value={billQuantities[bill] || ''} onChange={e => handleCashChange('bill', bill, e.target.value)} className="w-full h-7 border-none rounded-none text-[10px] p-1 text-center" /></TableCell>
                                            <TableCell className="border-r border-black p-1 text-right">{currencyFormatter.format(parseFloat(bill))}</TableCell>
                                            <TableCell className="p-1 text-right font-semibold">{currencyFormatter.format(parseFloat(bill) * (billQuantities[bill] || 0))}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-slate-50"><TableCell colSpan={2} className="text-right p-1 border-r border-black uppercase">SUB-TOTAL BILLETES</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(cashBreakdownTotals.billTotal)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                            <Table className="text-[10px] border border-black">
                                <TableHeader className="bg-slate-50"><TableRow><TableHead className="border-r border-black p-1 font-bold text-black h-7">Cant.</TableHead><TableHead className="border-r border-black p-1 font-bold text-black h-7">Monedas</TableHead><TableHead className="p-1 font-bold text-black h-7">Monto</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {Object.keys(coinQuantities).map(coin => (
                                        <TableRow key={coin} className="h-7 hover:bg-transparent">
                                            <TableCell className="border-r border-black p-0"><Input type="number" value={coinQuantities[coin] || ''} onChange={e => handleCashChange('coin', coin, e.target.value)} className="w-full h-7 border-none rounded-none text-[10px] p-1 text-center" /></TableCell>
                                            <TableCell className="border-r border-black p-1 text-right">{currencyFormatter.format(parseFloat(coin))}</TableCell>
                                            <TableCell className="p-1 text-right font-semibold">{currencyFormatter.format(parseFloat(coin) * (coinQuantities[coin] || 0))}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-slate-50"><TableCell colSpan={2} className="text-right p-1 border-r border-black uppercase">SUB-TOTAL MONEDAS</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(cashBreakdownTotals.coinTotal)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <div className="text-right font-bold text-sm bg-slate-100 p-2 rounded border border-black uppercase">TOTAL BILLETES Y MONEDAS: {currencyFormatter.format(cashBreakdownTotals.total)}</div>
                    </div>

                    <div className="space-y-4">
                        <Table className="text-[10px] border border-black">
                            <TableHeader className="bg-slate-800 text-white"><TableRow><TableHead colSpan={2} className="text-center font-bold p-1 h-7 uppercase text-white">Consolidado Final</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow className="hover:bg-transparent"><TableCell className="border-r border-black p-1">TOTAL CRÉDITO</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(transactionTotals.credit)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent"><TableCell className="border-r border-black p-1">TOTAL DÉBITO</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(transactionTotals.debit)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent"><TableCell className="border-r border-black p-1 font-bold">BAC</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(transactionTotals.bac)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent"><TableCell className="border-r border-black p-1 font-bold">GENERAL</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(transactionTotals.general)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent"><TableCell className="border-r border-black p-1 font-bold">CHEQUES</TableCell><TableCell className="p-1 text-right">{currencyFormatter.format(transactionTotals.cheques)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent bg-slate-50"><TableCell className="border-r border-black p-1 font-bold uppercase">TOTAL EFECTIVO (SISTEMA)</TableCell><TableCell className="p-1 text-right font-black">{currencyFormatter.format(transactionTotals.cash)}</TableCell></TableRow>
                                <TableRow className="font-bold bg-slate-200 border-t border-black"><TableCell className="border-r border-black p-1 uppercase">TOTAL FACTURADO DEL DÍA</TableCell><TableCell className="p-1 text-right text-sm">{currencyFormatter.format(grandTotals.totalFacturado)}</TableCell></TableRow>
                            </TableBody>
                        </Table>

                        <Table className="text-[10px] border border-black">
                            <TableHeader className="bg-red-800 text-white"><TableRow><TableHead colSpan={3} className="text-center font-bold p-1 h-7 uppercase text-white">Gastos Menores</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {expenses.map((expense, index) => (
                                    <TableRow key={index} className="hover:bg-transparent">
                                        <TableCell className="border-r border-black p-0"><Input placeholder="Descripción..." value={expense.description} onChange={e => handleExpenseChange(index, 'description', e.target.value)} className="w-full h-7 border-none rounded-none text-[10px] p-1" /></TableCell>
                                        <TableCell className="border-r border-black p-0 w-20"><Input type="number" value={expense.amount || ''} onChange={e => handleExpenseChange(index, 'amount', e.target.value)} className="w-full h-7 border-none rounded-none text-[10px] p-1 text-right" /></TableCell>
                                        <TableCell className="p-0 border-black border-l w-7 text-center print-hide">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeExpenseRow(index)}><Trash2 className="h-3 w-3"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="hover:bg-transparent print-hide"><TableCell colSpan={3} className="p-1"><Button variant="outline" className="h-6 text-[9px] w-full" onClick={addExpenseRow}>+ Añadir Gasto</Button></TableCell></TableRow>
                                <TableRow className="font-bold bg-red-50 border-t border-black"><TableCell className="border-r border-black p-1 uppercase">TOTAL GASTOS</TableCell><TableCell colSpan={2} className="p-1 text-right text-red-700">{currencyFormatter.format(totalExpenses)}</TableCell></TableRow>
                            </TableBody>
                        </Table>

                        <Table className="text-[10px] border border-black">
                            <TableBody>
                                <TableRow className="hover:bg-transparent bg-slate-50"><TableCell className="border-r border-black p-1 font-bold uppercase">EFECTIVO NETO (SISTEMA)</TableCell><TableCell className="p-1 text-right font-black">{currencyFormatter.format(grandTotals.totalEfectivoMenosGastos)}</TableCell></TableRow>
                                <TableRow className="hover:bg-transparent">
                                    <TableCell className="border-r border-black p-1 uppercase font-bold">DEPÓSITO REALIZADO (CONTADO)</TableCell>
                                    <TableCell className="p-1 text-right font-bold bg-muted/30">
                                        {currencyFormatter.format(cashBreakdownTotals.total)}
                                    </TableCell>
                                </TableRow>
                                <TableRow className={cn("font-bold border-t border-black", grandTotals.diferencia < 0 ? "bg-red-100 text-red-900" : grandTotals.diferencia > 0 ? "bg-green-100 text-green-900" : "bg-green-50 text-green-800")}><TableCell className="border-r border-black p-1 uppercase">DIFERENCIA / FALTANTE</TableCell><TableCell className="p-1 text-right text-sm">{currencyFormatter.format(grandTotals.diferencia)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}