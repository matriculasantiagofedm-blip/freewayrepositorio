import { NextResponse } from 'next/server';

export const maxDuration = 55;

const KNOWLEDGE = `
EMPRESA: Freeway Escuela de Manejo - Panama (La Chorrera, Green Plaza)
WhatsApp: +507-6381-4115

CURSOS:
- Auto Manual o Automatico: desde $133 (8h teorica + 8h practica, Certificado A,B)
- Motocicleta: desde $115 (traer casco y pasaportania)
- Mixto (Auto + Moto): precio combinado con descuento
- Deluxe Estandar: $300 total (matricula $15 + 6 pagos de $45)
- Deluxe Logistica: $330 total (matricula $15 + 6 pagos de $55)
- Deluxe Delivery: $288 total (matricula $15 + 6 pagos de $48)

PAGO: Efectivo, tarjeta, transferencia, cuotas quincenales.
HORARIOS: Lunes a sabado, distintos turnos.
WEB: https://www.contractimefedm.online/
`;

function extractJSON(text: string): { directa: string; cierre: string; persuasiva: string } | null {
    // Estrategia 1: limpiar markdown y parsear directo
    try {
        const cleaned = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
            const jsonStr = cleaned.substring(start, end + 1);
            const parsed = JSON.parse(jsonStr);
            if (parsed.directa && parsed.cierre && parsed.persuasiva) return parsed;
        }
    } catch {}

    // Estrategia 2: regex para extraer cada campo
    try {
        const d = text.match(/"directa"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
        const c = text.match(/"cierre"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
        const p = text.match(/"persuasiva"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
        if (d && c && p) {
            return {
                directa: d.replace(/\\n/g, ' ').replace(/\\"/g, '"'),
                cierre: c.replace(/\\n/g, ' ').replace(/\\"/g, '"'),
                persuasiva: p.replace(/\\n/g, ' ').replace(/\\"/g, '"'),
            };
        }
    } catch {}

    return null;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.65,
                            maxOutputTokens: 800,
                        }
                    })
                }
            );

            clearTimeout(timeoutId);

            if (res.status === 429) {
                const waitMs = (attempt + 1) * 4000;
                console.log(`[copilot] 429 rate limit, retrying in ${waitMs}ms`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                console.error(`[copilot] Gemini ${res.status}:`, errBody.substring(0, 300));
                throw new Error(`GEMINI_HTTP_${res.status}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('EMPTY_RESPONSE');
            console.log('[copilot] raw response:', text.substring(0, 200));
            return text;

        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err?.name === 'AbortError') throw new Error('TIMEOUT');
            if (attempt === MAX_RETRIES - 1) throw err;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    throw new Error('MAX_RETRIES_EXCEEDED');
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const history = ((body.historyString as string) || '').slice(0, 3000);

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ ok: false, error: 'API Key no configurada.' });
        }

        const prompt = `Eres copiloto de ventas de Freeway Escuela de Manejo (Panama).

CONOCIMIENTO:
${KNOWLEDGE}

HISTORIAL WHATSAPP:
${history || '(Cliente nuevo sin historial)'}

TAREA: Genera exactamente 3 respuestas de WhatsApp para el asesor de ventas.
- directa: Responde la duda principal con datos concretos del catalogo.
- cierre: Impulsa al cliente a inscribirse hoy. Pregunta disponibilidad o forma de pago.
- persuasiva: Mensaje corto, amigable, con un emoji que genere interes.

REGLAS:
- Maximo 2 oraciones por respuesta.
- Tono natural panamenio, profesional pero cercano.
- NO incluyas etiquetas ni titulos dentro del texto de cada respuesta.
- Responde SOLO con el siguiente JSON (sin explicaciones, sin codigo markdown):

{"directa":"RESPUESTA_DIRECTA_AQUI","cierre":"RESPUESTA_CIERRE_AQUI","persuasiva":"RESPUESTA_PERSUASIVA_AQUI"}`;

        const rawText = await callGemini(prompt, GEMINI_API_KEY);
        const options = extractJSON(rawText);

        if (options) {
            return NextResponse.json({ ok: true, options });
        }

        // Si ninguna estrategia funcionó, devolver error informativo
        console.error('[copilot] JSON extraction failed. rawText:', rawText.substring(0, 400));
        return NextResponse.json({
            ok: false,
            error: 'La IA no respondio en el formato esperado. Intenta de nuevo.'
        });

    } catch (err: any) {
        const msg = err?.message || 'ERROR_DESCONOCIDO';
        console.error('[copilot] Fatal error:', msg);

        const friendlyError =
            msg === 'TIMEOUT' ? 'Tiempo de espera agotado. Intenta de nuevo.' :
            msg.includes('GEMINI_HTTP_429') || msg === 'MAX_RETRIES_EXCEEDED'
                ? 'La IA esta ocupada. Espera unos segundos e intenta de nuevo.' :
            msg.includes('GEMINI_HTTP_') ? `Error de la IA. Intenta de nuevo.` :
            'Error inesperado. Intenta de nuevo.';

        return NextResponse.json({ ok: false, error: friendlyError });
    }
}
