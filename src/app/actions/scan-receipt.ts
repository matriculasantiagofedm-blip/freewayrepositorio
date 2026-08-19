'use server';

const DEFAULT_FALLBACK_KEY = 'AIzaSyCqW5aoIkWl4Nv3ZmWbvgtIsCJ3Um9mugw';

export async function scanReceipt(base64Image: string) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || DEFAULT_FALLBACK_KEY;

    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();

    const requestBody = {
      contents: [{
        parts: [
          { text: `Eres un asistente contable experto procesando facturas y recibos de Panamá.
Analiza la siguiente imagen de una factura y extrae los datos con mucha precisión.
Responde ÚNICAMENTE con un objeto JSON válido que contenga estas propiedades exactas (sin comillas invertidas extra ni texto fuera del JSON):
{
  "amount": (número decimal, el total exacto pagado en la factura, o 0),
  "date": (texto, "YYYY-MM-DD", la fecha de la factura o hoy si no se ve bien),
  "provider": (texto, el nombre comercial principal arriba en el recibo),
  "providerRuc": (texto opcional, el RUC),
  "providerDv": (texto opcional, el DV o dígito verificador),
  "invoiceNumber": (texto opcional, el número de factura),
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

    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest'];
    let candidateText: string | null = null;
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (candidateText) break;
        } else {
          lastError = await response.text();
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!candidateText) {
      return { success: false, error: `La IA no pudo procesar la imagen. Detalle: ${lastError.substring(0, 100)}` };
    }

    const cleaned = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsedOutput = JSON.parse(cleaned);

    return { 
      success: true, 
      data: parsedOutput
    };

  } catch (error: any) {
    console.error('Error scanning receipt:', error);
    return { success: false, error: error.message || 'Ocurrió un error al procesar la imagen.' };
  }
}
