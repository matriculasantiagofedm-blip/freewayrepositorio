import { NextResponse } from 'next/server';

const EVO_URL = process.env.EVOLUTION_API_URL || '';
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'freeway-crm';

// GET /api/whatsapp-instance/qr — Refresh del QR
export async function GET() {
  if (!EVO_URL || !EVO_KEY) return NextResponse.json({ error: 'No configurado' }, { status: 503 });
  try {
    const res = await fetch(`${EVO_URL}/instance/connect/${INSTANCE}`, {
      headers: { 'apikey': EVO_KEY },
    });
    const data = await res.json();
    const qrCode = data?.base64 || data?.qrcode?.base64 || data?.code;
    return NextResponse.json({ qrCode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
