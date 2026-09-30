'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDb } from '@/firebase';
import { collection, query, where, Timestamp, doc, setDoc, onSnapshot } from 'firebase/firestore';
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
  FileText, 
  ArrowRightLeft, 
  Save, 
  Check,
  Search,
  Eye
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

// Columnas de métodos de pago en el reporte de caja
const PAYMENT_COLUMNS = [
  { id: 'Efectivo', label: 'EFECTIVO' },
  { id: 'B. General', label: 'YAPPY / B. GENERAL' },
  { id: 'T. Débito', label: 'T. DÉBITO' },
  { id: 'T. Crédito', label: 'T. CRÉDITO' },
  { id: 'BAC', label: 'BAC' },
  { id: 'Cheque', label: 'CHEQUE' },
];

const BILL_DENOMINATIONS = [
  { val: 100, label: 'B/. 100.00' },
  { val: 50, label: 'B/. 50.00' },
  { val: 20, label: 'B/. 20.00' },
  { val: 10, label: 'B/. 10.00' },
  { val: 5, label: 'B/. 5.00' },
  { val: 1, label: 'B/. 1.00' },
];

const COIN_DENOMINATIONS = [
  { val: 1.00, label: 'B/. 1.00' },
  { val: 0.50, label: 'B/. 0.50' },
  { val: 0.25, label: 'B/. 0.25' },
  { val: 0.10, label: 'B/. 0.10' },
  { val: 0.05, label: 'B/. 0.05' },
  { val: 0.01, label: 'B/. 0.01' },
];

/**
 * Limpia y normaliza números de folios eliminando prefijos duplicados
 */
function cleanFolio(raw: any): string {
  if (!raw && raw !== 0) return '';
  let str = String(raw).trim();
  str = str.replace(/^(REC-CONTRATO-|CONTRATO-|REC-CAN-|REC-TRM-|REC-LIB-|REC-)/i, '');
  if (!str) return '';
  if (/^\d+$/.test(str)) {
    str = str.padStart(4, '0');
  }
  return str;
}

/**
 * Mapea métodos de pago ingresados a las categorías estándar
 */
function mapMethod(m?: string) {
  if (!m) return 'Efectivo';
  const lower = m.toLowerCase();
  if (lower.includes('cash') || lower.includes('efectivo')) return 'Efectivo';
  if (lower.includes('debit') || lower.includes('débito')) return 'T. Débito';
  if (lower.includes('credit') || lower.includes('crédito') || lower.includes('cubo') || lower.includes('card') || lower.includes('tarjeta')) return 'T. Crédito';
  if (lower.includes('bac')) return 'BAC';
  if (lower.includes('yappy') || lower.includes('general') || lower.includes('gral') || lower.includes('bg') || lower.includes('ach')) return 'B. General';
  if (lower.includes('cheque') || lower.includes('check')) return 'Cheque';
  return 'B. General';
}

/**
 * Devuelve la etiqueta y estilo del badge de servicio
 */
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

