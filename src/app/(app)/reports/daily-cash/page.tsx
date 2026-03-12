
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useDb, useUser } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Printer, CalendarIcon, Save, Wallet, CheckCircle2, ChevronLeft } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';

interface CashTransaction {
    id: string;
    folio: string;
    client: string;
    idNumber: string;
    service: string;
    amount: number;
    method: string;
    type: string;
    date: Date;
    createdBy?: string;
}

export default function DailyCashReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchTransactions = async (date: Date) => {
    if (!db || !user) return;
    setIsLoading(true);
    const start = startOfDay(date);
    const end = endOfDay(date);

    try {
      const results: CashTransaction[] = [];

      // 1. Contratos Nuevos (Abonos Iniciales) - Basado en activatedAt para caja real
      const qContracts = query(
        collection(db, 'contracts'),
        where('activatedAt', '>=', Timestamp.fromDate(start)),
        where('activatedAt', '<=', Timestamp.fromDate(end))
      );
      
      // 2. Pagos de Saldos
      const qCancellations = query(
        collection(db, 'cancellation_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );

      // 3. Actualizaciones
      const qUpdates = query(
        collection(db, 'update_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );

      // 4. Venta de Libros
      const qBooks = query(
        collection(db, 'book_sale_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );

      const [snapC, snapCan, snapU, snapB] = await Promise.all([
        getDocs(qContracts), getDocs(qCancellations), getDocs(qUpdates), getDocs(qBooks)
      ]);

      snapC.forEach(doc => {
        const data = doc.data();
        const details = data.autoMotoDetails || data.deluxeDetails || data.ampliacionesDetails;
        if (details?.downPayment > 0) {
            results.push({
                id: doc.id,
                folio: String(data.folioNumber).padStart(6, '0'),
                client: data.clientName,
                idNumber: details.studentIdNumber || '',
                service: `Inscripción ${data.type}`,
                amount: details.downPayment,
                method: details.paymentType || 'cash',
                type: 'Inscripción',
                date: toDate(data.activatedAt),
                createdBy: data.createdBy
            });
        }
      });

      snapCan.forEach(doc => {
        const data = doc.data();
        results.push({
            id: doc.id,
            folio: String(data.cancellationFolio).padStart(6, '0'),
            client: data.clientName,
            idNumber: data.studentIdNumber,
            service: `Saldo Contrato ${data.contractFolio}`,
            amount: data.amount,
            method: data.paymentType || 'cash',
            type: 'Saldo',
            date: toDate(data.paymentDate),
            createdBy: data.createdBy
        });
      });

      snapU.forEach(doc => {
        const data = doc.data();
        results.push({
            id: doc.id,
            folio: String(data.updateFolio).padStart(6, '0'),
            client: data.clientName,
            idNumber: data.studentIdNumber,
            service: `Actualización Certificado`,
            amount: data.amount,
            method: data.paymentType || 'cash',
            type: 'Actualización',
            date: toDate(data.paymentDate),
            createdBy: data.createdBy
        });
      });

      snapB.forEach(doc => {
        const data = doc.data();
        results.push({
            id: doc.id,
            folio: String(data.bookSaleFolio).padStart(6, '0'),
            client: data.clientName,
            idNumber: data.studentIdNumber,
            service: `Venta: ${data.bookTitle}`,
            amount: data.amount,
            method: data.paymentType || 'cash',
            type: 'Libro',
            date: toDate(data.paymentDate),
            createdBy: data.createdBy
        });
      });

      setTransactions(results.sort((a, b) => a.date.getTime() - b.date.getTime()));

      // Verificar si ya existe un cierre para esta fecha
      const qCierre = query(collection(db, 'cash_closes'), where('dateString', '==', format(date, 'yyyy-MM-dd')));
      const snapCierre = await getDocs(qCierre);
      setIsClosed(!snapCierre.empty);

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) fetchTransactions(selectedDate);
  }, [selectedDate, db, user, mounted]);

  const totals = useMemo(() => {
    const res = { cash: 0, debit: 0, credit: 0, bac: 0, general: 0, yappy: 0, total: 0 };
    transactions.forEach(t => {
        const m = t.method.toLowerCase();
        if (m === 'cash' || m === 'efectivo') res.cash += t.amount;
        else if (m === 'debit' || m === 'tarjeta débito') res.debit += t.amount;
        else if (m === 'credit' || m === 'tarjeta crédito') res.credit += t.amount;
        else if (m === 'bac') res.bac += t.amount;
        else if (m === 'yappy') res.yappy += t.amount;
        else res.general += t.amount;
        res.total += t.amount;
    });
    return res;
  }, [transactions]);

  const handleSaveClose = async () => {
    if (!db || !user || isClosed) return;
    setIsSaving(true);
    try {
        await addDoc(collection(db, 'cash_closes'), {
            date: Timestamp.fromDate(selectedDate),
            dateString: format(selectedDate, 'yyyy-MM-dd'),
            totals,
            transactionCount: transactions.length,
            closedBy: role || 'Administrador',
            createdAt: serverTimestamp()
        });
        setIsClosed(true);
        toast({ title: 'Caja Cerrada', description: 'El reporte diario ha sido guardado permanentemente.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error' });
    } finally {
        setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/reports"><ChevronLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="font-headline text-3xl font-bold uppercase tracking-tight">Reporte de Caja Diario</h1>
                    <p className="text-muted-foreground text-xs font-medium">Consolidado de ingresos presenciales y web.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="h-11 font-bold">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(selectedDate, "PPP", { locale: es })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
                    </PopoverContent>
                </Popover>
                <Button onClick={() => window.print()} variant="secondary" className="h-11 px-6 font-bold uppercase"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="py-3 px-4"><CardTitle className="text-[10px] font-black uppercase text-slate-500">Ingreso Total</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4"><p className="text-3xl font-black text-primary">B/. {totals.total.toFixed(2)}</p></CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
                <CardHeader className="py-3 px-4"><CardTitle className="text-[10px] font-black uppercase text-green-600">Efectivo</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4"><p className="text-2xl font-black text-green-700">B/. {totals.cash.toFixed(2)}</p></CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="py-3 px-4"><CardTitle className="text-[10px] font-black uppercase text-blue-600">Yappy / General</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4"><p className="text-2xl font-black text-blue-700">B/. {(totals.yappy + totals.general).toFixed(2)}</p></CardContent>
            </Card>
            <Card className={cn("border-2 transition-all", isClosed ? "bg-green-600 text-white border-green-700" : "bg-white border-slate-200")}>
                <CardContent className="p-4 flex flex-col items-center justify-center h-full gap-2">
                    {isClosed ? (
                        <><CheckCircle2 className="h-6 w-6" /><p className="text-xs font-black uppercase">CAJA CERRADA</p></>
                    ) : (
                        <Button onClick={handleSaveClose} disabled={isSaving || transactions.length === 0} className="w-full bg-slate-900 font-bold uppercase text-[10px] h-10">
                            {isSaving ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : <Save className="mr-2 h-3 w-3" />} Guardar Cierre
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>

        <Card className="shadow-sm border-slate-200 print:shadow-none print:border-none">
            <CardHeader className="border-b bg-slate-50/50 print:py-2">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Desglose de Operaciones — {format(selectedDate, "dd/MM/yyyy")}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/20" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-100 hover:bg-slate-100">
                                <TableHead className="w-[80px] font-black text-slate-900 text-[10px] uppercase">Folio</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">Estudiante</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">Servicio</TableHead>
                                <TableHead className="text-right font-black text-slate-900 text-[10px] uppercase">Monto</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">Método</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">Vendedor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((t) => (
                                <TableRow key={t.id} className="text-[11px] font-medium h-10 border-b border-slate-100">
                                    <TableCell className="font-black text-blue-600">{t.folio}</TableCell>
                                    <TableCell className="uppercase font-bold">{t.client}</TableCell>
                                    <TableCell className="text-slate-500 italic">{t.service}</TableCell>
                                    <TableCell className="text-right font-black text-slate-900">B/. {t.amount.toFixed(2)}</TableCell>
                                    <TableCell><span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-black uppercase text-slate-600">{t.method}</span></TableCell>
                                    <TableCell className="text-[10px] text-slate-400 uppercase">{t.createdBy || '---'}</TableCell>
                                </TableRow>
                            ))}
                            {transactions.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">No se registraron movimientos en esta fecha.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter className="bg-slate-900 text-white hover:bg-slate-900">
                            <TableRow>
                                <TableCell colSpan={3} className="text-right font-black uppercase text-[10px]">Gran Total del Día:</TableCell>
                                <TableCell className="text-right font-black text-sm">B/. {totals.total.toFixed(2)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                )}
            </CardContent>
        </Card>

        <div className="hidden print:block mt-20">
            <div className="flex justify-around">
                <div className="text-center w-64">
                    <div className="border-t-2 border-black mb-1"></div>
                    <p className="text-xs font-black uppercase">Firma del Administrador</p>
                </div>
                <div className="text-center w-64">
                    <div className="border-t-2 border-black mb-1"></div>
                    <p className="text-xs font-black uppercase">Contador General</p>
                </div>
            </div>
            <p className="text-center text-[8px] text-slate-400 mt-10 uppercase tracking-[0.3em]">Freeway Escuela de Manejo S.A. — Documento de Auditoría Interna</p>
        </div>

        <style jsx global>{`
            @media print {
                @page { size: letter portrait; margin: 0.5in; }
                header, nav, .print-hidden, button { display: none !important; }
                body { background: white !important; }
                .card { border: none !important; box-shadow: none !important; }
                .table-footer { background-color: #000 !important; color: white !important; -webkit-print-color-adjust: exact; }
            }
        `}</style>
    </div>
  );
}
