import { NextResponse } from 'next/server';

export const maxDuration = 55;

const KNOWLEDGE = `
Freeway Escuela de Manejo - Panama (La Chorrera, Green Plaza)
WhatsApp: +507-6381-4115

CURSOS:
- Auto Manual o Automatico: desde $133 (8h teoria + 8h practica, Certificado A,B)
- Motocicleta: desde $115 (traer casco y pasaportania)
- Mixto (Auto + Moto): precio combinado con descuento
- Deluxe Estandar: $300 total (matricula $15 + 6 pagos de $45)
- Deluxe Logistica: $330 total (matricula $15 + 6 pagos de $55)
- Deluxe Delivery: $288 total (matricula $15 + 6 pagos de $48)
- PAGO: Efectivo, tarjeta, transferencia, cuotas quincenales
- HORARIOS: Lunes a sabado
`;

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
                        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
                    })
                }
            );

            clearTimeout(timeoutId);

            if (res.status === 429) {
                await new Promise(r => setTimeout(r, (attempt + 1) * 4000));
                continue;
            }

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                console.error(`[copilot] Gemini ${res.status}:`, errBody.substring(0, 300));
                throw new Error(`GEMINI_HTTP_${res.status}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
            return NextResponse.json({ ok: false, error: 'API Key no configurada en el servidor.' });
        }

        const prompt = `Eres el copiloto de ventas de Freeway Escuela de Manejo (Panama).

INFORMACION DE LA EMPRESA:
${KNOWLEDGE}

HISTORIAL DE CONVERSACION:
${history || '(Cliente nuevo)'}

INSTRUCCION: Escribe 3 mensajes de WhatsApp para que el asesor responda al cliente.
Cada mensaje debe ser maximo 2 oraciones. Tono panamenio, natural y profesional.

FORMATO DE RESPUESTA (escribe EXACTAMENTE asi, 3 lineas, nada mas):
DIRECTA: [mensaje que responde la duda con informacion del catalogo]
CIERRE: [mensaje que invita a inscribirse hoy, pregunta horario o pago]
PERSUASIVA: [mensaje corto y entusiasta con un emoji]`;

        const rawText = await callGemini(prompt, GEMINI_API_KEY);
        console.log('[copilot] raw:', rawText.substring(0, 300));

        // Parsear por prefijos de línea — mucho más robusto que JSON
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

        const findLine = (prefix: string) =>
            lines.find(l => l.toUpperCase().startsWith(prefix.toUpperCase()))
                ?.replace(new RegExp(`^${prefix}:?\\s*`, 'i'), '')
                .replace(/\*\*/g, '')   // quitar markdown bold
                .trim() ?? '';

        const directa    = findLine('DIRECTA');
        const cierre     = findLine('CIERRE');
        const persuasiva = findLine('PERSUASIVA');

        if (!directa && !cierre && !persuasiva) {
            console.error('[copilot] parsing failed, rawText:', rawText.substring(0, 400));
            return NextResponse.json({
                ok: false,
                error: 'La IA no pudo generar sugerencias. Intenta de nuevo.'
            });
        }

        return NextResponse.json({
            ok: true,
            options: {
                directa:    directa    || '(Sin respuesta directa)',
                cierre:     cierre     || '(Sin respuesta de cierre)',
                persuasiva: persuasiva || '(Sin respuesta persuasiva)',
            }
        });

    } catch (err: any) {
        const msg = err?.message || 'ERROR_DESCONOCIDO';
        console.error('[copilot] Fatal:', msg);

        const friendlyError =
            msg === 'TIMEOUT'                ? 'Tiempo de espera agotado. Intenta de nuevo.' :
            msg === 'MAX_RETRIES_EXCEEDED'   ? 'La IA esta ocupada. Espera unos segundos.' :
            msg.includes('GEMINI_HTTP_429')  ? 'Limite de uso alcanzado. Espera 30 segundos.' :
            msg.includes('GEMINI_HTTP_')     ? 'Error de la IA. Intenta de nuevo.' :
                                               'Error inesperado. Intenta de nuevo.';

        return NextResponse.json({ ok: false, error: friendlyError });
    }
}
