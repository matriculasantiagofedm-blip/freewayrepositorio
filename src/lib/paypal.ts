// ── PayPal API Helper — Freeway Escuela de Manejo ─────────────────

const PAYPAL_BASE    = process.env.PAYPAL_BASE_URL    || 'https://api-m.paypal.com';
const CLIENT_ID      = process.env.PAYPAL_CLIENT_ID   || '';
const CLIENT_SECRET  = process.env.PAYPAL_CLIENT_SECRET || '';
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL  || 'https://contractimefedm.online';

// ── Obtener Access Token ──────────────────────────────────────────
export async function getPayPalAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal token error: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ── Crear orden de pago ───────────────────────────────────────────
export async function createFreewayPayPalOrder(
  amount: number,
  coursePlan: string,
  buyerEmail?: string
) {
  const token = await getPayPalAccessToken();
  const requestId = `fw-${Date.now()}`;

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: requestId,
        description: `Freeway Escuela de Manejo — ${coursePlan}`,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
        custom_id: JSON.stringify({ coursePlan, email: buyerEmail }),
      }],
      application_context: {
        brand_name: 'Freeway Escuela de Manejo',
        locale: 'es-PA',
        landing_page: 'BILLING',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${APP_URL}/enroll?paypal=success`,
        cancel_url: `${APP_URL}/enroll?paypal=cancel`,
      },
    }),
  });

  if (!res.ok) throw new Error(`PayPal create order error: ${await res.text()}`);
  return res.json();
}

// ── Capturar pago tras aprobación ────────────────────────────────
export async function captureFreewayPayPalOrder(orderId: string) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`PayPal capture error: ${await res.text()}`);
  return res.json();
}
