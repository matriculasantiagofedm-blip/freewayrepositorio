'use server';

export async function scanReceipt(base64Image: string) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'No se encontró la clave de API en el servidor.' };
    }

    // Extraer solo la data base64 si incluye el prefijo "data:image/jpeg;base64,"
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", response.status, errorText);
      return { success: false, error: `Error conectando a la IA: ${response.statusText}` };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return { success: false, error: 'La IA no devolvió un formato válido.' };
    }

    const parsedOutput = JSON.parse(candidateText);

    return { 
      success: true, 
      data: parsedOutput
    };

  } catch (error: any) {
    console.error('Error scanning receipt:', error);
    return { success: false, error: error.message || 'Ocurrió un error al procesar la imagen.' };
  }
}
