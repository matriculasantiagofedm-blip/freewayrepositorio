'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDb, useUser } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Printer, CalendarIcon, ChevronLeft, FileText, CheckCircle } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';

export default function CertificatesSummaryReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchCertificates = async (date: Date) => {
    if (!db || !user) return;
    setIsLoading(true);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    try {
      const q = query(
        collection(db, 'contracts'),
        where('certificateGeneratedAt', '>=', Timestamp.fromDate(start)),
        where('certificateGeneratedAt', '<=', Timestamp.fromDate(end)),
        orderBy('certificateGeneratedAt', 'desc')
      );
      const snap = await getDocs(q);
      const results: any[] = [];
      snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
      setContracts(results);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (mounted) fetchCertificates(selectedDate); }, [selectedDate, db, user, mounted]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 pb-20">
        <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/reports"><ChevronLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="font-headline text-3xl font-bold uppercase">Consolidado de Certificados</h1>
                    <p className="text-muted-foreground text-xs">Registro de documentos emitidos mensualmente.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Popover><PopoverTrigger asChild><Button variant="outline" className="font-bold"><CalendarIcon className="mr-2 h-4 w-4" />{format(selectedDate, "MMMM yyyy", { locale: es })}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus /></PopoverContent></Popover>
                <Button onClick={() => window.print()} variant="secondary" className="font-bold"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-500">Total Emitidos</p>
                        <p className="text-3xl font-black text-slate-900">{contracts.length}</p>
                    </div>
                    <FileText className="h-10 w-10 text-slate-300" />
                </CardContent>
            </Card>
        </div>

        <Card className="shadow-none border-slate-200">
            <CardHeader className="bg-slate-50 border-b py-2"><CardTitle className="text-xs font-black uppercase">Relación Mensual de Certificados</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow className="bg-slate-100">
                        <TableHead className="font-black text-[9px] uppercase">Folio Cert.</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Fecha Emisión</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Estudiante</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Cédula</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Tipo Trámite</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Estado</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {contracts.map((c) => (
                            <TableRow key={c.id} className="text-[10px] h-8">
                                <TableCell className="font-black text-blue-600">{c.certificateFolio || '---'}</TableCell>
                                <TableCell>{format(toDate(c.certificateGeneratedAt), "dd/MM/yy")}</TableCell>
                                <TableCell className="uppercase font-bold truncate max-w-[180px]">{c.clientName}</TableCell>
                                <TableCell className="font-mono">{c.autoMotoDetails?.studentIdNumber || c.ampliacionesDetails?.studentIdNumber || '---'}</TableCell>
                                <TableCell className="truncate max-w-[120px]">{c.type}</TableCell>
                                <TableCell><span className="text-green-600 flex items-center gap-1 font-black"><CheckCircle className="h-3 w-3" /> EMITIDO</span></TableCell>
                            </TableRow>
                        ))}
                        {contracts.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-400 italic">Sin certificados registrados en este periodo.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
