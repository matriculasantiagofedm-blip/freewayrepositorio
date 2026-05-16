import { NextResponse } from 'next/server';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COPILOTO IA - Freeway Escuela de Manejo
// VersiÃ³n: 2.0 - Construido desde cero
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const maxDuration = 55;

const KNOWLEDGE = `
EMPRESA: Freeway Escuela de Manejo - Panama (La Chorrera, Green Plaza)
WhatsApp: +507-6381-4115

CURSOS DISPONIBLES:
- Auto Manual: desde $133 (incluye 8h teorica + 8h practica)
- Auto Automatico: desde $133 (incluye 8h teorica + 8h practica)
- Motocicleta: desde $115 (el estudiante debe traer casco y pasaportania)
- Mixto (Auto + Moto): precio combinado con descuento
- Deluxe Estandar: $300 total (matricula $15 + 6 pagos de $45)
- Deluxe Logistica: $330 total (matricula $15 + 6 pagos de $55)
- Deluxe Delivery: $288 total (matricula $15 + 6 pagos de $48)

BENEFICIOS INCLUIDOS EN TODOS LOS CURSOS:
- Certificado A,B oficial
- Simulador de examen
- Centro de estudio con IA
- Clases teoricas + practicas

FORMAS DE PAGO: Efectivo, tarjeta, transferencia, cuotas quincenales.
HORARIOS: Lunes a sabado, distintos turnos disponibles.
INSCRIPCION ONLINE: https://www.contractimefedm.online/
`;

async function callGeminiWithRetry(prompt: string, apiKey: string): Promise<string> {
    const MAX_RETRIES = 3;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 22000);

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
                            temperature: 0.6,
                            maxOutputTokens: 700,
                            responseMimeType: 'application/json'
                        }
                    })
                }
            );

            clearTimeout(timeoutId);

            // 429 = rate limit â†’ esperar y reintentar
            if (res.status === 429) {
                const waitMs = (attempt + 1) * 3000;
                console.log(`[copilot] 429 rate limit, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                console.error(`[copilot] Gemini error ${res.status}:`, errText.substring(0, 200));
                throw new Error(`GEMINI_HTTP_${res.status}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('EMPTY_RESPONSE');
            return text;

        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err?.name === 'AbortError') throw new Error('TIMEOUT');
            if (attempt === MAX_RETRIES - 1) throw err;
            // Si es un error de red, reintentar
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
            return NextResponse.json({
                ok: false,
                error: 'GEMINI_API_KEY no configurado en el servidor.'
            });
        }

        const prompt = `Eres el mejor copiloto de ventas de Freeway Escuela de Manejo (Panama).
Tu mision: leer el historial de WhatsApp y generar 3 respuestas listas para copiar y enviar al cliente.

BASE DE CONOCIMIENTOS:
${KNOWLEDGE}

HISTORIAL DE LA CONVERSACION:
${history || '(Sin historial - cliente nuevo)'}

INSTRUCCIONES:
- Opcion 1 (DIRECTA): Responde la duda exacta con informacion precisa del catalogo.
- Opcion 2 (CIERRE): Impulsa al cierre. Pregunta disponibilidad, metodo de pago o invita a reservar cupo.
- Opcion 3 (PERSUASIVA): Mensaje corto, calido y con un emoji. Genera interes.
- Tono: natural panamenio, profesional pero cercano.
- NO incluyas los titulos (Directa, Cierre, Persuasiva) en el texto de la respuesta.
- Maximo 2 oraciones por opcion.

Responde UNICAMENTE con este JSON valido (sin markdown, sin backticks):
{
  "directa": "texto de la opcion directa aqui",
  "cierre": "texto de la opcion de cierre aqui",
  "persuasiva": "texto de la opcion persuasiva aqui"
}`;

        const rawText = await callGeminiWithRetry(prompt, GEMINI_API_KEY);

        // Parsear JSON de la respuesta
        let options: { directa: string; cierre: string; persuasiva: string };
        try {
            // Limpiar posibles backticks o texto extra
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');
            const jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);
            options = JSON.parse(jsonStr);
        } catch {
            // Si falla el JSON, intentar extraer el texto directamente
            return NextResponse.json({
                ok: true,
                options: {
                    directa: rawText.substring(0, 250),
                    cierre: 'Revisa el texto completo arriba.',
                    persuasiva: ''
                },
                rawText
            });
        }

        return NextResponse.json({ ok: true, options });

    } catch (err: any) {
        const msg = err?.message || 'ERROR_DESCONOCIDO';
        console.error('[copilot] Fatal error:', msg);

        const friendlyError =
            msg === 'TIMEOUT' ? 'Tiempo de espera agotado. Intenta de nuevo.' :
            msg.startsWith('GEMINI_HTTP_') ? `Error del servidor de IA (${msg}). Intenta de nuevo.` :
            msg === 'MAX_RETRIES_EXCEEDED' ? 'El servidor de IA esta ocupado. Espera 30 segundos e intenta de nuevo.' :
            'Error inesperado. Intenta de nuevo.';

        return NextResponse.json({ ok: false, error: friendlyError });
    }
}

