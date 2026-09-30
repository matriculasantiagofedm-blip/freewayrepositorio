import { NextRequest, NextResponse } from 'next/server';
import { yappyVerifyWebhook } from '@/lib/yappy';

export const dynamic = 'force-dynamic';

// POST /api/yappy/webhook
// Yappy notifica aquí cuando un pago es confirmado
// La actualización real de Firestore se hace vía fetch a una API interna
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-yappy-signature') || req.headers.get('x-signature');

    // Verificar autenticidad del webhook
    const isValid = yappyVerifyWebhook(rawBody, signature);
    if (!isValid) {
      console.warn('[Yappy Webhook] Firma inválida recibida');
      // Retornamos 200 para evitar reintentos de Yappy
      return NextResponse.json({ received: true, verified: false });
    }

    const payload = JSON.parse(rawBody);
    console.log('[Yappy Webhook] Payload recibido:', JSON.stringify(payload));

    const {
      orderId,
      status,         // 'APPROVED' | 'DECLINED' | 'CANCELLED'
      transactionId,
      amount,
    } = payload;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId faltante' }, { status: 400 });
    }

    if (status === 'APPROVED') {
      // Notificar internamente para actualizar Firestore
      // (la lógica de Firestore se maneja en el cliente o en una Cloud Function separada)
      console.log(`[Yappy Webhook] ✅ Pago APROBADO - Folio: ${orderId}, TX: ${transactionId}, Monto: ${amount}`);

      // Opcional: llamar a otra API interna que sí tenga acceso al SDK de cliente
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://contractimefedm.online';
      try {
        await fetch(`${appUrl}/api/yappy/update-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.CRON_SECRET || '' },
          body: JSON.stringify({ orderId, transactionId, amount, status }),
        });
      } catch (e) {
        // Si falla la notificación interna, el log queda en Cloud Run
        console.warn('[Yappy Webhook] No se pudo notificar internamente:', e);
      }
    } else {
      console.log(`[Yappy Webhook] Pago ${status} - Folio: ${orderId}`);
    }

    return NextResponse.json({ received: true, verified: true, status });
  } catch (err: any) {
    console.error('[Yappy Webhook] Error:', err.message);
    return NextResponse.json({ received: true, error: err.message });
  }
}
