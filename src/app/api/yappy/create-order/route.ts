import { NextRequest, NextResponse } from 'next/server';
import { yappyCreateOrder } from '@/lib/yappy';

export const dynamic = 'force-dynamic';

// POST /api/yappy/create-order
// Crea una orden de pago en Yappy y retorna el token para el web component
export async function POST(req: NextRequest) {
  try {
    const { amount, orderId, description } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'amount y orderId son requeridos' },
        { status: 400 }
      );
    }

    const order = await yappyCreateOrder({
      orderId: String(orderId),
      amount: Number(amount),
      description: description || `Matrícula Freeway - Folio ${orderId}`,
    });

    return NextResponse.json({
      token: order.token,
      redirectUrl: order.redirectUrl,
      orderId: order.orderId,
    });
  } catch (err: any) {
    console.error('[Yappy] create-order error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
