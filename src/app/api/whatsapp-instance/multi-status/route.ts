import { NextRequest, NextResponse } from 'next/server';

const EVO_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';

const h = () => ({ 'Content-Type': 'application/json', 'apikey': EVO_KEY });

// GET /api/whatsapp-instance/multi-status?instance=freeway-crm-2
export async function GET(req: NextRequest) {
    const instance = req.nextUrl.searchParams.get('instance');
    if (!instance) return NextResponse.json({ status: 'error', error: 'instance param required' }, { status: 400 });
    if (!EVO_URL || !EVO_KEY) return NextResponse.json({ status: 'error', error: 'Evolution API no configurada' });

    try {
        const res = await fetch(`${EVO_URL}/instance/connectionState/${instance}`, { headers: h() });
        if (!res.ok) return NextResponse.json({ status: 'disconnected' });

        const data = await res.json();
        const state = data?.instance?.state || 'close';

        if (state === 'open') {
            let phone = '', name = '';
            try {
                const info = await fetch(`${EVO_URL}/instance/fetchInstances`, { headers: h() });
                const instances = await info.json();
                const inst = Array.isArray(instances)
                    ? instances.find((i: any) => i.instance?.instanceName === instance)
                    : null;
                phone = inst?.instance?.owner || '';
                name = inst?.instance?.profileName || '';
            } catch { /* silencioso */ }
            return NextResponse.json({ status: 'connected', phone, name });
        } else if (state === 'connecting') {
            return NextResponse.json({ status: 'connecting' });
        }
        return NextResponse.json({ status: 'disconnected' });
    } catch {
        return NextResponse.json({ status: 'error' });
    }
}

// POST /api/whatsapp-instance/multi-status?instance=X&action=connect|disconnect|qr
export async function POST(req: NextRequest) {
    const instance = req.nextUrl.searchParams.get('instance');
    const action   = req.nextUrl.searchParams.get('action') || 'connect';
    if (!instance) return NextResponse.json({ error: 'instance param required' }, { status: 400 });
    if (!EVO_URL || !EVO_KEY) return NextResponse.json({ error: 'Evolution API no configurada' }, { status: 503 });

    try {
        if (action === 'disconnect') {
            await fetch(`${EVO_URL}/instance/logout/${instance}`, { method: 'DELETE', headers: h() }).catch(() => {});
            return NextResponse.json({ success: true });
        }

        if (action === 'qr') {
            const qrRes = await fetch(`${EVO_URL}/instance/connect/${instance}`, { headers: h() });
            const qrData = await qrRes.json();
            const qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || qrData?.qr;
            if (!qrCode) return NextResponse.json({ error: 'QR no disponible', raw: qrData }, { status: 500 });
            const finalQr = qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
            return NextResponse.json({ qrCode: finalQr });
        }

        // action === 'connect'
        await fetch(`${EVO_URL}/instance/create`, {
            method: 'POST', headers: h(),
            body: JSON.stringify({ instanceName: instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
        });

        // Registrar webhook
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://contractimefedm.online').replace(/\/$/, '');
        await fetch(`${EVO_URL}/webhook/set/${instance}`, {
            method: 'POST', headers: h(),
            body: JSON.stringify({
                url: `${appUrl}/api/whatsapp-instance/webhook`,
                webhook_by_events: false,
                webhook_base64: false,
                events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
            }),
        }).catch(() => {});

        const qrRes = await fetch(`${EVO_URL}/instance/connect/${instance}`, { headers: h() });
        if (!qrRes.ok) return NextResponse.json({ error: `QR error ${qrRes.status}` }, { status: 500 });

        const qrData = await qrRes.json();
        const qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || qrData?.qr;

        if (!qrCode) {
            const stateRes = await fetch(`${EVO_URL}/instance/connectionState/${instance}`, { headers: h() });
            const stateData = await stateRes.json();
            if (stateData?.instance?.state === 'open') return NextResponse.json({ status: 'connected' });
            return NextResponse.json({ error: 'QR no disponible', raw: qrData }, { status: 500 });
        }

        const finalQr = qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`;
        return NextResponse.json({ qrCode: finalQr, status: 'qr_ready' });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
