'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, query, where } from 'firebase/firestore';
import { CalendarSearch, Car, Clock, Sparkles, AlertCircle, CalendarRange, Bike, AlertTriangle } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { isPanamaHoliday } from '@/lib/holidays';
import { toDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TIME_OPTIONS = [
  "08:00am a 10:00am",
  "10:00am a 12:00pm",
  "01:00pm a 03:00pm",
  "03:00pm a 05:00pm"
];

const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
  '08:00am a 10:00am': '8am-10am',
  '10:00am a 12:00pm': '10am-12pm',
  '01:00pm a 03:00pm': '1pm-3pm',
  '03:00pm a 05:00pm': '3pm-5pm',
};

const getGlobalCapacity = (date: Date, slotId: string) => {
  const day = date.getDay(); 
  if (day === 0) return 0; // Domingo cerrado
  if (day >= 2 && day <= 5 && slotId === '8am-10am') return 3; // Martes a Viernes 8am-10am (1 en Teoría)
  if (day === 6 && slotId === '3pm-5pm') return 3; // Sábado 3pm-5pm (1 en Teoría)
  return 4; // Cupo normal (4 Instructores)
};

type TransmissionType = 'Automático' | 'Manual' | 'Moto';

export function LiveAvailabilityWidget() {
  const db = useDb();
  const { user } = useUser();
  const pathname = usePathname();
  const [transmission, setTransmission] = useState<TransmissionType>('Automático');
  const [dayFilter, setDayFilter] = useState<'Todos' | 'Semana' | 'Sábados'>('Todos');
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAllowedPath = pathname?.includes('/contracts') || pathname?.includes('/informes/vehicle-schedule') || pathname?.includes('/manual-schedule') || false;

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('openAvailabilityWidget', handleOpen);
    return () => window.removeEventListener('openAvailabilityWidget', handleOpen);
  }, []);

  const handleSelectSlot = (date: Date, time: string, vehicle: string) => {
    // @ts-ignore
    const index = window.__ACTIVE_SLOT_INDEX__ ?? -1;
    const event = new CustomEvent('agendaSlotSelected', { detail: { date, time, vehicle, index } });
    window.dispatchEvent(event);
    setOpen(false); // Cierra el modal
    // @ts-ignore
    window.__ACTIVE_SLOT_INDEX__ = undefined;
  };

  const shouldFetch = isAllowedPath || open;

  const activeContractsQuery = useMemoQuery(() => (db && user && shouldFetch) ? query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed'])) : null, [db, user, shouldFetch]);
  const manualEntriesQuery = useMemoQuery(() => (db && user && shouldFetch) ? query(collection(db, 'manual_schedules')) : null, [db, user, shouldFetch]);
  
  const { data: allContracts } = useCollection<any>(activeContractsQuery);
  const { data: allManualEntries } = useCollection<any>(manualEntriesQuery);

  const availabilityData = useMemo(() => {
    const vehicleOccupancy: Record<string, string[]> = {};
    const globalCounts: Record<string, number> = {};
    
    if (!shouldFetch) return { vehicleOccupancy, globalCounts };

    const processEntry = (date: any, slotString: string, vehicle: string, name: string) => {
        if (!date || !slotString || !vehicle) return;
        const dObj = toDate(date);
        if (isNaN(dObj.getTime())) return;

        const dateKey = format(dObj, 'yyyy-MM-dd');
        const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString;
        const vKey = `${dateKey}|${slotId}|${vehicle}`;
        const gKey = `${dateKey}|${slotId}`;
        
        if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
        if (!vehicleOccupancy[vKey].includes(name)) {
             vehicleOccupancy[vKey].push(name);
             globalCounts[gKey] = (globalCounts[gKey] || 0) + 1;
        }
    };

    allManualEntries?.forEach(entry => {
        if (entry.classType === 'Teórica') return;
        processEntry(entry.date, entry.timeSlot, entry.vehicle, entry.studentName);
    });

    allContracts?.forEach(c => {
        const processSlots = (slots: any[]) => {
            slots.forEach(s => {
                processEntry(s.date, s.time, s.vehicle, c.clientName);
            });
        };
        if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
        if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
        if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
    });

    return { vehicleOccupancy, globalCounts };
  }, [allContracts, allManualEntries, shouldFetch]);

  // Generar próximos días filtrando domingos y aplicando filtro de días
  const futureDays = useMemo(() => {
    return Array.from({length: 80})
      .map((_, i) => addDays(new Date(), i + 1))
      .filter(d => {
         const day = d.getDay();
         if (day === 0) return false; // NUNCA domingos
         if (dayFilter === 'Semana') return day >= 1 && day <= 5;
         if (dayFilter === 'Sábados') return day === 6;
         return true; // Todos
      });
  }, [dayFilter]);

  return (
    <>
      <Button 
         onClick={() => {
           // @ts-ignore
           window.__ACTIVE_SLOT_INDEX__ = undefined;
           setOpen(true);
         }}
         size="lg" 
         className={cn(
           "fixed bottom-8 right-8 z-[100] rounded-full shadow-[0_0_40px_rgba(37,99,235,0.4)] print:hidden",
           "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
           "text-white font-black gap-3 px-8 py-7 transition-all duration-500 hover:scale-110",
           "border-2 border-white/20 backdrop-blur-md group",
           isAllowedPath ? 'flex' : 'hidden'
         )}
      >
         <CalendarSearch className="h-6 w-6 group-hover:animate-bounce" />
         <span className="hidden sm:inline">Radar de Disponibilidad</span>
         <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
         </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[7xl] w-[95vw] h-[90vh] md:h-[85vh] p-0 overflow-hidden bg-slate-50/95 flex flex-col rounded-[2rem] shadow-2xl border border-white/40 backdrop-blur-xl">
         
         {/* HEADER PREMIUM */}
         <div className="px-6 md:px-10 py-6 bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 flex flex-col md:flex-row items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-5">
               <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-3xl shadow-lg shadow-indigo-500/30 ring-1 ring-white/50">
                 <CalendarRange className="h-8 w-8 text-white" />
               </div>
               <div>
                 <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">
                    Radar en Vivo
                 </h2>
                 <div className="flex items-center gap-2 mt-1.5">
                   <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                   </div>
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sincronizando Firebase Database</span>
                 </div>
               </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-3 mt-6 md:mt-0 items-center">
               <div className="flex bg-slate-200/50 p-1.5 rounded-2xl shadow-inner ring-1 ring-slate-900/5 items-center">
                  {(['Automático', 'Manual', 'Moto'] as TransmissionType[]).map(t => (
                    <button 
                     key={t}
                     onClick={() => setTransmission(t)} 
                     className={cn(
                       "px-4 md:px-6 py-2 md:py-3 rounded-xl text-xs md:text-sm font-black transition-all duration-300 flex items-center gap-2",
                       transmission === t 
                         ? "bg-white text-indigo-700 shadow-md ring-1 ring-slate-200" 
                         : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                     )}
                    >
                      {t === 'Automático' && <Car className="h-4 w-4 hidden md:block" />}
                      {t === 'Manual' && <Sparkles className="h-4 w-4 hidden md:block" />}
                      {t === 'Moto' && <Bike className="h-4 w-4 hidden md:block" />}
                      {t}
                    </button>
                  ))}
               </div>

               <div className="flex bg-slate-200/50 p-1.5 rounded-2xl shadow-inner ring-1 ring-slate-900/5 items-center">
                  {(['Todos', 'Semana', 'Sábados'] as const).map(f => (
                    <button 
                     key={f}
                     onClick={() => setDayFilter(f)} 
                     className={cn(
                       "px-4 py-2 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 flex items-center gap-2",
                       dayFilter === f 
                         ? "bg-white text-emerald-700 shadow-md ring-1 ring-slate-200" 
                         : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                     )}
                    >
                      {f}
                    </button>
                  ))}
               </div>
            </div>
         </div>

         {/* LEYENDA Y RESUMEN */}
         <div className="bg-indigo-50/50 px-6 py-3 border-b border-indigo-100 flex items-center justify-center md:justify-start gap-6 overflow-x-auto text-xs font-bold text-indigo-900">
            <span className="flex items-center gap-2 opacity-80"><Car size={14}/> 
              {transmission === 'Automático' ? "Flota: Picanto Blanco / Bronce / Skoda Automatico" : transmission === 'Manual' ? "Flota: Spark / Skoda Manual / Hyundai Manual" : "Flota: Moto Roja / Negra"}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div> Disponible</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100"></div> Poco Espacio</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-300 ring-4 ring-slate-100"></div> Lleno</span>
         </div>

         {/* GRID DE DIAS */}
         <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-b from-transparent to-slate-100/50" ref={scrollRef}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20 max-w-7xl mx-auto">
               {futureDays.map((d, i) => {
                  const dateKey = format(d, 'yyyy-MM-dd');
                  const holiday = isPanamaHoliday(d);
                  const formattedDay = format(d, 'EEEE', {locale: es});
                  const formattedDate = format(d, 'dd MMM', {locale: es});
                  const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                  return (
                     <div 
                        key={i} 
                        className={cn(
                          "bg-white rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
                          isToday ? "border-indigo-300 ring-4 ring-indigo-50" : "border-slate-100",
                          holiday && "bg-amber-50/30 border-amber-100 opacity-70 grayscale-[0.2]"
                        )}
                     >
                        <div className="flex items-center justify-between mb-5">
                           <div>
                             <h3 className="text-xl font-black text-slate-900 capitalize flex items-center gap-2">
                               {formattedDay}
                               {isToday && <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Hoy</span>}
                             </h3>
                             <p className="text-sm font-bold text-slate-400 capitalize">{formattedDate} {holiday && "• FERIADO"}</p>
                           </div>
                           <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 font-bold border border-slate-100">
                              {format(d, 'dd')}
                           </div>
                        </div>

                        {holiday ? (
                           <div className="flex flex-col items-center justify-center py-8 bg-amber-50 rounded-2xl border border-amber-100/50 text-amber-600">
                              <AlertTriangle size={24} className="mb-2 opacity-50" />
                              <span className="font-bold text-sm">Día Feriado</span>
                              <span className="text-xs font-medium opacity-60">No hay clases programadas</span>
                           </div>
                        ) : (
                           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                              {TIME_OPTIONS.map(slotStr => {
                                 const slotId = TIME_STRING_TO_SLOT_MAP[slotStr] || slotStr;
                                 let transVehicles = ['Picanto Blanco', 'Picanto Bronce', 'Skoda Automatico'];
                                 if (transmission === 'Manual') transVehicles = ['Spark', 'Skoda Manual', 'Hyundai Manual'];
                                 if (transmission === 'Moto') transVehicles = ['Moto Roja', 'Moto Negra'];
                                 
                                 let occ = 0;
                                 transVehicles.forEach(v => {
                                    const vKey = `${dateKey}|${slotId}|${v}`;
                                    if (availabilityData?.vehicleOccupancy?.[vKey]?.length > 0) occ++;
                                 });
                                 
                                 const gKey = `${dateKey}|${slotId}`;
                                 const globalOcc = availabilityData?.globalCounts?.[gKey] || 0;
                                 const globalCap = getGlobalCapacity(d, slotId);
                                 
                                 const transCapacity = transVehicles.length;
                                 const hasCapacity = (occ < transCapacity) && (globalOcc < globalCap);
                                 const libres = Math.max(0, Math.min(transCapacity - occ, globalCap - globalOcc));

                                 const freeVehicle = transVehicles.find(v => {
                                    const vKey = `${dateKey}|${slotId}|${v}`;
                                    return !(availabilityData?.vehicleOccupancy?.[vKey]?.length > 0);
                                 }) || '';

                                 // Estilos de la tarjeta segun disponibilidad
                                 let bgClass = "bg-slate-50 border-slate-200 text-slate-400 opacity-60 pointer-events-none"; // Lleno
                                 let badgeClass = "bg-slate-200 text-slate-500";
                                 let iconNode = <AlertCircle size={14} />;
                                 
                                 if (hasCapacity) {
                                    if (libres === 1) {
                                       // Poco espacio
                                       bgClass = "bg-amber-50/50 hover:bg-amber-100 border-amber-200 text-amber-700 hover:shadow-lg hover:shadow-amber-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 group";
                                       badgeClass = "bg-amber-100 text-amber-700 border border-amber-200 group-hover:bg-amber-200";
                                       iconNode = <Clock size={14} className="group-hover:animate-pulse" />;
                                    } else {
                                       // Disponible (2 o más)
                                       bgClass = "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 group";
                                       badgeClass = "bg-emerald-100 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-200";
                                       iconNode = <Clock size={14} className="group-hover:animate-pulse" />;
                                    }
                                 }

                                 return (
                                    <button 
                                       key={slotStr}
                                       onClick={() => hasCapacity ? handleSelectSlot(d, slotStr, freeVehicle) : null}
                                       disabled={!hasCapacity}
                                       className={cn("flex flex-col items-center justify-center p-3 rounded-2xl border", bgClass)}
                                    >
                                       <span className="font-bold text-xs mb-2 flex items-center gap-1 text-center leading-tight h-8">
                                          {slotId.replace('-', ' - ')}
                                       </span>
                                       
                                       <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 w-full justify-center", badgeClass)}>
                                          {hasCapacity ? iconNode : <span className="block w-2 h-2 rounded-full bg-slate-400"></span>}
                                          {hasCapacity ? `${libres} Libres` : "Lleno"}
                                       </div>
                                    </button>
                                 );
                              })}
                           </div>
                        )}
                     </div>
                  );
               })}
            </div>
         </div>
         
         <div className="py-4 bg-white/50 backdrop-blur-md border-t border-slate-200 text-center">
             <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
               Freeway CRM - Sistema Inteligente de Horarios
             </p>
         </div>

        </DialogContent>
      </Dialog>
    </>
  );
}

