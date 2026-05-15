import { NextResponse } from 'next/server';

const EVO_URL = process.env.EVOLUTION_API_URL || '';
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'freeway-crm';

const headers = () => ({
  'Content-Type': 'application/json',
  'apikey': EVO_KEY,
});

// GET /api/whatsapp-instance/status
export async function GET() {
  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({ status: 'error', error: 'Evolution API no configurada' });
  }
  try {
    const res = await fetch(`${EVO_URL}/instance/connectionState/${INSTANCE}`, {
      headers: headers(),
    });
    if (!res.ok) return NextResponse.json({ status: 'disconnected' });

    const data = await res.json();
    const state = data?.instance?.state || 'close';

    if (state === 'open') {
      // Obtener info del perfil
      let phone = '', name = '';
      try {
        const info = await fetch(`${EVO_URL}/instance/fetchInstances`, { headers: headers() });
        const instances = await info.json();
        const inst = Array.isArray(instances)
          ? instances.find((i: any) => i.instance?.instanceName === INSTANCE)
          : null;
        phone = inst?.instance?.owner || '';
        name = inst?.instance?.profileName || '';
      } catch { /* silencioso */ }

      return NextResponse.json({ status: 'connected', phone, name });
    } else if (state === 'connecting') {
      return NextResponse.json({ status: 'connecting' });
    } else {
      return NextResponse.json({ status: 'disconnected' });
    }
  } catch {
    return NextResponse.json({ status: 'error' });
  }
}
