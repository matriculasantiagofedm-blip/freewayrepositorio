import { NextResponse } from 'next/server';

// ══════════════════════════════════════════════════════════
// FRAMEWORK DE COMUNICACIÓN — Freeway Escuela de Manejo
// ══════════════════════════════════════════════════════════
//
// DIRECTRICES GLOBALES (aplican a todos los estilos):
// - Nunca uses tono confrontativo ni autoritario.
// - Evita respuestas cortantes o monosílabos.
// - No prometas cosas que no se pueden cumplir.
// - PROHIBIDO: [Nombre], [Cliente], [Fecha] ni texto entre corchetes.
// - Máximo 3 oraciones. Listo para pegar en WhatsApp.

const STYLE_GUIDE: Record<string, string> = {

    'Profesional': `
Aplica estas reglas en orden:
1. TONO: Lenguaje preciso y formal, propio de un asesor de una escuela de manejo reconocida.
   Sin jerga, sin emojis, sin expresiones informales. Estructura lógica y clara.
2. CONTENIDO: Mantén la intención del mensaje original. Eleva el vocabulario sin cambiar el sentido.
3. CIERRE: Si aplica, termina con una invitación respetuosa a responder o actuar.

Ejemplo entrada: "me indica su cedula"
Ejemplo salida: "Buenos días. Para continuar con su proceso de inscripción, le solicito amablemente su número de cédula."`,

    'Suave': `
Aplica estas reglas en orden:
1. VALIDACIÓN PREVIA: Empieza reconociendo la situación del cliente con una frase de transición
   como "Con gusto te ayudo con eso", "Entiendo perfectamente" o "Aprecio tu mensaje".
   Esto reduce la resistencia antes de pedir algo.
2. TONO: Cálido, empático y cercano. Puedes usar 1 emoji apropiado máximo.
3. CIERRE COLABORATIVO: Termina con una pregunta abierta que invite a cooperar,
   como "¿Cómo te queda eso?" o "¿Cuándo te vendría bien?"

Ejemplo entrada: "me indica su cedula"
Ejemplo salida: "Con gusto te ayudo con tu proceso 😊 Para poder avanzar, ¿me puedes compartir tu número de cédula?"`,

    'Negociación': `
Aplica estas reglas en orden:
1. ESCUCHA ACTIVA: Resume brevemente lo que el cliente dijo o necesita (1 frase).
   Esto demuestra comprensión antes de responder.
2. ENFOQUE GANAR-GANAR: Presenta el beneficio concreto para el cliente de tomar acción.
   Si hay una limitación, ofrece siempre una alternativa o concesión. Nunca cierres sin salida.
   No cedas por cortesía ni impongas por autoridad — busca lo que conviene a ambos.
3. CIERRE COLABORATIVO: Termina con una pregunta que invite a decidir hoy,
   como "¿Te animas si lo coordinamos ahora?" o "¿Cómo te sentirías si exploramos esta opción?"

Ejemplo entrada: "me indica su cedula"
Ejemplo salida: "Para reservar tu cupo antes de que se llene — que es lo que quieres asegurar — solo necesito tu cédula. ¿Te animas a compartirla ahora y coordinamos todo?"`,
};

export async function POST(req: Request) {
    try {
        const { text, style } = await req.json();

        if (!text?.trim()) {
            return NextResponse.json({ text: 'El mensaje no puede estar vacío.' }, { status: 400 });
        }

        const guia = STYLE_GUIDE[style as string] || STYLE_GUIDE['Profesional'];

        const prompt = `Eres el asistente experto en comunicación de ventas de Freeway Escuela de Manejo en Panamá.

Tu única tarea es reescribir el mensaje de un asesor aplicando el estilo y las técnicas indicadas.

━━━ ESTILO: ${style} ━━━
${guia}

━━━ RESTRICCIONES ABSOLUTAS ━━━
- Devuelve ÚNICAMENTE el mensaje mejorado. Sin explicaciones, sin encabezados, sin comillas.
- PROHIBIDO usar placeholders: [Nombre], [Cliente], [Fecha] ni NADA entre corchetes [ ].
- El mensaje debe poder copiarse y pegarse en WhatsApp exactamente como sale.
- No inventes datos (nombres, precios, fechas) que no estén en el mensaje original.
- Máximo 3 oraciones. Idioma: español panameño estándar.

━━━ MENSAJE ORIGINAL ━━━
"${text.trim()}"

━━━ MENSAJE MEJORADO ━━━`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            console.error('[/api/ai/improve] GEMINI_API_KEY no definida');
            return NextResponse.json({ text: 'Error: API key no configurada.' }, { status: 500 });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 200,
                        thinkingConfig: {
                            thinkingBudget: 0  // desactiva razonamiento extendido
                        }
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || 'Error desconocido de Gemini';
            console.error('[/api/ai/improve] Gemini error:', errMsg);
            return NextResponse.json({ text: `Error IA: ${errMsg}` }, { status: 500 });
        }

        let result: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        if (!result) {
            const reason = data.candidates?.[0]?.finishReason || 'sin respuesta';
            console.error('[/api/ai/improve] Sin texto. Razón:', reason);
            return NextResponse.json({ text: `Sin respuesta del modelo (${reason}).` }, { status: 500 });
        }

        // Limpieza de seguridad
        result = result
            .trim()
            .replace(/\[.*?\]/g, '')                              // elimina [placeholders]
            .replace(/^["'""''`]+|["'""''`]+$/g, '')              // quita comillas decorativas
            .replace(/^(Mensaje mejorado:|Respuesta:|Resultado:|━+.*?━+\s*)/i, '') // etiquetas residuales
            .replace(/\n{2,}/g, ' ')                              // colapsa saltos dobles
            .trim();

        return NextResponse.json({ text: result });

    } catch (e: any) {
        console.error('[/api/ai/improve] Error inesperado:', e);
        return NextResponse.json({ text: 'Error de conexión con la IA.' }, { status: 500 });
    }
}
