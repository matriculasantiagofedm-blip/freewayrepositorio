import { NextResponse } from 'next/server';

const EVO_URL = process.env.EVOLUTION_API_URL || '';
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'freeway-crm';

// POST /api/whatsapp-instance/disconnect
export async function POST() {
  if (!EVO_URL || !EVO_KEY) return NextResponse.json({ error: 'No configurado' }, { status: 503 });
  try {
    await fetch(`${EVO_URL}/instance/logout/${INSTANCE}`, {
      method: 'DELETE',
      headers: { 'apikey': EVO_KEY },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
