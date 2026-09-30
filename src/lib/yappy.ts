/**
 * Yappy Botón de Pago — Banco General
 * API: https://apipagosbg.bgeneral.cloud
 * Docs: comercial.yappy.com.pa
 *
 * Respuesta validate/merchant:
 * { status: { code, description }, body: { token, epochTime } }
 */

const YAPPY_API_URL = process.env.YAPPY_API_URL || 'https://apipagosbg.bgeneral.cloud';
const YAPPY_MERCHANT_ID = process.env.YAPPY_MERCHANT_ID || '4ef48e87-9b32-4360-a3be-f0190f678cb2';
const YAPPY_SECRET_KEY = process.env.YAPPY_SECRET_KEY || 'WVBfRkQ0QkU4Q0UtQkU2Qy0zQThDLUJGQjctQkREQjI3ODdGRjFFLjRlZjQ4ZTg3LTliMzItNDM2MC1hM2JlLWYwMTkwZjY3OGNiMg==';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://contractimefedm.online';

// ─── Paso 1: Validar comercio y obtener token de autenticación ────────────────
export async function yappyValidateMerchant(): Promise<{ token: string; epochTime: number }> {
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
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Yappy validate merchant error (${res.status}): ${err}`);
  }

  const data = await res.json();
  // La respuesta tiene estructura: { status, body: { token, epochTime } }
  const token = data?.body?.token;
  const epochTime = data?.body?.epochTime ?? Math.floor(Date.now() / 1000);

  if (!token) throw new Error(`Yappy no devolvió token. Respuesta: ${JSON.stringify(data)}`);
  return { token, epochTime };
}

// ─── Paso 2: Crear orden de pago (payment-wc) ─────────────────────────────────
export interface YappyOrderPayload {
  orderId: string;      // Folio (alfanumérico, max 15 chars)
  amount: number;       // Monto en USD
  description?: string;
  aliasYappy?: string;  // Celular Yappy del cliente (opcional en producción)
}

export interface YappyOrderResponse {
  token: string;        // Token para el web component btn-yappy
  transactionId?: string;
  documentName?: string;
}

export async function yappyCreateOrder(payload: YappyOrderPayload): Promise<YappyOrderResponse> {
  // Paso 1: obtener token de auth
  const { token: authToken, epochTime } = await yappyValidateMerchant();

  // Paso 2: crear la orden con el endpoint correcto
  const orderBody: Record<string, string | number | null | undefined> = {
    merchantId: YAPPY_MERCHANT_ID,
    orderId: payload.orderId.slice(0, 15), // máx 15 chars
    domain: APP_URL,
    paymentDate: epochTime,
    ipnUrl: `${APP_URL}/api/yappy/webhook`,
    discount: '0.00',
    taxes: '0.00',
    subtotal: payload.amount.toFixed(2),
    total: payload.amount.toFixed(2),
  };

  if (payload.aliasYappy) {
    orderBody.aliasYappy = payload.aliasYappy;
  }

  const res = await fetch(`${YAPPY_API_URL}/payments/payment-wc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authToken,   // Sin "Bearer"
    },
    body: JSON.stringify(orderBody),
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Yappy payment-wc error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const orderToken = data?.body?.token || data?.body?.documentName;
  if (!orderToken) throw new Error(`Yappy payment-wc sin token. Respuesta: ${JSON.stringify(data)}`);

  return {
    token: orderToken,
    transactionId: data?.body?.transactionId,
    documentName: data?.body?.documentName,
  };
}

// ─── Verificar firma del webhook ──────────────────────────────────────────────
export function yappyVerifyWebhook(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const crypto = require('crypto');
  const secret = Buffer.from(YAPPY_SECRET_KEY, 'base64').toString('utf-8');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}
