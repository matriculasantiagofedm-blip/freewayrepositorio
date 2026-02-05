
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
import { PlusCircle, Trash2, Printer, CalendarIcon, Loader2 } from 'lucide-react';
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
import { collection, query, where, getDocs, Timestamp, type DocumentData } from 'firebase/firestore';
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
  const { role, isLoading: isRoleLoading } = useCurrentRole();
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [billQuantities, setBillQuantities] = useState(initialBillQuantities);
  const [coinQuantities, setCoinQuantities] = useState(initialCoinQuantities);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');

  useEffect(() => {
    if (!db || !user || !role) {
        setIsLoading(false);
        return;
    };

    const fetchDailyData = async () => {
      setIsLoading(true);
      setIsDataLoaded(false);
      
      const startOfReportDay = startOfDay(reportDate);
      const endOfReportDay = endOfDay(reportDate);
      const fetchedTransactions: Transaction[] = [];

      try {
        const isAdmin = role === 'Administrador';

        // Simplified query creator - only filters by date range
        const createDateQuery = (collName: string) => {
            const baseRef = collection(db, collName);
            const dateField = (collName === 'contracts') ? 'createdAt' : 'paymentDate';
            
            return query(
                baseRef, 
                where(dateField, '>=', Timestamp.fromDate(startOfReportDay)), 
                where(dateField, '<=', Timestamp.fromDate(endOfReportDay))
            );
        };
        
        const contractsQuery = createDateQuery('contracts');
        const cancellationQuery = createDateQuery('cancellation_payments');
        const updateQuery = createDateQuery('update_payments');
        const bookSaleQuery = createDateQuery('book_sale_payments');

        const [
            contractsSnapshot,
            cancellationSnapshot,
            updateSnapshot,
            bookSaleSnapshot
        ] = await Promise.all([
            getDocs(contractsQuery),
            getDocs(cancellationQuery),
            getDocs(updateQuery),
            getDocs(bookSaleQuery)
        ]);

        // Helper to filter docs by user role on the client
        const docsToProcess = (snapshot: any) => {
            if (isAdmin) return snapshot.docs;
            return snapshot.docs.filter((doc: any) => doc.data().createdBy === role);
        }

        docsToProcess(contractsSnapshot).map((doc: any) => ({ id: doc.id, ...doc.data() } as Contract)).filter((contract: Contract) => contract.status !== 'expired').forEach((contract: Contract) => {
            let paymentType: string = 'cash';
            let amount: number = 0;
            let paymentColumns: any = { cash: 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0 };
            
            let studentIdNumber = contract.studentIdNumber || '';

            if (contract.type === 'Curso Deluxe') {
                paymentType = contract.deluxeDetails?.paymentType || 'cash';
                amount = 15.00; // Matrícula for Deluxe
                studentIdNumber = contract.deluxeDetails?.studentIdNumber || studentIdNumber;
            } else if (contract.autoMotoDetails?.downPayment && contract.autoMotoDetails.downPayment > 0) {
                 paymentType = contract.autoMotoDetails?.paymentType || 'cash';
                 amount = contract.autoMotoDetails?.downPayment;
                 studentIdNumber = contract.autoMotoDetails?.studentIdNumber || studentIdNumber;
            } else if (contract.ampliacionesDetails?.downPayment && contract.ampliacionesDetails.downPayment > 0) {
                paymentType = contract.ampliacionesDetails?.paymentType || 'cash';
                amount = contract.ampliacionesDetails?.downPayment;
                studentIdNumber = contract.ampliacionesDetails?.studentIdNumber || studentIdNumber;
            }

            if(amount > 0 && Object.keys(paymentColumns).includes(paymentType)) {
                paymentColumns[paymentType as keyof typeof paymentColumns] = amount;
            }
            
            if(amount > 0) {
                 fetchedTransactions.push({
                    id: contract.id,
                    contrato: String(contract.folioNumber || ''),
                    cedula: studentIdNumber,
                    clientName: contract.clientName || '',
                    service: contract.type === 'Curso Deluxe' ? 'Matrícula Deluxe' : `Abono Contrato ${contract.type}`,
                    amount: amount,
                    paymentType: paymentType,
                    createdBy: contract.createdBy,
                    ...paymentColumns,
                });
            }
        });

        docsToProcess(cancellationSnapshot).forEach((doc: any) => {
            const payment = doc.data() as Payment;
            fetchedTransactions.push({
                id: doc.id,
                contrato: String(payment.cancellationFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: 'Cancelación/Abono de Saldo',
                amount: payment.amount || 0,
                paymentType: 'cash', // Assuming cash, as it's not specified
                createdBy: payment.createdBy,
                cash: payment.amount || 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0,
            });
        });

        docsToProcess(updateSnapshot).forEach((doc: any) => {
            const payment = doc.data() as Payment;
            fetchedTransactions.push({
                id: doc.id,
                contrato: String(payment.updateFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: 'Actualización de Certificado',
                amount: payment.amount || 0,
                paymentType: 'cash', // Assuming cash
                createdBy: payment.createdBy,
                cash: payment.amount || 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0,
            });
        });

        docsToProcess(bookSaleSnapshot).forEach((doc: any) => {
            const payment = doc.data() as BookSalePayment;
            fetchedTransactions.push({
                id: doc.id,
                contrato: String(payment.bookSaleFolio || '').padStart(6, '0'),
                cedula: payment.studentIdNumber || '',
                clientName: payment.clientName || '',
                service: `Venta de Libro: ${payment.bookTitle}`,
                amount: payment.amount || 0,
                paymentType: 'cash', // Assuming cash
                createdBy: payment.createdBy,
                cash: payment.amount || 0, debit: 0, credit: 0, global: 0, bac: 0, general: 0, cheques: 0,
            });
        });

        setTransactions(fetchedTransactions);
        setExpenses(initialExpenses);
        setBillQuantities(initialBillQuantities);
        setCoinQuantities(initialCoinQuantities);
        setTotalDeposit(0);
        setIsDataLoaded(true);

      } catch (error: any) {
        console.error("Error fetching data for report:", error);
        toast({
          variant: "destructive",
          title: "Error al Cargar Datos",
          description: "No se pudieron obtener los datos para el reporte. Revisa la consola para más detalles.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyData();
  }, [db, reportDate, user, role, toast]);

  const filteredTransactions = useMemo(() => {
    if (role !== 'Administrador' || sellerFilter === 'all') {
      return transactions;
    }
    return transactions.filter(t => t.createdBy === sellerFilter);
  }, [transactions, sellerFilter, role]);

  const transactionTotals = useMemo(() => {
    return filteredTransactions.reduce(
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
    const diferencia = totalEfectivoMenosGastos - totalDeposit;
    return { totalFacturado, totalEfectivoMenosGastos, diferencia };
  }, [transactionTotals, totalExpenses, totalDeposit]);
  

  const handleTransactionChange = (index: number, field: keyof Transaction, value: any) => {
    const transactionId = filteredTransactions[index].id;
    const originalIndex = transactions.findIndex(t => t.id === transactionId);
    if (originalIndex === -1) return;

    const updated = [...transactions];
    let newTransaction = { ...updated[originalIndex] };
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
    updated[originalIndex] = newTransaction;
    setTransactions(updated);
};


  const addTransactionRow = () => {
    setTransactions([
      ...transactions,
      {
        id: `manual-${transactions.length + 1}`,
        contrato: '',
        cedula: '',
        clientName: '',
        service: '',
        amount: 0,
        paymentType: '',
        createdBy: role || undefined,
        cash: 0,
        debit: 0,
        credit: 0,
        global: 0,
        bac: 0,
        general: 0,
        cheques: 0,
      },
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
  
  if (isUserLoading || isRoleLoading) {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando reporte...</p>
        </div>
    );
  }

  if (!role || (role !== 'Administrador' && role !== 'Ventas' && role !== 'Ventas Externas')) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Acceso Restringido
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No tienes permiso para ver esta sección.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Volver al Panel</Link>
          </Button>
        </div>
      );
  }

  return (
    <div className="space-y-6 rounded-lg print:bg-white">
      <style jsx global>{`
        @media print {
            @page {
                size: landscape;
                margin: 0.25in;
            }
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background-color: white !important;
            }
        }
      `}</style>
      <div className="flex justify-between items-center print-hide">
        <h1 className="text-2xl font-bold font-headline">Reporte de Caja Diario</h1>
        <div className="flex items-center gap-2">
            {role === 'Administrador' && (
              <>
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filtrar por vendedor..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los Vendedores</SelectItem>
                        <SelectItem value="Administrador">Administrador</SelectItem>
                        <SelectItem value="Ventas">Ventas</SelectItem>
                        <SelectItem value="Ventas Externas">Ventas Externas</SelectItem>
                    </SelectContent>
                </Select>
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
              </>
            )}
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
        </div>
      </div>

      <div className="p-2 text-center font-bold text-xl print:text-base">
        {format(reportDate, "EEEE d 'DE' LLLL 'DE' yyyy", { locale: es }).toUpperCase()}
      </div>

       {(isLoading) && (
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
                          <TableHead className="border border-black p-1 text-center font-bold">#</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold min-w-[80px]">Contrato</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold min-w-[80px]">Cédula</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold min-w-[120px]">Nombre del cliente</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold min-w-[120px]">Servicio</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">Monto</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold min-w-[80px]">Tipo de Pago</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">Efectivo</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">T.Débito</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">T.Crédito</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">GLOBAL</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">BAC</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">GENERAL</TableHead>
                          <TableHead className="border border-black p-1 text-center font-bold">Cheques</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.map((transaction, index) => (
                        <TableRow key={transaction.id}>
                            <TableCell className="border border-black p-1 text-center">{index + 1}</TableCell>
                            <TableCell className="border border-black p-0"><Input type="text" value={transaction.contrato} onChange={e => handleTransactionChange(index, 'contrato', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="text" value={transaction.cedula} onChange={e => handleTransactionChange(index, 'cedula', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
                            <TableCell className="border border-black p-0"><Input type="text" value={transaction.clientName} onChange={e => handleTransactionChange(index, 'clientName', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 bg-muted/30" readOnly /></TableCell>
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
                        {isDataLoaded && filteredTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={14} className="text-center text-muted-foreground p-4 border border-black">
                                    No se encontraron transacciones para la fecha seleccionada.
                                </TableCell>
                            </TableRow>
                        )}
                        <TableRow className="font-bold">
                            <TableCell colSpan={7} className="text-right p-1 border border-black">TOTAL</TableCell>
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="md:col-span-2 space-y-4">
                    <h3 className="font-bold text-center">DESGLOSE DE EFECTIVO</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Table className="text-xs border-collapse border border-black">
                            <TableHeader><TableRow><TableHead className="border border-black p-1 font-bold">Cant.</TableHead><TableHead className="border border-black p-1 font-bold">Billetes</TableHead><TableHead className="border border-black p-1 font-bold">Monto</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.keys(billQuantities).map(bill => (
                                    <TableRow key={bill}>
                                        <TableCell className="border border-black p-0"><Input type="number" value={billQuantities[bill] || ''} onChange={e => handleCashChange('bill', bill, e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(bill))}</TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(bill) * (billQuantities[bill] || 0))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell colSpan={2} className="text-right p-1 border border-black">TOTAL</TableCell><TableCell className="p-1 border border-black text-right">{currencyFormatter.format(cashBreakdownTotals.billTotal)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                        <Table className="text-xs border-collapse border border-black">
                            <TableHeader><TableRow><TableHead className="border border-black p-1 font-bold">Cant.</TableHead><TableHead className="border border-black p-1 font-bold">Monedas</TableHead><TableHead className="border border-black p-1 font-bold">Monto</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.keys(coinQuantities).map(coin => (
                                    <TableRow key={coin}>
                                        <TableCell className="border border-black p-0"><Input type="number" value={coinQuantities[coin] || ''} onChange={e => handleCashChange('coin', coin, e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(coin))}</TableCell>
                                        <TableCell className="border border-black p-1 text-right">{currencyFormatter.format(parseFloat(coin) * (coinQuantities[coin] || 0))}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold"><TableCell colSpan={2} className="text-right p-1 border border-black">TOTAL</TableCell><TableCell className="p-1 border border-black text-right">{currencyFormatter.format(cashBreakdownTotals.coinTotal)}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div className="text-right font-bold print:text-lg">TOTAL BILLETES Y MONEDAS: {currencyFormatter.format(cashBreakdownTotals.total)}</div>
                </div>

                <div className="space-y-4">
                    <Table className="text-xs border-collapse border border-black">
                        <TableHeader><TableRow><TableHead colSpan={2} className="text-center font-bold p-1 border border-black">Totales</TableHead></TableRow></TableHeader>
                        <TableBody>
                            <TableRow><TableCell className="border border-black p-1">Total tarjetas CRÉDITO</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.credit)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Total tarjetas DÉBITO</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.debit)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">GLOBAL</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.global)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">BAC</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.bac)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">GENERAL</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.general)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Cheques</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.cheques)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Total Efectivo</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(transactionTotals.cash)}</TableCell></TableRow>
                            <TableRow className="font-bold"><TableCell className="border border-black p-1">Total Facturado</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(grandTotals.totalFacturado)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <Table className="text-xs border-collapse border border-black">
                        <TableHeader><TableRow><TableHead colSpan={3} className="text-center font-bold p-1 border border-black">GASTOS DEL DIA</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {expenses.map((expense, index) => (
                                <TableRow key={index}>
                                    <TableCell className="border border-black p-0"><Input placeholder="Descripción" value={expense.description} onChange={e => handleExpenseChange(index, 'description', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1" /></TableCell>
                                    <TableCell className="border border-black p-0 w-28"><Input type="number" value={expense.amount || ''} onChange={e => handleExpenseChange(index, 'amount', e.target.value)} className="w-full h-full border-none rounded-none text-xs p-1 text-right" /></TableCell>
                                    <TableCell className="p-0.5 border-black border w-8 text-center print-hide"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExpenseRow(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}
                            <TableRow><TableCell colSpan={3} className="p-1 print-hide"><Button size="sm" variant="outline" onClick={addExpenseRow}><PlusCircle className="mr-2 h-4 w-4"/>Añadir Gasto</Button></TableCell></TableRow>
                            <TableRow className="font-bold"><TableCell className="border border-black p-1">Total de Gastos</TableCell><TableCell colSpan={2} className="border border-black p-1 text-right">{currencyFormatter.format(totalExpenses)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                    <Table className="text-xs border-collapse border border-black">
                        <TableBody>
                            <TableRow><TableCell className="border border-black p-1">TOTAL EFECTIVO MENOS GASTOS</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(grandTotals.totalEfectivoMenosGastos)}</TableCell></TableRow>
                            <TableRow><TableCell className="border border-black p-1">Total / Deposito</TableCell><TableCell className="border border-black p-0 w-28"><Input type="number" value={totalDeposit || ''} onChange={e => setTotalDeposit(parseFloat(e.target.value) || 0)} className="w-full h-full border-none rounded-none text-xs p-1 text-right" /></TableCell></TableRow>
                            <TableRow className={cn("font-bold", grandTotals.diferencia !== 0 ? "bg-red-200" : "bg-green-200")}><TableCell className="border border-black p-1">Diferencia</TableCell><TableCell className="border border-black p-1 text-right">{currencyFormatter.format(grandTotals.diferencia)}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
