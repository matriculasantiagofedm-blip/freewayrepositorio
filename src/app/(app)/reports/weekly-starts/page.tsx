'use client';

import { useState, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useDb, useUser } from '@/firebase';
import type { Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, User, CalendarDays, ClipboardList, Car } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, toDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCurrentRole } from '@/hooks/use-current-role';
import Link from 'next/link';

interface WeeklyStart {
    contract: Contract;
    startDate: Date;
    planName: string;
    logType: string;
    instructor: string;
}

export default function WeeklyStartsReportPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const [currentDate, setCurrentDate] = useState(new Date());

  // RESTRICCIÓN DE SEGURIDAD PARA ROL VENTAS
  if (role === 'Ventas') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <div className="bg-red-100 p-4 rounded-full mb-4">
            <ClipboardList className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Acceso Restringido</h3>
        <p className="text-slate-600 mt-2 max-w-sm font-medium">Lo sentimos, el personal de Ventas no tiene permisos para visualizar este reporte de inicios.</p>
        <Button asChild className="mt-8 h-12 px-8 font-bold" variant="default">
            <Link href="/dashboard">Volver al Panel Principal</Link>
        </Button>
      </div>
    );
  }

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']));
  }, [db, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  const getRecommendedLogType = (contract: Contract) => {
    const details = contract.autoMotoDetails || contract.deluxeDetails;
    const plan = (details as any)?.coursePlan || '';
    const planUpper = plan.toUpperCase();
    const typeUpper = contract.type.toUpperCase();
    const transmission = (details as any)?.vehicleTransmission || 'Manual';
    
    if (planUpper.includes('YA SE MANEJAR')) return 'already-know';

    const isMoto = typeUpper.includes('MOTO') || planUpper.includes('MOTO');
    const isAutomatic = transmission === 'Automático';
    const prefix = isMoto ? 'moto-manual-' : (isAutomatic ? 'auto-automatic-' : 'manual-');
    
    if (planUpper.includes('8 HR') || planUpper.includes('BASICO') || planUpper.includes('BÁSICO')) return `${prefix}8h`;
    if (planUpper.includes('10 HR') || planUpper.includes('PLUS')) return `${prefix}10h`;
    if (planUpper.includes('12 HR') || planUpper.includes('PREMIUM')) return `${prefix}12h`;
    
    if (contract.type === 'Curso Moto') return 'moto-manual-8h';
    if (contract.type === 'Curso Auto') return isAutomatic ? 'auto-automatic-10h' : 'manual-8h';
    return `${prefix}12h`;
  };

  const startingStudents = useMemo(() => {
    if (!contracts) return [];
    
    const results: WeeklyStart[] = [];
    const weekInterval = { start: startOfDay(weekStart), end: weekEnd };

    contracts.forEach(c => {
        const d = c.autoMotoDetails || c.deluxeDetails;
        if (!d) return;

        // Buscamos la fecha más temprana de entre todas sus agendas
        const allPracticalDates = [
            ...(d.practicalClassSchedules || []),
            ...(d.motoPracticalClassSchedules || []),
            ...(c.deluxeDetails?.classSchedules || [])
        ].map(s => toDate(s.date)).filter(dt => !isNaN(dt.getTime()));

        if (allPracticalDates.length === 0) return;

        // La fecha de inicio es la mínima de su agenda
        const startDate = new Date(Math.min(...allPracticalDates.map(d => d.getTime())));

        if (isWithinInterval(startDate, weekInterval)) {
            const firstSession = (d.practicalClassSchedules?.[0] || d.motoPracticalClassSchedules?.[0] || c.deluxeDetails?.classSchedules?.[0]);
            
            results.push({
                contract: c,
                startDate,
                planName: (d as any).coursePlan || c.type,
                logType: getRecommendedLogType(c),
                instructor: firstSession?.instructor || 'POR ASIGNAR'
            });
        }
    });

    return results.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [contracts, weekStart, weekEnd]);

  const handlePrintLog = (item: WeeklyStart) => {
    const params = new URLSearchParams({
        name: item.contract.clientName,
        id: item.contract.autoMotoDetails?.studentIdNumber || item.contract.studentIdNumber || '',
        type: item.logType,
        instructor: item.instructor === 'POR ASIGNAR' ? '' : item.instructor
    });
    window.open(`/print-log/${item.contract.id}?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="font-headline text-3xl font-bold">Inicios de Semana</h1>
            <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Alumnos que comienzan clases prácticas</p>
        </div>
        <div className="flex items-center gap-2 bg-background border p-1 rounded-md shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-bold text-[10px] uppercase w-48 text-center flex items-center justify-center gap-2">
                <CalendarDays className="h-3 w-3 text-primary" />
                {format(weekStart, "d 'de' MMM", { locale: es })} - {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: es })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="shadow-md border-none bg-slate-50/50">
        <CardHeader className="pb-3 border-b bg-white">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Estudiantes por Iniciar</CardTitle>
                    <CardDescription>Lista filtrada por la fecha de su primera sesión práctica.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-primary text-white border-none h-7 px-4 font-black">
                    {startingStudents.length} ALUMNOS
                </Badge>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analizando agendas...</p>
                </div>
            ) : startingStudents.length > 0 ? (
                <Table>
                    <TableHeader className="bg-slate-100/50">
                        <TableRow>
                            <TableHead className="font-black text-[10px] uppercase text-slate-500">Fecha Inicio</TableHead>
                            <TableHead className="font-black text-[10px] uppercase text-slate-500">Folio</TableHead>
                            <TableHead className="font-black text-[10px] uppercase text-slate-500">Estudiante</TableHead>
                            <TableHead className="font-black text-[10px] uppercase text-slate-500">Plan de Curso</TableHead>
                            <TableHead className="font-black text-[10px] uppercase text-slate-500">Instructor</TableHead>
                            <TableHead className="text-right font-black text-[10px] uppercase text-slate-500">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-white">
                        {startingStudents.map((item) => (
                            <TableRow key={item.contract.id} className="hover:bg-slate-50 transition-colors">
                                <TableCell className="font-bold text-xs">
                                    {format(item.startDate, "EEEE dd/MM", { locale: es }).toUpperCase()}
                                </TableCell>
                                <TableCell className="font-black text-primary text-xs">
                                    {String(item.contract.folioNumber).padStart(6, '0')}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-black text-sm uppercase leading-tight text-slate-900">{item.contract.clientName}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{item.contract.autoMotoDetails?.studentIdNumber || '---'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 bg-slate-50">
                                            {item.logType.includes('moto') ? <Bike className="h-2.5 w-2.5 mr-1" /> : <Car className="h-2.5 w-2.5 mr-1" />}
                                            {item.contract.autoMotoDetails?.vehicleTransmission || 'Manual'}
                                        </Badge>
                                        <span className="text-[10px] font-bold uppercase text-slate-600 truncate max-w-[150px]">{item.planName}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3 w-3" />
                                        <span className={cn(item.instructor === 'POR ASIGNAR' && "text-red-500 font-bold")}>{item.instructor}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        size="sm" 
                                        onClick={() => handlePrintLog(item)}
                                        className="h-8 bg-blue-600 hover:bg-blue-700 shadow-md font-black text-[10px] uppercase gap-2"
                                    >
                                        <ClipboardList className="h-3.5 w-3.5" />
                                        Bitácora
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
                    <div className="bg-slate-100 p-6 rounded-full mb-4">
                        <CalendarDays className="h-12 w-12 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Sin inicios programados</h3>
                    <p className="text-slate-500 text-sm max-w-xs mt-1">No se han encontrado alumnos que inicien su primera clase práctica en este rango de fechas.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function Bike({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="18.5" cy="17.5" r="3.5" /><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="15" cy="5" r="1" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" />
        </svg>
    );
}
