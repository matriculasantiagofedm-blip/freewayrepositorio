import React from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { UploadCloud, FileImage, Trash2, Smartphone, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StepPaymentProps {
  total: number;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  voucherBase64: string | null;
  setVoucherBase64: (val: string | null) => void;
  setVoucherMime: (val: string | null) => void;
  isSubmitting: boolean;
  submitForm: () => void;
}

const YAPPY_OFFICIAL_LINK = 'https://link.yappy.com.pa/stc/dgXr5v%2BGA2xDgGKBkz%2BnBhSk16Vdr9BZvaim7nGhYrA%3D';
const CUBO_OFFICIAL_LINK = 'https://link.cubopago.com/VloWHLdDc4c3';

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
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Método de Pago y Confirmación</h2>
        <p className="text-slate-500 mt-0.5 text-xs">Selecciona tu método de pago preferido para completar tu matrícula oficial.</p>
      </div>

      {/* Tabs de Selección de Método */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Yappy */}
        <div 
          onClick={() => setValue('paymentType', 'yappy', { shouldValidate: true, shouldDirty: true })}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col gap-2 ${
            paymentType === 'yappy' 
              ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600/40' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              paymentType === 'yappy' ? 'bg-[#004fb9] text-white' : 'bg-blue-100 text-[#004fb9]'
            }`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-slate-800">Yappy / Directorio Comercial</h4>
              <p className="text-xs text-slate-500 font-normal">Directorio: Freeway Escuela de Manejo</p>
            </div>
          </div>
        </div>

        {/* Cubo (Tarjeta de Crédito / Débito) */}
        <div 
          onClick={() => setValue('paymentType', 'cubo', { shouldValidate: true, shouldDirty: true })}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col gap-2 ${
            paymentType === 'cubo' 
              ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/40' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              paymentType === 'cubo' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-slate-800">Tarjeta de Débito / Crédito</h4>
              <p className="text-xs text-slate-500 font-normal">Pago seguro vía enlace Cubo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido según método de pago */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        
        {/* Caso 1: YAPPY */}
        {paymentType === 'yappy' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-blue-100/50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-blue-950">
                  📱 Paga con Yappy por <strong>${total.toFixed(2)} USD</strong>
                </p>
                <p className="text-[11px] text-blue-800 font-normal">
                  Búscanos en el Directorio Comercial de Banco General como: <strong>Freeway Escuela de Manejo</strong> o usa el botón directo:
                </p>
              </div>

              <a
                href={YAPPY_OFFICIAL_LINK}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 self-start sm:self-auto"
              >
                <Button
                  type="button"
                  className="bg-[#004fb9] hover:bg-[#003da1] text-white font-medium text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  Abrir Yappy <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Caso 2: CUBO (TARJETA) */}
        {paymentType === 'cubo' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-emerald-100/50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-emerald-950">
                  💳 Paga con Tarjeta por <strong>${total.toFixed(2)} USD</strong>
                </p>
                <p className="text-[11px] text-emerald-800 font-normal">
                  Aceptamos Visa y Mastercard a través del portal de procesamiento seguro de <strong>Cubo</strong>:
                </p>
              </div>

              <a
                href={CUBO_OFFICIAL_LINK}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 self-start sm:self-auto"
              >
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  Pagar en Cubo <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Formulario de Confirmación y Comprobante */}
        <div className="space-y-4 pt-2 border-t border-slate-200 max-w-md mx-auto">
          <div className="space-y-1.5">
            <Label htmlFor="yappyReference" className="text-xs font-medium text-slate-700 block">
              Número de Referencia / Confirmación de Pago
            </Label>
            <Input 
              id="yappyReference"
              placeholder="Ej. #12345678 o ID de Transacción"
              {...register('yappyReference')}
              className="w-full bg-white h-10 text-xs rounded-xl border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 block">
              Adjuntar Comprobante o Captura de Pago
            </Label>
            
            {!voucherBase64 ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-slate-50 transition-colors p-4">
                <UploadCloud className="w-7 h-7 text-slate-400 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Subir foto o captura del pago</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Formatos JPG, PNG o PDF (Máx. 5MB)</p>
                <input type="file" accept="image/png, image/jpeg, image/webp, application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-white border border-blue-200 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <FileImage className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Comprobante Adjunto</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Listo para enviar ✓</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setVoucherBase64(null); setVoucherMime(null); }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Botón Final */}
        <div className="pt-2 max-w-md mx-auto">
          <Button 
            type="button" 
            onClick={submitForm} 
            disabled={isSubmitting} 
            className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 shadow-md rounded-xl cursor-pointer"
          >
            {isSubmitting ? 'Procesando Matrícula...' : 'Confirmar y Finalizar Matrícula'}
          </Button>
          <p className="text-[11px] text-slate-400 text-center mt-2.5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Registro digital con Folio Oficial y validación de asesor
          </p>
        </div>
      </div>
    </motion.div>
  );
}
