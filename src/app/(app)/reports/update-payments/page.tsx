'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDb, useUser } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Printer, CalendarIcon, ChevronLeft, Tag } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';

export default function UpdatePaymentsReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchPayments = async (date: Date) => {
    if (!db || !user) return;
    setIsLoading(true);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    try {
      const q = query(
        collection(db, 'update_payments'),
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end)),
        orderBy('paymentDate', 'desc')
      );
      const snap = await getDocs(q);
      const results: any[] = [];
      snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
      setPayments(results);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (mounted) fetchPayments(selectedDate); }, [selectedDate, db, user, mounted]);

  const total = useMemo(() => payments.reduce((sum, p) => sum + (p.amount || 0), 0), [payments]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/reports"><ChevronLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="font-headline text-3xl font-bold uppercase">Actualizaciones de Certificados</h1>
                    <p className="text-muted-foreground text-xs">Reporte de ingresos por renovación de documentos.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Popover><PopoverTrigger asChild><Button variant="outline" className="font-bold"><CalendarIcon className="mr-2 h-4 w-4" />{format(selectedDate, "MMMM yyyy", { locale: es })}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus /></PopoverContent></Popover>
                <Button onClick={() => window.print()} variant="secondary" className="font-bold"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </div>
        </div>

        <Card className="bg-amber-600 text-white border-none shadow-lg">
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Ingreso por Actualizaciones — {format(selectedDate, "MMMM", { locale: es })}</p>
                    <p className="text-4xl font-black">B/. {total.toFixed(2)}</p>
                </div>
                <Tag className="h-12 w-12 opacity-20" />
            </CardContent>
        </Card>

        <Card className="shadow-none border-slate-200">
            <CardHeader className="bg-slate-50 border-b py-2"><CardTitle className="text-xs font-black uppercase">Listado de Actualizaciones Realizadas</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow className="bg-slate-100">
                        <TableHead className="font-black text-[9px] uppercase">Recibo</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Fecha</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Cliente</TableHead>
                        <TableHead className="text-right font-black text-[9px] uppercase">Monto</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Método</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {payments.map((p) => (
                            <TableRow key={p.id} className="text-[10px] h-8">
                                <TableCell className="font-black text-amber-600">{String(p.updateFolio || '').padStart(6, '0')}</TableCell>
                                <TableCell>{format(toDate(p.paymentDate), "dd/MM/yy")}</TableCell>
                                <TableCell className="uppercase font-bold">{p.clientName}</TableCell>
                                <TableCell className="text-right font-black">B/. {Number(p.amount).toFixed(2)}</TableCell>
                                <TableCell className="uppercase font-bold text-slate-500">{p.paymentType}</TableCell>
                            </TableRow>
                        ))}
                        {payments.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-400 italic">Sin resultados.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
