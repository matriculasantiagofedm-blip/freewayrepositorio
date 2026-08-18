import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { UploadCloud, FileImage, Trash2, Smartphone, CreditCard, ShieldCheck } from 'lucide-react';
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
  const paymentType = watch('paymentType') || 'yappy';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Finalizar Inscripción</h2>
        <p className="text-slate-500 mt-1 text-sm">Selecciona tu método de pago y adjunta tu comprobante.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Yappy */}
        <div 
          onClick={() => setValue('paymentType', 'yappy', { shouldValidate: true })}
          className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 flex flex-col gap-3 ${
            paymentType === 'yappy' 
              ? 'border-indigo-600 bg-indigo-50/60 shadow-md ring-2 ring-indigo-600/30' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h4 className={`font-bold ${paymentType === 'yappy' ? 'text-indigo-950' : 'text-slate-800'}`}>Yappy / Transferencia</h4>
              <p className="text-xs text-slate-500">Envía a nuestro directorio comercial</p>
            </div>
          </div>
        </div>

        {/* Cubo (Tarjeta) */}
        <div 
          onClick={() => setValue('paymentType', 'cubo', { shouldValidate: true })}
          className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 flex flex-col gap-3 ${
            paymentType === 'cubo' 
              ? 'border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-600/30' 
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className={`font-bold ${paymentType === 'cubo' ? 'text-emerald-950' : 'text-slate-800'}`}>Tarjeta de Débito / Crédito</h4>
              <p className="text-xs text-slate-500">Pago seguro mediante enlace Cubo</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2 max-w-lg mx-auto">
          {paymentType === 'yappy' ? (
            <>
              <h4 className="font-extrabold text-slate-900 text-lg">Yappy a 6046-6084</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Envía el monto total de <strong className="text-blue-600">${total.toFixed(2)} USD</strong> al número <strong>6046-6084</strong> (Freeway Escuela de Manejo) y coloca el número de confirmación o captura abajo.
              </p>
            </>
          ) : (
            <>
              <h4 className="font-extrabold text-slate-900 text-lg">Pago con Tarjeta vía Enlace Cubo</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Realiza el pago de <strong className="text-blue-600">${total.toFixed(2)} USD</strong> a través de la pasarela segura Cubo y adjunta el comprobante del recibo emitido.
              </p>
            </>
          )}
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center">
              Número de Referencia o Transacción
            </label>
            <Input 
              placeholder="Ej. #12345678 o Ref. de pago"
              {...register('yappyReference')}
              className="w-full text-center bg-white h-11 border-slate-200 rounded-xl font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center">
              Adjuntar Comprobante de Pago
            </label>
            {!voucherBase64 ? (
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-slate-50/80 transition-colors">
                <div className="flex flex-col items-center justify-center pt-4 pb-4">
                  <UploadCloud className="w-8 h-8 text-blue-600 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Subir foto o captura del pago</p>
                  <p className="text-xs text-slate-400 mt-1">Formatos JPG, PNG o PDF (Máx. 5MB)</p>
                </div>
                <input type="file" accept="image/png, image/jpeg, application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-white border border-emerald-200 bg-emerald-50/30 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    <FileImage className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Comprobante Adjunto</p>
                    <p className="text-xs text-emerald-600 font-semibold">Listo para enviar ✓</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setVoucherBase64(null); setVoucherMime(null); }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 max-w-md mx-auto">
          <Button 
            type="button" 
            onClick={submitForm} 
            disabled={isSubmitting} 
            className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 rounded-2xl cursor-pointer"
          >
            {isSubmitting ? 'Procesando Inscripción...' : 'Confirmar y Finalizar Matrícula'}
          </Button>
          <p className="text-[11px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Confirmación inmediata con asesor asignado
          </p>
        </div>
      </div>
    </motion.div>
  );
}
