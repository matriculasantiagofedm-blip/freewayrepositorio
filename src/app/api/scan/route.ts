import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_FALLBACK_KEY = 'AIzaSyCqW5aoIkWl4Nv3ZmWbvgtIsCJ3Um9mugw';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base64Image = body.base64Image;
    
    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'No se proporcionó ninguna imagen.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || DEFAULT_FALLBACK_KEY;

    // Limpiar el prefijo data:image/...;base64, de forma segura
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();

    const requestBody = {
      contents: [{
        parts: [
          { text: `Eres un asistente contable experto procesando facturas, comprobantes de pago y recibos de Panamá.
Analiza la siguiente imagen de una factura/recibo y extrae los datos con mucha precisión.
Responde ÚNICAMENTE con un objeto JSON válido que contenga estas propiedades exactas (sin comillas invertidas extra ni texto fuera del JSON):
{
  "amount": (número decimal con el total exacto pagado en la factura, o 0),
  "date": (texto en formato "YYYY-MM-DD" con la fecha de la factura, o la fecha de hoy),
  "provider": (texto con el nombre comercial o razón social del emisor de la factura),
  "providerRuc": (texto opcional con el RUC si aparece),
  "providerDv": (texto opcional con el DV si aparece),
  "invoiceNumber": (texto opcional con el número de factura/recibo/documento),
  "category": (elige estrictamente una de: "Combustible", "Alquiler", "Salarios", "Mantenimiento", "Insumos", "Otros"),
  "description": (texto breve describiendo el gasto o producto comprado)
}` },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json",
      }
    };

    // Intentar primero con gemini-2.5-flash y fallback a gemini-flash-latest
    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest'];
    let candidateText: string | null = null;
    let lastError: string = '';

    for (const model of modelsToTry) {
      try {
        const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (fetchRes.ok) {
          const data = await fetchRes.json();
          candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (candidateText) break;
        } else {
          const errBody = await fetchRes.text();
          lastError = `Modelo ${model} (${fetchRes.status}): ${errBody.substring(0, 150)}`;
          console.warn(`[AI Scan] Falló con ${model}:`, lastError);
        }
      } catch (err: any) {
        lastError = err.message || 'Error de conexión con Gemini';
      }
    }

    if (!candidateText) {
      return NextResponse.json({ 
        success: false, 
        error: `No se pudo analizar la factura con la IA. Detalle: ${lastError}` 
      }, { status: 500 });
    }

    try {
      // Limpiar posibles bloques ```json ... ``` si la IA los incluye
      const cleaned = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsedOutput = JSON.parse(cleaned);
      return NextResponse.json({ success: true, data: parsedOutput });
    } catch (parseError) {
      console.error("[AI Scan] Error parsing JSON candidate:", candidateText);
      return NextResponse.json({ success: false, error: 'No se pudo estructurar el JSON devuelto por la IA.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[AI Scan] Exception:", error);
    return NextResponse.json({ success: false, error: error.message || 'Ocurrió un error inesperado al procesar la factura.' }, { status: 500 });
  }
}
