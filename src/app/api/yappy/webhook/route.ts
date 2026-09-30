import { NextRequest, NextResponse } from 'next/server';
import { yappyVerifyWebhook } from '@/lib/yappy';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// POST /api/yappy/webhook
// Yappy notifica aquí cuando un pago es confirmado
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-yappy-signature') || req.headers.get('x-signature');

    // Verificar autenticidad del webhook (omitir en pruebas si es necesario)
    const isValid = yappyVerifyWebhook(rawBody, signature);
    if (!isValid) {
      console.warn('[Yappy Webhook] Firma inválida recibida');
      // Retornamos 200 para evitar reintentos, pero no procesamos
      return NextResponse.json({ received: true, verified: false });
    }

    const payload = JSON.parse(rawBody);
    console.log('[Yappy Webhook] Payload:', JSON.stringify(payload));

    const {
      orderId,
      status,         // 'APPROVED' | 'DECLINED' | 'CANCELLED'
      transactionId,
      amount,
    } = payload;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId faltante' }, { status: 400 });
    }

    // Buscar el contrato por folio (orderId viene como "000520")
    const folioNumber = parseInt(orderId, 10);

    if (status === 'APPROVED') {
      // Buscar contrato en Firestore por folioNumber
      const contractsRef = adminDb.collection('contracts');
      const snap = await contractsRef
        .where('folioNumber', '==', folioNumber)
        .limit(1)
        .get();

      if (!snap.empty) {
        const contractDoc = snap.docs[0];
        await contractDoc.ref.update({
          yappyStatus: 'PAGADO',
          yappyTransactionId: transactionId || null,
          yappyAmount: amount || null,
          yappyPaidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`[Yappy Webhook] Contrato ${orderId} marcado como PAGADO`);
      } else {
        console.warn(`[Yappy Webhook] No se encontró contrato con folio ${orderId}`);
      }
    }

    return NextResponse.json({ received: true, verified: true, status });
  } catch (err: any) {
    console.error('[Yappy Webhook] Error:', err.message);
    // Retornar 200 para que Yappy no reintente indefinidamente
    return NextResponse.json({ received: true, error: err.message });
  }
}
