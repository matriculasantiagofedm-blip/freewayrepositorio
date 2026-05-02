'use server';

import {ai} from '@/ai/genkit';
import { z } from 'zod';

const ValidatePaymentInputSchema = z.object({
  base64Image: z.string(),
  mimeType: z.string(),
});

const ValidatePaymentOutputSchema = z.object({
  isValid: z.boolean(),
  amount: z.number().nullable().optional(),
  reference: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  reason: z.string().nullable().optional()
});

export async function validatePaymentFlow(input: { base64Image: string, mimeType: string }) {
  return internalValidatePaymentFlow(input);
}

const internalValidatePaymentFlow = ai.defineFlow(
  {
    name: 'validatePaymentFlow',
    inputSchema: ValidatePaymentInputSchema,
    outputSchema: ValidatePaymentOutputSchema,
  },
  async (input) => {
    const prompt = `
      Eres un auditor financiero experto.
      Analiza la captura de pantalla adjunta de un comprobante de pago bancario (ej. Banco General / Yappy, o Tarjetas de Crédito).
      Tu tarea es asegurar que sea un comprobante legítimo de pago, exitoso y reciente, y no una simple transferencia pendiente o cancelada.
      
      Extrae de la imagen exactamente lo siguiente:
      - isValid: true si parece un comprobante legítimo y exitoso. false si es ilegible, si parece falso, si dice 'pendiente' o 'fallido', o si no es un comprobante.
      - amount: el monto exacto pagado en formato numerico (ej. 50.00).
      - reference: el número exacto de referencia, comprobante de pago, número de id, o confirmación.
      - bank: el nombre del banco o pasarela de pago (ej: "Banco General", "Cubo", "Yappy", "Banistmo").
      - reason: si isValid es falso, explica brevemente por qué. Si es verdadero, pon "OK".
    `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: [
           { text: prompt },
           { media: { url: `data:${input.mimeType};base64,${input.base64Image}` } }
        ],
        output: {
            schema: ValidatePaymentOutputSchema
        }
    });

    if (!output) {
      throw new Error('No se pudo leer la imagen del comprobante.');
    }
    return output;
  }
);
