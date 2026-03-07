
'use client';

import { useState, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import type { Contract, ManualSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon, Printer, Download, UserCheck, Search, Users } from 'lucide-react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AttendanceRow {
    name: string;
    idNumber: string;
    plan: string;
    schedule: string;
}

export default function TheoryAttendanceReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isDownloading, setIsDownloading] = useState(false);

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']));
  }, [db, user]);

  const manualEntriesQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return collection(db, 'manual_schedules');
  }, [db, user]);

  const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsQuery);
  const { data: manualEntries, isLoading: isLoadingManual } = useCollection<ManualSchedule>(manualEntriesQuery);

  const attendanceList = useMemo(() => {
    if (!contracts && !manualEntries) return [];
    
    const results: AttendanceRow[] = [];
    const targetDate = startOfDay(reportDate);

    // Procesar Contratos
    contracts?.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
        if (!d) return;

        const checkAndAdd = (date: any) => {
            if (!date) return;
            const classDate = toDate(date);
            if (isSameDay(classDate, targetDate)) {
                results.push({
                    name: c.clientName,
                    idNumber: d.studentIdNumber || c.studentIdNumber || '---',
                    plan: c.type,
                    schedule: (d as any).theoreticalClassSchedule || (d as any).theoreticalClassTime || 'Teoría',
                });
            }
        };

        // Diferentes estructuras de fechas teóricas por tipo de contrato
        const theoryDates = (d as any).theoreticalClassDates || (d as any).theoreticalClasses || [];
        if (Array.isArray(theoryDates)) {
            theoryDates.forEach(dt => checkAndAdd(dt));
        }
        if ((d as any).theoreticalClassDate) {
            checkAndAdd((d as any).theoreticalClassDate);
        }
    });

    // Procesar Entradas Manuales
    manualEntries?.forEach(e => {
        if (e.classType === 'Teórica' && isSameDay(toDate(e.date), targetDate)) {
            results.push({
                name: e.studentName,
                idNumber: 'MANUAL',
                plan: e.coursePlan || 'Manual',
                schedule: e.timeSlot || 'Teoría',
            });
        }
    });

    // Ordenar por Horario y luego por Nombre
    return results.sort((a, b) => {
        if (a.schedule !== b.schedule) return a.schedule.localeCompare(b.schedule);
        return a.name.localeCompare(b.name);
    });
  }, [contracts, manualEntries, reportDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('attendance-print-content');
    if (!element) return;

    setIsDownloading(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `Lista_Asistencia_Teorica_${format(reportDate, 'dd-MM-yyyy')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', width: 800 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdf().from(element).set(opt).save();
      toast({ title: "PDF Generado", description: "La lista de asistencia se ha descargado." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: letter portrait; margin: 10mm; }
          header, footer, nav, aside, .print-hide, button { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .print-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid black !important; font-size: 9pt !important; }
          th, td { border: 1px solid black !important; padding: 6px 4px !important; color: black !important; }
          .h-12 { height: 3rem !important; }
        }
      `}} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print-hide">
        <div>
            <h1 className="font-headline text-3xl font-bold">Asistencia Teórica</h1>
            <p className="text-muted-foreground">Genera la lista de firmas para el aula teórica por día.</p>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[240px] justify-start text-left font-normal h-11">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportDate ? format(reportDate, "PPP", { locale: es }) : <span>Elegir día</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={reportDate} onSelect={(d) => d && setReportDate(d)} initialFocus />
                </PopoverContent>
            </Popover>
            <Button onClick={handlePrint} variant="outline" className="h-11"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            <Button onClick={handleDownloadPdf} disabled={isDownloading} className="h-11 bg-blue-600 hover:bg-blue-700">
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} PDF
            </Button>
        </div>
      </div>

      <div id="attendance-print-content" className="print-container bg-white">
        <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-tighter">FREEWAY ESCUELA DE MANEJO S.A.</h1>
            <h2 className="text-lg font-bold uppercase mt-1">LISTA DE ASISTENCIA - CAPACITACIÓN TEÓRICA</h2>
            <p className="text-sm font-bold uppercase mt-2 bg-slate-100 py-1 border-y border-black">
                FECHA: {format(reportDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}
            </p>
        </div>

        {isLoadingContracts || isLoadingManual ? (
            <div className="flex justify-center py-20 print-hide"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>
        ) : (
            <div className="space-y-6">
                <div className="rounded-md border border-black overflow-hidden">
                    <Table className="border-collapse">
                        <TableHeader className="bg-slate-50 print:bg-slate-100">
                            <TableRow className="border-black">
                                <TableHead className="w-10 text-center font-bold text-black border-black">N°</TableHead>
                                <TableHead className="font-bold text-black border-black">Nombre del Estudiante</TableHead>
                                <TableHead className="font-bold text-black border-black">Cédula / ID</TableHead>
                                <TableHead className="font-bold text-black border-black">Curso / Plan</TableHead>
                                <TableHead className="font-bold text-black border-black">Horario</TableHead>
                                <TableHead className="w-40 font-bold text-black border-black text-center">Firma de Asistencia</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceList.length > 0 ? (
                                attendanceList.map((row, idx) => (
                                    <TableRow key={idx} className="h-12 border-black">
                                        <TableCell className="text-center font-medium border-black">{idx + 1}</TableCell>
                                        <TableCell className="font-bold uppercase border-black">{row.name}</TableCell>
                                        <TableCell className="border-black">{row.idNumber}</TableCell>
                                        <TableCell className="text-xs border-black">{row.plan}</TableCell>
                                        <TableCell className="text-xs font-bold border-black">{row.schedule}</TableCell>
                                        <TableCell className="border-black"></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic border-black">
                                        No hay estudiantes programados para teoría en esta fecha.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-8">
                    <div className="border border-black p-4 rounded-sm space-y-2">
                        <h3 className="font-bold text-xs uppercase underline">Resumen de Aula:</h3>
                        <p className="text-sm">Total de Alumnos Programados: <span className="font-bold">{attendanceList.length}</span></p>
                        <p className="text-sm">Alumnos Presentes: _________</p>
                        <p className="text-sm">Alumnos Ausentes: _________</p>
                    </div>
                    <div className="flex flex-col items-center justify-end">
                        <div className="w-64 border-t border-black mb-1"></div>
                        <p className="text-xs font-bold uppercase">Firma del Instructor / Supervisor</p>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
