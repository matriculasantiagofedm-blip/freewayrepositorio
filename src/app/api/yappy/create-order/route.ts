import { NextRequest, NextResponse } from 'next/server';
import { yappyValidateMerchant, yappyCreateOrder } from '@/lib/yappy';

export const dynamic = 'force-dynamic';

// POST /api/yappy/create-order
export async function POST(req: NextRequest) {
  try {
    const { amount, orderId, description, aliasYappy } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json({ error: 'amount y orderId son requeridos' }, { status: 400 });
    }

    // Intentar crear la orden completa (paso 1 + paso 2)
    try {
      const order = await yappyCreateOrder({
        orderId: String(orderId),
        amount: Number(amount),
        description: description || `Matrícula Freeway - ${orderId}`,
        aliasYappy: aliasYappy || undefined,
      });

      console.log('[Yappy] Orden creada OK, token:', order.token?.substring(0, 20) + '...');

      return NextResponse.json({
        token: order.token,
        orderId: String(orderId),
        amount: Number(amount).toFixed(2),
        transactionId: order.transactionId,
        source: 'payment-wc',
      });
    } catch (orderErr: any) {
      // Si falla el paso 2, devolver solo el token de autenticación
      // para que el web component intente procesar el pago directamente
      console.warn('[Yappy] payment-wc falló, usando solo auth token:', orderErr.message);

      const { token: authToken, epochTime } = await yappyValidateMerchant();

      return NextResponse.json({
        token: authToken,
        orderId: String(orderId),
        amount: Number(amount).toFixed(2),
        epochTime,
        source: 'auth-only',
        warning: orderErr.message,
      });
    }
  } catch (err: any) {
    console.error('[Yappy] create-order error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
