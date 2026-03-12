'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileCheck, CalendarIcon, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';

export default function CertificatesSummaryReport() {
  const db = useDb();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const q = useMemoQuery(() => {
    if (!db) return null;
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    // Buscamos contratos donde se generó certificado hoy
    return query(
      collection(db, 'contracts'),
      where('certificateGeneratedAt', '>=', Timestamp.fromDate(start)),
      where('certificateGeneratedAt', '<=', Timestamp.fromDate(end)),
      orderBy('certificateGeneratedAt', 'desc')
    );
  }, [db, selectedDate]);

  const { data: contracts, isLoading } = useCollection(q);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/reportes-nuevos-2026"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-indigo-600">Consolidado de Certificados</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Control global de folios oficiales emitidos.</p>
          </div>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48 justify-start text-left font-bold uppercase text-[10px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="py-3 px-6 bg-slate-50/50 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Certificados Emitidos Hoy</CardTitle>
          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">Total: {contracts?.length || 0}</span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-200" /></div>
          ) : contracts && contracts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-[10px] font-black uppercase">Folio Cert.</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Estudiante</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Cédula</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Categoría</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50 border-b">
                    <TableCell className="text-xs font-black text-indigo-600">{c.certificateFolio}</TableCell>
                    <TableCell className="text-[10px] font-bold uppercase">{c.clientName}</TableCell>
                    <TableCell className="text-[10px] font-mono">{c.certificateCip || '---'}</TableCell>
                    <TableCell className="text-[10px] font-black text-slate-500 uppercase">{c.certificateLicenseType}</TableCell>
                    <TableCell className="text-[9px] font-bold text-slate-400">
                      {format(toDate(c.certificateGeneratedAt), 'hh:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-xs font-bold text-slate-400 italic">No se emitieron certificados físicos hoy.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
