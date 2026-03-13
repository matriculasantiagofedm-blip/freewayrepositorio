'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ClipboardList, Printer, Car, Bike, FileCheck, CalendarDays, ArrowRight } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Badge } from '@/components/ui/badge';
import { cn, toDate } from '@/lib/utils';
import Link from 'next/link';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';

export default function LogsPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();
  const { role } = useCurrentRole();

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContracts, setFoundContracts] = useState<Contract[] | null>(null);
  const [searched, setSearched] = useState(false);

  // Consulta global de contratos activos para detectar inicios de semana
  const activeQuery = useMemoQuery(() => (db ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']), orderBy('folioNumber', 'desc')) : null), [db]);
  const { data: allActiveContracts, isLoading: isLoadingWeekly } = useCollection<Contract>(activeQuery);

  // Filtrar estudiantes que inician clases prácticas ESTA SEMANA
  const startingThisWeek = useMemo(() => {
    if (!allActiveContracts) return [];
    
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });

    return allActiveContracts.filter(c => {
      const details = c.autoMotoDetails || c.deluxeDetails;
      const schedules = details?.practicalClassSchedules || details?.motoPracticalClassSchedules || (details as any)?.classSchedules || [];
      
      if (schedules.length === 0) return false;

      // Obtener la fecha de la PRIMERA clase
      const firstClassDate = toDate(schedules[0].date);
      if (isNaN(firstClassDate.getTime())) return false;

      return isWithinInterval(firstClassDate, { start, end });
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
        <p className="text-slate-600 mt-2 max-w-sm font-medium">Lo sentimos, el personal de Ventas no tiene permisos para generar o visualizar bitácoras de control.</p>
        <Button asChild className="mt-8 h-12 px-8 font-bold" variant="default">
            <Link href="/dashboard">Volver al Panel de Control</Link>
        </Button>
      </div>
    );
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdNumber.trim() || !db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce un número de cédula.' });
      return;
    }

    setIsLoading(true);
    setSearched(true);
    setFoundContracts(null);

    try {
      const contractsRef = collection(db, 'contracts');
      const q1 = query(contractsRef, where('autoMotoDetails.studentIdNumber', '==', studentIdNumber.trim()));
      const q2 = query(contractsRef, where('ampliacionesDetails.studentIdNumber', '==', studentIdNumber.trim()));
      const q3 = query(contractsRef, where('deluxeDetails.studentIdNumber', '==', studentIdNumber.trim()));

      const [snapshot1, snapshot2, snapshot3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
      const contractsMap = new Map<string, Contract>();

      const processSnapshot = (snapshot: any) => {
          snapshot.forEach((doc: any) => {
              const contractData = { id: doc.id, ...doc.data() } as Contract;
              if (contractData.status !== 'expired' && !contractsMap.has(doc.id)) {
                contractsMap.set(doc.id, contractData);
              }
          });
      };
      
      processSnapshot(snapshot1);
      processSnapshot(snapshot2);
      processSnapshot(snapshot3);

      const allContracts = Array.from(contractsMap.values());
      setFoundContracts(allContracts.length > 0 ? allContracts : null);
      
    } catch (error) {
      console.error("Error searching for contract:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda.' });
    } finally {
      setIsLoading(false);
    }
  };

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
                <p className="text-muted-foreground text-sm font-medium">Gestión de capacitación práctica e impresión de formatos.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* PANEL IZQUIERDO: BUSCADOR */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="shadow-md border-primary/20">
                    <CardHeader className="py-4">
                        <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                            <Search className="h-4 w-4 text-primary" />
                            Buscador por Cédula
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleSearch} className="space-y-3">
                            <Input 
                                placeholder="Ej: 8-000-000" 
                                value={studentIdNumber} 
                                onChange={(e) => setStudentIdNumber(e.target.value)} 
                                className="h-10 font-bold uppercase tracking-widest"
                            />
                            <Button type="submit" disabled={isLoading} className="w-full h-10 font-bold">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                Buscar Alumno
                            </Button>
                        </form>

                        {searched && !isLoading && foundContracts && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <p className="text-[10px] font-black uppercase text-slate-400">Resultados:</p>
                                {foundContracts.map(c => (
                                    <div key={c.id} className="p-3 bg-slate-50 border rounded-lg flex flex-col gap-2 group">
                                        <div>
                                            <p className="font-black text-xs uppercase leading-tight">{c.clientName}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground">{c.type}</p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            onClick={() => handlePrintLog(c)} 
                                            className="h-8 text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-black"
                                        >
                                            <Printer className="mr-2 h-3 w-3" /> Imprimir Bitácora
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* PANEL DERECHO: INICIOS DE LA SEMANA */}
            <div className="lg:col-span-2">
                <Card className="shadow-lg border-none overflow-hidden h-full">
                    <CardHeader className="bg-slate-900 text-white py-4 px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-2 rounded-lg">
                                    <CalendarDays className="h-5 w-5 text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest">Inicios de Clases Prácticas</CardTitle>
                                    <CardDescription className="text-[10px] text-blue-200/60 font-bold uppercase">Semana: {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM')} al {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM')}</CardDescription>
                                </div>
                            </div>
                            <Badge className="bg-blue-600 text-white border-none font-black text-[10px] px-2 h-6">
                                {startingThisWeek.length} ALUMNOS
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingWeekly ? (
                            <div className="p-20 text-center flex flex-col items-center gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Consultando Agenda...</p>
                            </div>
                        ) : startingThisWeek.length > 0 ? (
                            <div className="divide-y">
                                {startingThisWeek.map((contract) => {
                                    const recommended = getRecommendedLogType(contract);
                                    const instructor = getInstructorName(contract);
                                    const isMoto = recommended.startsWith('moto-');
                                    const isAutomatic = recommended.includes('-automatic-');
                                    const transmission = (contract.autoMotoDetails as any)?.vehicleTransmission || 'Manual';

                                    return (
                                        <div key={contract.id} className="p-4 hover:bg-slate-50 transition-all flex flex-col md:flex-row items-center justify-between gap-4 group">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border-2",
                                                    isMoto ? "bg-orange-50 border-orange-100 text-orange-600" : "bg-blue-50 border-blue-100 text-blue-600"
                                                )}>
                                                    {isMoto ? <Bike className="h-6 w-6" /> : <Car className="h-6 w-6" />}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-sm uppercase tracking-tight text-slate-900">{contract.clientName}</p>
                                                        <Badge variant="outline" className="text-[8px] font-black uppercase h-4 leading-none bg-white">
                                                            Folio {String(contract.folioNumber).padStart(6, '0')}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold text-slate-500 uppercase">
                                                        <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /> {contract.type}</span>
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[8px]">{transmission}</span>
                                                        <span className={cn("px-1.5 py-0.5 rounded text-[8px] border", instructor === 'PENDIENTE' ? "text-red-600 bg-red-50 border-red-100" : "text-slate-600 bg-white border-slate-200")}>
                                                            Instructor: {instructor}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button 
                                                onClick={() => handlePrintLog(contract)}
                                                className="h-12 px-6 font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-md group-hover:shadow-blue-200 transition-all gap-2"
                                            >
                                                <Printer className="h-4 w-4" />
                                                Imprimir Bitácora
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-20 text-center flex flex-col items-center gap-4 opacity-40">
                                <div className="bg-slate-100 p-6 rounded-full"><ClipboardList className="h-12 w-12 text-slate-400" /></div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">Sin nuevos inicios esta semana</p>
                                    <p className="text-[10px] font-medium text-slate-400">Usa el buscador lateral para generar bitácoras de alumnos previos.</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
