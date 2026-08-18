import React, { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
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
        <p className="text-slate-500 mt-1 text-sm">Selecciona tus horarios para la teoría y la práctica en vivo.</p>
      </div>

      {/* Teoría */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">1</span>
          Horario Teórico Presencial
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTheoreticalSchedules.map((sched) => (
            <div 
              key={sched.id}
              onClick={() => setValue('theoreticalClassSchedule', sched.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 flex flex-col gap-1.5 ${
                currentValues.theoreticalClassSchedule === sched.id 
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${currentValues.theoreticalClassSchedule === sched.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-bold text-sm leading-tight ${currentValues.theoreticalClassSchedule === sched.id ? 'text-blue-900' : 'text-slate-700'}`}>{sched.label}</span>
                </div>
                {currentValues.theoreticalClassSchedule === sched.id && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500 ml-7">{sched.desc}</p>
            </div>
          ))}
        </div>

        {currentValues.theoreticalClassDates?.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-center animate-in fade-in zoom-in duration-300">
            <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-700 text-xs mb-1.5">Fechas Teóricas Asignadas:</h4>
              <div className="flex flex-wrap gap-1.5">
                {currentValues.theoreticalClassDates.map((d: Date, i: number) => (
                  <span key={i} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-600 shadow-sm">
                    {format(d, "EEE d MMM", { locale: es })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Práctica */}
      {currentValues.theoreticalClassSchedule && practicalDays.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">2</span>
              Agenda de Clases Prácticas
            </h3>
            
            {/* Asignación Rápida */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 px-2 uppercase tracking-wider">Asignación Rápida:</span>
              <div className="flex gap-1">
                {timeSlots.map(slot => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => handleAssignAll(slot.id, practicalDays.length)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    {slot.id.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-[100px_1fr] md:grid-cols-[140px_1fr] divide-x divide-slate-100">
              <div className="bg-slate-50/50 p-3 font-semibold text-xs text-slate-500 uppercase flex items-center justify-center">Fecha</div>
              <div className="bg-slate-50/50 p-3 font-semibold text-xs text-slate-500 uppercase">Horarios Disponibles</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {practicalDays.map((dateObj) => {
                const dateStr = format(dateObj, 'yyyy-MM-dd');
                const dayName = format(dateObj, "EEEE d 'de' MMMM", { locale: es });
                const assignedSlot = getAssignedSlotForDate(dateStr);

                return (
                  <div key={dateStr} className="grid grid-cols-[100px_1fr] md:grid-cols-[140px_1fr] divide-x divide-slate-100">
                    <div className="p-3 md:p-4 flex flex-col justify-center bg-slate-50/30">
                      <span className="text-sm font-bold text-slate-800 capitalize leading-tight">{format(dateObj, "EEEE", { locale: es })}</span>
                      <span className="text-[11px] font-medium text-slate-500">{format(dateObj, "d MMM yyyy", { locale: es })}</span>
                    </div>
                    
                    <div className="p-3 md:p-4">
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
                                relative p-2 rounded-lg border text-left transition-all duration-200
                                ${isSelected 
                                  ? 'bg-blue-600 border-blue-600 shadow-md ring-2 ring-blue-600/20 z-10' 
                                  : disabled 
                                    ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' 
                                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}
                              `}
                            >
                              <div className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                {slot.label}
                              </div>
                              <div className={`text-[9px] mt-0.5 font-medium ${isSelected ? 'text-blue-100' : disabled ? 'text-red-500' : 'text-emerald-600'}`}>
                                {occ.label}
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
      )}
    </motion.div>
  );
}
