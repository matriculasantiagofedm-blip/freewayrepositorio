
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';

export default function CertificatesSummaryReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [diplomas, setDiplomas] = useState<any[]>([]);

  const fetchReportData = async () => {
    if (!db || !user) return;
    setIsLoading(true);
    try {
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      const q = query(
        collection(db, 'contracts'),
        where('certificateGeneratedAt', '>=', Timestamp.fromDate(start)),
        where('certificateGeneratedAt', '<=', Timestamp.fromDate(end))
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (a.certificateFolio || '').localeCompare(b.certificateFolio || '', undefined, { numeric: true }));
      setDiplomas(results);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-headline uppercase">Consolidado de Certificados</h1>
          <p className="text-sm text-muted-foreground font-medium">Control de folios emitidos por fecha.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border p-1 rounded-md bg-white">
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 text-xs">{format(startDate, 'dd/MM/yy')}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-xs">al</span>
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-8 text-xs">{format(endDate, 'dd/MM/yy')}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <Button onClick={() => window.print()} variant="outline"><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
        </div>
      </div>

      <div className="bg-white border-2 border-black p-4">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-slate-100 hover:bg-slate-100 h-8">
              <TableHead className="border border-black p-1 text-center font-bold text-black text-[8px] w-12">FOLIO</TableHead>
              <TableHead className="border border-black p-1 text-center font-bold text-black text-[8px] w-20">ID</TableHead>
              <TableHead className="border border-black p-1 font-bold text-black text-[8px]">ESTUDIANTE</TableHead>
              <TableHead className="border border-black p-1 text-center font-bold text-black text-[8px] w-12">CAT.</TableHead>
              <TableHead className="border border-black p-1 text-center font-bold text-black text-[8px]">FECHA EMISIÓN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : diplomas.map((d) => (
              <TableRow key={d.id} className="h-7 hover:bg-transparent">
                <TableCell className="border border-black p-1 text-center font-black text-[8px]">{d.certificateFolio}</TableCell>
                <TableCell className="border border-black p-1 text-center text-[8px] font-mono">{d.certificateCip || '-'}</TableCell>
                <TableCell className="border border-black p-1 uppercase text-[8px] font-bold">{d.clientName}</TableCell>
                <TableCell className="border border-black p-1 text-center font-black text-[8px] bg-yellow-50">{d.certificateLicenseType || '-'}</TableCell>
                <TableCell className="border border-black p-1 text-center text-[8px]">{format(toDate(d.certificateGeneratedAt), 'dd/MM/yy HH:mm')}</TableCell>
              </TableRow>
            ))}
            {!isLoading && diplomas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">No hay certificados en este rango.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
