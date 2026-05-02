'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, ChevronLeft, Download, TrendingUp, TrendingDown, Landmark, PieChart } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function FinancialStatementsPage() {
  const db = useDb();
  
  const [period, setPeriod] = useState<string>('current-month');
  const [isDownloading, setIsDownloading] = useState(false);

  // Determinar fechas
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'current-month') {
      return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: es }) };
    }
    if (period === 'last-month') {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth), label: format(lastMonth, 'MMMM yyyy', { locale: es }) };
    }
    if (period === 'current-year') {
      return { start: startOfYear(now), end: endOfYear(now), label: format(now, 'yyyy', { locale: es }) };
    }
    // Default
    return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: es }) };
  }, [period]);

  // Queries para el Estado de Resultados (Por Período)
  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('activatedAt', '>=', Timestamp.fromDate(dateRange.start)), where('activatedAt', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const calcQuery = useMemoQuery(() => (db ? query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(dateRange.start)), where('paymentDate', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const updatesQuery = useMemoQuery(() => (db ? query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(dateRange.start)), where('paymentDate', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const expensesQuery = useMemoQuery(() => (db ? query(collection(db, 'expenses'), where('date', '>=', Timestamp.fromDate(dateRange.start)), where('date', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const bookSalesQuery = useMemoQuery(() => (db ? query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(dateRange.start)), where('paymentDate', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);

  // Queries Globales (Para Estado de Situación - Desde el inicio de los tiempos)
  const allContractsQ = useMemoQuery(() => (db ? query(collection(db, 'contracts')) : null), [db]);
  const allCancQ = useMemoQuery(() => (db ? query(collection(db, 'cancellation_payments')) : null), [db]);
  const allUpdatesQ = useMemoQuery(() => (db ? query(collection(db, 'update_payments')) : null), [db]);
  const allExpensesQ = useMemoQuery(() => (db ? query(collection(db, 'expenses')) : null), [db]);
  const allBookSalesQ = useMemoQuery(() => (db ? query(collection(db, 'book_sale_payments')) : null), [db]);

  const { data: contracts, isLoading: l1 } = useCollection<any>(contractsQuery);
  const { data: cancellations, isLoading: l2 } = useCollection<any>(calcQuery);
  const { data: updates, isLoading: l3 } = useCollection<any>(updatesQuery);
  const { data: expenses, isLoading: l4 } = useCollection<any>(expensesQuery);
  const { data: bookSales, isLoading: l4b } = useCollection<any>(bookSalesQuery);

  const { data: allContracts, isLoading: l5 } = useCollection<any>(allContractsQ);
  const { data: allCancellations, isLoading: l6 } = useCollection<any>(allCancQ);
  const { data: allUpdates, isLoading: l7 } = useCollection<any>(allUpdatesQ);
  const { data: allExpenses, isLoading: l8 } = useCollection<any>(allExpensesQ);
  const { data: allBookSales, isLoading: l9 } = useCollection<any>(allBookSalesQ);

  const isLoading = l1 || l2 || l3 || l4 || l4b || l5 || l6 || l7 || l8 || l9;

  // --- ESTADO DE RESULTADOS (Periodo Actual) ---
  const incomePeriod = useMemo(() => {
    let sales = 0;
    let updatesAmount = 0;
    let booksAmount = 0;
    
    // Revenue is recognized when contract is created (accrual accounting)
    contracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      if (Number(details?.courseValue) > 0) sales += Number(details?.courseValue);
    });
    
    // Updates and Book Sales are also revenue
    updates?.forEach(c => { updatesAmount += Number(c.amount) || 0; });
    bookSales?.forEach(b => { booksAmount += Number(b.amount) || 0; });

    return { 
        total: sales + updatesAmount + booksAmount, 
        sales, 
        updates: updatesAmount, 
        books: booksAmount 
    };
  }, [contracts, updates, bookSales]);

  const expensesPeriod = useMemo(() => {
    const list = expenses || [];
    const grouped = list.reduce((acc, curr) => {
      const cat = curr.category || 'Otros Generales';
      acc[cat] = (acc[cat] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {} as Record<string, number>);
    const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { list: Object.entries(grouped).map(([k, v]) => ({ category: k, amount: v })), total };
  }, [expenses]);

  const netIncome = incomePeriod.total - expensesPeriod.total;

  // --- ESTADO DE SITUACIÓN (Global Histórico) ---
  const balanceSheet = useMemo(() => {
    let globalContracted = 0;
    let totalCashReceived = 0;
    let accountsReceivable = 0;
    let globalExpenses = 0;

    // Ingresos base por contratos
    allContracts?.forEach(c => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      const courseValue = Number(details?.courseValue) || 0;
      const balance = Number(details?.balance) || 0;
      
      globalContracted += courseValue;
      accountsReceivable += balance;
      
      // Lo recaudado del contrato es su valor total menos lo que aún deben
      totalCashReceived += (courseValue - balance);
    });

    // Los trámites se pagan de contado
    allUpdates?.forEach(c => { 
      const amt = Number(c.amount) || 0;
      globalContracted += amt; 
      totalCashReceived += amt; 
    });
    
    // Los libros se pagan de contado
    allBookSales?.forEach(b => {
      const amt = Number(b.amount) || 0;
      globalContracted += amt; 
      totalCashReceived += amt; 
    });

    // Gastos
    allExpenses?.forEach(e => { globalExpenses += Number(e.amount) || 0; });

    const cashOnBanks = Math.max(0, totalCashReceived - globalExpenses); // Efectivo en caja/bancos
    
    const assets = cashOnBanks + accountsReceivable;
    const equity = globalContracted - globalExpenses; // Total ganado (Devengado Histórico - Gastos)

    return {
      cash: cashOnBanks,
      receivable: accountsReceivable,
      totalAssets: assets,
      totalLiabilities: 0,
      totalEquity: equity
    };
  }, [allContracts, allCancellations, allUpdates, allExpenses, allBookSales]);


  const handleDownloadPdf = async () => {
    const element = document.getElementById('financial-reports-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: 0,
        filename: `Estados_Financieros_${period}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 816 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) { console.error(e); } finally { setIsDownloading(false); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-white border rounded-xl shadow-sm gap-4 mt-6 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Estados Financieros</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contabilidad Oficial</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px] h-10 font-bold uppercase text-xs">
              <SelectValue placeholder="Seleccionar Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month" className="font-bold text-xs uppercase">Mes Actual</SelectItem>
              <SelectItem value="last-month" className="font-bold text-xs uppercase">Mes Pasado</SelectItem>
              <SelectItem value="current-year" className="font-bold text-xs uppercase">Año Actual</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => window.print()} variant="outline" className="font-bold border-2 border-slate-800 uppercase tracking-widest text-xs hidden md:flex"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isLoading || isDownloading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-lg text-xs">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />} PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="font-bold uppercase tracking-widest text-slate-500 text-xs">Calculando matrices contables...</p>
        </div>
      ) : (
        <div id="financial-reports-print" className="w-full flex justify-center print:p-0">
          <div className="bg-white w-full max-w-[8.5in] p-8 md:p-10 font-sans text-black border shadow-lg print:shadow-none print:border-none box-border flex flex-col gap-10">
            
            {/* Header del Documento */}
            <div className="text-center">
              <h1 className="text-2xl font-black uppercase tracking-widest mb-1">FREEWAY ESCUELA DE MANEJO</h1>
              <p className="text-[8pt] font-bold uppercase mb-4 text-slate-500">RUC 155628022-2-2016 DV 2</p>
            </div>

            {/* ESTADO DE RESULTADOS */}
            <div className="border border-slate-300 rounded-sm">
              <div className="bg-slate-100 p-3 border-b border-slate-300 flex justify-between items-center">
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-800">Estado de Resultados</h2>
                <span className="text-[10px] font-bold bg-white px-2 py-1 uppercase rounded border border-slate-200">
                  Período: {dateRange.label.toUpperCase()}
                </span>
              </div>
              <div className="p-6 flex flex-col gap-4">
                
                {/* Ingresos */}
                <div>
                  <h3 className="font-black uppercase text-sm border-b-2 border-black pb-1 mb-2 text-emerald-800 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Ingresos Operativos
                  </h3>
                  <div className="flex justify-between py-1 text-sm font-medium">
                    <span>Ventas de Contratos (Valor Total)</span>
                    <span>B/. {incomePeriod.sales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm font-medium">
                    <span>Trámites y Actualizaciones</span>
                    <span>B/. {incomePeriod.updates.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm font-medium">
                    <span>Venta de Libros</span>
                    <span>B/. {incomePeriod.books.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-black bg-emerald-50 mt-2 px-2">
                    <span>TOTAL INGRESOS</span>
                    <span>B/. {incomePeriod.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Egresos */}
                <div className="mt-4">
                  <h3 className="font-black uppercase text-sm border-b-2 border-black pb-1 mb-2 text-red-800 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Gastos Operativos
                  </h3>
                  {expensesPeriod.list.length > 0 ? (
                    expensesPeriod.list.map((expense, i) => (
                      <div key={i} className="flex justify-between py-1 text-sm font-medium text-slate-700">
                        <span>Gastos de {expense.category}</span>
                        <span>B/. {expense.amount.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-slate-400 uppercase font-medium">Sin gastos reportados en este período.</p>
                  )}
                  <div className="flex justify-between py-2 text-sm font-black bg-red-50 mt-2 px-2">
                    <span>TOTAL EGRESOS</span>
                    <span>B/. {expensesPeriod.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Utilidad */}
                <div className="mt-6 border-4 border-slate-900 p-3 pt-2 bg-slate-50 flex justify-between items-center shadow-inner">
                  <span className="font-black uppercase text-sm tracking-widest">Utilidad Neta (Pérdida/Ganancia)</span>
                  <span className={cn("font-black text-xl", netIncome >= 0 ? "text-emerald-700" : "text-red-700")}>
                    B/. {netIncome.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>


            {/* ESTADO DE SITUACIÓN */}
            <div className="border border-slate-300 rounded-sm">
              <div className="bg-slate-100 p-3 border-b border-slate-300 flex justify-between items-center">
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-800">Estado de Situación Financiera</h2>
                <span className="text-[10px] font-bold bg-white px-2 py-1 uppercase rounded border border-slate-200">
                  Global (Histórico Acumulado)
                </span>
              </div>
              <div className="p-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Balance General - Ecuación Contable</p>
                
                <div className="grid grid-cols-2 gap-8 relative">
                  
                  {/* DIVIDER LINE */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 -translate-x-1/2"></div>

                  {/* Activos */}
                  <div className="flex flex-col">
                    <h3 className="font-black uppercase text-sm border-b border-slate-800 pb-1 mb-3 flex items-center gap-2">
                      <Landmark className="h-4 w-4" /> Activos
                    </h3>
                    
                    <div className="flex flex-col gap-1 mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-400">Activo Corriente</span>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Caja y Bancos (Efectivo Neto)</span>
                        <span>B/. {balanceSheet.cash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Cuentas por Cobrar (Saldos Alumnos)</span>
                        <span>B/. {balanceSheet.receivable.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="flex justify-between py-2 text-sm font-black border-y-2 border-black">
                        <span>TOTAL ACTIVOS</span>
                        <span>B/. {balanceSheet.totalAssets.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pasivos y Patrimonio */}
                  <div className="flex flex-col">
                    <h3 className="font-black uppercase text-sm border-b border-slate-800 pb-1 mb-3 flex items-center gap-2">
                      <PieChart className="h-4 w-4" /> Pasivo y Patrimonio
                    </h3>
                    
                    <div className="flex flex-col gap-1 mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-400">Pasivos</span>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Cuentas por Pagar</span>
                        <span>B/. 0.00</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-400">Patrimonio Neto</span>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Capital / Utilidades Retenidas</span>
                        <span>B/. {balanceSheet.totalEquity.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="flex justify-between py-2 text-sm font-black border-y-2 border-black">
                        <span>TOTAL PASIVO Y PATRIMONIO</span>
                        <span>B/. {(balanceSheet.totalLiabilities + balanceSheet.totalEquity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-center">
                   <div className={cn(
                     "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border",
                     (balanceSheet.totalAssets.toFixed(2) === (balanceSheet.totalLiabilities + balanceSheet.totalEquity).toFixed(2))
                     ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                     : "bg-red-50 text-red-700 border-red-200"
                   )}>
                     Diagnóstico: {(balanceSheet.totalAssets.toFixed(2) === (balanceSheet.totalLiabilities + balanceSheet.totalEquity).toFixed(2)) ? 'ECUACIÓN CONTABLE CUADRADA OK' : 'DESCUADRE EN SISTEMA'}
                   </div>
                </div>

              </div>
            </div>

            {/* Firmas */}
            <div className="mt-12 grid grid-cols-2 gap-16 px-12 print:mt-auto">
              <div className="text-center">
                <div className="border-t border-black mb-2"></div>
                <p className="text-[9px] font-black uppercase tracking-widest">Preparado Por</p>
                <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">Sistema Automatizado ContractTime</p>
              </div>
              <div className="text-center">
                <div className="border-t border-black mb-2"></div>
                <p className="text-[9px] font-black uppercase tracking-widest">Revisado Por / Gerencia</p>
              </div>
            </div>

          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
