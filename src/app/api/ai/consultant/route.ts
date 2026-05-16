import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { addDays, mondayOf, DAYS_ES } from '@/lib/schedule-context';
import { freewayInfo } from '@/lib/freeway-info';

export async function POST(req: Request) {
    try {
        const { question, scheduleContext } = await req.json();
        if (!question) return NextResponse.json({ text: 'Pregunta vacÃ­a.' }, { status: 400 });

        // Inicializar Firebase (solo para leer settings pÃºblicos)
        let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const fs = getFirestore(app);

        // 1. Precios (settings tiene allow read: if true â€” accesible sin auth)
        let catalogText = 'CATÃLOGO DE PRECIOS:\n';
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

        // 2. Base de conocimiento (tambiÃ©n pÃºblica) â€” fallback a freeway-info.ts
        let kbText = freewayInfo;
        try {
            const aiDoc = await getDoc(doc(fs, 'settings', 'ai_knowledge'));
            if (aiDoc.exists() && aiDoc.data().text && aiDoc.data().text.length > 50) {
                // Si hay base de conocimiento personalizada en Firestore, aÃ±adirla ENCIMA
                kbText = aiDoc.data().text + '\n\n' + freewayInfo;
            }
        } catch {}

        // 3. Contexto de agenda â€” viene del FRONTEND (autenticado) via scheduleContext
        // Si no se proveyÃ³, indicarlo claramente al modelo
        const agendaText = scheduleContext
            ? scheduleContext
            : 'NOTA: No se recibiÃ³ contexto de agenda. Indica al vendedor que recargue e intente de nuevo.';

        // 4. Calcular referencia de fechas para el prompt
        const today = new Date();
        const tomorrow = addDays(today, 1);
        const nextMonday = mondayOf(addDays(today, 7));

        // 5. Prompt
        const prompt = `Eres FREEWAY AI â€” el mejor vendedor y asesor de Freeway Escuela de Manejo (PanamÃ¡).
Tu misiÃ³n es CERRAR VENTAS. Eres experto en detectar la intenciÃ³n del cliente y guiarlo hacia la inscripciÃ³n.

=== DETECCIÃ“N DE INTENCIÃ“N ===
Analiza el mensaje del asesor y clasifica internamente al cliente en una de estas etapas:
  ðŸ”´ EXPLORADOR: Solo pregunta precios o informaciÃ³n general â†’ Responde con entusiasmo, destaca el valor y beneficios, genera urgencia.
  ðŸŸ¡ INTERESADO: Pregunta por horarios especÃ­ficos, disponibilidad, formas de pago â†’ EstÃ¡n listos para avanzar. Ofrece opciones concretas y usa preguntas de cierre.
  ðŸŸ¢ LISTO PARA COMPRAR: Menciona "me anoto", "quiero empezar", "cÃ³mo pago", "cuÃ¡ndo inicio" o confirma un plan â†’ ACTIVA EL CIERRE INMEDIATO.

=== TÃ‰CNICAS DE VENTA (aplica siempre) ===
1. URGENCIA REAL: Si hay pocos cupos disponibles, menciÃ³nalo. Ej: "Esta semana quedan 2 cupos para automÃ¡tico, se llenan rÃ¡pido."
2. VALOR > PRECIO: Siempre refuerza lo que INCLUYE el curso (foto, simulador, IA, libro, descuentos).
3. COMPARACIÃ“N FAVORABLE: Si preguntan precio, compara con el valor de obtener la licencia vs el costo del curso.
4. PREGUNTAS DE CIERRE: Usa frases como "Â¿Prefieres comenzar esta semana o la prÃ³xima?", "Â¿AutomÃ¡tico o manual?", "Â¿Te acomoda mejor el horario de maÃ±ana o de tarde?"
5. ELIMINA OBJECIONES: Si dicen "estÃ¡ caro", ofrece el plan de abono o el combo. Si dicen "lo pienso", genera urgencia con cupos.
6. MINI-COMPROMISO: Cuando el cliente confirma interÃ©s, dile "Perfecto, solo necesitas 2 minutos para reservar tu cupo ahora mismo."

=== CURSOS DELUXE (menciona siempre los 3 cuando pregunten) ===
  1. ðŸ† Paquete Deluxe (EdiciÃ³n Especial): $300 total. MatrÃ­cula $15 + 6 pagos quincenales de $45.
  2. ðŸ’¼ Curso Deluxe con Ã‰nfasis en LogÃ­stica (EdiciÃ³n Profesional): $330 total. MatrÃ­cula $15 + 6 pagos quincenales de $55.
  3. ðŸ›µ Curso Deluxe con Ã‰nfasis en Delivery (EdiciÃ³n Delivery): $288 total. MatrÃ­cula $15 + 6 pagos quincenales de $48.
Todos incluyen: 20 horas teÃ³ricas + 16 horas prÃ¡cticas, Jueves 7-9pm, 12 semanas.
Beneficios GRATIS: Libro, Simulador de Examen, Centro de Estudio IA, Descuento Tipaje y Doping.

=== CIERRE DE VENTA â€” URL DE INSCRIPCIÃ“N ===
Cuando el cliente estÃ© listo para inscribirse (etapa ðŸŸ¢ o cuando el asesor pida el link de cierre),
proporciona SIEMPRE este mensaje de cierre listo para enviar al cliente:

---
âœ… *Â¡Excelente decisiÃ³n!* Tu cupo en Freeway estÃ¡ a un paso.

ðŸ‘‰ Ingresa aquÃ­ para elegir tu horario y completar tu pago en lÃ­nea:
ðŸ”— *https://www.contractimefedm.online/*

ðŸ“² Una vez que hagas tu pago, *envÃ­anos el comprobante por este mismo WhatsApp* y con eso confirmamos tu matrÃ­cula oficialmente. Â¡Te esperamos! ðŸŽ‰
---

El asesor puede copiar ese bloque exacto y enviÃ¡rselo al cliente por WhatsApp.

=== REGLAS PARA INTERPRETAR LA AGENDA ===
- Formato de cada turno: HORARIO:ESTADO[DETALLE]
  â€¢ LIBRE(Nesp) = N espacios completamente libres
  â€¢ LLENO[AUTO:(veh)(n)|MAN:(veh)(n)|MOTO:(veh)(n)] = sin espacios
  â€¢ X/Nlibre=Y[...] = X de N ocupados, Y espacios aÃºn libres
- Para AUTO AUTOMÃTICO: busca "AUTO:" en los corchetes (Skoda Automatico, Picanto Blanco, Picanto Bronce)
- Para AUTO MANUAL: busca "MAN:" en los corchetes (Spark, Hyundai Manual, Skoda Manual, Pick Up)
- Para MOTO: busca "MOTO:" en los corchetes (Moto Roja, Moto Negra)
- Un turno estÃ¡ libre para AUTO AUTOMÃTICO si tiene "LIBRE" o si libre>0 y los autos automÃ¡ticos no estÃ¡n al tope
- Si la semana dice "Toda la semana LIBRE" significa que no hay NINGUNA clase agendada aÃºn

=== REFERENCIAS TEMPORALES ===
- Hoy: ${DAYS_ES[today.getDay()]} ${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}
- MaÃ±ana: ${DAYS_ES[tomorrow.getDay()]} ${tomorrow.getDate()}/${tomorrow.getMonth()+1}
- PrÃ³xima semana comienza: ${DAYS_ES[nextMonday.getDay()]} ${nextMonday.getDate()}/${nextMonday.getMonth()+1}

${kbText}

${catalogText}

${agendaText}

MENSAJE DEL ASESOR: ${question}

Responde en espaÃ±ol panameÃ±o. SÃ© directo, entusiasta y orientado al cierre.
- Si hay disponibilidad, dila con urgencia.
- Si el cliente estÃ¡ listo para inscribirse, incluye el bloque de cierre con la URL.
- Siempre termina con una pregunta de acciÃ³n o siguiente paso.`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY ;
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



