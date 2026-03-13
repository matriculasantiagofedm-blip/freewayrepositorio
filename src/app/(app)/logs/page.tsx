'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb } from '@/components/firebase-provider';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { Loader2, ClipboardList, Printer, Car, Bike, CalendarDays, ArrowRight } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Badge } from '@/components/ui/badge';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LogsPage() {
  const db = useDb();
  const { role } = useCurrentRole();

  // Consulta global de contratos activos para detectar inicios de semana
  const activeQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']), orderBy('folioNumber', 'desc')) : null), [db]);
  const { data: allActiveContracts, isLoading: isLoadingWeekly } = useCollection<Contract>(activeQuery);

  // Filtrar estudiantes que inician clases prácticas ESTA SEMANA (Lunes a Domingo)
  const startingThisWeek = useMemo(() => {
    if (!allActiveContracts) return [];
    
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });

    return allActiveContracts.filter(c => {
      const details = c.autoMotoDetails || c.deluxeDetails;
      // Combinar posibles arreglos de agenda según el tipo de contrato
      const schedules = details?.practicalClassSchedules || details?.motoPracticalClassSchedules || (details as any)?.classSchedules || [];
      
      if (schedules.length === 0) return false;

      // Obtener la fecha de la PRIMERA clase registrada para determinar el inicio del curso
      const firstClassDate = toDate(schedules[0].date);
      if (isNaN(firstClassDate.getTime())) return false;

      return isWithinInterval(firstClassDate, { start, end });
    }).sort((a, b) => {
        // Ordenar por fecha de la primera clase
        const dateA = toDate(a.autoMotoDetails?.practicalClassSchedules?.[0]?.date || a.autoMotoDetails?.motoPracticalClassSchedules?.[0]?.date || 0);
        const dateB = toDate(b.autoMotoDetails?.practicalClassSchedules?.[0]?.date || b.autoMotoDetails?.motoPracticalClassSchedules?.[0]?.date || 0);
        return dateA.getTime() - dateB.getTime();
    });
  }, [allActiveContracts]);

  // RESTRICCIÓN DE SEGURIDAD PARA ROL VENTAS
  if (role === 'Ventas') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <div className="bg-red-100 p-4 rounded-full mb-4">
            <ClipboardList className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Acceso Restringido</h3>
        <p className="text-slate-600 mt-2 max-w-sm font-medium">Lo sentimos, el personal de Ventas no tiene permisos para generar bitácoras de control.</p>
        <Button asChild className="mt-8 h-12 px-8 font-bold" variant="default">
            <Link href="/dashboard">Volver al Panel de Control</Link>
        </Button>
      </div>
    );
  }

  const getInstructorName = (contract: Contract) => {
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
    if (details?.instructor) return details.instructor;
    const schedules = contract.autoMotoDetails?.practicalClassSchedules || contract.autoMotoDetails?.motoPracticalClassSchedules || contract.deluxeDetails?.classSchedules || [];
    const sessionWithInstructor = schedules.find((s: any) => s.instructor);
    if (sessionWithInstructor) return sessionWithInstructor.instructor;
    return 'PENDIENTE';
  };

  const getRecommendedLogType = (contract: Contract) => {
    const details = contract.autoMotoDetails || contract.deluxeDetails || contract.ampliacionesDetails;
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

  const handlePrintLog = (contract: Contract) => {
    const logType = getRecommendedLogType(contract);
    const instructor = getInstructorName(contract);
    const params = new URLSearchParams({
        name: contract.clientName || '',
        id: contract.autoMotoDetails?.studentIdNumber || contract.deluxeDetails?.studentIdNumber || contract.ampliacionesDetails?.studentIdNumber || '',
        type: logType,
        instructor: instructor === 'PENDIENTE' ? '' : instructor
    });
    window.open(`/print-log/${contract.id}?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
        <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
                <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="font-headline text-3xl font-bold uppercase tracking-tight">Bitácoras de Control</h1>
                <p className="text-muted-foreground text-sm font-medium">Listado de alumnos que inician capacitación práctica esta semana.</p>
            </div>
        </div>

        <div className="max-w-5xl mx-auto w-full">
            <Card className="shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-slate-900 text-white py-5 px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/10 p-3 rounded-2xl">
                                <CalendarDays className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-widest">Inicios de Clases Prácticas</CardTitle>
                                <CardDescription className="text-xs text-blue-200/60 font-bold uppercase">
                                    Semana: {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "d 'de' MMM", { locale: es })} al {format(endOfWeek(new Date(), { weekStartsOn: 1 }), "d 'de' MMM", { locale: es })}
                                </CardDescription>
                            </div>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-blue-600 text-white border-none font-black text-xs px-3 h-8">
                                {startingThisWeek.length} ESTUDIANTES
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoadingWeekly ? (
                        <div className="p-24 text-center flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Consultando Agenda Semanal...</p>
                        </div>
                    ) : startingThisWeek.length > 0 ? (
                        <div className="divide-y border-b">
                            {startingThisWeek.map((contract) => {
                                const recommended = getRecommendedLogType(contract);
                                const instructor = getInstructorName(contract);
                                const isMoto = recommended.startsWith('moto-');
                                const transmission = (contract.autoMotoDetails as any)?.vehicleTransmission || 'Manual';
                                
                                // Obtener la fecha exacta del primer día
                                const firstSession = contract.autoMotoDetails?.practicalClassSchedules?.[0] || 
                                                 contract.autoMotoDetails?.motoPracticalClassSchedules?.[0];
                                const startDate = toDate(firstSession?.date);

                                return (
                                    <div key={contract.id} className="p-6 hover:bg-slate-50/80 transition-all flex flex-col md:flex-row items-center justify-between gap-6 group">
                                        <div className="flex items-center gap-5 flex-1">
                                            <div className={cn(
                                                "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border-2 shadow-sm transition-transform group-hover:scale-105",
                                                isMoto ? "bg-orange-50 border-orange-100 text-orange-600" : "bg-blue-50 border-blue-100 text-blue-600"
                                            )}>
                                                {isMoto ? <Bike className="h-7 w-7" /> : <Car className="h-7 w-7" />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <p className="font-black text-base uppercase tracking-tight text-slate-900">{contract.clientName}</p>
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase bg-white border-slate-200">
                                                        Folio {String(contract.folioNumber).padStart(6, '0')}
                                                    </Badge>
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase border border-blue-100">
                                                        Inicia: {format(startDate, 'EEEE d', { locale: es })}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-500 uppercase">
                                                    <span className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-slate-300" /> {contract.type}</span>
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px]">{transmission}</span>
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[9px] border",
                                                        instructor === 'PENDIENTE' ? "text-red-600 bg-red-50 border-red-100" : "text-slate-600 bg-white border-slate-200"
                                                    )}>
                                                        Instructor: {instructor}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            <Button 
                                                onClick={() => handlePrintLog(contract)}
                                                className="h-14 px-8 font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-lg group-hover:shadow-blue-200 transition-all gap-3 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                                            >
                                                <Printer className="h-5 w-5" />
                                                Imprimir Bitácora
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-32 text-center flex flex-col items-center gap-6 opacity-40">
                            <div className="bg-slate-100 p-8 rounded-full border-2 border-dashed border-slate-200">
                                <ClipboardList className="h-16 w-16 text-slate-300" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-600">Sin nuevos inicios registrados</p>
                                <p className="text-xs font-medium text-slate-400 max-w-xs mx-auto">No se han detectado contratos cuya primera clase práctica sea en el transcurso de esta semana.</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <div className="mt-8 bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                <div className="bg-blue-100 p-1.5 rounded-lg shrink-0 mt-0.5"><ArrowRight className="h-4 w-4 text-blue-600" /></div>
                <div>
                    <p className="text-[10px] font-black uppercase text-blue-800 mb-1">Nota de Operación</p>
                    <p className="text-[10px] font-medium text-blue-700 leading-relaxed">
                        Este listado se actualiza en tiempo real basado en la **Agenda Práctica** de cada contrato. Si un estudiante no aparece aquí, verifica que su primera clase esté agendada para una fecha dentro de la semana actual en su expediente correspondiente.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}
