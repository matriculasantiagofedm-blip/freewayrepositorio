'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, ChevronLeft, Download, Building2, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ProvidersLedgerPage() {
  const db = useDb();
  
  const [period, setPeriod] = useState<string>('current-year');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
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
    if (period === 'all') {
      return { start: new Date(2020, 0, 1), end: endOfYear(now), label: 'Histórico Completo' };
    }
    // Default
    return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: es }) };
  }, [period]);

  const expensesQuery = useMemoQuery(() => (db ? query(collection(db, 'expenses'), where('date', '>=', Timestamp.fromDate(dateRange.start)), where('date', '<=', Timestamp.fromDate(dateRange.end))) : null), [db, dateRange]);
  const providersQuery = useMemoQuery(() => (db ? query(collection(db, 'providers')) : null), [db]);

  const { data: expenses, isLoading: l1 } = useCollection<any>(expensesQuery);
  const { data: providersList, isLoading: l2 } = useCollection<any>(providersQuery);

  const isLoading = l1 || l2;

  // Filtrar y ordenar gastos
  const transactions = useMemo(() => {
    let list = expenses || [];

    // Filter by provider
    if (selectedProvider !== 'all') {
      list = list.filter(e => {
          // Compare loosely because provider is usually just a string inside expenses
          const envProvName = (e.provider || '').toLowerCase().trim();
          const targetProvName = selectedProvider.toLowerCase().trim();
          // Also try matching by exact RUC if available
          return envProvName === targetProvName || 
                 (e.providerRuc && e.providerRuc === selectedProvider);
      });
    }

    // Sort by date descending
    list.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
      const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
      return dateB - dateA;
    });

    return list;
  }, [expenses, selectedProvider]);

  // Providers dropdown list (Unique providers extracted from expenses + the providers collection if they have names)
  const uniqueProviders = useMemo(() => {
    const names = new Set<string>();
    providersList?.forEach(p => {
       if (p.name) names.add(p.name);
    });
    expenses?.forEach(e => {
       if (e.provider && e.provider !== 'N/A') names.add(e.provider);
    });
    return Array.from(names).sort();
  }, [expenses, providersList]);

  // Summary logic
  const totals = useMemo(() => {
    let totalAmount = 0;
    let transactionsCount = transactions.length;

    transactions.forEach(t => {
      totalAmount += Number(t.amount) || 0;
    });

    return { totalAmount, transactionsCount };
  }, [transactions]);

  // Información del proveedor seleccionado (si es uno específico)
  const providerDetails = useMemo(() => {
      if (selectedProvider === 'all') return null;
      // Try to find the provider in the database
      const found = providersList?.find(p => p.name?.toLowerCase().trim() === selectedProvider.toLowerCase().trim() || p.ruc === selectedProvider);
      
      // Try to extract from the most recent expense if not found in providers
      if (!found && transactions.length > 0) {
          const latest = transactions[0];
          return {
              name: latest.provider || selectedProvider,
              ruc: latest.providerRuc || 'No Registrado',
              dv: latest.providerDv || '',
          };
      }
      return found;
  }, [selectedProvider, providersList, transactions]);


  const handleDownloadPdf = async () => {
    const element = document.getElementById('provider-ledger-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: 0.3,
        filename: `Mayor_Proveedores_${selectedProvider === 'all' ? 'Global' : selectedProvider}_${period}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) { console.error(e); } finally { setIsDownloading(false); }
  };

  return (
    <div className="flex flex-col gap-6 mx-auto pb-20 w-full min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-white border rounded-xl shadow-sm gap-4 mt-6 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900">Mayor Auxiliar: Cuentas por Pagar</h1>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">Historial de Operaciones con Proveedores</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
             <SelectTrigger className="w-[220px] h-10 font-bold uppercase text-[10px] sm:text-xs border-indigo-200 bg-indigo-50">
               <Building2 className="w-4 h-4 mr-2 text-indigo-600" />
               <SelectValue placeholder="Seleccionar Proveedor" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all" className="font-black text-xs uppercase text-indigo-700">Todos los Proveedores</SelectItem>
               {uniqueProviders.map(p => (
                   <SelectItem key={p} value={p} className="font-bold text-xs uppercase text-slate-700">{p}</SelectItem>
               ))}
             </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] h-10 font-bold uppercase text-[10px] sm:text-xs">
              <SelectValue placeholder="Seleccionar Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month" className="font-bold text-xs uppercase">Mes Actual</SelectItem>
              <SelectItem value="last-month" className="font-bold text-xs uppercase">Mes Pasado</SelectItem>
              <SelectItem value="current-year" className="font-bold text-xs uppercase">Año Actual</SelectItem>
              <SelectItem value="all" className="font-bold text-xs uppercase font-black text-blue-600">Histórico Total</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => window.print()} variant="outline" className="font-bold border-2 border-slate-800 uppercase tracking-widest text-xs hidden lg:flex"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button onClick={handleDownloadPdf} disabled={isLoading || isDownloading} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-lg text-[10px] sm:text-xs h-10">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />} Exportar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="font-bold uppercase tracking-widest text-slate-500 text-xs">Cruzando sub-cuentas auxiliares...</p>
        </div>
      ) : (
        <div id="provider-ledger-print" className="w-full bg-white border border-slate-300 shadow-sm print:border-none print:shadow-none p-4 rounded-xl">
          
          <div className="flex justify-between items-end mb-6 border-b pb-4">
            <div>
               <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                 <Building2 className="h-5 w-5" /> 
                 {selectedProvider === 'all' ? 'Resumen General (Todos los Proveedores)' : `Mayor de Proveedor: ${selectedProvider}`}
               </h2>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                 Período Auditado: {dateRange.label.toUpperCase()}
               </p>
            </div>
            
            {providerDetails && selectedProvider !== 'all' && (
                <div className="text-right bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-black uppercase text-slate-400">Datos Fiscales</p>
                    <p className="text-sm font-black text-slate-800 uppercase mt-1">RUC: {providerDetails.ruc || 'N/A'}</p>
                    {providerDetails.dv && <p className="text-xs font-bold text-slate-600">DV: {providerDetails.dv}</p>}
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Total Transado / Egresos</span>
                  <span className="text-3xl font-black text-red-800 mt-1">B/. {totals.totalAmount.toFixed(2)}</span>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Volumen de Transacciones</span>
                  <span className="text-3xl font-black text-slate-800 mt-1">{totals.transactionsCount} Facturas</span>
                </CardContent>
              </Card>
          </div>

          <div className="rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead className="w-[120px] text-xs font-black uppercase tracking-widest">Fecha</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-widest text-slate-500">Documento/Ref</TableHead>
                  {selectedProvider === 'all' && <TableHead className="text-xs font-black uppercase tracking-widest">Proveedor / RUC</TableHead>}
                  <TableHead className="text-xs font-black uppercase tracking-widest">Atribución (Categoría)</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-widest">Descripción</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase tracking-widest text-slate-900">Monto Facturado (B/.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((t) => {
                      const dateObj = t.date?.toDate ? t.date.toDate() : new Date();
                      return (
                    <TableRow key={t.id} className="hover:bg-slate-50/50 h-10">
                      <TableCell className="font-bold text-[10px] uppercase text-slate-500 whitespace-nowrap">
                        {format(dateObj, "dd/MM/yy hh:mm a")}
                      </TableCell>
                      <TableCell className="font-black text-[10px] uppercase text-slate-800 truncate max-w-[120px]">
                        {t.invoiceNumber || (t.id ? t.id.substring(0,6).toUpperCase() : 'N/A')}
                      </TableCell>
                      {selectedProvider === 'all' && (
                          <TableCell className="font-black text-[11px] uppercase text-indigo-700">
                              <p className="truncate max-w-[150px]">{t.provider || 'S/N'}</p>
                              {(t.providerRuc || t.providerDv) && (
                                <p className="text-[9px] font-bold text-slate-400 mt-0.5 tracking-tight">
                                  RUC: {t.providerRuc || '-'} {t.providerDv ? ` DV: ${t.providerDv}` : ''}
                                </p>
                              )}
                          </TableCell>
                      )}
                      <TableCell className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[150px]">
                        {t.category || 'Generales'}
                      </TableCell>
                      <TableCell className="text-[10px] font-medium text-slate-500 truncate max-w-[200px]">
                        {t.description || '-'}
                      </TableCell>
                      <TableCell className="text-right font-black text-red-600 text-sm">
                        B/. {(Number(t.amount) || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={selectedProvider === 'all' ? 6 : 5} className="h-40 text-center text-slate-400 text-xs uppercase font-bold tracking-widest">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Filter className="w-8 h-8 opacity-20" />
                        No existen facturas ni pagos al proveedor en el rango seleccionado.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>
    </div>
  );
}
