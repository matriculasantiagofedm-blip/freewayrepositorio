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

const paymentMethodOptions = [
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
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sellerFilter, setSellerFilter] = useState('all');

  useEffect(() => {
    if (!db || isUserLoading || isRoleLoading || !user || !role) {
        return;
    }

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
            let concept: string = '';
            let paymentColumns: any = { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, cheques: 0 };
            
            const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
            let studentId = details?.studentIdNumber || contract.studentIdNumber || '';

            if (contract.type === 'Curso Deluxe') {
                concept = 'Matrícula Deluxe';
                paymentType = contract.deluxeDetails?.paymentType || 'cash';
                amount = 15.00;
            } else {
                if (details) {
                    concept = `Abono ${contract.type}`;
                    paymentType = (details as any).paymentType || 'cash';
                    amount = details.downPayment || 0;
                }
            }

            if(amount > 0) {
                const pKey = paymentType && paymentColumns.hasOwnProperty(paymentType) ? paymentType : 'cash';
                paymentColumns[pKey] = amount;

                fetchedTransactions.push({
                    id: contract.id,
                    contrato: String(contract.folioNumber || '').padStart(6, '0'),
                    cedula: studentId,
                    clientName: contract.clientName || '',
                    service: concept,
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

        const timer = setTimeout(() => {
            setIsReady(true);
        }, 3000);
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
    const totalEfectivoMenosGastos = (transactionTotals.cash || 0) - totalExpenses;
    const diferencia = cashBreakdownTotals.total - totalEfectivoMenosGastos;
    return { totalFacturado, totalEfectivoMenosGastos, diferencia };
  }, [transactionTotals, totalExpenses, cashBreakdownTotals.total]);
  

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

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-export');
    if (!element) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [0.3, 0.7, 0.3, 0.3], // Top, Left (0.7 is +40% from 0.5), Bottom, Right
        filename: `Reporte_Caja_Freeway_${format(reportDate, 'dd-MM-yyyy')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 750 // Reduced width for larger scale appearance
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
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

  const isAdmin = role === 'Administrador';

  return (
    <div className="space-y-6 rounded-lg print:bg-white min-h-screen pb-12">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
            @page { 
                size: letter portrait; 
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
                width: 100% !important;
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
                <p className="text-xs text-muted-foreground">Ingresos registrados en el systema.</p>
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
          <p className="text-[10px] font-bold">REPORTE DE CAJA DIARIO - {format(reportDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-20" /></div>
        ) : (
          <div className="space-y-4">
            <Table className="border-collapse border border-black">
              <TableHeader>
                <TableRow className="bg-slate-100 font-bold border-b-2 border-black">
                  <TableHead className="text-black p-1 h-auto text-[10px]">Contrato</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px]">Cédula</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px]">Cliente</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px]">Vendedor</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px] text-right">Efectivo</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px] text-right">T.Débito</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px] text-right">T.Crédito</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px] text-right">BAC</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px] text-right">Gral</TableHead>
                  <TableHead className="text-black p-1 h-auto text-[10px] text-right">Cheque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((t) => (
                  <TableRow key={t.id} className="h-auto border-black">
                    <TableCell className="p-1 text-[9px] font-bold">{t.contrato}</TableCell>
                    <TableCell className="p-1 text-[9px] whitespace-nowrap">{t.cedula}</TableCell>
                    <TableCell className="p-1 text-[9px] uppercase font-medium max-w-[120px] truncate">{t.clientName}</TableCell>
                    <TableCell className="p-1 text-[9px] uppercase">{t.createdBy}</TableCell>
                    <TableCell className="p-1 text-[9px] text-right">{t.cash > 0 ? t.cash.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[9px] text-right">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[9px] text-right">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[9px] text-right">{t.bac > 0 ? t.bac.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[9px] text-right">{t.general > 0 ? t.general.toFixed(2) : '-'}</TableCell>
                    <TableCell className="p-1 text-[9px] text-right">{t.cheques > 0 ? t.cheques.toFixed(2) : '-'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-bold border-t-2 border-black h-auto">
                  <TableCell colSpan={4} className="p-1 text-[10px] text-right uppercase">Totales por Método</TableCell>
                  <TableCell className="p-1 text-[10px] text-right">{transactionTotals.cash.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[10px] text-right">{transactionTotals.debit.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[10px] text-right">{transactionTotals.credit.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[10px] text-right">{transactionTotals.bac.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[10px] text-right">{transactionTotals.general.toFixed(2)}</TableCell>
                  <TableCell className="p-1 text-[10px] text-right">{transactionTotals.cheques.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-black p-2 rounded-sm space-y-2">
                <h3 className="text-[10px] font-black uppercase bg-slate-100 p-1 border-b border-black">Desglose de Efectivo</h3>
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold border-b mb-1">Billetes</p>
                    {Object.keys(billQuantities).map(val => (
                      <div key={val} className="flex justify-between items-center text-[9px]">
                        <span>B/. {val}:</span>
                        <div className="flex items-center gap-1">
                            <Input 
                                type="number" 
                                className="h-5 w-10 text-[9px] p-1 border-black print-hide" 
                                value={billQuantities[val] || ''}
                                onChange={(e) => handleCashChange('bill', val, e.target.value)}
                            />
                            <span className="print-show-val">{billQuantities[val]}</span>
                            <span className="w-12 text-right">{(parseFloat(val) * (billQuantities[val] || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 border-l border-black pl-4">
                    <p className="text-[9px] font-bold border-b mb-1">Monedas</p>
                    {Object.keys(coinQuantities).map(val => (
                      <div key={val} className="flex justify-between items-center text-[9px]">
                        <span>B/. {val}:</span>
                        <div className="flex items-center gap-1">
                            <Input 
                                type="number" 
                                className="h-5 w-10 text-[9px] p-1 border-black print-hide" 
                                value={coinQuantities[val] || ''}
                                onChange={(e) => handleCashChange('coin', val, e.target.value)}
                            />
                            <span className="print-show-val">{coinQuantities[val]}</span>
                            <span className="w-12 text-right">{(parseFloat(val) * (coinQuantities[val] || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center font-bold text-[10px] pt-1 border-t border-black">
                  <span>TOTAL FÍSICO:</span>
                  <span>B/. {cashBreakdownTotals.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border border-black p-2 rounded-sm">
                  <h3 className="text-[10px] font-black uppercase bg-slate-100 p-1 border-b border-black flex justify-between">
                    <span>Gastos del Día</span>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 print-hide" onClick={() => setExpenses([...expenses, { description: '', amount: 0 }])}>+</Button>
                  </h3>
                  <div className="space-y-1 pt-1">
                    {expenses.map((exp, idx) => (
                      <div key={idx} className="flex gap-1 items-center">
                        <Input 
                            placeholder="Descripción" 
                            className="h-5 text-[9px] p-1 border-black flex-1 print-hide" 
                            value={exp.description} 
                            onChange={(e) => handleExpenseChange(idx, 'description', e.target.value)}
                        />
                        <span className="print-show-val flex-1">{exp.description}</span>
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="h-5 w-16 text-[9px] p-1 border-black print-hide" 
                            value={exp.amount || ''} 
                            onChange={(e) => handleExpenseChange(idx, 'amount', e.target.value)}
                        />
                        <span className="print-show-val w-16 text-right">{exp.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center font-bold text-[10px] pt-1 border-t border-black mt-1">
                    <span>TOTAL GASTOS:</span>
                    <span>B/. {totalExpenses.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-2 border-black p-3 bg-slate-50 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-bold">Total Facturado:</span>
                    <span className="font-black">{currencyFormatter.format(grandTotals.totalFacturado)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Efectivo en Sistema:</span>
                    <span>{transactionTotals.cash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-red-600">
                    <span>(-) Gastos:</span>
                    <span>- {totalExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-black border-t border-black pt-1">
                    <span>Efectivo Esperado:</span>
                    <span>B/. {grandTotals.totalEfectivoMenosGastos.toFixed(2)}</span>
                  </div>
                  <div className={cn("flex justify-between text-[12px] font-black p-1 rounded-sm mt-1", grandTotals.diferencia === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                    <span>DIFERENCIA:</span>
                    <span>B/. {grandTotals.diferencia.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-12 pb-4">
                <div className="text-center">
                    <div className="border-t border-black w-48 mx-auto"></div>
                    <p className="text-[10px] font-bold uppercase">Firma del Cajero</p>
                </div>
                <div className="text-center">
                    <div className="border-t border-black w-48 mx-auto"></div>
                    <p className="text-[10px] font-bold uppercase">Firma del Administrador</p>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
