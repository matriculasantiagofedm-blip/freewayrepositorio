'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Plus, 
  Trash2, 
  Filter, 
  Car, 
  Bike, 
  FileCheck, 
  Sparkles, 
  Compass, 
  BookOpen, 
  RefreshCw, 
  DollarSign, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const COLUMNS = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'T. Débito', label: 'T. Débito' },
  { id: 'T. Crédito', label: 'T. Crédito' },
  { id: 'BAC', label: 'BAC' },
  { id: 'B. General', label: 'B. General' },
  { id: 'Cheque', label: 'Cheque' },
];

const BILLS = [
  { val: 100, label: 'B/. 100.00' },
  { val: 50, label: 'B/. 50.00' },
  { val: 20, label: 'B/. 20.00' },
  { val: 10, label: 'B/. 10.00' },
  { val: 5, label: 'B/. 5.00' },
  { val: 1, label: 'B/. 1.00' },
];

const COINS = [
  { val: 1.00, label: 'B/. 1.00' },
  { val: 0.50, label: 'B/. 0.50' },
  { val: 0.25, label: 'B/. 0.25' },
  { val: 0.10, label: 'B/. 0.10' },
  { val: 0.05, label: 'B/. 0.05' },
  { val: 0.01, label: 'B/. 0.01' },
];

