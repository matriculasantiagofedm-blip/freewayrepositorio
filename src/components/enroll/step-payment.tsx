'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, ShieldCheck, Loader2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// Declaración para el web component de Yappy
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        token?: string;
        amount?: string;
        'order-id'?: string;
        description?: string;
        'success-url'?: string;
        'failure-url'?: string;
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
  folioNumber?: number | string;
}

const TIMER_SECONDS = 5 * 60; // 5 minutos

export function StepPayment({
  total,
  submitForm,
  folioNumber,
  setVoucherBase64,
  setVoucherMime,
}: StepPaymentProps) {
  const { toast } = useToast();
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Estado de sesión Yappy
  const [yappyPhone, setYappyPhone] = useState('');
  const [yappyToken, setYappyToken] = useState<string | null>(null);
  const [yappyOrderId, setYappyOrderId] = useState('');
  const [yappyAmount, setYappyAmount] = useState('');
  const [yappySource, setYappySource] = useState<'payment-wc' | 'auth-only' | null>(null);
  const [yappyLoading, setYappyLoading] = useState(false);
  const [yappyError, setYappyError] = useState<string | null>(null);

  // Cronómetro
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cargar script CDN de Yappy
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.querySelector('script[data-yappy]')) { setScriptLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js';
    script.async = true;
    script.setAttribute('data-yappy', '1');
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Escuchar evento de pago exitoso del web component
  useEffect(() => {
    const handleSuccess = (e: Event) => {
      console.log('[Yappy] Pago exitoso:', (e as CustomEvent).detail);
      if (timerRef.current) clearInterval(timerRef.current);
      toast({
        title: '✅ ¡Pago confirmado!',
        description: 'Yappy confirmó tu pago. Creando tu contrato...',
      });
      submitForm();
    };
    const handleError = (e: Event) => {
      console.error('[Yappy] Error:', (e as CustomEvent).detail);
      setYappyError('El pago fue rechazado o cancelado. Intenta de nuevo.');
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(null);
    };
    window.addEventListener('yappy-payment-success', handleSuccess);
    window.addEventListener('yappy-payment-error', handleError);
    return () => {
      window.removeEventListener('yappy-payment-success', handleSuccess);
      window.removeEventListener('yappy-payment-error', handleError);
    };
  }, [submitForm, toast]);

  // Limpiar cronómetro al desmontar
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const iniciarCronometro = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Preparar orden Yappy con el celular del cliente
  const handlePrepararPago = () => {
    const phone = yappyPhone.replace(/\D/g, '');
    if (phone.length < 7) {
      setYappyError('Ingresa tu número Yappy válido (Ej: 6234-5678)');
      return;
    }

    const orderId = folioNumber
      ? String(folioNumber).padStart(6, '0').slice(0, 15)
      : `WEB${Date.now()}`.slice(0, 15);

    setYappyLoading(true);
    setYappyError(null);
    setYappyToken(null);

    fetch('/api/yappy/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        orderId,
        description: `Matrícula Freeway - Folio ${orderId}`,
        aliasYappy: phone,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setYappyToken(data.token);
          setYappyOrderId(data.orderId || orderId);
          setYappyAmount(data.amount || total.toFixed(2));
          setYappySource(data.source || 'auth-only');

          // Toast verde + iniciar cronómetro
          iniciarCronometro();
          toast({
            title: '✅ ¡Todo listo! Ve a Yappy ahora',
            description: `Tienes 5 minutos para confirmar tu pago de $${total.toFixed(2)}`,
            className: 'border-green-500 bg-green-50 text-green-900',
          });
        } else {
          throw new Error(data.error || 'No se obtuvo token de Yappy');
        }
      })
      .catch((err) => {
        console.error('[Yappy]', err);
        setYappyError('No se pudo conectar con Yappy. Intenta de nuevo.');
      })
      .finally(() => setYappyLoading(false));
  };

  const timerExpired = timeLeft === 0;

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

      {/* Header monto */}
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

      {/* Sección principal de pago */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">

        {/* Botón web component activo */}
        {yappyToken && scriptLoaded && yappySource === 'payment-wc' ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-slate-500 font-medium">
              📱 Toca el botón y confirma en tu app Yappy
            </p>
            <p className="text-3xl font-black text-[#004fb9]">${total.toFixed(2)}</p>

            <btn-yappy
              token={yappyToken}
              amount={yappyAmount || total.toFixed(2)}
              order-id={yappyOrderId}
              description="Matrícula Freeway"
              success-url="https://contractimefedm.online/enroll?status=success"
              failure-url="https://contractimefedm.online/enroll?status=error"
              lang="es"
              style={{ display: 'block', width: '100%', maxWidth: '320px' }}
            />

            {/* Cronómetro */}
            {timeLeft !== null && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    timerExpired
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : timeLeft < 60
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  {timerExpired
                    ? '⏰ Tiempo expirado — recarga la página'
                    : `Tiempo para pagar: ${formatTime(timeLeft)}`}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

        ) : yappyLoading ? (
          <div className="flex flex-col items-center gap-2 py-4 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#004fb9]" />
            <p className="text-xs">Conectando con Yappy...</p>
          </div>

        ) : (
          /* Ingreso del número Yappy */
          <div className="space-y-4">
            {/* Si ya tiene token (auth-only) mostrar el componente con cronómetro */}
            {yappyToken && yappySource === 'auth-only' && (
              <div className="flex flex-col items-center gap-3 mb-2">
                <p className="text-xs text-slate-500 font-medium">
                  📱 Toca el botón y confirma en tu app Yappy
                </p>
                <p className="text-3xl font-black text-[#004fb9]">${total.toFixed(2)}</p>
                <btn-yappy
                  token={yappyToken}
                  amount={yappyAmount || total.toFixed(2)}
                  order-id={yappyOrderId}
                  description="Matrícula Freeway"
                  success-url="https://contractimefedm.online/enroll?status=success"
                  failure-url="https://contractimefedm.online/enroll?status=error"
                  lang="es"
                  style={{ display: 'block', width: '100%', maxWidth: '320px' }}
                />
                {timeLeft !== null && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    timerExpired
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : timeLeft < 60
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {timerExpired ? '⏰ Tiempo expirado — intenta de nuevo' : `Tiempo para pagar: ${formatTime(timeLeft)}`}
                  </div>
                )}
              </div>
            )}

            {!yappyToken && (
              <>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Ingresa tu número Yappy</p>
                  <p className="text-[11px] text-slate-400">
                    El número de celular registrado en tu app Yappy
                  </p>
                </div>

                <div className="flex gap-2 max-w-sm mx-auto">
                  <Input
                    type="tel"
                    placeholder="Ej. 6234-5678"
                    value={yappyPhone}
                    onChange={(e) => { setYappyPhone(e.target.value); setYappyError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePrepararPago()}
                    className="bg-white border-slate-300 rounded-xl text-sm h-11 flex-1"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={handlePrepararPago}
                    disabled={!yappyPhone || yappyPhone.replace(/\D/g, '').length < 7}
                    className="h-11 px-4 bg-[#004fb9] hover:bg-[#003da1] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 shrink-0"
                  >
                    💙 Pagar
                  </button>
                </div>
              </>
            )}

            {yappyError && (
              <p className="text-xs text-red-500 text-center">{yappyError}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer de seguridad */}
      <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Tu contrato se genera automáticamente al confirmar el pago en Yappy
      </p>
    </motion.div>
  );
}
