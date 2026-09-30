/**
 * Yappy Botón de Pago — Banco General
 * API: https://apipagosbg.bgeneral.cloud
 * Docs: comercial.yappy.com.pa
 */

const YAPPY_API_URL = process.env.YAPPY_API_URL || 'https://apipagosbg.bgeneral.cloud';
const YAPPY_MERCHANT_ID = process.env.YAPPY_MERCHANT_ID || '';
const YAPPY_SECRET_KEY = process.env.YAPPY_SECRET_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://contractimefedm.online';

// ─── Validar comercio y obtener token ────────────────────────────────────────
export async function yappyValidateMerchant(): Promise<string> {
  const res = await fetch(`${YAPPY_API_URL}/payments/validate/merchant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${YAPPY_SECRET_KEY}`,
    },
    body: JSON.stringify({
      merchantId: YAPPY_MERCHANT_ID,
      urlDomain: APP_URL,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Yappy validate merchant error (${res.status}): ${err}`);
  }

  const data = await res.json();
  // El token puede venir como data.token o data.access_token
  const token = data.token || data.access_token || data.data?.token;
  if (!token) throw new Error('Yappy no devolvió token de autenticación');
  return token;
}

// ─── Crear orden de pago ──────────────────────────────────────────────────────
export interface YappyOrderPayload {
  orderId: string;       // Folio del contrato (ej: "000520")
  amount: number;        // Monto en USD (ej: 65.00)
  description: string;   // Descripción del servicio
  successUrl?: string;   // URL de retorno al completar
  failureUrl?: string;   // URL de retorno al cancelar
}

export interface YappyOrderResponse {
  token: string;         // Token para el web component
  redirectUrl?: string;  // URL de pago alternativa
  orderId: string;
}

export async function yappyCreateOrder(payload: YappyOrderPayload): Promise<YappyOrderResponse> {
  // 1. Obtener token de autenticación
  const authToken = await yappyValidateMerchant();

  // 2. Crear la orden de pago
  const res = await fetch(`${YAPPY_API_URL}/payments/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      merchantId: YAPPY_MERCHANT_ID,
      orderId: payload.orderId,
      amount: payload.amount.toFixed(2),
      description: payload.description,
      successUrl: payload.successUrl || `${APP_URL}/enroll?status=success`,
      failureUrl: payload.failureUrl || `${APP_URL}/enroll?status=error`,
      webhookUrl: `${APP_URL}/api/yappy/webhook`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Yappy create order error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const token = data.token || data.data?.token || data.checkoutToken;
  if (!token) throw new Error('Yappy no devolvió token de checkout');

  return {
    token,
    redirectUrl: data.redirectUrl || data.data?.redirectUrl,
    orderId: payload.orderId,
  };
}

// ─── Verificar firma del webhook ──────────────────────────────────────────────
export function yappyVerifyWebhook(
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  // Yappy firma con HMAC-SHA256 usando la secret key decodificada
  const crypto = require('crypto');
  const secret = Buffer.from(YAPPY_SECRET_KEY, 'base64').toString('utf-8');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expected === signature;
}