export default function DailyCashReport() {
  const db = useDb();
  const { role: userRole } = useCurrentRole();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterRole, setFilterRole] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'contratos' | 'cancelaciones' | 'otros'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados del Arqueo de Caja Físico y Gastos
  const [billCounts, setBillCounts] = useState<Record<number, number>>({});
  const [coinCounts, setCoinCounts] = useState<Record<number, number>>({});
  const [expenses, setExpenses] = useState<{ id: string; desc: string; amount: number }[]>([]);
  const [isSavingArqueo, setIsSavingArqueo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const start = startOfDay(selectedDate);
  const end = endOfDay(selectedDate);
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const arqueoDocId = `${dateKey}_${filterRole}`;

  // Carga y sincronización de arqueo desde Firestore
  useEffect(() => {
    if (!db) return;
    setSaveStatus('idle');

    const docRef = doc(db, 'daily_cash_arqueos', arqueoDocId);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBillCounts(data.billCounts || {});
        setCoinCounts(data.coinCounts || {});
        setExpenses(data.expenses || []);
      } else {
        setBillCounts({});
        setCoinCounts({});
        setExpenses([]);
      }
    }, (err) => console.error("Error al cargar arqueo:", err));

    return () => unsubscribe();
  }, [db, arqueoDocId]);

  // Guardar Arqueo en Firestore
  const saveArqueoToFirestore = async (b = billCounts, c = coinCounts, e = expenses) => {
    if (!db) return;
    setIsSavingArqueo(true);
    setSaveStatus('saving');
    try {
      const calcTotalFisico = BILL_DENOMINATIONS.reduce((sum, item) => sum + (b[item.val] || 0) * item.val, 0) + 
                              COIN_DENOMINATIONS.reduce((sum, item) => sum + (c[item.val] || 0) * item.val, 0);
      const calcTotalGastos = e.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      await setDoc(doc(db, 'daily_cash_arqueos', arqueoDocId), {
        date: dateKey,
        filterRole,
        billCounts: b,
        coinCounts: c,
        expenses: e,
        totalFisico: calcTotalFisico,
        totalGastos: calcTotalGastos,
        updatedAt: Timestamp.now(),
        updatedBy: userRole || 'Usuario'
      }, { merge: true });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Error guardando arqueo:", err);
      setSaveStatus('idle');
    } finally {
      setIsSavingArqueo(false);
    }
  };

  // Consultas Firestore para las 4 colecciones
  const contractsQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts')) : null), [db]);
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
  const allCancellationsQuery = useMemoQuery(() => (db ? query(collection(db, 'cancellation_payments')) : null), [db]);

  const { data: contracts, isLoading: loadingC } = useCollection<any>(contractsQuery);
  const { data: cancellations, isLoading: loadingCanc } = useCollection<any>(cancellationsQuery);
  const { data: updates, isLoading: loadingU } = useCollection<any>(updatesQuery);
  const { data: bookSales, isLoading: loadingB } = useCollection<any>(bookSalesQuery);
  const { data: allCancellations } = useCollection<any>(allCancellationsQuery);

  // Helper para abono inicial real del contrato
  const getContractInitialPayment = (c: any) => {
    const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
    if (!details) return 0;
    if (details.initialDownPayment !== undefined && details.initialDownPayment !== null) {
      return Number(details.initialDownPayment) || 0;
    }
    const contractFolio = c.folioNumber;
    const contractId = c.id;
    const contractCancellations = allCancellations?.filter((p: any) => 
      (contractFolio && (p.contractFolio === contractFolio || Number(p.contractFolio) === Number(contractFolio))) ||
      (contractId && p.contractId === contractId)
    ) || [];
    const totalCancellationsAmount = contractCancellations.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const currentDownPayment = Number(details.downPayment) || 0;
    return Math.max(0, currentDownPayment - totalCancellationsAmount);
  };

  // Consolidación estricta de transacciones del día
  const transactions = useMemo(() => {
    let list: any[] = [];
    const startTime = start.getTime();
    const endTime = end.getTime();

    // 1. CONTRATOS NUEVOS (Servicio/Factura Inicial)
    // Regla de Negocio Crucial: N° RECIBO = '-' (NUNCA REC-CONTRATO-XXXX), FOLIO CONTRATO = 'CONTRATO-2026-XXXX'
    contracts?.forEach((c: any) => {
      const cDate = toDate(c.activatedAt || c.createdAt);
      if (cDate && cDate.getTime() >= startTime && cDate.getTime() <= endTime) {
        const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
        const initialAmount = getContractInitialPayment(c);
        
        if (initialAmount > 0) {
          const sInfo = getServiceInfo(c.type, details?.coursePlan);
          const rawNum = cleanFolio(c.folioNumber) || 'S-N';
          
          list.push({
            id: `contract-${c.id}`,
            rawId: c.id,
            opType: 'CONTRATO',
            serviceType: sInfo.label,
            serviceBadgeClass: sInfo.badgeClass,
            serviceIcon: sInfo.icon,
            // ❌ NUNCA GENERAR RECIBO PARA UN CONTRATO
            receiptNo: '-',
            // ✅ FOLIO DE CONTRATO SEPARADO E INDEPENDIENTE
            contractFolio: `CONTRATO-${rawNum}`,
            folio: rawNum,
            cedula: details?.studentIdNumber || c.studentIdNumber || '---',
            client: c.clientName || 'Cliente Sin Nombre',
            address: details?.studentAddress || '---',
            serviceDesc: `Abono Inicial (${c.type || 'Curso Auto'})`,
            amount: initialAmount,
            method: mapMethod(details?.paymentType || c.paymentMethod),
            date: cDate,
            seller: c.createdBy || 'Recepción Central',
            category: 'contratos'
          });
        }
      }
    });

    // 2. CANCELACIONES / ABONOS DE SALDOS
    // Regla de Negocio Crucial: N° RECIBO = 'REC-000001', FOLIO CONTRATO = 'CONTRATO-2026-XXXX'
    cancellations?.forEach((p: any) => {
      const sInfo = getServiceInfo(p.contractType || p.type || 'Curso Auto');
      const cancNum = cleanFolio(p.cancellationFolio) || 'S-N';
      const contractNum = cleanFolio(p.contractFolio);
      
      list.push({
        id: `canc-${p.id}`,
        rawId: p.id,
        opType: 'CANCELACIÓN',
        serviceType: sInfo.label,
        serviceBadgeClass: sInfo.badgeClass,
        serviceIcon: sInfo.icon,
        // ✅ NÚMERO DE RECIBO DE COBRO REAL
        receiptNo: `REC-${cancNum}`,
        // ✅ CONTRATO AL QUE SE HIZO EL ABONO
        contractFolio: contractNum ? `CONTRATO-${contractNum}` : '-',
        folio: cancNum,
        cedula: p.studentIdNumber || '---',
        client: p.clientName || 'Cliente Sin Nombre',
        address: p.clientAddress || '---',
        serviceDesc: `Abono de Saldo / Cancelación`,
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate || p.createdAt),
        seller: p.createdBy || 'Caja',
        category: 'cancelaciones'
      });
    });

    // 3. ACTUALIZACIONES DE TRÁMITES
    // Regla de Negocio Crucial: N° RECIBO = 'REC-000001', FOLIO CONTRATO = '-'
    updates?.forEach((p: any) => {
      const sInfo = getServiceInfo('actualizacion');
      const upNum = cleanFolio(p.updateFolio) || 'S-N';
      
      list.push({
        id: `update-${p.id}`,
        rawId: p.id,
        opType: 'ACTUALIZACIÓN',
        serviceType: 'Trámite',
        serviceBadgeClass: sInfo.badgeClass,
        serviceIcon: sInfo.icon,
        receiptNo: `REC-${upNum}`,
        contractFolio: '-',
        folio: upNum,
        cedula: p.studentIdNumber || '---',
        client: p.clientName || 'Cliente Sin Nombre',
        address: p.clientAddress || '---',
        serviceDesc: `Trámite: ${p.reason || 'Vigencia / Duplicado'}`,
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate || p.createdAt),
        seller: p.createdBy || 'Caja',
        category: 'otros'
      });
    });

    // 4. VENTAS DE LIBROS
    // Regla de Negocio Crucial: N° RECIBO = 'REC-000001', FOLIO CONTRATO = '-'
    bookSales?.forEach((p: any) => {
      const sInfo = getServiceInfo('libro');
      const bookNum = cleanFolio(p.bookSaleFolio) || 'S-N';
      
      list.push({
        id: `book-${p.id}`,
        rawId: p.id,
        opType: 'LIBRO',
        serviceType: 'Libro',
        serviceBadgeClass: sInfo.badgeClass,
        serviceIcon: sInfo.icon,
        receiptNo: `REC-${bookNum}`,
        contractFolio: '-',
        folio: bookNum,
        cedula: p.studentIdNumber || '---',
        client: p.clientName || 'Cliente Sin Nombre',
        address: p.clientAddress || '---',
        serviceDesc: `Libro: ${p.bookTitle || 'Material Teórico'}`,
        amount: Number(p.amount) || 0,
        method: mapMethod(p.paymentType),
        date: toDate(p.paymentDate || p.createdAt),
        seller: p.createdBy || 'Caja',
        category: 'otros'
      });
    });

    // Filtrar por rol de usuario
    if (filterRole !== 'all') {
      list = list.filter(t => t.seller === filterRole);
    }

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [contracts, cancellations, updates, bookSales, allCancellations, filterRole, start, end]);

  // Filtrar por pestaña activa y por búsqueda
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (activeTab !== 'all' && t.category !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mClient = t.client.toLowerCase().includes(q);
        const mId = t.cedula.toLowerCase().includes(q);
        const mReceipt = t.receiptNo.toLowerCase().includes(q);
        const mContract = t.contractFolio.toLowerCase().includes(q);
        const mDesc = t.serviceDesc.toLowerCase().includes(q);
        if (!mClient && !mId && !mReceipt && !mContract && !mDesc) return false;
      }
      return true;
    });
  }, [transactions, activeTab, searchQuery]);

  // Totales por Método de Pago
  const totalsByMethod = useMemo(() => {
    const res: Record<string, number> = {};
    PAYMENT_COLUMNS.forEach(c => res[c.id] = 0);
    transactions.forEach(t => {
      if (res[t.method] !== undefined) res[t.method] += t.amount;
    });
    return res;
  }, [transactions]);

  // Totales generales
  const totalFacturado = Object.values(totalsByMethod).reduce((a, b) => a + b, 0);
  const countContratos = transactions.filter(t => t.opType === 'CONTRATO').length;
  const countCancelaciones = transactions.filter(t => t.opType === 'CANCELACIÓN').length;
  const countOtros = transactions.filter(t => t.opType === 'ACTUALIZACIÓN' || t.opType === 'LIBRO').length;

  // Cuadre de Arqueo
  const totalEfectivoSistema = totalsByMethod['Efectivo'] || 0;
  const totalFisico = BILL_DENOMINATIONS.reduce((sum, b) => sum + (billCounts[b.val] || 0) * b.val, 0) + 
                      COIN_DENOMINATIONS.reduce((sum, c) => sum + (coinCounts[c.val] || 0) * c.val, 0);
  const totalGastos = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const efectivoEsperado = totalEfectivoSistema - totalGastos;
  const diferencia = totalFisico - efectivoEsperado;

  // Navegación de Fecha
  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handlePrintReceipt = (t: any) => {
    const queryParams = new URLSearchParams({
      folio: t.receiptNo !== '-' ? t.receiptNo : t.contractFolio,
      contractFolio: t.contractFolio,
      date: format(t.date, 'PPP', { locale: es }),
      name: t.client,
      idNumber: t.cedula,
      address: t.address || '---',
      concept: t.serviceDesc,
      amount: String(t.amount.toFixed(2)),
    });
    window.open(`/print-receipt?${queryParams.toString()}`, '_blank');
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('report-caja-print');
    if (!element) return;
    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = { 
        margin: [0.2, 0.2, 0.2, 0.2], 
        filename: `Cierre_Caja_${format(selectedDate, 'yyyy-MM-dd')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 850 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } 
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
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-slate-100/90 min-h-screen pb-16 font-sans">
      
      {/* ── BARRA DE TÍTULO Y CONTROLES PRINCIPALES ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-10 w-10 rounded-xl border-slate-200">
            <Link href="/dashboard"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Reporte de Cierre de Caja</h1>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Gestión diaria de ingresos por matrículas, abonos a saldo, trámites y arqueo físico.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navegador de Fecha */}
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

      {/* ── PESTAÑAS DE NAVEGACIÓN Y BÚSQUEDA ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        
        {/* Pestañas de Filtro Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <Button
            variant={activeTab === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('all')}
            className={cn("h-8 text-xs font-black rounded-xl uppercase", activeTab === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            Todos ({transactions.length})
          </Button>
          <Button
            variant={activeTab === 'contratos' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('contratos')}
            className={cn("h-8 text-xs font-black rounded-xl uppercase flex items-center gap-1.5", activeTab === 'contratos' ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <FileText className="w-3.5 h-3.5" />
            Contratos ({countContratos})
          </Button>
          <Button
            variant={activeTab === 'cancelaciones' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('cancelaciones')}
            className={cn("h-8 text-xs font-black rounded-xl uppercase flex items-center gap-1.5", activeTab === 'cancelaciones' ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Cancelaciones ({countCancelaciones})
          </Button>
          <Button
            variant={activeTab === 'otros' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('otros')}
            className={cn("h-8 text-xs font-black rounded-xl uppercase flex items-center gap-1.5", activeTab === 'otros' ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Trámites / Libros ({countOtros})
          </Button>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por recibo, contrato, cliente..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-slate-200"
          />
        </div>
      </div>

      {/* ── TABLA PRINCIPAL DEL CIERRE DE CAJA (IMPRIMIBLE) ── */}
      <div id="report-caja-print" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6">
        
        {/* Encabezado Impreso */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2 border-slate-900">
          <h1 className="text-2xl font-black uppercase text-slate-950">FREEWAY ESCUELA DE MANEJO</h1>
          <p className="text-xs font-bold text-slate-600 uppercase">REPORTE DE CIERRE DE CAJA — CONSOLIDADO GENERAL</p>
          <p className="text-xs font-medium text-slate-800 uppercase mt-1">
            {format(selectedDate, "EEEE d 'DE' MMMM 'DE' yyyy", { locale: es })}
          </p>
        </div>

        {/* Tabla de Movimientos */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px] font-sans">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-black">
                <th className="p-2.5 text-left border border-slate-800 whitespace-nowrap min-w-[110px]">N° RECIBO</th>
                <th className="p-2.5 text-left border border-slate-800 whitespace-nowrap min-w-[120px]">FOLIO</th>
                <th className="p-2.5 text-left border border-slate-800 whitespace-nowrap min-w-[90px]">CÉDULA</th>
                <th className="p-2.5 text-left border border-slate-800">CLIENTE</th>
                <th className="p-2.5 text-left border border-slate-800 whitespace-nowrap">ASESOR</th>
                <th className="p-2.5 text-center border border-slate-800 min-w-[90px]">SERVICIO</th>
                <th className="p-2.5 text-center border border-slate-800 min-w-[100px]">OPERACIÓN</th>
                {PAYMENT_COLUMNS.map(col => (
                  <th key={col.id} className="p-2.5 text-right border border-slate-800 whitespace-nowrap min-w-[85px]">
                    {col.label}
                  </th>
                ))}
                <th className="p-2.5 text-center border border-slate-800 print:hidden w-[60px]">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <Loader2 className="animate-spin h-7 w-7 mx-auto text-blue-600" />
                    <span className="text-xs text-slate-400 font-bold uppercase mt-2 block">Cargando transacciones de caja...</span>
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-slate-50 border-b border-slate-200 transition-colors">
                    
                    {/* 1. N° RECIBO (Estrictamente '-' para Contratos, REC-XXXXXX para Recibos de Cobro) */}
                    <td className="p-2 border border-slate-200 font-mono font-black text-xs">
                      {t.receiptNo !== '-' ? (
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {t.receiptNo}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    {/* 2. FOLIO CONTRATO (CONTRATO-2026-XXXX para Contratos o Abonos, '-' para otros) */}
                    <td className="p-2 border border-slate-200 font-mono font-bold text-xs text-slate-800">
                      {t.contractFolio !== '-' ? (
                        <span className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {t.contractFolio}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    {/* 3. CÉDULA */}
                    <td className="p-2 border border-slate-200 font-mono text-slate-600">{t.cedula}</td>

                    {/* 4. CLIENTE */}
                    <td className="p-2 border border-slate-200 font-bold uppercase text-slate-900">{t.client}</td>

                    {/* 5. ASESOR */}
                    <td className="p-2 border border-slate-200 text-slate-600 uppercase font-semibold text-[10px]">{t.seller}</td>

                    {/* 6. SERVICIO */}
                    <td className="p-2 border border-slate-200 text-center">
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase border", t.serviceBadgeClass)}>
                        {t.serviceType}
                      </span>
                    </td>

                    {/* 7. OPERACIÓN */}
                    <td className="p-2 border border-slate-200 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase border",
                        t.opType === 'CONTRATO' && "bg-blue-600 text-white border-blue-700",
                        t.opType === 'CANCELACIÓN' && "bg-emerald-600 text-white border-emerald-700",
                        t.opType === 'ACTUALIZACIÓN' && "bg-purple-600 text-white border-purple-700",
                        t.opType === 'LIBRO' && "bg-amber-600 text-white border-amber-700"
                      )}>
                        {t.opType}
                      </span>
                    </td>

                    {/* 8 a 13. MÉTODOS DE PAGO */}
                    {PAYMENT_COLUMNS.map(col => {
                      const hasAmount = t.method === col.id;
                      return (
                        <td key={col.id} className="p-2 border border-slate-200 text-right font-mono font-bold">
                          {hasAmount ? (
                            <span className="text-slate-950 font-black">B/. {t.amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* 14. ACCIÓN */}
                    <td className="p-1 border border-slate-200 text-center print:hidden">
                      <Button onClick={() => handlePrintReceipt(t)} variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:text-blue-600 hover:bg-blue-50">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={14} className="p-8 text-center italic text-slate-400 font-bold uppercase text-xs">
                    No se encontraron transacciones registradas para este día o filtro.
                  </td>
                </tr>
              )}
            </tbody>

            {/* FILA CONSOLIDADA DE TOTALES POR MÉTODO DE PAGO */}
            <tfoot>
              <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                <td colSpan={7} className="p-3 text-right uppercase tracking-wider">
                  TOTAL FACTURADO (GENERAL):
                </td>
                {PAYMENT_COLUMNS.map(col => (
                  <td key={col.id} className="p-3 text-right font-mono text-xs text-emerald-400 border-l border-slate-800">
                    B/. {(totalsByMethod[col.id] || 0).toFixed(2)}
                  </td>
                ))}
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BANNER DEL GRAN TOTAL FACTURADO */}
        <div className="mt-4 p-4 bg-slate-950 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gran Total Recaudado en el Día</p>
              <h2 className="text-2xl font-black text-white font-mono">B/. {totalFacturado.toFixed(2)}</h2>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Contratos</span>
              <span className="font-mono font-bold text-blue-400">{countContratos} registrados</span>
            </div>
            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Cancelaciones</span>
              <span className="font-mono font-bold text-emerald-400">{countCancelaciones} abonos</span>
            </div>
            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Otros Trámites</span>
              <span className="font-mono font-bold text-amber-400">{countOtros} recibos</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── SECCIÓN DE ARQUEO FÍSICO Y GASTOS MENORES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        
        {/* PANEL DE ARQUEO DE EFECTIVO FÍSICO */}
        <Card className="border-slate-200 shadow-xs rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-900">
                Arqueo de Efectivo Físico
              </CardTitle>
            </div>
            <Button 
              onClick={() => saveArqueoToFirestore()} 
              disabled={isSavingArqueo}
              size="sm" 
              className={cn("h-8 text-xs font-bold rounded-xl transition-all", saveStatus === 'saved' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700")}
            >
              {isSavingArqueo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : (saveStatus === 'saved' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />)}
              {saveStatus === 'saved' ? 'Guardado' : 'Guardar Arqueo'}
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              {/* Billetes */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b pb-1">Billetes</p>
                {BILL_DENOMINATIONS.map(b => (
                  <div key={b.val} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{b.label}:</span>
                    <Input 
                      type="number" 
                      min="0"
                      value={billCounts[b.val] || ''} 
                      onChange={(e) => setBillCounts({ ...billCounts, [b.val]: parseInt(e.target.value) || 0 })}
                      className="w-20 h-7 text-right font-mono font-bold text-xs rounded-lg"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {/* Monedas */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b pb-1">Monedas</p>
                {COIN_DENOMINATIONS.map(c => (
                  <div key={c.val} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{c.label}:</span>
                    <Input 
                      type="number" 
                      min="0"
                      value={coinCounts[c.val] || ''} 
                      onChange={(e) => setCoinCounts({ ...coinCounts, [c.val]: parseInt(e.target.value) || 0 })}
                      className="w-20 h-7 text-right font-mono font-bold text-xs rounded-lg"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Total Físico */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-emerald-900">Total Efectivo Físico Con contado:</span>
              <span className="font-mono text-lg font-black text-emerald-700">B/. {totalFisico.toFixed(2)}</span>
            </div>

          </CardContent>
        </Card>

        {/* PANEL DE EGRESOS Y CUADRE FINAL */}
        <Card className="border-slate-200 shadow-xs rounded-2xl bg-white overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-rose-600" />
                <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-900">
                  Egresos / Gastos Menores
                </CardTitle>
              </div>
              <Button 
                onClick={() => {
                  const updated = [...expenses, { id: Math.random().toString(), desc: '', amount: 0 }];
                  setExpenses(updated);
                  saveArqueoToFirestore(billCounts, coinCounts, updated);
                }} 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs font-bold rounded-xl border-slate-300"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-rose-600" /> Añadir Gasto
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {expenses.length > 0 ? (
                expenses.map(ex => (
                  <div key={ex.id} className="flex items-center gap-2">
                    <Input 
                      placeholder="Concepto o descripción del gasto..." 
                      value={ex.desc}
                      onChange={(e) => setExpenses(expenses.map(item => item.id === ex.id ? { ...item, desc: e.target.value } : item))}
                      className="h-8 text-xs rounded-lg flex-1"
                    />
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="0.00" 
                      value={ex.amount || ''}
                      onChange={(e) => setExpenses(expenses.map(item => item.id === ex.id ? { ...item, amount: parseFloat(e.target.value) || 0 } : item))}
                      className="h-8 w-24 text-right font-mono font-bold text-xs rounded-lg"
                    />
                    <Button 
                      onClick={() => {
                        const updated = expenses.filter(item => item.id !== ex.id);
                        setExpenses(updated);
                        saveArqueoToFirestore(billCounts, coinCounts, updated);
                      }}
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">Sin egresos o gastos registrados en el día.</p>
              )}
              
              <div className="p-2.5 bg-slate-100 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Total Gastos de Caja Chica:</span>
                <span className="font-mono text-rose-600">B/. {totalGastos.toFixed(2)}</span>
              </div>
            </CardContent>
          </div>

          {/* CUADRE FINAL */}
          <div className="p-5 bg-slate-900 text-white border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 uppercase font-semibold">Efectivo Sistema:</span>
              <span className="font-mono font-bold text-slate-200">B/. {totalEfectivoSistema.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 uppercase font-semibold">Efectivo Esperado (- Gastos):</span>
              <span className="font-mono font-bold text-slate-200">B/. {efectivoEsperado.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">Resultado de Cuadre:</span>
              <span className={cn(
                "font-mono text-base font-black px-2 py-0.5 rounded",
                diferencia === 0 && "bg-emerald-500/20 text-emerald-400",
                diferencia > 0 && "bg-blue-500/20 text-blue-400",
                diferencia < 0 && "bg-rose-500/20 text-rose-400"
              )}>
                {diferencia === 0 ? 'CUADRADO EXACTO (B/. 0.00)' : (diferencia > 0 ? `SOBRANTE (+B/. ${diferencia.toFixed(2)})` : `FALTANTE (B/. ${diferencia.toFixed(2)})`)}
              </span>
            </div>
          </div>

        </Card>

      </div>

    </div>
  );
}
