import { NextResponse } from 'next/server';

// Base de conocimientos por defecto (si no se carga desde Firestore)
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

export async function POST(req: Request) {
    try {
        const { historyString, leadId } = await req.json();

        const kbText = DEFAULT_KB;
        const historyText = historyString ;

        const prompt = `Eres un copiloto experto en cierre de ventas por WhatsApp (Asesor de Freeway Panama).
Acabas de leer el historial reciente de una conversacion con un prospecto interesado en cursos de manejo o licencia.
Tu mision es ofrecerle al asesor humano 3 OPCIONES DISTINTAS de respuesta para que el asesor pueda elegir la mejor estrategia y enviarla.

REGLAS DE LAS OPCIONES:
Opcion 1: Respuesta directa y amigable. Responde su duda exacta basandote en el catalogo.
Opcion 2: Respuesta enfocada en avance o cierre (preguntandole disponibilidad, metodo de pago, o invitandolo a enviar sus datos).
Opcion 3: Respuesta corta, suave y persuasiva.
- Usa tono natural de Panama, profesional pero calido. Usa un emoji por respuesta.
- No saludes con "Hola" si la conversacion ya esta activa, a menos que tenga sentido.
- Formatea la respuesta estrictamente con vinetas:
1. Directa: (texto)
2. Al Cierre: (texto)
3. Persuasiva: (texto)

Base de Conocimientos:
${kbText}

Historial de la Conversacion:
${historyText || "(El cliente acaba de escribir para pedir informacion por primera vez)"}

Escribe las 3 opciones para responderle al cliente de la mejor manera. No incluyas nada mas que las opciones.`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY ;
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 1500 }
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('[copilot] Gemini error:', response.status, errText);
            return NextResponse.json({ text: `Error Gemini ${response.status}` }, { status: 500 });
        }

        const data = await response.json();
        const finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar respuesta.';
        return NextResponse.json({ text: finalAnswer.trim() });

    } catch (e: any) {
        console.error('[copilot] Error:', e);
        return NextResponse.json({ text: 'Error procesando IA: ' + String(e.message) }, { status: 500 });
    }
}

