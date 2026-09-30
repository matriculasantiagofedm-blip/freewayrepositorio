import { NextRequest, NextResponse } from 'next/server';
import { yappyValidateMerchant } from '@/lib/yappy';

export const dynamic = 'force-dynamic';

// POST /api/yappy/create-order
// Obtiene el token de autenticación de Yappy para el web component
export async function POST(req: NextRequest) {
  try {
    const { amount, orderId, description } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'amount y orderId son requeridos' },
        { status: 400 }
      );
    }

    // El token de validate/merchant se pasa directo al web component
    const token = await yappyValidateMerchant();

    return NextResponse.json({
      token,
      orderId: String(orderId),
      amount: Number(amount).toFixed(2),
      description: description || `Matrícula Freeway - Folio ${orderId}`,
    });
  } catch (err: any) {
    console.error('[Yappy] create-order error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
