'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay, addDays, subDays, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Printer, 
  Loader2, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Search,
  Receipt,
  FileText,
  ArrowRightLeft,
  RefreshCw,
  BookOpen,
  DollarSign,
  Filter,
  Car,
  Bike,
  Sparkles,
  Compass,
  FileCheck
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function mapMethod(m?: string) {
  if (!m) return 'Efectivo';
  const lower = m.toLowerCase();
  if (lower.includes('cash') || lower.includes('efectivo')) return 'Efectivo';
  if (lower.includes('debit') || lower.includes('débito')) return 'T. Débito';
  if (lower.includes('credit') || lower.includes('crédito') || lower.includes('cubo') || lower.includes('card') || lower.includes('tarjeta')) return 'T. Crédito';
  if (lower.includes('bac')) return 'BAC';
  if (lower.includes('yappy') || lower.includes('general') || lower.includes('gral') || lower.includes('bg')) return 'B. General';
  if (lower.includes('cheque') || lower.includes('check')) return 'Cheque';
  return 'B. General';
}

function getServiceLabel(contractType?: string, serviceName?: string) {
  const raw = (contractType || serviceName || '').toLowerCase();
  if (raw.includes('moto') && raw.includes('auto')) return 'Auto + Moto';
  if (raw.includes('moto')) return 'Moto';
  if (raw.includes('amplia') || raw.includes('ampliacion')) return 'Ampliación';
  if (raw.includes('deluxe')) return 'Deluxe';
  if (raw.includes('practica') || raw.includes('solo practica')) return 'Práctica';
  if (raw.includes('libro')) return 'Libro';
  if (raw.includes('actualiza')) return 'Trámite';
  return 'Curso Auto';
}

function cleanFolio(raw: any): string {
  if (!raw && raw !== 0) return '';
  let str = String(raw).trim();
  str = str.replace(/^(REC-CONTRATO-|CONTRATO-|REC-CAN-|REC-TRM-|REC-LIB-|REC-)/i, '');
  if (!str) return '';
  if (/^\d+$/.test(str)) {
    str = str.padStart(6, '0');
  }
  return str;
}

