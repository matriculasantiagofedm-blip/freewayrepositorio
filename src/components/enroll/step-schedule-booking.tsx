import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Zap, ShieldAlert, Sparkles } from 'lucide-react';
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

  const isTheoreticalSelected = !!currentValues.theoreticalClassSchedule;
  const isSemanalTheo = currentValues.theoreticalClassSchedule?.includes('Semanal');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Horarios de Clases</h2>
        <p className="text-slate-500 mt-1 text-sm">Organiza fácilmente tus clases teóricas y prácticas de manejo.</p>
      </div>

      {/* BLOQUE 1: TEORÍA */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-md shadow-blue-600/20">
              1
            </span>
            Horario de Clases Teóricas Presenciales
          </h3>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            Obligatorio
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredTheoreticalSchedules.map((sched) => {
            const isSelected = currentValues.theoreticalClassSchedule === sched.id;
            return (
              <div 
                key={sched.id}
                onClick={() => setValue('theoreticalClassSchedule', sched.id, { shouldValidate: true, shouldDirty: true })}
                className={`cursor-pointer rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between gap-2.5 ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-600/30' 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm leading-tight ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>
                        {sched.label}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{sched.desc}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentValues.theoreticalClassDates?.length > 0 && (
          <div className="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center animate-in fade-in duration-300">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-blue-950 text-xs mb-1">
                Fechas de tus Clases Teóricas:
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {currentValues.theoreticalClassDates.map((d: Date, i: number) => (
                  <span key={i} className="bg-white border border-blue-200 px-2.5 py-0.5 rounded-lg text-xs font-bold text-blue-900 shadow-sm capitalize">
                    {format(d, "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BLOQUE 2: PRÁCTICA */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-md shadow-blue-600/20">
              2
            </span>
            Horarios de tus Clases Prácticas de Manejo
          </h3>
          {practicalDays.length > 0 && (
            <span className="text-xs font-bold text-slate-600">
              {practicalDays.length} clases de 2 horas
            </span>
          )}
        </div>

        {isTheoreticalSelected && practicalDays.length > 0 ? (
          <div className="space-y-4">
            {/* Atajo rápido */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs font-bold text-blue-950">
                  ¿Quieres el mismo horario para todas tus clases?
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {timeSlots.map(slot => {
                  const isConflictWithSemanalTheo = isSemanalTheo && slot.id.includes('10:00am');
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={isConflictWithSemanalTheo}
                      onClick={() => handleAssignAll(slot.id, practicalDays.length)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        isConflictWithSemanalTheo
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                          : 'bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 active:scale-95'
                      }`}
                    >
                      {slot.id.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Listado de Clases Prácticas */}
            <div className="space-y-3">
              {practicalDays.map((dateObj, idx) => {
                const dateStr = format(dateObj, 'yyyy-MM-dd');
                const assignedSlot = getAssignedSlotForDate(dateStr);
                const hasAssigned = !!assignedSlot;

                return (
                  <div 
                    key={dateStr}
                    className={`p-4 rounded-2xl border transition-all duration-200 ${
                      hasAssigned 
                        ? 'border-blue-300 bg-white shadow-sm ring-1 ring-blue-100' 
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Fecha y Número de Clase */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          hasAssigned ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 capitalize">
                              {format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
                            </span>
                            {hasAssigned && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Asignada ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">Clase Práctica #{idx + 1} (2 Horas)</p>
                        </div>
                      </div>

                      {/* Selector de Horarios en Pills */}
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
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
                                px-3 py-2 rounded-xl text-xs font-bold transition-all text-center flex flex-col justify-center items-center cursor-pointer
                                ${isSelected 
                                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600/30' 
                                  : disabled 
                                    ? 'bg-slate-100 border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed' 
                                    : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'}
                              `}
                            >
                              <span>{slot.id.split(' ')[0]}</span>
                              <span className={`text-[9px] font-semibold mt-0.5 ${isSelected ? 'text-blue-100' : occ.isFull ? 'text-red-500' : 'text-slate-400'}`}>
                                {isSelected ? 'Elegido' : occ.isFull ? 'Lleno' : `${occ.available} cupos`}
                              </span>
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
        ) : (
          <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-blue-500 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">Primero elige tu horario teórico en el Punto 1 arriba</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Una vez seleccionada tu teoría, se habilitará inmediatamente el calendario de tus clases prácticas.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