export default function DailyCashReport() {
  const db = useDb();
  const { role: userRole } = useCurrentRole();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterRole, setFilterRole] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'contratos' | 'cancelaciones' | 'otros'>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [coinCounts, setCoinCounts] = useState<Record<number, number>>({});
  const [expenses, setExpenses] = useState<{ id: string; desc: string; amount: number }[]>([]);

  const start = startOfDay(selectedDate);
  const end = endOfDay(selectedDate);

  // Consultas de Firestore
  const contractsQuery = useMemoQuery(
    () => (db ? query(collection(db, 'contracts'), where('activatedAt', '>=', Timestamp.fromDate(start)), where('activatedAt', '<=', Timestamp.fromDate(end))) : null),
    [db, selectedDate]
  );
  
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

  // Consulta auxiliar para obtener todas las cancelaciones históricas de contratos activos hoy (para evitar duplicidad si downPayment fue mutado)
  const allCancellationsQuery = useMemoQuery(
    () => (db ? query(collection(db, 'cancellation_payments')) : null),
    [db]
  );

  const { data: contracts, isLoading: loadingC } = useCollection<any>(contractsQuery);
  const { data: cancellations, isLoading: loadingCanc } = useCollection<any>(cancellationsQuery);
  const { data: updates, isLoading: loadingU } = useCollection<any>(updatesQuery);
  const { data: bookSales, isLoading: loadingB } = useCollection<any>(bookSalesQuery);
  const { data: allCancellations } = useCollection<any>(allCancellationsQuery);

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

  function getServiceInfo(contractType?: string, serviceName?: string) {
    const raw = (contractType || serviceName || '').toLowerCase();
    if (raw.includes('moto') && raw.includes('auto')) {
      return { label: 'Auto + Moto', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Car };
    }
    if (raw.includes('moto')) {
      return { label: 'Moto', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', icon: Bike };
    }
    if (raw.includes('amplia') || raw.includes('ampliacion')) {
      return { label: 'Ampliación', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FileCheck };
    }
    if (raw.includes('deluxe')) {
      return { label: 'Deluxe', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200', icon: Sparkles };
    }
    if (raw.includes('practica') || raw.includes('solo practica')) {
      return { label: 'Práctica', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200', icon: Compass };
    }
    if (raw.includes('libro')) {
      return { label: 'Libro', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200', icon: BookOpen };
    }
    if (raw.includes('actualiza')) {
      return { label: 'Trámite', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', icon: RefreshCw };
    }
    return { label: 'Auto', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', icon: Car };
  }

  // Helper para determinar el abono inicial real del contrato
  const getContractInitialPayment = (c: any) => {
    const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
    if (!details) return 0;
    
    // 1. Si está explícitamente guardado
    if (details.initialDownPayment !== undefined && details.initialDownPayment !== null) {
      return Number(details.initialDownPayment) || 0;
    }
    
    // 2. Si no está guardado, buscar cancelaciones acumuladas para este contrato
    const contractFolio = c.folioNumber;
    const contractId = c.id;
    const contractCancellations = allCancellations?.filter((p: any) => 
      (contractFolio && (p.contractFolio === contractFolio || Number(p.contractFolio) === Number(contractFolio))) ||
      (contractId && p.contractId === contractId)
    ) || [];
    
    const totalCancellationsAmount = contractCancellations.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const currentDownPayment = Number(details.downPayment) || 0;
    
    // El abono inicial es el downPayment actual menos los abonos registrados posteriormente
    const initial = Math.max(0, currentDownPayment - totalCancellationsAmount);
    return initial;
  };

  const transactions = useMemo(() => {
    let list: any[] = [];
    
    // 1. Contratos Nuevos (Abono Inicial en la fecha del contrato)
    contracts?.forEach((c: any) => {
      const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
      const initialAmount = getContractInitialPayment(c);
      
      if (initialAmount > 0) {
        const sInfo = getServiceInfo(c.type, details?.coursePlan);
        list.push({
          id: `contract-${c.id}`,
          rawId: c.id,
          opType: 'CONTRATO',
          serviceType: sInfo.label,
          serviceBadgeClass: sInfo.badgeClass,
          serviceIcon: sInfo.icon,
          folio: String(c.folioNumber || 'S-N').padStart(6, '0'),
          cedula: details?.studentIdNumber || c.studentIdNumber || '---',
          client: c.clientName || 'Cliente Sin Nombre',
          serviceDesc: c.type || 'Curso Auto',
          amount: initialAmount,
          method: mapMethod(details?.paymentType || c.paymentMethod),
          date: toDate(c.activatedAt || c.createdAt),
          seller: c.createdBy || 'Sistema',
          category: 'contratos'
        });
      }
    });

    // 2. Cancelaciones / Abonos de Saldos
    cancellations?.forEach((p: any) => {
      const contractType = p.contractType || p.type || 'Curso Auto';
      const sInfo = getServiceInfo(contractType);
      
      list.push({
        id: `canc-${p.id}`,
        rawId: p.id,
        opType: 'CANCELACIÓN',
        serviceType: sInfo.label,
        serviceBadgeClass: sInfo.badgeClass,
        serviceIcon: sInfo.icon,
        folio: p.contractFolio ? String(p.contractFolio).padStart(6, '0') : String(p.cancellationFolio || '---').padStart(6, '0'),
        cancellationFolio: p.cancellationFolio ? String(p.cancellationFolio).padStart(6, '0') : undefined,
        cedula: p.studentIdNumber || '---',
        client: p.clientName || 'Cliente Sin Nombre',
        serviceDesc: `Cancelación / Abono (${sInfo.label})`,
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja',
        category: 'cancelaciones'
      });
    });

    // 3. Actualizaciones de Trámites
    updates?.forEach((p: any) => {
      const sInfo = getServiceInfo('actualizacion');
      list.push({
        id: `update-${p.id}`,
        rawId: p.id,
        opType: 'ACTUALIZACIÓN',
        serviceType: 'Trámite',
        serviceBadgeClass: sInfo.badgeClass,
        serviceIcon: sInfo.icon,
        folio: String(p.updateFolio || p.contractFolio || '---').padStart(6, '0'),
        cedula: p.studentIdNumber || '---',
        client: p.clientName || 'Cliente Sin Nombre',
        serviceDesc: p.reason || 'Actualización de Contrato',
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja',
        category: 'otros'
      });
    });

    // 4. Ventas de Libros
    bookSales?.forEach((p: any) => {
      const sInfo = getServiceInfo('libro');
      list.push({
        id: `book-${p.id}`,
        rawId: p.id,
        opType: 'LIBRO',
        serviceType: 'Libro',
        serviceBadgeClass: sInfo.badgeClass,
        serviceIcon: sInfo.icon,
        folio: String(p.bookSaleFolio || '---').padStart(6, '0'),
        cedula: p.studentIdNumber || '---',
        client: p.clientName || 'Cliente Sin Nombre',
        serviceDesc: `Libro: ${p.bookTitle || 'Material Teórico'}`,
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate),
        seller: p.createdBy || 'Caja',
        category: 'otros'
      });
    });

    // Filtro por Rol
    if (filterRole !== 'all') {
      list = list.filter(t => t.seller === filterRole);
    }

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [contracts, cancellations, updates, bookSales, allCancellations, filterRole]);

  // Transacciones filtradas por pestaña activa para visualización en pantalla
  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions;
    return transactions.filter(t => t.category === activeTab);
  }, [transactions, activeTab]);

  // Totales por Método de Pago
  const totalsByMethod = useMemo(() => {
    const res: Record<string, number> = {};
    COLUMNS.forEach(c => res[c.id] = 0);
    transactions.forEach(t => {
      if (res[t.method] !== undefined) res[t.method] += t.amount;
    });
    return res;
  }, [transactions]);

  // Resumen de Métricas (KPIs)
  const countContratos = transactions.filter(t => t.opType === 'CONTRATO').length;
  const totalContratos = transactions.filter(t => t.opType === 'CONTRATO').reduce((acc, t) => acc + t.amount, 0);

  const countCancelaciones = transactions.filter(t => t.opType === 'CANCELACIÓN').length;
  const totalCancelaciones = transactions.filter(t => t.opType === 'CANCELACIÓN').reduce((acc, t) => acc + t.amount, 0);

  const countOtros = transactions.filter(t => t.opType === 'ACTUALIZACIÓN' || t.opType === 'LIBRO').length;
  const totalOtros = transactions.filter(t => t.opType === 'ACTUALIZACIÓN' || t.opType === 'LIBRO').reduce((acc, t) => acc + t.amount, 0);

  const totalFacturado = Object.values(totalsByMethod).reduce((a, b) => a + b, 0);
  const totalEfectivoSistema = totalsByMethod['Efectivo'] || 0;
  
  const totalFisico = BILLS.reduce((sum, b) => sum + (billCounts[b.val] || 0) * b.val, 0) + 
                      COINS.reduce((sum, c) => sum + (coinCounts[c.val] || 0) * c.val, 0);
  
  const totalGastos = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const efectivoEsperado = totalEfectivoSistema - totalGastos;
  const diferencia = totalFisico - efectivoEsperado;

  // Navegación de Fechas
  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-to-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: [0.2, 0.2, 0.2, 0.2],
        filename: `Cierre_Caja_Freeway_${format(selectedDate, 'yyyy-MM-dd')}_${filterRole}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 816 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
      };
      await html2pdf().from(element).set(opt).save();
    } catch (e) { 
      console.error("Error al exportar PDF:", e); 
    } finally { 
      setIsDownloading(false); 
    }
  };

  const isLoading = loadingC || loadingCanc || loadingU || loadingB;

  return (
    <div className="flex flex-col gap-5 bg-slate-100/80 min-h-screen pb-12">
      
      {/* ── BARRA SUPERIOR DE CONTROL Y FILTROS ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 py-3 shadow-sm print:hidden">
        <div className="w-full mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Título y Navegación rápida */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-100">
              <Link href="/dashboard"><ChevronLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">Cierre de Caja Diario</h1>
                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                  {filterRole === 'all' ? 'Consolidado General' : filterRole}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Auditoría en tiempo real de ingresos por contratos, cancelaciones y trámites.
              </p>
            </div>
          </div>

          {/* Controles de Fecha y Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Navegador de Días */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePrevDay} 
                className="h-8 w-8 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900"
                title="Día Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button 
                variant={isToday(selectedDate) ? "default" : "ghost"} 
                size="sm" 
                onClick={handleToday}
                className={cn(
                  "h-8 px-2.5 text-xs font-bold rounded-lg transition-all",
                  isToday(selectedDate) 
                    ? "bg-blue-600 text-white shadow-xs hover:bg-blue-700" 
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                )}
              >
                Hoy
              </Button>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextDay} 
                className="h-8 w-8 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900"
                title="Día Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Popover Selector de Fecha */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-48 justify-start text-left font-bold text-xs rounded-xl border-slate-200 bg-white hover:bg-slate-50">
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-600 shrink-0" />
                  <span className="truncate">{format(selectedDate, "EEE, d 'de' MMMM", { locale: es })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
              </PopoverContent>
            </Popover>

            {/* Selector de Rol */}
            <div className="flex items-center bg-white rounded-xl border border-slate-200 px-2.5 py-1">
              <Filter className="h-3.5 w-3.5 text-slate-400 mr-2" />
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="h-7 w-[140px] border-none shadow-none focus:ring-0 text-xs font-semibold uppercase p-0">
                  <SelectValue placeholder="Filtrar Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold uppercase">Todos los Roles</SelectItem>
                  <SelectItem value="Ventas" className="text-xs font-bold uppercase">Ventas</SelectItem>
                  <SelectItem value="Ventas Externas" className="text-xs font-bold uppercase">Ventas Externas</SelectItem>
                  <SelectItem value="Administrador" className="text-xs font-bold uppercase">Administración</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
              <Button 
                onClick={() => window.print()} 
                variant="outline" 
                size="sm" 
                className="h-9 px-3 font-bold text-xs rounded-xl border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-700" /> 
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              
              <Button 
                onClick={handleDownloadPdf} 
                disabled={isDownloading} 
                size="sm" 
                className="h-9 px-3.5 font-bold text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} 
                PDF
              </Button>
            </div>

          </div>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL DEL PANEL ── */}
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-6">

        {/* ── TARJETAS DE RESUMEN EJECUTIVO (KPIs) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          
          {/* Card 1: Total Facturado General */}
          <Card className="border-slate-200/90 shadow-xs bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl overflow-hidden relative">
            <div className="absolute top-2 right-2 p-2 opacity-15">
              <DollarSign className="w-16 h-16" />
            </div>
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold tracking-wider uppercase text-blue-100">Total Facturado (Día)</p>
                <h3 className="text-2xl font-black tracking-tight">B/. {totalFacturado.toFixed(2)}</h3>
              </div>
              <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-blue-100 font-medium">
                <span>{transactions.length} transacciones</span>
                <span>{format(selectedDate, "dd/MM/yyyy")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Contratos Nuevos */}
          <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contratos Nuevos</p>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 space-y-0.5">
                <h3 className="text-xl font-black text-slate-900">B/. {totalContratos.toFixed(2)}</h3>
                <p className="text-xs text-blue-600 font-bold">{countContratos} {countContratos === 1 ? 'matrícula' : 'matrículas'} registradas</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Cancelaciones y Abonos */}
          <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cancelaciones / Saldos</p>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 space-y-0.5">
                <h3 className="text-xl font-black text-slate-900">B/. {totalCancelaciones.toFixed(2)}</h3>
                <p className="text-xs text-emerald-600 font-bold">{countCancelaciones} {countCancelaciones === 1 ? 'cobro de saldo' : 'cobros de saldo'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Efectivo Esperado vs Físico */}
          <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cuadre Efectivo</p>
                <span className={cn(
                  "p-1.5 rounded-lg",
                  diferencia === 0 ? "bg-emerald-50 text-emerald-700" : (diferencia > 0 ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700")
                )}>
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 space-y-0.5">
                <h3 className="text-xl font-black text-slate-900">B/. {efectivoEsperado.toFixed(2)}</h3>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "inline-block w-2 h-2 rounded-full",
                    diferencia === 0 ? "bg-emerald-500" : (diferencia > 0 ? "bg-blue-500" : "bg-rose-500")
                  )} />
                  <p className={cn(
                    "text-xs font-bold",
                    diferencia === 0 ? "text-emerald-600" : (diferencia > 0 ? "text-blue-600" : "text-rose-600")
                  )}>
                    {diferencia === 0 ? 'Cuadrado exacto' : (diferencia > 0 ? `Sobrante (+${diferencia.toFixed(2)})` : `Faltante (${diferencia.toFixed(2)})`)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── PESTAÑAS DE FILTRO RÁPIDO ── */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 print:hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Button
              variant={activeTab === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('all')}
              className={cn("h-8 text-xs font-bold rounded-xl", activeTab === 'all' ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/60")}
            >
              Todos ({transactions.length})
            </Button>
            <Button
              variant={activeTab === 'contratos' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('contratos')}
              className={cn("h-8 text-xs font-bold rounded-xl flex items-center gap-1.5", activeTab === 'contratos' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/60")}
            >
              <FileText className="w-3.5 h-3.5" />
              Contratos ({countContratos})
            </Button>
            <Button
              variant={activeTab === 'cancelaciones' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('cancelaciones')}
              className={cn("h-8 text-xs font-bold rounded-xl flex items-center gap-1.5", activeTab === 'cancelaciones' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/60")}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Cancelaciones ({countCancelaciones})
            </Button>
            <Button
              variant={activeTab === 'otros' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('otros')}
              className={cn("h-8 text-xs font-bold rounded-xl flex items-center gap-1.5", activeTab === 'otros' ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200/60")}
            >
              <Layers className="w-3.5 h-3.5" />
              Trámites / Libros ({countOtros})
            </Button>
          </div>

          <span className="text-xs font-bold text-slate-400 uppercase hidden md:inline">
            Mostrando {filteredTransactions.length} registros
          </span>
        </div>

        {/* ── DOCUMENTO IMPRIMIBLE / REPORTE OFICIAL ── */}
        <div className="w-full flex justify-center print:p-0">
          <div 
            id="report-to-print" 
            className="bg-white w-full max-w-full p-6 sm:p-8 flex flex-col font-sans text-slate-900 min-h-[10.5in] rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:m-0 print:p-0 box-border overflow-hidden"
          >
            
            {/* Membrete Oficial */}
            <div className="text-center mb-6 pb-4 border-b-2 border-slate-900">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center font-black text-xs">
                  CT
                </div>
                <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">
                  FREEWAY ESCUELA DE MANEJO
                </h1>
              </div>
              
              <p className="text-[8pt] font-semibold text-slate-500 uppercase tracking-wide">
                PH Green Plaza, La Chorrera • RUC 155628022-2-2016 DV 2 • Tel: 345-0000
              </p>
              
              <div className="mt-3 py-1.5 bg-slate-900 text-white font-black text-[9.5pt] uppercase tracking-[0.2em] rounded-md">
                REPORTE DE CIERRE DE CAJA — {filterRole === 'all' ? 'CONSOLIDADO GENERAL' : filterRole.toUpperCase()}
              </div>
              
              <p className="text-[8.5pt] font-bold text-slate-800 uppercase mt-2">
                {format(selectedDate, "EEEE d 'DE' MMMM 'DE' yyyy", { locale: es })}
              </p>
            </div>

            {/* TABLA PRINCIPAL DE TRANSACCIONES */}
            <div className="mb-6 overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-[8pt]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                    <th className="border border-slate-300 p-2 text-left w-[65px] font-black uppercase">Folio</th>
                    <th className="border border-slate-300 p-2 text-left w-[90px] font-black uppercase">Cédula</th>
                    <th className="border border-slate-300 p-2 text-left font-black uppercase">Cliente</th>
                    <th className="border border-slate-300 p-2 text-left w-[90px] font-black uppercase">Rol</th>
                    <th className="border border-slate-300 p-2 text-center w-[95px] font-black uppercase">Servicio</th>
                    <th className="border border-slate-300 p-2 text-center w-[100px] font-black uppercase">Operación</th>
                    {COLUMNS.map(c => (
                      <th key={c.id} className="border border-slate-300 p-2 text-right w-[65px] font-black uppercase">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-blue-600" />
                        <span className="text-[8pt] text-slate-400 font-bold uppercase mt-2 block">Cargando movimientos de caja...</span>
                      </td>
                    </tr>
                  ) : transactions.length > 0 ? (
                    transactions.map((t, i) => {
                      const ServiceIcon = t.serviceIcon || Car;
                      const isContrato = t.opType === 'CONTRATO';
                      const isCancelacion = t.opType === 'CANCELACIÓN';

                      return (
                        <tr key={t.id || i} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                          
                          {/* Columna 1: Folio */}
                          <td className="border border-slate-300 p-1.5 font-mono font-bold text-slate-700">
                            {t.folio}
                          </td>

                          {/* Columna 2: Cédula */}
                          <td className="border border-slate-300 p-1.5 font-mono text-slate-700">
                            {t.cedula}
                          </td>

                          {/* Columna 3: Cliente */}
                          <td className="border border-slate-300 p-1.5 font-bold uppercase text-slate-900" title={t.client}>
                            {t.client}
                          </td>

                          {/* Columna 4: Asesor / Rol */}
                          <td className="border border-slate-300 p-1.5 font-semibold uppercase text-slate-600" title={t.seller}>
                            {t.seller}
                          </td>

                          {/* Columna 5: Tipo de Servicio (Auto, Moto, Ampliación, etc.) */}
                          <td className="border border-slate-300 p-1.5 text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[7pt] font-bold uppercase border",
                              t.serviceBadgeClass
                            )}>
                              <ServiceIcon className="w-3 h-3 shrink-0" />
                              <span>{t.serviceType}</span>
                            </span>
                          </td>

                          {/* Columna 6: Tipo de Operación (Contrato vs Cancelación) */}
                          <td className="border border-slate-300 p-1.5 text-center font-bold">
                            <span className={cn(
                              "inline-block px-2 py-0.5 rounded text-[7pt] font-black uppercase border",
                              isContrato 
                                ? "bg-blue-100 text-blue-800 border-blue-200" 
                                : isCancelacion 
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                                  : t.opType === 'LIBRO' 
                                    ? "bg-amber-100 text-amber-800 border-amber-200" 
                                    : "bg-purple-100 text-purple-800 border-purple-200"
                            )}>
                              {t.opType}
                            </span>
                          </td>

                          {/* Columnas de Métodos de Pago */}
                          {COLUMNS.map(c => (
                            <td 
                              key={c.id} 
                              className={cn(
                                "border border-slate-300 p-1.5 text-right font-mono",
                                t.method === c.id ? "font-bold bg-slate-50 text-slate-950" : "text-slate-300"
                              )}
                            >
                              {t.method === c.id ? t.amount.toFixed(2) : '-'}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="p-10 text-center italic text-slate-400 font-bold uppercase text-[8.5pt]">
                        No se encontraron registros de caja para la fecha y filtro seleccionados.
                      </td>
                    </tr>
                  )}

                  {/* Fila de Totales Facturados */}
                  <tr className="bg-slate-900 text-white font-black text-[8pt] border-t-2 border-slate-900">
                    <td colSpan={6} className="border border-slate-900 p-2 text-right tracking-wider uppercase">
                      TOTAL FACTURADO ({filterRole === 'all' ? 'GENERAL' : filterRole.toUpperCase()}):
                    </td>
                    {COLUMNS.map(c => (
                      <td key={c.id} className="border border-slate-900 p-2 text-right font-mono text-white">
                        {totalsByMethod[c.id].toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── ARQUEO DE CAJA FÍSICA Y GASTOS / CONCILIACIÓN ── */}
            <div className="flex flex-col gap-6 mt-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Arqueo de Efectivo Físico */}
                <div className="border border-slate-300 p-3.5 rounded-xl bg-white shadow-xs">
                  <h3 className="font-black text-[9pt] uppercase border-b border-slate-200 mb-3 pb-1 flex justify-between items-center text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                      Arqueo de Efectivo Físico
                    </span>
                    <span className="text-slate-400 font-bold text-[7pt] tracking-wider uppercase">(Conteo Manual)</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Billetes */}
                    <div className="space-y-1 bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                      <p className="text-[7pt] font-black uppercase text-slate-500 mb-1">Billetes</p>
                      {BILLS.map(b => (
                        <div key={b.val} className="flex items-center justify-between gap-1">
                          <span className="text-[7.5pt] font-bold text-slate-700 w-16">{b.label}:</span>
                          <input 
                            type="number" 
                            min="0"
                            className="w-12 h-5 border border-slate-200 rounded text-center text-[8pt] font-black focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                            value={billCounts[b.val] || ''}
                            onChange={(e) => setBillCounts({ ...billCounts, [b.val]: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Monedas */}
                    <div className="space-y-1 bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                      <p className="text-[7pt] font-black uppercase text-slate-500 mb-1">Monedas</p>
                      {COINS.map(c => (
                        <div key={c.val} className="flex items-center justify-between gap-1">
                          <span className="text-[7.5pt] font-bold text-slate-700 w-16">{c.label}:</span>
                          <input 
                            type="number" 
                            min="0"
                            className="w-12 h-5 border border-slate-200 rounded text-center text-[8pt] font-black focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                            value={coinCounts[c.val] || ''}
                            onChange={(e) => setCoinCounts({ ...coinCounts, [c.val]: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center bg-slate-100 p-2 rounded-lg">
                    <span className="font-black text-[8.5pt] uppercase text-slate-800">Total Físico Recontado:</span>
                    <span className="font-black text-[11pt] font-mono text-blue-900 bg-white px-2.5 py-0.5 rounded border border-slate-300">
                      B/. {totalFisico.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 2. Egresos / Gastos y Resumen de Cuadre */}
                <div className="flex flex-col gap-4">
                  
                  {/* Caja de Egresos */}
                  <div className="border border-slate-300 p-3.5 rounded-xl bg-white shadow-xs flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-200 mb-2 pb-1">
                      <h3 className="font-black text-[9pt] uppercase text-slate-900">Egresos / Gastos Menores</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[7pt] font-black border border-slate-200 rounded-lg hover:bg-slate-100 print:hidden cursor-pointer" 
                        onClick={() => setExpenses([...expenses, { id: Math.random().toString(), desc: '', amount: 0 }])}
                      >
                        <Plus className="h-3 w-3 mr-1 text-blue-600" /> Añadir Gasto
                      </Button>
                    </div>

                    <div className="space-y-1.5 max-h-[95px] overflow-y-auto mb-2 pr-1">
                      {expenses.length === 0 ? (
                        <p className="text-[7.5pt] text-slate-400 italic py-2 text-center">Sin egresos registrados.</p>
                      ) : (
                        expenses.map(e => (
                          <div key={e.id} className="flex gap-1.5 items-center group">
                            <input 
                              className="flex-1 h-6 border-b border-slate-200 text-[7.5pt] font-semibold uppercase placeholder:text-slate-300 px-1 focus:border-slate-800 bg-transparent"
                              placeholder="Concepto del gasto..."
                              value={e.desc}
                              onChange={(v) => setExpenses(expenses.map(ex => ex.id === e.id ? { ...ex, desc: v.target.value } : ex))}
                            />
                            <input 
                              type="number"
                              className="w-16 h-6 border border-slate-200 rounded text-right pr-1 text-[7.5pt] font-black focus:border-slate-800 bg-white"
                              value={e.amount || ''}
                              onChange={(v) => setExpenses(expenses.map(ex => ex.id === e.id ? { ...ex, amount: parseFloat(v.target.value) || 0 } : ex))}
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 text-red-500 opacity-60 group-hover:opacity-100 print:hidden shrink-0 cursor-pointer" 
                              onClick={() => setExpenses(expenses.filter(ex => ex.id !== e.id))}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-auto pt-1.5 border-t border-slate-200 flex justify-between font-black text-[8pt] bg-slate-50 px-2 py-1 rounded">
                      <span className="text-slate-700">Total Gastos:</span>
                      <span className="text-red-600 font-mono">B/. {totalGastos.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Tarjeta de Conciliación y Cuadre */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xs">
                    <div className="space-y-1.5 text-[8pt]">
                      <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-300">
                        <span className="uppercase text-[7pt] font-bold">Total Facturado Sistema:</span>
                        <span className="font-mono font-bold text-white">B/. {totalFacturado.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-300">
                        <span className="uppercase text-[7pt] font-bold">Efectivo Esperado (Sistema - Gastos):</span>
                        <span className="font-mono font-black text-blue-300">B/. {efectivoEsperado.toFixed(2)}</span>
                      </div>
                      
                      <div className={cn(
                        "flex justify-between items-center mt-2 p-2 rounded-lg border",
                        diferencia === 0 
                          ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-400" 
                          : diferencia > 0 
                            ? "bg-blue-950/60 border-blue-500/50 text-blue-300" 
                            : "bg-rose-950/60 border-rose-500/50 text-rose-400"
                      )}>
                        <div className="flex items-center gap-1.5">
                          {diferencia === 0 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                          )}
                          <span className="font-black uppercase text-[8.5pt]">
                            {diferencia === 0 ? 'Caja Cuadrada' : (diferencia > 0 ? 'Sobrante' : 'Faltante')}:
                          </span>
                        </div>
                        
                        <span className="font-mono font-black text-[12pt]">
                          {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ── BLOQUE DE FIRMAS Y RESPONSABLES ── */}
              <div className="mt-6 pt-4 grid grid-cols-2 gap-12 px-8 pb-2">
                <div className="text-center">
                  <div className="border-t-2 border-slate-800 mb-1 w-3/4 mx-auto"></div>
                  <p className="text-[8pt] font-black uppercase text-slate-900">Firma del Cajero / Asesor</p>
                  <p className="text-[6.5pt] font-bold text-slate-500 uppercase tracking-tight">
                    {filterRole !== 'all' ? filterRole : (userRole || 'Responsable de Turno')}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="border-t-2 border-slate-800 mb-1 w-3/4 mx-auto"></div>
                  <p className="text-[8pt] font-black uppercase text-slate-900">Firma Administración</p>
                  <p className="text-[6.5pt] font-bold text-slate-500 uppercase tracking-tight">
                    Auditoría Interna y Contabilidad
                  </p>
                </div>
              </div>

            </div>

            {/* Pie de página con Timestamp oficial */}
            <div className="text-center text-[6pt] text-slate-400 font-bold uppercase mt-4 tracking-[0.2em] border-t border-slate-200 pt-2">
              SISTEMA CONTRACTTIME • AUDITORÍA OFICIAL DE CAJA • GENERADO EL {format(new Date(), 'PPpp', { locale: es })}
            </div>

          </div>
        </div>

      </div>

      {/* ── ESTILOS GLOBALES DE IMPRESIÓN ── */}
      <style jsx global>{`
        @media print {
          @page { 
            size: letter portrait; 
            margin: 0.3in; 
          }
          body { 
            background: white !important; 
            margin: 0 !important; 
          }
          header, footer, nav, .print-hidden { 
            display: none !important; 
          }
          #report-to-print { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important; 
            width: 100% !important; 
            max-width: none !important;
            padding: 0 !important;
          }
          input { 
            border: none !important; 
            background: transparent !important; 
            outline: none !important; 
            padding: 0 !important; 
          }
          .bg-slate-50 { 
            background-color: #f8fafc !important; 
            -webkit-print-color-adjust: exact; 
          }
          .bg-slate-100 { 
            background-color: #f1f5f9 !important; 
            -webkit-print-color-adjust: exact; 
          }
          .bg-slate-900 { 
            background-color: #0f172a !important; 
            color: #ffffff !important;
            -webkit-print-color-adjust: exact; 
          }
        }
      `}</style>
    </div>
  );
}

