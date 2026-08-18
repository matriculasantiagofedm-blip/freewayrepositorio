import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, CheckCircle2, AlertCircle, CalendarSearch, ChevronRight, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StepScheduleProps {
  filteredTheoreticalSchedules: { id: string; label: string; desc: string }[];
  currentValues: any;
  practicalDays: Date[];
  timeSlots: { id: string; label: string }[];
  availableTheoStartDates: Date[];
  selectedTheoStartDate: Date;
  onSelectTheoStartDate: (date: Date, offset: number) => void;
  theoWeekOffset: number;
  availablePracticalStartDates: Date[];
  selectedPracticalStartDate: Date;
  onSelectPracticalStartDate: (date: Date, offset: number) => void;
  practicalWeekOffset: number;
  practicalType: string;
  getSlotOccupancy: (dateStr: string, slotId: string) => { available: number; max: number; label: string; isFull: boolean };
  getAssignedSlotForDate: (dateStr: string) => string | undefined;
  handleSlotSelection: (dateStr: string, timeSlot: string) => void;
}

export function StepScheduleBooking({ 
  filteredTheoreticalSchedules, 
  currentValues, 
  practicalDays, 
  timeSlots, 
  availableTheoStartDates,
  selectedTheoStartDate,
  onSelectTheoStartDate,
  theoWeekOffset,
  availablePracticalStartDates,
  selectedPracticalStartDate,
  onSelectPracticalStartDate,
  practicalWeekOffset,
  practicalType,
  getSlotOccupancy,
  getAssignedSlotForDate,
  handleSlotSelection
}: StepScheduleProps) {
  const { setValue } = useFormContext();

  const isTheoreticalSelected = !!currentValues.theoreticalClassSchedule;

  // Handlers para Teoría
  const handlePrevTheoWeek = () => {
    if (theoWeekOffset > 0 && availableTheoStartDates[theoWeekOffset - 1]) {
      onSelectTheoStartDate(availableTheoStartDates[theoWeekOffset - 1], theoWeekOffset - 1);
    }
  };

  const handleNextTheoWeek = () => {
    if (theoWeekOffset < availableTheoStartDates.length - 1 && availableTheoStartDates[theoWeekOffset + 1]) {
      onSelectTheoStartDate(availableTheoStartDates[theoWeekOffset + 1], theoWeekOffset + 1);
    }
  };

  // Handlers para Práctica (100% Independiente)
  const handlePrevPracticalWeek = () => {
    if (practicalWeekOffset > 0 && availablePracticalStartDates[practicalWeekOffset - 1]) {
      onSelectPracticalStartDate(availablePracticalStartDates[practicalWeekOffset - 1], practicalWeekOffset - 1);
    }
  };

  const handleNextPracticalWeek = () => {
    if (practicalWeekOffset < availablePracticalStartDates.length - 1 && availablePracticalStartDates[practicalWeekOffset + 1]) {
      onSelectPracticalStartDate(availablePracticalStartDates[practicalWeekOffset + 1], practicalWeekOffset + 1);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-7"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Horarios de Clases</h2>
        <p className="text-slate-500 mt-0.5 text-xs">
          Organiza las fechas y horas de tu teoría y tus clases prácticas de manera independiente.
        </p>
      </div>

      {/* BLOQUE 1: TEORÍA */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-xs">
              1
            </span>
            Horario de Clases Teóricas Presenciales
          </h3>
          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
            Obligatorio
          </span>
        </div>
        
        {/* Selector de Modalidad Teórica */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTheoreticalSchedules.map((sched) => {
            const isSelected = currentValues.theoreticalClassSchedule === sched.id;
            return (
              <div 
                key={sched.id}
                onClick={() => setValue('theoreticalClassSchedule', sched.id, { shouldValidate: true, shouldDirty: true })}
                className={`cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 flex flex-col justify-between gap-2 ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600/30' 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className={`text-xs sm:text-sm font-semibold leading-tight ${isSelected ? 'text-blue-950' : 'text-slate-700'}`}>
                        {sched.label}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-normal">{sched.desc}</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* NAVEGADOR DE FECHA DE INICIO PARA TEORÍA (INDEPENDIENTE) */}
        {isTheoreticalSelected && availableTheoStartDates.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarSearch className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <h4 className="text-xs font-semibold text-slate-700">
                  Semana de Inicio para tu Teoría:
                </h4>
              </div>
              
              {/* Botones Anterior / Siguiente para Teoría */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={theoWeekOffset === 0}
                  onClick={handlePrevTheoWeek}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all"
                >
                  <ChevronLeft className="w-3 h-3" /> Anterior
                </button>
                <button
                  type="button"
                  disabled={theoWeekOffset >= availableTheoStartDates.length - 1}
                  onClick={handleNextTheoWeek}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all"
                >
                  Siguiente <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Fecha de Teoría Seleccionada */}
            <div className="bg-white border border-blue-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 block">
                  {theoWeekOffset === 0 ? 'Semana Teórica Más Próxima' : `Semana Teórica Futura (+${theoWeekOffset} semanas)`}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 capitalize">
                  Inicio: {format(selectedTheoStartDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </span>
              </div>
              <span className="text-[11px] font-normal text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md self-start sm:self-auto">
                Opción #{theoWeekOffset + 1} de {availableTheoStartDates.length}
              </span>
            </div>

            {/* Días de Teoría */}
            {currentValues.theoreticalClassDates?.length > 0 && (
              <div className="pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 mb-1.5">
                  <CalendarIcon className="w-3 h-3 text-blue-600" />
                  <span>Días de Clases Teóricas:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentValues.theoreticalClassDates.map((d: Date, i: number) => (
                    <span key={i} className="bg-blue-50/80 border border-blue-100 px-2 py-0.5 rounded-md text-[11px] font-normal text-blue-900 capitalize">
                      {format(d, "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BLOQUE 2: PRÁCTICA (TOTALMENTE INDEPENDIENTE) */}
      <div className="space-y-3.5 pt-3 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-xs">
              2
            </span>
            Horarios de tus Clases Prácticas de Manejo
          </h3>
          {practicalDays.length > 0 && (
            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
              {practicalDays.length} clases de 2 horas
            </span>
          )}
        </div>

        {/* SELECTOR DE MODALIDAD PRÁCTICA (Semanal Lunes a Viernes o Sábados) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setValue('practicalType', 'semanal', { shouldValidate: true, shouldDirty: true })}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              practicalType === 'semanal' 
                ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-600/30' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🚗 Práctica Semanal (Lunes a Viernes)
          </button>
          <button
            type="button"
            onClick={() => setValue('practicalType', 'sabatino', { shouldValidate: true, shouldDirty: true })}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              practicalType === 'sabatino' 
                ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-600/30' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🚗 Práctica Sabatina (Sábados)
          </button>
        </div>

        {/* NAVEGADOR DE FECHAS PARA PRÁCTICA (AVANZAR Y RETROCEDER INDEPENDIENTE) */}
        {practicalDays.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 px-4 shadow-xs">
            <button
              type="button"
              disabled={practicalWeekOffset === 0}
              onClick={handlePrevPracticalWeek}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all"
            >
              <ChevronLeft className="w-3 h-3" /> Semanas Anteriores
            </button>

            <div className="text-center px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 block">
                {practicalWeekOffset === 0 ? 'Semana Práctica Más Próxima' : `Semana Práctica +${practicalWeekOffset}`}
              </span>
              <p className="text-xs font-normal text-slate-700 mt-0.5">
                Del <span className="font-semibold text-blue-600 capitalize">{format(practicalDays[0], "d 'de' MMM", { locale: es })}</span> al <span className="font-semibold text-blue-600 capitalize">{format(practicalDays[practicalDays.length - 1], "d 'de' MMM yyyy", { locale: es })}</span>
              </p>
            </div>

            <button
              type="button"
              disabled={practicalWeekOffset >= availablePracticalStartDates.length - 1}
              onClick={handleNextPracticalWeek}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all"
            >
              Semanas Siguientes <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {practicalDays.length > 0 ? (
          <div className="space-y-2.5">
            {/* Listado de Clases Prácticas Individuales */}
            {practicalDays.map((dateObj, idx) => {
              const dateStr = format(dateObj, 'yyyy-MM-dd');
              const assignedSlot = getAssignedSlotForDate(dateStr);
              const hasAssigned = !!assignedSlot;

              return (
                <div 
                  key={dateStr}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                    hasAssigned 
                      ? 'border-blue-300 bg-white shadow-xs ring-1 ring-blue-50' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Fecha y Número de Clase */}
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                        hasAssigned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 capitalize">
                            {format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
                          </span>
                          {hasAssigned && (
                            <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                              Elegido ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-normal">Clase Práctica #{idx + 1} (2 Horas)</p>
                      </div>
                    </div>

                    {/* Selector de Horarios en Botones Pills (Sin Negrita Excesiva) */}
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
                              px-3 py-1.5 rounded-xl text-xs transition-all text-center flex flex-col justify-center items-center cursor-pointer min-w-[85px] font-normal
                              ${isSelected 
                                ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-600/30' 
                                : disabled 
                                  ? 'bg-slate-50 border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed' 
                                  : 'bg-slate-50/80 border border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/40'}
                            `}
                          >
                            <span className={isSelected ? 'font-medium' : 'font-normal'}>{slot.id.split(' ')[0]}</span>
                            <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-blue-100 font-medium' : occ.isFull ? 'text-red-500 font-normal' : 'text-slate-400 font-normal'}`}>
                              {isSelected ? 'Elegido ✓' : occ.isFull ? 'Lleno' : `${occ.available} cupos`}
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
        ) : (
          <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-blue-500 mx-auto" />
            <h4 className="font-medium text-slate-700 text-sm">Selecciona un plan para ver tus clases prácticas</h4>
          </div>
        )}
      </div>
    </motion.div>
  );
}
