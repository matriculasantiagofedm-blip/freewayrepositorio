export const dynamic = 'force-static';
import { NextResponse } from 'next/server';

const EVO_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'freeway-crm';

// POST /api/whatsapp-instance/connect
export async function POST() {
  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({ error: 'Evolution API no configurada' }, { status: 503 });
  }

  const h = { 'Content-Type': 'application/json', 'apikey': EVO_KEY };

  try {
    // 1. Intentar crear la instancia (si ya existe, 409 es OK)
    await fetch(`${EVO_URL}/instance/create`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ instanceName: INSTANCE, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });

    // 2. Registrar webhook para recibir mensajes entrantes automáticamente
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://contractimefedm.online').replace(/\/$/, '');
    await fetch(`${EVO_URL}/webhook/set/${INSTANCE}`, {
      method: 'POST', headers: h,
      body: JSON.stringify({
        url: `${appUrl}/api/whatsapp-instance/webhook`,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      }),
    }).catch(() => {}); // No crítico si falla

    // 3. Pedir el QR — Evolution API v2 devuelve base64 en /instance/connect/:name

    const qrRes = await fetch(`${EVO_URL}/instance/connect/${INSTANCE}`, { headers: h });
    
    if (!qrRes.ok) {
      const errText = await qrRes.text();
      return NextResponse.json({ error: `QR error ${qrRes.status}: ${errText}` }, { status: 500 });
    }

    const qrData = await qrRes.json();
    
    // Evolution API v2 puede devolver el QR en distintos formatos según la versión
    const qrCode = qrData?.base64          // v2 standard
               || qrData?.qrcode?.base64  // v1 format
               || qrData?.code            // fallback
               || qrData?.qr;             // otro formato posible

    if (!qrCode) {
      // Si no hay QR, la instancia ya puede estar conectada
      const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${INSTANCE}`, { headers: h });
      const stateData = await stateRes.json();
      if (stateData?.instance?.state === 'open') {
        return NextResponse.json({ status: 'connected' });
      }
      // Devolver el raw para debugging
      return NextResponse.json({ error: 'QR no disponible', raw: qrData }, { status: 500 });
    }

    // Asegurar que el base64 viene con el prefix correcto para imagen
    const finalQr = qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
    return NextResponse.json({ qrCode: finalQr, status: 'qr_ready' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
