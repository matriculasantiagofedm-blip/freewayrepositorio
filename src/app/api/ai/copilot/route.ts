import { NextResponse } from 'next/server';

const DEFAULT_KB = `Freeway Escuela de Manejo - Panama
Cursos disponibles:
- Auto Manual: desde $133
- Auto Automatico: desde $133
- Motocicleta: desde $115
- Curso Mixto (auto + moto): precio especial
- Curso Deluxe (todo incluido): precio premium

Incluye: clases teoricas, clases practicas, simulador de examen, certificado A,B.
Los estudiantes de moto deben traer casco y pasamon bandera.
Metodos de pago: efectivo, tarjeta, transferencia, cuotas.
Horarios: lunes a sabado, distintos turnos disponibles.
`;

export const maxDuration = 55; // Next.js App Router max seconds

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const historyText = (body.historyString || '').slice(0, 2000);

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ text: 'Error: GEMINI_API_KEY no configurado.' }, { status: 500 });
        }

        const prompt = `Eres un copiloto de ventas de Freeway Escuela de Manejo (Panama).
Lee el historial de WhatsApp y da 3 opciones de respuesta para el asesor.

Base de conocimientos:
${DEFAULT_KB}

Historial:
${historyText || '(Sin historial - primera vez que contacta)'}

Responde SOLO con las 3 opciones en este formato:
1. Directa: [texto]
2. Al Cierre: [texto]
3. Persuasiva: [texto]`;

        // Timeout de 25 segundos para no colgar el Cloud Function
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        let geminiResponse: Response;
        try {
            geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.5, maxOutputTokens: 800 }
                    })
                }
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!geminiResponse.ok) {
            const errBody = await geminiResponse.text().catch(() => 'sin detalle');
            console.error('[copilot] Gemini HTTP error:', geminiResponse.status, errBody.substring(0, 200));
            return NextResponse.json(
                { text: `Error al contactar IA (${geminiResponse.status}). Intente de nuevo.` },
                { status: 200 } // 200 para que el frontend muestre el mensaje en el panel
            );
        }

        const data = await geminiResponse.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!answer) {
            return NextResponse.json({ text: 'La IA no genero respuesta. Intente de nuevo.' }, { status: 200 });
        }

        return NextResponse.json({ text: answer.trim() });

    } catch (err: any) {
        const isTimeout = err?.name === 'AbortError';
        console.error('[copilot] Error:', err?.name, err?.message);
        return NextResponse.json(
            { text: isTimeout ? 'Tiempo de espera agotado. Intente de nuevo.' : 'Error interno. Intente de nuevo.' },
            { status: 200 }
        );
    }
}
