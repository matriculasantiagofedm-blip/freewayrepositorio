import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { CheckCircle2, Car, Award, Sparkles, Compass } from 'lucide-react';

export interface PricingPlan {
  title: string;
  name: string;
  hoursText: string;
  classCount: number;
  price: number;
  tag: string;
  desc: string;
}

export function StepCourseSelection({ plans }: { plans: PricingPlan[] }) {
  const { watch, setValue } = useFormContext();
  const currentPlan = watch('coursePlan');
  const transmission = watch('vehicleTransmission') || 'Automático';

  const selectPlan = (planName: string) => {
    setValue('coursePlan', planName, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    // Reset schedules when plan changes
    setValue('theoreticalClassSchedule', '');
    setValue('practicalClassSchedules', []);
    setValue('theoreticalClassDates', []);
  };

  const setTransmission = (type: string) => {
    setValue('vehicleTransmission', type, { shouldValidate: true, shouldDirty: true });
    setValue('coursePlan', '', { shouldValidate: true }); // Reset plan when transmission changes
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Selección de Curso</h2>
        <p className="text-slate-500 mt-1 text-sm">Elige el tipo de transmisión y el plan de clases prácticas que deseas tomar.</p>
      </div>

      {/* Tipo de Transmisión */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <Car className="w-4 h-4 text-blue-600" />
          Transmisión del Vehículo
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'Automático', label: 'Automático', icon: Car },
            { id: 'Manual', label: 'Manual', icon: Compass },
            { id: 'Moto', label: 'Moto', icon: Award }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTransmission(id)}
              className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                transmission === id 
                  ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-600/30' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <Icon className={`w-6 h-6 ${transmission === id ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${transmission === id ? 'text-blue-900' : 'text-slate-700'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Planes de Curso */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Planes Disponibles ({transmission})
          </h3>
          <span className="text-xs text-slate-400 font-medium">Precios oficiales en USD</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isSelected = currentPlan === plan.name;
            const isPopular = plan.tag === 'Más Popular' || plan.tag === 'MÁS POPULAR';
            const isRecommended = plan.tag === 'Recomendado' || plan.tag === 'RECOMENDADO';

            return (
              <div 
                key={plan.name}
                onClick={() => selectPlan(plan.name)}
                className={`relative cursor-pointer rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/30 shadow-lg ring-2 ring-blue-600/40 scale-[1.02]' 
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                }`}
              >
                {plan.tag && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-sm ${
                    isPopular 
                      ? 'bg-blue-600 text-white shadow-blue-500/20' 
                      : isRecommended 
                        ? 'bg-amber-500 text-slate-950 shadow-amber-500/20' 
                        : 'bg-slate-800 text-white'
                  }`}>
                    {plan.tag}
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={`font-bold text-base ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>{plan.title}</h4>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </div>
                  
                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-3xl font-black text-slate-900">${plan.price}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">USD Total</span>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{plan.desc}</p>
                </div>
                
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                    {plan.hoursText}
                  </span>
                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                    {isSelected ? 'Seleccionado ✓' : 'Elegir plan →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
