export const dynamic = 'force-static';
import { NextRequest, NextResponse } from 'next/server';
import { createFreewayPayPalOrder } from '@/lib/paypal';

// POST /api/paypal/create-order
// Crea una orden PayPal para el abono del curso
export async function POST(req: NextRequest) {
  try {
    const { amount, coursePlan, email } = await req.json();

    if (!amount || !coursePlan) {
      return NextResponse.json({ error: 'amount y coursePlan son requeridos' }, { status: 400 });
    }

    const order = await createFreewayPayPalOrder(Number(amount), coursePlan, email);

    const approveUrl =
      order.links?.find((l: { rel: string }) => l.rel === 'payer-action')?.href ||
      order.links?.find((l: { rel: string }) => l.rel === 'approve')?.href;

    if (!approveUrl) {
      return NextResponse.json({ error: 'PayPal no retornó URL de aprobación' }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, approveUrl, status: order.status });
  } catch (err: any) {
    console.error('[PayPal] create-order error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
