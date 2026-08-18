import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { UploadCloud, FileImage, Trash2, Smartphone, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface StepPaymentProps {
  total: number;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  voucherBase64: string | null;
  setVoucherBase64: (val: string | null) => void;
  setVoucherMime: (val: string | null) => void;
  isSubmitting: boolean;
  submitForm: () => void;
}

export function StepPayment({
  total,
  handleFileChange,
  voucherBase64,
  setVoucherBase64,
  setVoucherMime,
  isSubmitting,
  submitForm
}: StepPaymentProps) {
  const { watch, setValue, register } = useFormContext();
  const paymentType = watch('paymentType');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Finalizar Inscripción</h2>
        <p className="text-slate-500 mt-1 text-sm">Selecciona tu método de pago y sube el comprobante.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Yappy */}
        <div 
          onClick={() => setValue('paymentType', 'yappy')}
          className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 flex flex-col gap-3 ${
            paymentType === 'yappy' 
              ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className={`font-bold ${paymentType === 'yappy' ? 'text-indigo-900' : 'text-slate-800'}`}>Yappy / Transferencia</h4>
              <p className="text-xs text-slate-500">Envía el comprobante</p>
            </div>
          </div>
        </div>

        {/* Cubo (Tarjeta) */}
        <div 
          onClick={() => setValue('paymentType', 'cubo')}
          className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 flex flex-col gap-3 ${
            paymentType === 'cubo' 
              ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-600' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h4 className={`font-bold ${paymentType === 'cubo' ? 'text-emerald-900' : 'text-slate-800'}`}>Cubo (Tarjeta)</h4>
              <p className="text-xs text-slate-500">Pago por enlace Cubo</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
        <div className="text-center space-y-2">
          {paymentType === 'yappy' ? (
            <>
              <h4 className="font-bold text-slate-800 text-lg">Yappy a 6046-6084</h4>
              <p className="text-sm text-slate-600">Por favor envía el total de <strong>${total.toFixed(2)}</strong> a nuestro número y sube la captura de pantalla aquí.</p>
            </>
          ) : (
            <>
              <h4 className="font-bold text-slate-800 text-lg">Pago con Tarjeta vía Cubo</h4>
              <p className="text-sm text-slate-600">Por favor realiza el pago de <strong>${total.toFixed(2)}</strong> a través del enlace de Cubo que te daremos y sube la captura del recibo aquí.</p>
            </>
          )}
        </div>

        <div className="max-w-sm mx-auto space-y-4">
          <Input 
            placeholder="Número de Referencia del Pago"
            {...register('yappyReference')}
            className="w-full text-center bg-white"
          />

          {!voucherBase64 ? (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-slate-50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Sube tu comprobante</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG o PDF (Max. 5MB)</p>
              </div>
              <input type="file" accept="image/png, image/jpeg, application/pdf" className="hidden" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  <FileImage className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Comprobante Listo</p>
                  <p className="text-xs text-slate-500">Archivo adjunto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setVoucherBase64(null); setVoucherMime(null); }}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <Button 
          type="button" 
          onClick={submitForm} 
          disabled={isSubmitting || !voucherBase64} 
          className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-md rounded-xl"
        >
          {isSubmitting ? 'Procesando Inscripción...' : 'Confirmar y Enviar Comprobante'}
        </Button>
      </div>
    </motion.div>
  );
}
