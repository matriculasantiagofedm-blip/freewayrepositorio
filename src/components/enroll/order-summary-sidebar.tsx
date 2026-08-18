import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Car, Clock, Calendar, ShieldCheck, Tag } from 'lucide-react';
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
  const transmission = watch('vehicleTransmission');
  const coursePlan = watch('coursePlan');
  const theoreticalClassSchedule = watch('theoreticalClassSchedule');
  const practicalClassSchedules = watch('practicalClassSchedules');

  const selectedPlanObj = plans.find(p => p.name === coursePlan);
  const selectedTeoricoObj = filteredTheoreticalSchedules.find(t => t.id === theoreticalClassSchedule);

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 lg:p-8 shadow-2xl lg:sticky lg:top-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
      
      <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
        <Tag className="w-5 h-5 text-blue-400" />
        Tu Resumen
      </h3>

      <div className="space-y-6 relative z-10">
        {/* Vehículo */}
        <div className="flex items-start justify-between border-b border-slate-700/50 pb-4">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Vehículo</p>
            <p className="font-bold text-slate-100">{transmission || 'Pendiente...'}</p>
          </div>
          <Car className="w-5 h-5 text-slate-500" />
        </div>

        {/* Plan */}
        <div className="flex items-start justify-between border-b border-slate-700/50 pb-4">
          <div className="w-full">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Plan Seleccionado</p>
            <div className="flex justify-between items-start w-full">
              <p className={`font-bold ${selectedPlanObj ? 'text-slate-100' : 'text-slate-600 italic'}`}>
                {selectedPlanObj?.title || 'Pendiente...'}
              </p>
              {selectedPlanObj && (
                <span className="font-bold text-blue-400">${selectedPlanObj.price}</span>
              )}
            </div>
            {selectedPlanObj && (
              <p className="text-xs text-slate-400 mt-1">{selectedPlanObj.hoursText}</p>
            )}
          </div>
        </div>

        {/* Teoría */}
        <div className="flex items-start justify-between border-b border-slate-700/50 pb-4">
          <div className="w-full">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Clases Teóricas</p>
            <p className={`font-bold text-sm ${selectedTeoricoObj ? 'text-slate-100' : 'text-slate-600 italic'}`}>
              {selectedTeoricoObj?.label || 'Pendiente...'}
            </p>
          </div>
        </div>

        {/* Práctica */}
        <div className="flex items-start justify-between pb-2">
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Clases Prácticas</p>
              {selectedPlanObj && (
                <span className="text-[10px] font-bold bg-slate-800 text-blue-400 px-2 py-0.5 rounded-full">
                  {practicalClassSchedules?.length || 0} / {selectedPlanObj.classCount}
                </span>
              )}
            </div>
            
            {!practicalClassSchedules || practicalClassSchedules.length === 0 ? (
              <p className="font-bold text-sm text-slate-600 italic">Pendiente...</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {practicalClassSchedules.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                    <span className="text-slate-300 font-medium">
                      {format(new Date(s.date + 'T12:00:00'), "EEE d MMM", { locale: es })}
                    </span>
                    <span className="text-blue-300 font-bold">{s.time.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 mt-4">
          <div className="flex justify-between items-end bg-blue-600/10 p-5 rounded-2xl border border-blue-500/20">
            <p className="text-sm font-semibold text-blue-200">Total a pagar</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">${total.toFixed(0)}</span>
              <span className="text-sm font-bold text-blue-300">.00</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 text-[11px] text-slate-400 justify-center">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Contrato generado en tiempo real</span>
        </div>
      </div>
    </div>
  );
}
