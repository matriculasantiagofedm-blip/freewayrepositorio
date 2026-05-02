import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

export async function POST(req: Request) {
    try {
        const { historyString, leadId } = await req.json();
        
        let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        let fs = getFirestore(app);
        
        // 1. Obtener Base de Conocimientos
        let kbText = "Precios de Freeway Panamá: Autos desde $133, Motos desde $115.";
        try {
            const aiDoc = await getDoc(doc(fs, 'settings', 'ai_knowledge'));
            if (aiDoc.exists() && aiDoc.data().text) kbText = aiDoc.data().text;
        } catch(e) {}
        
        // 2. Obtener Catálogo Completo de Precios
        let catalogText = "CATÁLOGO OFICIAL DE PRECIOS:\n";
        try {
            const prDoc = await getDoc(doc(fs, 'settings', 'prices'));
            const prices = prDoc.exists() ? prDoc.data().values : null;
            if (prices) {
                for (const cat in prices) {
                    catalogText += `CATEGORÍA ${cat.toUpperCase()}:\n`;
                    for (const item in prices[cat]) {
                        catalogText += `- ${item}: $${prices[cat][item]}\n`;
                    }
                }
            }
        } catch(e) {}

        // 3. Obtener Historial Reciente enviado desde el Frontend
        let historyText = historyString || "";

        const prompt = `Eres un copiloto experto en cierre de ventas por WhatsApp (Asesor de Freeway Panamá).
Acabas de leer el historial reciente de una conversación con un prospecto interesado en cursos de manejo o licencia.
Tu misión es ofrecerle al asesor humano 3 OPCIONES DISTINTAS de respuesta para que el asesor pueda elegir la mejor estrategia y enviarla.

REGLAS DE LAS OPCIONES:
Opción 1: Respuesta directa y amigable. Responde su duda exacta basándote en el catálogo.
Opción 2: Respuesta enfocada en avance o cierre (preguntándole disponibilidad, método de pago, o invitándolo a enviar sus datos).
Opción 3: Respuesta corta, suave y persuasiva.
- Usa tono natural de Panamá, profesional pero cálido. Usa un emoji por respuesta.
- No saludes con "Hola" si la conversación ya está activa, a menos que tenga sentido.
- Formatea la respuesta estrictamente con viñetas:
1️⃣ Directa: (texto)
2️⃣ Al Cierre: (texto)
3️⃣ Persuasiva: (texto)

Base de Datos:
${kbText}

${catalogText}

Historial de la Conversación:
${historyText || "(El cliente acaba de escribir para pedir información por primera vez)"}

Escribe las 3 opciones para responderle al cliente de la mejor manera. No incluyas nada más que las opciones.`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 3000 }
            })
        });
        
        if (!response.ok) {
             const errorRaw = await response.text();
             return NextResponse.json({ text: "La IA no pudo procesar la respuesta: " + response.status }, { status: 500 });
        }
        
        const data = await response.json();
        const finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar respuesta.";
        return NextResponse.json({ text: finalAnswer.trim() });
    } catch (e: any) {
        return NextResponse.json({ text: "Error procesando IA: " + String(e.message) }, { status: 500 });
    }
}
