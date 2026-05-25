import { NextResponse } from 'next/server';

// Opt out of caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base64Image = body.base64Image;
    
    if (!base64Image) {
      return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Configuración: No se encontró la clave de API en el servidor.' }, { status: 400 });
    }

    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const requestBody = {
      contents: [{
        parts: [
          { text: `Eres un asistente contable experto procesando facturas y recibos de Panamá.
Analiza la siguiente imagen de una factura y extrae los datos con mucha precisión.
Responde ÚNICAMENTE con un objeto JSON válido que contenga estas propiedades exactas (sin comillas invertidas extra ni texto fuera del JSON):
{
  "amount": (número decimal, el total exacto pagado en la factura, o 0),
  "date": (texto, "YYYY-MM-DD", la fecha de la factura o hoy),
  "provider": (texto, el nombre comercial principal),
  "providerRuc": (texto opcional, el RUC),
  "providerDv": (texto opcional, el DV),
  "invoiceNumber": (texto opcional, el número único impreso de factura/recibo/documento),
  "category": (elige una: "Combustible", "Alquiler", "Salarios", "Mantenimiento", "Insumos", "Otros"),
  "description": (texto breve, lo que se pagó)
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

    const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!fetchRes.ok) {
      const errorText = await fetchRes.text();
      return NextResponse.json({ success: false, error: `Error desde API de IA: ${fetchRes.status} ${errorText.substring(0, 100)}` }, { status: fetchRes.status });
    }

    const data = await fetchRes.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json({ success: false, error: 'Respuesta vacía o formato inválido desde la IA.' }, { status: 500 });
    }

    try {
      const parsedOutput = JSON.parse(candidateText);
      return NextResponse.json({ success: true, data: parsedOutput });
    } catch (parseError) {
      return NextResponse.json({ success: false, error: 'No se pudo leer la respuesta JSON de la IA.' }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Ocurrió un error inesperado al procesar la solicitud.' }, { status: 500 });
  }
}
