import { NextRequest, NextResponse } from 'next/server';
import { captureFreewayPayPalOrder } from '@/lib/paypal';

// POST /api/paypal/capture-order
// Captura el pago tras redirección de PayPal
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });

    const capture = await captureFreewayPayPalOrder(orderId);

    const unit      = capture.purchase_units?.[0];
    const payment   = unit?.payments?.captures?.[0];
    const amount    = parseFloat(payment?.amount?.value || '0');
    const reference = payment?.id || orderId;
    const status    = capture.status; // COMPLETED

    return NextResponse.json({ ok: true, amount, reference, status, capture });
  } catch (err: any) {
    console.error('[PayPal] capture error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
