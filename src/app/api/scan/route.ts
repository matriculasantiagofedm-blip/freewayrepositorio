import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base64Image = body.base64Image;
    
    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'No se proporcionó ninguna imagen.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Configuración: No se encontró la clave de API (GEMINI_API_KEY) en las variables de entorno de Vercel/Servidor.' 
      }, { status: 500 });
    }

    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const requestBody = {
      contents: [{
        parts: [
          { text: `Eres un asistente contable experto procesando facturas y recibos de Panamá.
Analiza la siguiente imagen de una factura/recibo y extrae los datos con precisión.
Responde ÚNICAMENTE con un objeto JSON válido que contenga estas propiedades exactas (sin comillas invertidas extra ni texto fuera del JSON):
{
  "amount": (número decimal, el total exacto pagado en la factura, o 0),
  "date": (texto, "YYYY-MM-DD", la fecha de la factura o la fecha actual),
  "provider": (texto, el nombre comercial o razón social principal),
  "providerRuc": (texto opcional, el RUC),
  "providerDv": (texto opcional, el DV),
  "invoiceNumber": (texto opcional, el número único impreso de factura/recibo/documento),
  "category": (elige estrictamente una de: "Combustible", "Alquiler", "Salarios", "Mantenimiento", "Insumos", "Otros"),
  "description": (texto breve, lo que se pagó o compró)
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
          lastError = `Modelo ${model} retornó ${fetchRes.status}: ${errBody.substring(0, 150)}`;
          console.warn(`[AI Scan] Error con ${model}:`, lastError);
        }
      } catch (err: any) {
        lastError = err.message || 'Error de red con Gemini';
      }
    }

    if (!candidateText) {
      return NextResponse.json({ 
        success: false, 
        error: `No se pudo procesar la factura con la IA. Detalle: ${lastError}` 
      }, { status: 500 });
    }

    try {
      const parsedOutput = JSON.parse(candidateText);
      return NextResponse.json({ success: true, data: parsedOutput });
    } catch (parseError) {
      return NextResponse.json({ success: false, error: 'No se pudo leer la respuesta JSON devuelta por la IA.' }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Ocurrió un error inesperado al procesar la factura.' }, { status: 500 });
  }
}
