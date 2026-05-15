import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { addDays, mondayOf, DAYS_ES } from '@/lib/schedule-context';
import { freewayInfo } from '@/lib/freeway-info';

export async function POST(req: Request) {
    try {
        const { question, scheduleContext } = await req.json();
        if (!question) return NextResponse.json({ text: 'Pregunta vacía.' }, { status: 400 });

        // Inicializar Firebase (solo para leer settings públicos)
        let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const fs = getFirestore(app);

        // 1. Precios (settings tiene allow read: if true — accesible sin auth)
        let catalogText = 'CATÁLOGO DE PRECIOS:\n';
        try {
            const prDoc = await getDoc(doc(fs, 'settings', 'prices'));
            const prices = prDoc.exists() ? prDoc.data().values : null;
            if (prices) {
                for (const cat in prices) {
                    catalogText += `  ${cat.toUpperCase()}:\n`;
                    for (const item in prices[cat]) catalogText += `    - ${item}: $${prices[cat][item]}\n`;
                }
            }
        } catch {}

        // 2. Base de conocimiento (también pública) — fallback a freeway-info.ts
        let kbText = freewayInfo;
        try {
            const aiDoc = await getDoc(doc(fs, 'settings', 'ai_knowledge'));
            if (aiDoc.exists() && aiDoc.data().text && aiDoc.data().text.length > 50) {
                // Si hay base de conocimiento personalizada en Firestore, añadirla ENCIMA
                kbText = aiDoc.data().text + '\n\n' + freewayInfo;
            }
        } catch {}

        // 3. Contexto de agenda — viene del FRONTEND (autenticado) via scheduleContext
        // Si no se proveyó, indicarlo claramente al modelo
        const agendaText = scheduleContext
            ? scheduleContext
            : 'NOTA: No se recibió contexto de agenda. Indica al vendedor que recargue e intente de nuevo.';

        // 4. Calcular referencia de fechas para el prompt
        const today = new Date();
        const tomorrow = addDays(today, 1);
        const nextMonday = mondayOf(addDays(today, 7));

        // 5. Prompt
        const prompt = `Eres FREEWAY AI — el mejor vendedor y asesor de Freeway Escuela de Manejo (Panamá).
Tu misión es CERRAR VENTAS. Eres experto en detectar la intención del cliente y guiarlo hacia la inscripción.

=== DETECCIÓN DE INTENCIÓN ===
Analiza el mensaje del asesor y clasifica internamente al cliente en una de estas etapas:
  🔴 EXPLORADOR: Solo pregunta precios o información general → Responde con entusiasmo, destaca el valor y beneficios, genera urgencia.
  🟡 INTERESADO: Pregunta por horarios específicos, disponibilidad, formas de pago → Están listos para avanzar. Ofrece opciones concretas y usa preguntas de cierre.
  🟢 LISTO PARA COMPRAR: Menciona "me anoto", "quiero empezar", "cómo pago", "cuándo inicio" o confirma un plan → ACTIVA EL CIERRE INMEDIATO.

=== TÉCNICAS DE VENTA (aplica siempre) ===
1. URGENCIA REAL: Si hay pocos cupos disponibles, menciónalo. Ej: "Esta semana quedan 2 cupos para automático, se llenan rápido."
2. VALOR > PRECIO: Siempre refuerza lo que INCLUYE el curso (foto, simulador, IA, libro, descuentos).
3. COMPARACIÓN FAVORABLE: Si preguntan precio, compara con el valor de obtener la licencia vs el costo del curso.
4. PREGUNTAS DE CIERRE: Usa frases como "¿Prefieres comenzar esta semana o la próxima?", "¿Automático o manual?", "¿Te acomoda mejor el horario de mañana o de tarde?"
5. ELIMINA OBJECIONES: Si dicen "está caro", ofrece el plan de abono o el combo. Si dicen "lo pienso", genera urgencia con cupos.
6. MINI-COMPROMISO: Cuando el cliente confirma interés, dile "Perfecto, solo necesitas 2 minutos para reservar tu cupo ahora mismo."

=== CURSOS DELUXE (menciona siempre los 3 cuando pregunten) ===
  1. 🏆 Paquete Deluxe (Edición Especial): $300 total. Matrícula $15 + 6 pagos quincenales de $45.
  2. 💼 Curso Deluxe con Énfasis en Logística (Edición Profesional): $330 total. Matrícula $15 + 6 pagos quincenales de $55.
  3. 🛵 Curso Deluxe con Énfasis en Delivery (Edición Delivery): $288 total. Matrícula $15 + 6 pagos quincenales de $48.
Todos incluyen: 20 horas teóricas + 16 horas prácticas, Jueves 7-9pm, 12 semanas.
Beneficios GRATIS: Libro, Simulador de Examen, Centro de Estudio IA, Descuento Tipaje y Doping.

=== CIERRE DE VENTA — URL DE INSCRIPCIÓN ===
Cuando el cliente esté listo para inscribirse (etapa 🟢 o cuando el asesor pida el link de cierre),
proporciona SIEMPRE este mensaje de cierre listo para enviar al cliente:

---
✅ *¡Excelente decisión!* Tu cupo en Freeway está a un paso.

👉 Ingresa aquí para elegir tu horario y completar tu pago en línea:
🔗 *https://www.contractimefedm.online/*

📲 Una vez que hagas tu pago, *envíanos el comprobante por este mismo WhatsApp* y con eso confirmamos tu matrícula oficialmente. ¡Te esperamos! 🎉
---

El asesor puede copiar ese bloque exacto y enviárselo al cliente por WhatsApp.

=== REGLAS PARA INTERPRETAR LA AGENDA ===
- Formato de cada turno: HORARIO:ESTADO[DETALLE]
  • LIBRE(Nesp) = N espacios completamente libres
  • LLENO[AUTO:(veh)(n)|MAN:(veh)(n)|MOTO:(veh)(n)] = sin espacios
  • X/Nlibre=Y[...] = X de N ocupados, Y espacios aún libres
- Para AUTO AUTOMÁTICO: busca "AUTO:" en los corchetes (Skoda Automatico, Picanto Blanco, Picanto Bronce)
- Para AUTO MANUAL: busca "MAN:" en los corchetes (Spark, Hyundai Manual, Skoda Manual, Pick Up)
- Para MOTO: busca "MOTO:" en los corchetes (Moto Roja, Moto Negra)
- Un turno está libre para AUTO AUTOMÁTICO si tiene "LIBRE" o si libre>0 y los autos automáticos no están al tope
- Si la semana dice "Toda la semana LIBRE" significa que no hay NINGUNA clase agendada aún

=== REFERENCIAS TEMPORALES ===
- Hoy: ${DAYS_ES[today.getDay()]} ${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}
- Mañana: ${DAYS_ES[tomorrow.getDay()]} ${tomorrow.getDate()}/${tomorrow.getMonth()+1}
- Próxima semana comienza: ${DAYS_ES[nextMonday.getDay()]} ${nextMonday.getDate()}/${nextMonday.getMonth()+1}

${kbText}

${catalogText}

${agendaText}

MENSAJE DEL ASESOR: ${question}

Responde en español panameño. Sé directo, entusiasta y orientado al cierre.
- Si hay disponibilidad, dila con urgencia.
- Si el cliente está listo para inscribirse, incluye el bloque de cierre con la URL.
- Siempre termina con una pregunta de acción o siguiente paso.`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
                })
            }
        );

        if (!response.ok) {
            return NextResponse.json({ text: 'Error IA: ' + response.status }, { status: 500 });
        }

        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar respuesta.';
        return NextResponse.json({ text: answer.trim() });

    } catch (e: any) {
        return NextResponse.json({ text: 'Error interno: ' + String(e.message) }, { status: 500 });
    }
}
