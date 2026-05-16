import { NextResponse } from 'next/server';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FRAMEWORK DE COMUNICACIÃ“N â€” Freeway Escuela de Manejo
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//
// DIRECTRICES GLOBALES (aplican a todos los estilos):
// - Nunca uses tono confrontativo ni autoritario.
// - Evita respuestas cortantes o monosÃ­labos.
// - No prometas cosas que no se pueden cumplir.
// - PROHIBIDO: [Nombre], [Cliente], [Fecha] ni texto entre corchetes.
// - MÃ¡ximo 3 oraciones. Listo para pegar en WhatsApp.

const STYLE_GUIDE: Record<string, string> = {

    'Profesional': `
Aplica estas reglas en orden:
1. TONO: Lenguaje preciso y formal, propio de un asesor de una escuela de manejo reconocida.
   Sin jerga, sin emojis, sin expresiones informales. Estructura lÃ³gica y clara.
2. CONTENIDO: MantÃ©n la intenciÃ³n del mensaje original. Eleva el vocabulario sin cambiar el sentido.
3. CIERRE: Si aplica, termina con una invitaciÃ³n respetuosa a responder o actuar.

Ejemplo entrada: "me indica su cedula"
Ejemplo salida: "Buenos dÃ­as. Para continuar con su proceso de inscripciÃ³n, le solicito amablemente su nÃºmero de cÃ©dula."`,

    'Suave': `
Aplica estas reglas en orden:
1. VALIDACIÃ“N PREVIA: Empieza reconociendo la situaciÃ³n del cliente con una frase de transiciÃ³n
   como "Con gusto te ayudo con eso", "Entiendo perfectamente" o "Aprecio tu mensaje".
   Esto reduce la resistencia antes de pedir algo.
2. TONO: CÃ¡lido, empÃ¡tico y cercano. Puedes usar 1 emoji apropiado mÃ¡ximo.
3. CIERRE COLABORATIVO: Termina con una pregunta abierta que invite a cooperar,
   como "Â¿CÃ³mo te queda eso?" o "Â¿CuÃ¡ndo te vendrÃ­a bien?"

Ejemplo entrada: "me indica su cedula"
Ejemplo salida: "Con gusto te ayudo con tu proceso ðŸ˜Š Para poder avanzar, Â¿me puedes compartir tu nÃºmero de cÃ©dula?"`,

    'NegociaciÃ³n': `
Aplica estas reglas en orden:
1. ESCUCHA ACTIVA: Resume brevemente lo que el cliente dijo o necesita (1 frase).
   Esto demuestra comprensiÃ³n antes de responder.
2. ENFOQUE GANAR-GANAR: Presenta el beneficio concreto para el cliente de tomar acciÃ³n.
   Si hay una limitaciÃ³n, ofrece siempre una alternativa o concesiÃ³n. Nunca cierres sin salida.
   No cedas por cortesÃ­a ni impongas por autoridad â€” busca lo que conviene a ambos.
3. CIERRE COLABORATIVO: Termina con una pregunta que invite a decidir hoy,
   como "Â¿Te animas si lo coordinamos ahora?" o "Â¿CÃ³mo te sentirÃ­as si exploramos esta opciÃ³n?"

Ejemplo entrada: "me indica su cedula"
Ejemplo salida: "Para reservar tu cupo antes de que se llene â€” que es lo que quieres asegurar â€” solo necesito tu cÃ©dula. Â¿Te animas a compartirla ahora y coordinamos todo?"`,
};

export async function POST(req: Request) {
    try {
        const { text, style } = await req.json();

        if (!text?.trim()) {
            return NextResponse.json({ text: 'El mensaje no puede estar vacÃ­o.' }, { status: 400 });
        }

        const guia = STYLE_GUIDE[style as string] || STYLE_GUIDE['Profesional'];

        const prompt = `Eres el asistente experto en comunicaciÃ³n de ventas de Freeway Escuela de Manejo en PanamÃ¡.

Tu Ãºnica tarea es reescribir el mensaje de un asesor aplicando el estilo y las tÃ©cnicas indicadas.

â”â”â” ESTILO: ${style} â”â”â”
${guia}

â”â”â” RESTRICCIONES ABSOLUTAS â”â”â”
- Devuelve ÃšNICAMENTE el mensaje mejorado. Sin explicaciones, sin encabezados, sin comillas.
- PROHIBIDO usar placeholders: [Nombre], [Cliente], [Fecha] ni NADA entre corchetes [ ].
- El mensaje debe poder copiarse y pegarse en WhatsApp exactamente como sale.
- No inventes datos (nombres, precios, fechas) que no estÃ©n en el mensaje original.
- MÃ¡ximo 3 oraciones. Idioma: espaÃ±ol panameÃ±o estÃ¡ndar.

â”â”â” MENSAJE ORIGINAL â”â”â”
"${text.trim()}"

â”â”â” MENSAJE MEJORADO â”â”â”`;

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
            console.error('[/api/ai/improve] Sin texto. RazÃ³n:', reason);
            return NextResponse.json({ text: `Sin respuesta del modelo (${reason}).` }, { status: 500 });
        }

        // Limpieza de seguridad
        result = result
            .trim()
            .replace(/\[.*?\]/g, '')                              // elimina [placeholders]
            .replace(/^["'""''`]+|["'""''`]+$/g, '')              // quita comillas decorativas
            .replace(/^(Mensaje mejorado:|Respuesta:|Resultado:|â”+.*?â”+\s*)/i, '') // etiquetas residuales
            .replace(/\n{2,}/g, ' ')                              // colapsa saltos dobles
            .trim();

        return NextResponse.json({ text: result });

    } catch (e: any) {
        console.error('[/api/ai/improve] Error inesperado:', e);
        return NextResponse.json({ text: 'Error de conexiÃ³n con la IA.' }, { status: 500 });
    }
}

