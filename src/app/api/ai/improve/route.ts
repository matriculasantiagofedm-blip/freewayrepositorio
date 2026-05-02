import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, style } = await req.json();
        const prompt = `Actúa como un experto en ventas panameño. Toma el siguiente texto del empleado y devuélvelo mejorado, manteniendo el espíritu pero adaptándolo estrictamente a este estilo: ${style}.
        
Debe sonar amigable, humano y no como un robot. NO des explicaciones. Solo manda la frase lista para enviar.
        
TEXTO ORIGINAL:
"${text}"`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 300 }
            })
        });
        
        if (!response.ok) {
            return NextResponse.json({ text: "Error de servidor Gemini." }, { status: 500 });
        }
        
        const data = await response.json();
        const finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo mejorar el mensaje.";
        return NextResponse.json({ text: finalAnswer.trim() });
    } catch (e: any) {
        return NextResponse.json({ text: "Error crítico: " + String(e.message) }, { status: 500 });
    }
}
