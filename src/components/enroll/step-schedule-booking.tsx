import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StepScheduleProps {
  filteredTheoreticalSchedules: { id: string; label: string; desc: string }[];
  currentValues: any;
  practicalDays: Date[];
  timeSlots: { id: string; label: string }[];
  getSlotOccupancy: (dateStr: string, slotId: string) => { available: number; max: number; label: string; isFull: boolean };
  handleAssignAll: (slotId: string, count: number) => void;
  getAssignedSlotForDate: (dateStr: string) => string | undefined;
  handleSlotSelection: (dateStr: string, timeSlot: string) => void;
}

export function StepScheduleBooking({ 
  filteredTheoreticalSchedules, 
  currentValues, 
  practicalDays, 
  timeSlots, 
  getSlotOccupancy,
  handleAssignAll,
  getAssignedSlotForDate,
  handleSlotSelection
}: StepScheduleProps) {
  const { setValue } = useFormContext();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Horarios de Clases</h2>
        <p className="text-slate-500 mt-1 text-sm">Selecciona tus horarios para la teoría y las clases prácticas en vivo.</p>
      </div>

      {/* Teoría */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm">1</span>
          Horario Teórico Presencial
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTheoreticalSchedules.map((sched) => (
            <div 
              key={sched.id}
              onClick={() => setValue('theoreticalClassSchedule', sched.id, { shouldValidate: true, shouldDirty: true })}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col gap-1.5 ${
                currentValues.theoreticalClassSchedule === sched.id 
                  ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-600/30' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${currentValues.theoreticalClassSchedule === sched.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-bold text-sm leading-tight ${currentValues.theoreticalClassSchedule === sched.id ? 'text-blue-900' : 'text-slate-800'}`}>
                    {sched.label}
                  </span>
                </div>
                {currentValues.theoreticalClassSchedule === sched.id && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </div>
              <p className="text-xs text-slate-500 ml-7">{sched.desc}</p>
            </div>
          ))}
        </div>

        {currentValues.theoreticalClassDates?.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 items-center animate-in fade-in duration-300">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-xs mb-1.5">Fechas de Clases Teóricas Asignadas:</h4>
              <div className="flex flex-wrap gap-1.5">
                {currentValues.theoreticalClassDates.map((d: Date, i: number) => (
                  <span key={i} className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 shadow-sm capitalize">
                    {format(d, "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Práctica */}
      {currentValues.theoreticalClassSchedule && practicalDays.length > 0 ? (
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm">2</span>
              Agenda de Clases Prácticas ({practicalDays.length} clases)
            </h3>
            
            {/* Asignación Rápida */}
            <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
              <span className="text-[10px] font-bold text-slate-600 px-1 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Asignar a todas:
              </span>
              <div className="flex gap-1">
                {timeSlots.map(slot => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => handleAssignAll(slot.id, practicalDays.length)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-sm cursor-pointer"
                  >
                    {slot.id.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
            <div className="grid grid-cols-[110px_1fr] md:grid-cols-[160px_1fr] bg-slate-50 divide-x divide-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <div className="p-3.5 text-center">Día / Fecha</div>
              <div className="p-3.5">Horarios Disponibles</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {practicalDays.map((dateObj, idx) => {
                const dateStr = format(dateObj, 'yyyy-MM-dd');
                const assignedSlot = getAssignedSlotForDate(dateStr);

                return (
                  <div key={dateStr} className="grid grid-cols-[110px_1fr] md:grid-cols-[160px_1fr] divide-x divide-slate-100">
                    <div className="p-3.5 md:p-4 flex flex-col justify-center bg-slate-50/40">
                      <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider mb-0.5">Clase {idx + 1}</span>
                      <span className="text-sm font-bold text-slate-800 capitalize leading-tight">{format(dateObj, "EEEE", { locale: es })}</span>
                      <span className="text-xs font-medium text-slate-500 mt-0.5">{format(dateObj, "d 'de' MMM", { locale: es })}</span>
                    </div>
                    
                    <div className="p-3.5 md:p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                        {timeSlots.map(slot => {
                          const occ = getSlotOccupancy(dateStr, slot.id);
                          const isSelected = assignedSlot === slot.id;
                          const disabled = occ.isFull && !isSelected;

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => handleSlotSelection(dateStr, slot.id)}
                              className={`
                                relative p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer
                                ${isSelected 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-md ring-2 ring-blue-600/30 z-10' 
                                  : disabled 
                                    ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed text-slate-400' 
                                    : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-sm text-slate-700'}
                              `}
                            >
                              <div className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                {slot.label}
                              </div>
                              <div className={`text-[10px] font-medium mt-1 ${isSelected ? 'text-blue-100 font-semibold' : occ.isFull ? 'text-red-500' : occ.available === 1 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                                {isSelected ? '✓ Seleccionado' : occ.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Primero selecciona tu horario teórico arriba</p>
          <p className="text-xs text-slate-400">Una vez elegido el horario teórico, se desplegarán automáticamente los días para tus clases prácticas.</p>
        </div>
      )}
    </motion.div>
  );
}
