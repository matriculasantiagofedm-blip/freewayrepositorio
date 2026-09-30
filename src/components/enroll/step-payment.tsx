'use client';
import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { UploadCloud, FileImage, Trash2, Smartphone, ShieldCheck, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Declaración para el web component de Yappy
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        token?: string;
        lang?: string;
      }, HTMLElement>;
    }
  }
}

interface StepPaymentProps {
  total: number;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  voucherBase64: string | null;
  setVoucherBase64: (val: string | null) => void;
  setVoucherMime: (val: string | null) => void;
  isSubmitting: boolean;
  submitForm: () => void;
  // Datos para crear la orden de Yappy
  folioNumber?: number | string;
}

export function StepPayment({
  total,
  handleFileChange,
  voucherBase64,
  setVoucherBase64,
  setVoucherMime,
  isSubmitting,
  submitForm,
  folioNumber,
}: StepPaymentProps) {
  const { register } = useFormContext();
  const [yappyToken, setYappyToken] = useState<string | null>(null);
  const [yappyLoading, setYappyLoading] = useState(false);
  const [yappyError, setYappyError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Cargar el script del web component de Yappy
  useEffect(() => {
    if (scriptLoaded) return;
    const script = document.createElement('script');
    script.src = 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
    return () => {
      // No remover al desmontar para evitar re-cargas
    };
  }, []);

  // Link directo al directorio comercial de Yappy (sin parámetros — Yappy no los acepta)
  const yappyDirectLink = `https://link.yappy.com.pa/stc/dgXr5v%2BGA2xDgGKBkz%2BnBhSk16Vdr9BZvaim7nGhYrA%3D`;

  // Obtener token de Yappy al montar el componente
  useEffect(() => {
    if (!total) return;
    const orderId = folioNumber
      ? String(folioNumber).padStart(6, '0')
      : `WEB-${Date.now()}`;

    setYappyLoading(true);
    setYappyError(null);

    fetch('/api/yappy/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        orderId,
        description: `Matrícula Freeway - Folio ${orderId}`,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setYappyToken(data.token);
        } else {
          throw new Error(data.error || 'No se obtuvo token de Yappy');
        }
      })
      .catch((err) => {
        console.error('[Yappy]', err);
        setYappyError('fallback');
      })
      .finally(() => setYappyLoading(false));
  }, [total, folioNumber]);

  // Escuchar eventos del botón de Yappy
  useEffect(() => {
    const handleSuccess = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('[Yappy] Pago exitoso:', detail);
      // Auto-enviar el formulario al detectar pago exitoso
      submitForm();
    };
    const handleError = (e: Event) => {
      console.error('[Yappy] Error en pago:', (e as CustomEvent).detail);
      setYappyError('El pago fue rechazado o cancelado. Intenta nuevamente.');
    };
    window.addEventListener('yappy-success', handleSuccess);
    window.addEventListener('yappy-error', handleError);
    return () => {
      window.removeEventListener('yappy-success', handleSuccess);
      window.removeEventListener('yappy-error', handleError);
    };
  }, [submitForm]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Pago con Yappy</h2>
        <p className="text-slate-500 mt-0.5 text-xs">
          Completa tu pago de forma segura a través de Yappy — Banco General.
        </p>
      </div>

      {/* Header Yappy */}
      <div className="rounded-2xl border border-blue-600 bg-blue-50/70 ring-1 ring-blue-600/40 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#004fb9] text-white shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-sm text-slate-800">Yappy — Banco General</h4>
          <p className="text-xs text-slate-500">Freeway Escuela de Manejo</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-black text-[#004fb9]">${total.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400">USD total</p>
        </div>
      </div>

      {/* Botón de Pago Yappy */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">

        <div className="flex flex-col items-center justify-center min-h-[100px] gap-3">
          {yappyLoading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#004fb9]" />
              <p className="text-xs">Conectando con Yappy...</p>
            </div>
          ) : yappyError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs text-slate-500 font-medium">
                📱 Toca el botón para pagar <strong className="text-[#004fb9]">${total.toFixed(2)}</strong> con Yappy
              </p>
              <a
                href={yappyDirectLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-[#004fb9] hover:bg-[#003da1] text-white font-bold text-sm h-12 px-8 rounded-2xl transition-colors shadow-md"
              >
                💙 Pagar ${total.toFixed(2)} con Yappy
              </a>
              <p className="text-[11px] text-slate-400">
                Se abrirá Yappy con el monto pre-cargado
              </p>
            </div>
          ) : yappyToken ? (
            <div className="w-full flex flex-col items-center gap-2">
              <p className="text-xs text-slate-500 font-medium">
                📱 Toca el botón y confirma en tu app Yappy
              </p>
              {/* Web Component oficial de Yappy */}
              <btn-yappy
                token={yappyToken}
                lang="es"
                style={{ display: 'block', width: '100%', maxWidth: '300px' }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs">Preparando pago...</p>
            </div>
          )}
        </div>

        {/* Referencia manual y comprobante (respaldo) */}
        <div className="space-y-4 pt-4 border-t border-slate-200 max-w-md mx-auto">
          <p className="text-[11px] text-slate-400 text-center italic">
            ¿Ya realizaste el pago? Ingresa la referencia y adjunta el comprobante.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="yappyReference" className="text-xs font-medium text-slate-700 block">
              Número de Referencia / Confirmación
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
              Comprobante de Pago
            </Label>
            {!voucherBase64 ? (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-slate-50 transition-colors p-4">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Subir captura del pago</p>
                <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG o PDF (Máx. 5MB)</p>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-white border border-blue-200 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <FileImage className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Comprobante adjunto</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Listo ✓</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setVoucherBase64(null); setVoucherMime(null); }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Botón de confirmación manual */}
          <button
            type="button"
            onClick={submitForm}
            disabled={isSubmitting}
            className="w-full h-11 text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white shadow-md rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar Matrícula'}
          </button>

          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Registro oficial con Folio y validación de asesor
          </p>
        </div>
      </div>
    </motion.div>
  );
}
