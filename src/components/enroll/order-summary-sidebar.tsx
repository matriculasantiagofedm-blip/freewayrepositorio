import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Car, Clock, Calendar, ShieldCheck, Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PricingPlan {
  title: string;
  name: string;
  hoursText: string;
  classCount: number;
  price: number;
  tag: string;
  desc: string;
}

interface OrderSummaryProps {
  total: number;
  plans: PricingPlan[];
  filteredTheoreticalSchedules: { id: string; label: string; desc: string }[];
}

export function OrderSummarySidebar({ total, plans, filteredTheoreticalSchedules }: OrderSummaryProps) {
  const { watch } = useFormContext();
  const transmission = watch('vehicleTransmission') || 'Automático';
  const coursePlan = watch('coursePlan');
  const theoreticalClassSchedule = watch('theoreticalClassSchedule');
  const practicalClassSchedules = watch('practicalClassSchedules') || [];

  const selectedPlanObj = plans.find(p => p.name === coursePlan);
  const selectedTeóricoObj = filteredTheoreticalSchedules.find(t => t.id === theoreticalClassSchedule);

  // Solo consideramos como asignadas aquellas clases que tengan fecha y hora
  const validPracticalSchedules = practicalClassSchedules.filter((s: any) => s && s.date && s.time);
  const requiredClassCount = selectedPlanObj?.classCount || 0;

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden relative border border-slate-800">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
      
      <h3 className="text-xl font-black mb-6 flex items-center gap-2.5 text-white tracking-tight">
        <div className="p-1.5 rounded-lg bg-blue-600/30 border border-blue-500/30 text-blue-400">
          <Tag className="w-4 h-4" />
        </div>
        Tu Resumen
      </h3>

      <div className="space-y-5 relative z-10">
        {/* Vehículo */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Vehículo / Transmisión</p>
            <p className="font-extrabold text-slate-100 text-sm">{transmission || 'Automático'}</p>
          </div>
          <div className="p-2 bg-slate-800 rounded-xl text-blue-400">
            <Car className="w-4 h-4" />
          </div>
        </div>

        {/* Plan */}
        <div className="border-b border-slate-800 pb-4">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Plan Seleccionado</p>
          <div className="flex justify-between items-start w-full">
            <p className={`font-extrabold text-sm ${selectedPlanObj ? 'text-slate-100' : 'text-slate-500 italic'}`}>
              {selectedPlanObj?.title || 'Por favor elige un plan...'}
            </p>
            {selectedPlanObj && (
              <span className="font-black text-blue-400 text-base">${selectedPlanObj.price}</span>
            )}
          </div>
          {selectedPlanObj && (
            <p className="text-xs text-slate-400 mt-1">{selectedPlanObj.hoursText} ({selectedPlanObj.classCount} clases de 2h)</p>
          )}
        </div>

        {/* Teoría */}
        <div className="border-b border-slate-800 pb-4">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Clases Teóricas</p>
          <p className={`font-bold text-sm ${selectedTeóricoObj ? 'text-slate-100' : 'text-slate-500 italic'}`}>
            {selectedTeóricoObj?.label || 'Pendiente de elegir en Paso 3...'}
          </p>
          {selectedTeóricoObj && (
            <p className="text-xs text-slate-400 mt-0.5">{selectedTeóricoObj.desc}</p>
          )}
        </div>

        {/* Práctica */}
        <div className="pb-2">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Clases Prácticas</p>
            {selectedPlanObj && (
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                validPracticalSchedules.length === requiredClassCount && requiredClassCount > 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                  : 'bg-blue-950 text-blue-400 border border-blue-800/60'
              }`}>
                {validPracticalSchedules.length} de {requiredClassCount} agendadas
              </span>
            )}
          </div>
          
          {validPracticalSchedules.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Se agendan en el Paso 3 (Horarios)...</p>
          ) : (
            <div className="space-y-1.5 mt-2">
              {validPracticalSchedules.map((s: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-blue-400">#{i + 1}</span>
                    <span className="text-slate-300 font-medium capitalize">
                      {format(new Date(s.date + 'T12:00:00'), "EEE d 'de' MMM", { locale: es })}
                    </span>
                  </div>
                  <span className="text-blue-300 font-bold">{s.time.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total Box */}
        <div className="pt-2">
          <div className="flex justify-between items-end bg-gradient-to-br from-blue-900/40 to-blue-950/80 p-5 rounded-2xl border border-blue-500/30 shadow-inner">
            <div>
              <p className="text-xs font-bold text-blue-300 uppercase tracking-wider">Total a pagar</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Incluye matrícula e impuestos</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">${total.toFixed(0)}</span>
              <span className="text-sm font-bold text-blue-400">.00</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-400 justify-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Contrato digital emitido con validez oficial</span>
        </div>
      </div>
    </div>
  );
}
