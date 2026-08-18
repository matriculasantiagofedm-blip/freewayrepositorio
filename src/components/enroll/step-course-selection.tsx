import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { CheckCircle2, Car } from 'lucide-react';

interface PricingPlan {
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
  const transmission = watch('vehicleTransmission');

  const selectPlan = (planName: string) => {
    setValue('coursePlan', planName, { shouldValidate: true });
    // Reset schedules when plan changes
    setValue('theoreticalClassSchedule', '');
    setValue('practicalClassSchedules', []);
    setValue('theoreticalClassDates', []);
  };

  const setTransmission = (type: string) => {
    setValue('vehicleTransmission', type);
    setValue('coursePlan', ''); // Reset plan when transmission changes
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
        <h3 className="font-semibold text-slate-800 text-sm">Transmisión del Vehículo</h3>
        <div className="grid grid-cols-3 gap-3">
          {['Automático', 'Manual', 'Moto'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTransmission(type)}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                transmission === type 
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Car className={`w-6 h-6 ${transmission === type ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className={`text-sm font-semibold ${transmission === type ? 'text-blue-900' : 'text-slate-600'}`}>
                {type}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Planes de Curso */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 text-sm">Planes Disponibles ({transmission})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              onClick={() => selectPlan(plan.name)}
              className={`relative cursor-pointer rounded-2xl border p-5 flex flex-col transition-all duration-200 ${
                currentPlan === plan.name 
                  ? 'border-blue-600 bg-white shadow-md ring-1 ring-blue-600 scale-[1.02]' 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {plan.tag && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm ${
                  plan.tag === 'Más Popular' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                }`}>
                  {plan.tag}
                </div>
              )}

              <div className="flex justify-between items-start mb-2">
                <h4 className={`font-bold ${currentPlan === plan.name ? 'text-blue-900' : 'text-slate-800'}`}>{plan.title}</h4>
                {currentPlan === plan.name && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </div>
              
              <div className="flex items-baseline gap-1 my-3">
                <span className="text-2xl font-black text-slate-900">${plan.price}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
              </div>
              
              <p className="text-xs text-slate-500 mb-4">{plan.desc}</p>
              
              <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                  {plan.hoursText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
