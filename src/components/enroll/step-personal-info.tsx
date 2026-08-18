import React from 'react';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { User, IdCard, Mail, Phone, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

export function StepPersonalInfo() {
  const { control } = useFormContext();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tus Datos Personales</h2>
        <p className="text-slate-500 mt-1 text-sm">Por favor completa tu información para la creación del contrato.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField
          control={control}
          name="clientName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-700 font-semibold text-sm">Nombre Completo</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="Ej. Juan Pérez" className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 shadow-sm rounded-xl" {...field} />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="studentIdNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-700 font-semibold text-sm">Cédula / Pasaporte</FormLabel>
              <FormControl>
                <div className="relative">
                  <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="Ej. 8-000-0000" className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 shadow-sm rounded-xl" {...field} />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="clientEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-700 font-semibold text-sm">Correo Electrónico</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="correo@ejemplo.com" type="email" className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 shadow-sm rounded-xl" {...field} />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="studentPhone1"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-700 font-semibold text-sm">Celular (WhatsApp)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="6000-0000" type="tel" className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 shadow-sm rounded-xl" {...field} />
                </div>
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="studentAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-slate-700 font-semibold text-sm">Dirección Residencial</FormLabel>
            <FormControl>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Barrio, Calle, Casa/Apto..." className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 shadow-sm rounded-xl" {...field} />
              </div>
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </motion.div>
  );
}
