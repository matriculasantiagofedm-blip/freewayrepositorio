'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useDb, useUser } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
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
    service: string;
    amount: number;
    method: string;
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

      // 1. Contratos (Abonos iniciales)
      const qC = query(collection(db, 'contracts'), where('activatedAt', '>=', Timestamp.fromDate(start)), where('activatedAt', '<=', Timestamp.fromDate(end)));
      // 2. Pagos de Saldos
      const qCan = query(collection(db, 'cancellation_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));
      // 3. Actualizaciones
      const qU = query(collection(db, 'update_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));
      // 4. Libros
      const qB = query(collection(db, 'book_sale_payments'), where('paymentDate', '>=', Timestamp.fromDate(start)), where('paymentDate', '<=', Timestamp.fromDate(end)));

      const [snapC, snapCan, snapU, snapB] = await Promise.all([getDocs(qC), getDocs(qCan), getDocs(qU), getDocs(qB)]);

      snapC.forEach(doc => {
        const d = doc.data();
        const details = d.autoMotoDetails || d.deluxeDetails || d.ampliacionesDetails;
        if (details?.downPayment > 0 && d.status !== 'draft') {
            results.push({ id: doc.id, folio: String(d.folioNumber).padStart(6, '0'), client: d.clientName, service: `Inscripción ${d.type}`, amount: details.downPayment, method: details.paymentType || 'cash', date: toDate(d.activatedAt), createdBy: d.createdBy });
        }
      });

      snapCan.forEach(doc => {
        const d = doc.data();
        results.push({ id: doc.id, folio: String(d.cancellationFolio).padStart(6, '0'), client: d.clientName, service: `Saldo Contrato ${d.contractFolio}`, amount: d.amount, method: d.paymentType || 'cash', date: toDate(d.paymentDate), createdBy: d.createdBy });
      });

      snapU.forEach(doc => {
        const d = doc.data();
        results.push({ id: doc.id, folio: String(d.updateFolio).padStart(6, '0'), client: d.clientName, service: `Actualización Certificado`, amount: d.amount, method: d.paymentType || 'cash', date: toDate(d.paymentDate), createdBy: d.createdBy });
      });

      snapB.forEach(doc => {
        const d = doc.data();
        results.push({ id: doc.id, folio: String(d.bookSaleFolio).padStart(6, '0'), client: d.clientName, service: `Venta: ${d.bookTitle}`, amount: d.amount, method: d.paymentType || 'cash', date: toDate(d.paymentDate), createdBy: d.createdBy });
      });

      setTransactions(results.sort((a, b) => a.date.getTime() - b.date.getTime()));
      
      const qCierre = query(collection(db, 'cash_closes'), where('dateString', '==', format(date, 'yyyy-MM-dd')));
      const snapCierre = await getDocs(qCierre);
      setIsClosed(!snapCierre.empty);
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (mounted) fetchTransactions(selectedDate); }, [selectedDate, db, user, mounted]);

  const totals = useMemo(() => {
    const res = { cash: 0, yappy: 0, bac: 0, card: 0, other: 0, total: 0 };
    transactions.forEach(t => {
        const m = t.method.toLowerCase();
        if (m === 'cash' || m === 'efectivo') res.cash += t.amount;
        else if (m === 'yappy') res.yappy += t.amount;
        else if (m === 'bac') res.bac += t.amount;
        else if (m.includes('tarjeta') || m === 'debit' || m === 'credit') res.card += t.amount;
        else res.other += t.amount;
        res.total += t.amount;
    });
    return res;
  }, [transactions]);

  const handleSaveClose = async () => {
    if (!db || !user || isClosed) return;
    setIsSaving(true);
    try {
        await addDoc(collection(db, 'cash_closes'), { date: Timestamp.fromDate(selectedDate), dateString: format(selectedDate, 'yyyy-MM-dd'), totals, closedBy: role, createdAt: serverTimestamp() });
        setIsClosed(true);
        toast({ title: 'Caja Cerrada' });
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsSaving(false); }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/reports"><ChevronLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="font-headline text-3xl font-bold uppercase">Caja Diario</h1>
                    <p className="text-muted-foreground text-xs">Arqueo físico de ingresos Freeway.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Popover><PopoverTrigger asChild><Button variant="outline" className="font-bold"><CalendarIcon className="mr-2 h-4 w-4" />{format(selectedDate, "PPP", { locale: es })}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus /></PopoverContent></Popover>
                <Button onClick={() => window.print()} variant="secondary" className="font-bold"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 print:grid-cols-5">
            <Card className="bg-slate-900 text-white"><CardContent className="p-4 text-center"><p className="text-[10px] font-black uppercase opacity-60">Total Recaudado</p><p className="text-2xl font-black">B/. {totals.total.toFixed(2)}</p></CardContent></Card>
            <Card className="bg-green-50 border-green-200"><CardContent className="p-4 text-center"><p className="text-[10px] font-black uppercase text-green-600">Efectivo</p><p className="text-xl font-black text-green-700">B/. {totals.cash.toFixed(2)}</p></CardContent></Card>
            <Card className="bg-blue-50 border-blue-200"><CardContent className="p-4 text-center"><p className="text-[10px] font-black uppercase text-blue-600">Yappy</p><p className="text-xl font-black text-blue-700">B/. {totals.yappy.toFixed(2)}</p></CardContent></Card>
            <Card className="bg-orange-50 border-orange-200"><CardContent className="p-4 text-center"><p className="text-[10px] font-black uppercase text-orange-600">BAC / Tarjetas</p><p className="text-xl font-black text-orange-700">B/. {(totals.bac + totals.card).toFixed(2)}</p></CardContent></Card>
            <Card className={cn("border-2", isClosed ? "bg-green-600 text-white border-green-700" : "bg-white border-slate-200")}>
                <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
                    {isClosed ? <><CheckCircle2 className="h-5 w-5" /><p className="text-[10px] font-black">CERRADA</p></> : 
                    <Button onClick={handleSaveClose} disabled={isSaving || transactions.length === 0} size="sm" className="w-full bg-slate-900 text-[9px] h-8 font-black">CERRAR CAJA</Button>}
                </CardContent>
            </Card>
        </div>

        <Card className="shadow-none border-slate-200">
            <CardHeader className="bg-slate-50 border-b py-2"><CardTitle className="text-xs font-black uppercase">Detalle de Ingresos — {format(selectedDate, "dd/MM/yyyy")}</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow className="bg-slate-100 hover:bg-slate-100">
                        <TableHead className="font-black text-[9px] uppercase">Folio</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Cliente</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Servicio</TableHead>
                        <TableHead className="text-right font-black text-[9px] uppercase">Monto</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Método</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Vendedor</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {transactions.map((t) => (
                            <TableRow key={t.id} className="text-[10px] h-8">
                                <TableCell className="font-black text-blue-600">{t.folio}</TableCell>
                                <TableCell className="uppercase font-bold truncate max-w-[150px]">{t.client}</TableCell>
                                <TableCell className="text-slate-500 italic">{t.service}</TableCell>
                                <TableCell className="text-right font-black">B/. {t.amount.toFixed(2)}</TableCell>
                                <TableCell><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">{t.method}</span></TableCell>
                                <TableCell className="uppercase opacity-60">{t.createdBy || '---'}</TableCell>
                            </TableRow>
                        ))}
                        {transactions.length === 0 && <TableRow><TableCell colSpan={6} className="h-20 text-center text-slate-400 italic">Sin movimientos.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <div className="hidden print:block mt-12">
            <div className="flex justify-around">
                <div className="text-center w-48"><div className="border-t border-black mb-1"></div><p className="text-[8px] font-black uppercase">Firma Administrador</p></div>
                <div className="text-center w-48"><div className="border-t border-black mb-1"></div><p className="text-[8px] font-black uppercase">Firma Receptor</p></div>
            </div>
        </div>

        <style jsx global>{`
            @media print {
                @page { size: letter portrait; margin: 0.5in; }
                header, nav, .print-hidden, button { display: none !important; }
                body { background: white !important; }
                .card { border: none !important; box-shadow: none !important; }
            }
        `}</style>
    </div>
  );
}