export default function ReceiptListPage() {
  const db = useDb();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOp, setFilterOp] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  const start = startOfDay(selectedDate);
  const end = endOfDay(selectedDate);

  // Queries para las 3 colecciones de recibos/pagos
  const cancellationsQuery = useMemoQuery(
    () => (db ? query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end))) : null),
    [db, selectedDate]
  );
  
  const updatesQuery = useMemoQuery(
    () => (db ? query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end))) : null),
    [db, selectedDate]
  );
  
  const bookSalesQuery = useMemoQuery(
    () => (db ? query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end))) : null),
    [db, selectedDate]
  );

  const { data: cancellations, isLoading: loadingCanc } = useCollection<any>(cancellationsQuery);
  const { data: updates, isLoading: loadingU } = useCollection<any>(updatesQuery);
  const { data: bookSales, isLoading: loadingB } = useCollection<any>(bookSalesQuery);

  const isLoading = loadingCanc || loadingU || loadingB;

  // Consolidar todos los recibos emitidos en la fecha
  const receipts = useMemo(() => {
    const list: any[] = [];
    const startTime = start.getTime();
    const endTime = end.getTime();

    // 1. Cancelaciones / Abonos de saldos
    cancellations?.forEach((p: any) => {
      const pDate = toDate(p.paymentDate || p.createdAt);
      const cancNum = cleanFolio(p.cancellationFolio) || 'S-N';
      const contractNum = cleanFolio(p.contractFolio);
      const receiptNoStr = `REC-${cancNum}`;
      const contractFolioStr = contractNum ? `CONTRATO-${contractNum}` : '---';
      
      list.push({
        id: `canc-${p.id}`,
        rawId: p.id,
        receiptNo: receiptNoStr,
        contractFolio: contractFolioStr,
        folio: cancNum,
        date: pDate,
        clientName: p.clientName || 'Cliente Sin Nombre',
        studentIdNumber: p.studentIdNumber || '---',
        concept: `Abono de Saldo / Cancelación`,
        opType: 'CANCELACIÓN',
        serviceLabel: getServiceLabel(p.contractType),
        seller: p.createdBy || p.userId || 'Caja',
        method: mapMethod(p.paymentType),
        amount: Number(p.amount) || 0,
        address: p.clientAddress || '---',
      });
    });

    // 2. Actualizaciones de trámites
    updates?.forEach((p: any) => {
      const pDate = toDate(p.paymentDate || p.createdAt);
      const upNum = cleanFolio(p.updateFolio) || 'S-N';
      const receiptNoStr = `REC-${upNum}`;
      
      list.push({
        id: `upd-${p.id}`,
        rawId: p.id,
        receiptNo: receiptNoStr,
        contractFolio: '---',
        folio: upNum,
        date: pDate,
        clientName: p.clientName || 'Cliente Sin Nombre',
        studentIdNumber: p.studentIdNumber || '---',
        concept: `Trámite: ${p.reason || 'Vigencia / Duplicado'}`,
        opType: 'ACTUALIZACIÓN',
        serviceLabel: 'Trámite',
        seller: p.createdBy || p.userId || 'Caja',
        method: mapMethod(p.paymentType),
        amount: Number(p.amount) || 0,
        address: p.clientAddress || '---',
      });
    });

    // 3. Ventas de Libros
    bookSales?.forEach((p: any) => {
      const pDate = toDate(p.paymentDate || p.createdAt);
      const bookNum = cleanFolio(p.bookSaleFolio) || 'S-N';
      const receiptNoStr = `REC-${bookNum}`;
      
      list.push({
        id: `book-${p.id}`,
        rawId: p.id,
        receiptNo: receiptNoStr,
        contractFolio: '---',
        folio: bookNum,
        date: pDate,
        clientName: p.clientName || 'Cliente Sin Nombre',
        studentIdNumber: p.studentIdNumber || '---',
        concept: `Libro: ${p.bookTitle || 'Material Teórico'}`,
        opType: 'LIBRO',
        serviceLabel: 'Libro',
        seller: p.createdBy || p.userId || 'Caja',
        method: mapMethod(p.paymentType),
        amount: Number(p.amount) || 0,
        address: '---',
      });
    });

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [cancellations, updates, bookSales, start, end]);

  // Filtrado dinámico por búsqueda, tipo de operación y método de pago
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // Filtro por búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = r.clientName.toLowerCase().includes(q);
        const matchesId = r.studentIdNumber.toLowerCase().includes(q);
        const matchesReceipt = (r.receiptNo || '').toLowerCase().includes(q);
        const matchesContract = (r.contractFolio || '').toLowerCase().includes(q);
        const matchesConcept = r.concept.toLowerCase().includes(q);
        if (!matchesClient && !matchesId && !matchesReceipt && !matchesContract && !matchesConcept) return false;
      }

      // Filtro por Operación
      if (filterOp !== 'all' && r.opType !== filterOp) return false;

      // Filtro por Método de Pago
      if (filterMethod !== 'all' && r.method !== filterMethod) return false;

      return true;
    });
  }, [receipts, searchQuery, filterOp, filterMethod]);

  // Totales de resumen
  const totalAmount = useMemo(() => filteredReceipts.reduce((sum, r) => sum + r.amount, 0), [filteredReceipts]);
  const totalCash = useMemo(() => filteredReceipts.filter(r => r.method === 'Efectivo').reduce((sum, r) => sum + r.amount, 0), [filteredReceipts]);
  const totalCardBank = useMemo(() => filteredReceipts.filter(r => r.method !== 'Efectivo').reduce((sum, r) => sum + r.amount, 0), [filteredReceipts]);

  // Navegación de fecha
  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  // Abrir ventana de impresión de recibo con sus parámetros exactos
  const handlePrintReceipt = (r: any) => {
    const queryParams = new URLSearchParams({
      folio: r.receiptNo,
      contractFolio: r.contractFolio,
      date: format(r.date, 'PPP', { locale: es }),
      name: r.clientName,
      idNumber: r.studentIdNumber,
      address: r.address || '---',
      concept: r.concept,
      amount: String(r.amount.toFixed(2)),
    });
    window.open(`/print-receipt?${queryParams.toString()}`, '_blank');
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('receipts-list-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: [0.3, 0.3, 0.3, 0.3], 
        filename: `Listado_Recibos_${format(selectedDate, 'yyyy-MM-dd')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 800 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) {
      console.error("Error exporting PDF:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-slate-50 min-h-screen">
      
      {/* ── ENCABEZADO Y CONTROLES PRINCIPALES ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-10 w-10 rounded-xl border-slate-200">
            <Link href="/informes"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Listado General de Recibos</h1>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Consolidado diario de recibos emitidos (Contratos, Abonos, Actualizaciones y Libros).
            </p>
          </div>
        </div>

        {/* Controles de Navegación de Fecha */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8 rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant={isToday(selectedDate) ? "default" : "ghost"} 
              size="sm" 
              onClick={handleToday}
              className={cn("h-8 px-3 text-xs font-bold rounded-lg", isToday(selectedDate) && "bg-blue-600 text-white")}
            >
              Hoy
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8 rounded-lg">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-48 justify-start text-left font-bold text-xs rounded-xl border-slate-200 bg-white">
                <CalendarIcon className="mr-2 h-4 w-4 text-blue-600 shrink-0" />
                <span className="truncate">{format(selectedDate, "EEE, d 'de' MMMM yyyy", { locale: es })}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
            </PopoverContent>
          </Popover>

          <Button 
            onClick={() => window.print()} 
            variant="outline" 
            size="sm" 
            className="h-9 px-3 font-bold text-xs rounded-xl border-slate-300"
          >
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>

          <Button 
            onClick={handleDownloadPdf} 
            disabled={isDownloading} 
            size="sm" 
            className="h-9 px-3.5 font-bold text-xs rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />} PDF
          </Button>
        </div>
      </div>

      {/* ── METRICAS / KPIS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        <Card className="border-slate-200 shadow-xs bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Total Recaudado en Recibos</p>
            <h2 className="text-3xl font-black mt-2">B/. {totalAmount.toFixed(2)}</h2>
            <p className="text-[11px] font-medium text-blue-200 mt-2">{filteredReceipts.length} recibos emitidos hoy</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total en Efectivo</p>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">B/. {totalCash.toFixed(2)}</h2>
            <p className="text-[11px] font-semibold text-emerald-600 mt-2">Pagos registrados en efectivo</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tarjetas y Bancos</p>
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">B/. {totalCardBank.toFixed(2)}</h2>
            <p className="text-[11px] font-semibold text-blue-600 mt-2">T. Débito, Crédito, BAC, B. General</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cantidad de Recibos</p>
              <Receipt className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">{filteredReceipts.length}</h2>
            <p className="text-[11px] font-semibold text-purple-600 mt-2">Documentos guardados hoy</p>
          </CardContent>
        </Card>

      </div>

      {/* ── BARRA DE FILTROS Y BÚSQUEDA ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        
        {/* Campo de Búsqueda */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por folio, cliente, cédula..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-slate-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Filtro por Tipo de Operación */}
          <Select value={filterOp} onValueChange={setFilterOp}>
            <SelectTrigger className="h-9 w-[160px] text-xs font-bold uppercase rounded-xl border-slate-200">
              <SelectValue placeholder="Todas las Operaciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">Todas las Operaciones</SelectItem>
              <SelectItem value="CANCELACIÓN" className="text-xs font-bold uppercase">Cancelaciones / Saldos</SelectItem>
              <SelectItem value="ACTUALIZACIÓN" className="text-xs font-bold uppercase">Actualizaciones</SelectItem>
              <SelectItem value="LIBRO" className="text-xs font-bold uppercase">Libros</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por Método de Pago */}
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="h-9 w-[160px] text-xs font-bold uppercase rounded-xl border-slate-200">
              <SelectValue placeholder="Todos los Métodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-bold uppercase">Todos los Métodos</SelectItem>
              <SelectItem value="Efectivo" className="text-xs font-bold uppercase">Efectivo</SelectItem>
              <SelectItem value="T. Débito" className="text-xs font-bold uppercase">T. Débito</SelectItem>
              <SelectItem value="T. Crédito" className="text-xs font-bold uppercase">T. Crédito</SelectItem>
              <SelectItem value="BAC" className="text-xs font-bold uppercase">BAC</SelectItem>
              <SelectItem value="B. General" className="text-xs font-bold uppercase">B. General</SelectItem>
              <SelectItem value="Cheque" className="text-xs font-bold uppercase">Cheque</SelectItem>
            </SelectContent>
          </Select>

          {(searchQuery || filterOp !== 'all' || filterMethod !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSearchQuery(''); setFilterOp('all'); setFilterMethod('all'); }}
              className="h-9 text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Limpiar
            </Button>
          )}
        </div>

      </div>

      {/* ── LISTADO SEPARADO POR CATEGORÍAS DE RECIBOS ── */}
      <div id="receipts-list-print" className="space-y-6">
        
        {/* Header de impresión */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-slate-900 bg-white p-4">
          <h1 className="text-xl font-black uppercase text-slate-950">FREEWAY ESCUELA DE MANEJO</h1>
          <p className="text-xs font-bold text-slate-600 uppercase">Informe Desglosado de Recibos Emitidos por Categoría</p>
          <p className="text-xs font-medium text-slate-800 uppercase mt-1">
            {format(selectedDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        {isLoading ? (
          <Card className="border-slate-200 shadow-xs rounded-2xl bg-white p-12 text-center">
            <Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-600" />
            <p className="text-xs text-slate-400 font-bold uppercase mt-2">Cargando recibos del día...</p>
          </Card>
        ) : filteredReceipts.length === 0 ? (
          <Card className="border-slate-200 shadow-xs rounded-2xl bg-white p-12 text-center italic text-slate-400 font-bold uppercase text-xs">
            No se encontraron recibos guardados para esta fecha o los filtros seleccionados.
          </Card>
        ) : (
          <>
            {/* 🟩 1. TABLA DE CANCELACIONES (ABONOS A SALDO) */}
            {(filterOp === 'all' || filterOp === 'CANCELACIÓN') && (
              <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-emerald-50/70 border-b border-emerald-100 py-3 px-5 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black uppercase text-emerald-950 tracking-wide">
                        1. Recibos por Cancelaciones (Abonos de Saldo)
                      </CardTitle>
                      <p className="text-[11px] text-emerald-700 font-medium">Pagos de cuotas o saldos pendientes de contratos activos</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 font-black text-xs">
                    {filteredReceipts.filter(r => r.opType === 'CANCELACIÓN').length} Recibos
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredReceipts.filter(r => r.opType === 'CANCELACIÓN').length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">N° Recibo</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Ref. Contrato</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Hora</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Estudiante / Cliente</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Cédula</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Detalle</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-center">Método</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-right">Monto (B/.)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-center print:hidden">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReceipts.filter(r => r.opType === 'CANCELACIÓN').map((r) => (
                          <TableRow key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                            <TableCell className="font-mono font-black text-emerald-700 text-xs">{r.receiptNo}</TableCell>
                            <TableCell className="font-mono font-bold text-slate-700 text-xs">{r.contractFolio}</TableCell>
                            <TableCell className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{format(r.date, 'hh:mm a')}</TableCell>
                            <TableCell className="text-xs font-bold uppercase text-slate-900">{r.clientName}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-600">{r.studentIdNumber}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">{r.concept}</TableCell>
                            <TableCell className="text-center text-xs font-bold text-slate-700">{r.method}</TableCell>
                            <TableCell className="text-right font-black text-sm text-slate-900">B/. {r.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-center print:hidden">
                              <Button onClick={() => handlePrintReceipt(r)} variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50">
                                <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-emerald-50/50 font-black text-xs text-emerald-950 border-t border-emerald-200">
                          <TableCell colSpan={7} className="text-right uppercase tracking-wide">
                            SUBTOTAL CANCELACIONES ({filteredReceipts.filter(r => r.opType === 'CANCELACIÓN').length} RECIBOS):
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-emerald-900">
                            B/. {filteredReceipts.filter(r => r.opType === 'CANCELACIÓN').reduce((s, r) => s + r.amount, 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="print:hidden"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-6 text-center italic text-slate-400 font-bold uppercase text-xs">Sin recibos de cancelaciones para este filtro.</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 🟪 2. TABLA DE TRÁMITES / ACTUALIZACIONES */}
            {(filterOp === 'all' || filterOp === 'ACTUALIZACIÓN') && (
              <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-purple-50/70 border-b border-purple-100 py-3 px-5 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black uppercase text-purple-950 tracking-wide">
                        2. Recibos por Trámites (Vigencia / Duplicados)
                      </CardTitle>
                      <p className="text-[11px] text-purple-700 font-medium">Ingresos por extensiones, trámites administrativos o documentos</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 font-black text-xs">
                    {filteredReceipts.filter(r => r.opType === 'ACTUALIZACIÓN').length} Recibos
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredReceipts.filter(r => r.opType === 'ACTUALIZACIÓN').length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">N° Recibo</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Hora</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Estudiante / Cliente</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Cédula</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Motivo del Trámite</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-center">Método</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-right">Monto (B/.)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-center print:hidden">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReceipts.filter(r => r.opType === 'ACTUALIZACIÓN').map((r) => (
                          <TableRow key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                            <TableCell className="font-mono font-black text-purple-700 text-xs">{r.receiptNo}</TableCell>
                            <TableCell className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{format(r.date, 'hh:mm a')}</TableCell>
                            <TableCell className="text-xs font-bold uppercase text-slate-900">{r.clientName}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-600">{r.studentIdNumber}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">{r.concept}</TableCell>
                            <TableCell className="text-center text-xs font-bold text-slate-700">{r.method}</TableCell>
                            <TableCell className="text-right font-black text-sm text-slate-900">B/. {r.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-center print:hidden">
                              <Button onClick={() => handlePrintReceipt(r)} variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-purple-600 hover:bg-purple-50">
                                <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-purple-50/50 font-black text-xs text-purple-950 border-t border-purple-200">
                          <TableCell colSpan={6} className="text-right uppercase tracking-wide">
                            SUBTOTAL TRÁMITES ({filteredReceipts.filter(r => r.opType === 'ACTUALIZACIÓN').length} RECIBOS):
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-purple-900">
                            B/. {filteredReceipts.filter(r => r.opType === 'ACTUALIZACIÓN').reduce((s, r) => s + r.amount, 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="print:hidden"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-6 text-center italic text-slate-400 font-bold uppercase text-xs">Sin recibos de trámites para este filtro.</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 🟧 3. TABLA DE VENTAS DE LIBROS */}
            {(filterOp === 'all' || filterOp === 'LIBRO') && (
              <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-amber-50/70 border-b border-amber-100 py-3 px-5 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black uppercase text-amber-950 tracking-wide">
                        3. Recibos por Ventas de Libros
                      </CardTitle>
                      <p className="text-[11px] text-amber-700 font-medium">Venta de manuales y material didáctico independiente</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 font-black text-xs">
                    {filteredReceipts.filter(r => r.opType === 'LIBRO').length} Recibos
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredReceipts.filter(r => r.opType === 'LIBRO').length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">N° Recibo</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Hora</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Estudiante / Cliente</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Cédula</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800">Libro / Material</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-center">Método</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-right">Monto (B/.)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-800 text-center print:hidden">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReceipts.filter(r => r.opType === 'LIBRO').map((r) => (
                          <TableRow key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                            <TableCell className="font-mono font-black text-amber-700 text-xs">{r.receiptNo}</TableCell>
                            <TableCell className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{format(r.date, 'hh:mm a')}</TableCell>
                            <TableCell className="text-xs font-bold uppercase text-slate-900">{r.clientName}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-600">{r.studentIdNumber}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">{r.concept}</TableCell>
                            <TableCell className="text-center text-xs font-bold text-slate-700">{r.method}</TableCell>
                            <TableCell className="text-right font-black text-sm text-slate-900">B/. {r.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-center print:hidden">
                              <Button onClick={() => handlePrintReceipt(r)} variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-amber-600 hover:bg-amber-50">
                                <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-amber-50/50 font-black text-xs text-amber-950 border-t border-amber-200">
                          <TableCell colSpan={6} className="text-right uppercase tracking-wide">
                            SUBTOTAL LIBROS ({filteredReceipts.filter(r => r.opType === 'LIBRO').length} RECIBOS):
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-amber-900">
                            B/. {filteredReceipts.filter(r => r.opType === 'LIBRO').reduce((s, r) => s + r.amount, 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="print:hidden"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-6 text-center italic text-slate-400 font-bold uppercase text-xs">Sin recibos de ventas de libros para este filtro.</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ⬛ BANNER CONSOLIDADO DEL GRAN TOTAL */}
            <Card className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Consolidado General de Recibos</h3>
                  <p className="text-xl font-black uppercase text-white tracking-wide">
                    Gran Total ({filteredReceipts.length} Comprobantes Emitidos)
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right border-r border-slate-700 pr-6 hidden sm:block">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Efectivo</span>
                    <span className="font-mono text-lg font-bold text-emerald-400">B/. {totalCash.toFixed(2)}</span>
                  </div>
                  <div className="text-right border-r border-slate-700 pr-6 hidden sm:block">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Tarjetas / Bancos</span>
                    <span className="font-mono text-lg font-bold text-sky-400">B/. {totalCardBank.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Gran Total Recaudado</span>
                    <span className="font-mono text-2xl font-black text-emerald-400">B/. {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
