export const dynamic = 'force-static';
import { NextRequest, NextResponse } from 'next/server';

const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
const EVO_KEY  = process.env.EVOLUTION_API_KEY  || 'freeway2025secret';

// Construye el webhook URL desde el request en runtime → siempre apunta al dominio correcto
function getWebhookUrl(req: NextRequest): string {
  const url = new URL(req.url);
  // Preferir el header x-forwarded-host (Vercel/proxies) sobre el host directo
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  return `${proto}://${host}/api/whatsapp-instance/webhook`;
}

const h = { 'Content-Type': 'application/json', 'apikey': EVO_KEY };

// Extrae el nombre de instancia desde cualquier formato de Evolution API
function extractName(inst: any): string {
    return inst?.instance?.instanceName
        || inst?.instanceName
        || inst?.instance?.name
        || inst?.name
        || '';
}

// Consulta el estado de conexión real por instancia
async function getConnectionState(name: string): Promise<string> {
    try {
        const res = await fetch(`${EVO_URL}/instance/connectionState/${name}`, { headers: h });
        if (!res.ok) return 'close';
        const d = await res.json();
        return d?.instance?.state || d?.state || 'close';
    } catch {
        return 'close';
    }
}

/**
 * GET /api/whatsapp-instance/sync-webhooks
 * Lista todas las instancias con su estado real de conexión.
 */
export async function GET(req: NextRequest) {
    try {
        const WEBHOOK_URL = getWebhookUrl(req);
        const listRes = await fetch(`${EVO_URL}/instance/fetchInstances`, { headers: h });
        if (!listRes.ok) {
            return NextResponse.json({ error: `Evolution API error: ${listRes.status}`, instances: [] }, { status: 502 });
        }

        const raw: any = await listRes.json();
        // Normalizar: puede ser array directo o { data: [...] }
        const instances: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.instances ?? []);

        // Para cada instancia, obtener su estado real de conexión
        const report = await Promise.all(instances.map(async (inst: any) => {
            const name    = extractName(inst);
            const phone   = inst?.instance?.owner        || inst?.owner        || '';
            const profile = inst?.instance?.profileName  || inst?.profileName  || '';
            const state   = name ? await getConnectionState(name) : 'close';
            return { instance: name || '?', phone, status: state, profile };
        }));

        return NextResponse.json({ instances: report, webhookUrl: WEBHOOK_URL });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, instances: [] }, { status: 500 });
    }
}

/**
 * POST /api/whatsapp-instance/sync-webhooks
 * Registra el webhook del CRM en TODAS las instancias de Evolution API.
 */
export async function POST(req: NextRequest) {
    try {
        const WEBHOOK_URL = getWebhookUrl(req);
        const listRes = await fetch(`${EVO_URL}/instance/fetchInstances`, { headers: h });
        if (!listRes.ok) {
            return NextResponse.json({ error: `Evolution API error: ${listRes.status}` }, { status: 502 });
        }

        const raw: any = await listRes.json();
        const instances: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.instances ?? []);

        if (instances.length === 0) {
            return NextResponse.json({ error: 'No se encontraron instancias en Evolution API', results: [] }, { status: 404 });
        }

        const results: { instance: string; phone: string; status: string; webhookOk: boolean }[] = [];

        for (const inst of instances) {
            const name  = extractName(inst);
            const phone = inst?.instance?.owner || inst?.owner || '';
            if (!name) continue;

            const state = await getConnectionState(name);

            // Registrar webhook (siempre, independiente del estado)
            let webhookOk = false;
            try {
                const wRes = await fetch(`${EVO_URL}/webhook/set/${name}`, {
                    method: 'POST',
                    headers: h,
                    body: JSON.stringify({
                        webhook: {
                            url: WEBHOOK_URL,
                            webhook_by_events: false,
                            webhook_base64: false,
                            enabled: true,
                            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
                        },
                    }),
                });
                webhookOk = wRes.ok;
            } catch { /* ignora errores individuales */ }

            results.push({ instance: name, phone, status: state, webhookOk });
        }

        const synced = results.filter(r => r.webhookOk).length;
        return NextResponse.json({
            ok: true,
            message: `Webhook registrado en ${synced} de ${results.length} instancias`,
            webhookUrl: WEBHOOK_URL,
            results,
        });
    } catch (err: any) {
        console.error('[sync-webhooks]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
