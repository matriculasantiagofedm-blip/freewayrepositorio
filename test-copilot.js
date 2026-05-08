const fetch = require('node-fetch');

async function test() {
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
Precios de Freeway Panamá: Autos desde $133, Motos desde $115.

CATÁLOGO OFICIAL DE PRECIOS:

Historial de la Conversación:
(El cliente acaba de escribir para pedir información por primera vez)

Escribe las 3 opciones para responderle al cliente de la mejor manera. No incluyas nada más que las opciones.`;

    const GEMINI_API_KEY = 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 500 }
        })
    });
    
    if (!response.ok) {
        console.log("Error status:", response.status);
        console.log("Error text:", await response.text());
        return;
    }
    
    const data = await response.json();
    console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

test();
