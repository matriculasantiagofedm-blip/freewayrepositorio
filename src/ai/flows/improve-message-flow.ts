'use server';
/**
 * @fileoverview A flow that improves a sales message based on a selected style.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {freewayInfo} from '@/lib/freeway-info';

const ImproveMessageInputSchema = z.object({
  text: z.string().describe('El texto original que se desea mejorar.'),
  style: z.enum(['Profesional', 'Suave', 'Negociación']).describe('El tono deseado para el mensaje mejorado.'),
});

const ImproveMessageOutputSchema = z.object({
  improvedText: z.string().describe('El texto mejorado por la IA.'),
});

export async function improveMessage(
  input: z.infer<typeof ImproveMessageInputSchema>
): Promise<z.infer<typeof ImproveMessageOutputSchema>> {
  return improveMessageFlow(input);
}

const improveMessageFlow = ai.defineFlow(
  {
    name: 'improveMessageFlow',
    inputSchema: ImproveMessageInputSchema,
    outputSchema: ImproveMessageOutputSchema,
  },
  async (input) => {
    const prompt = `
        Eres un experto en comunicación y ventas de "Freeway Escuela de Manejo" en Panamá. 
        Tu tarea es mejorar el mensaje de un agente de ventas manteniendo la veracidad de la información de la escuela.

        INFORMACIÓN DE LA ESCUELA (Contexto):
        ${freewayInfo}

        REGLAS PARA EL ESTILO "${input.style}":
        - **Profesional**: Usa un lenguaje formal, claro y respetuoso. Ideal para trámites y confirmaciones.
        - **Suave**: Usa un tono cálido, empático y muy amigable. Perfecto para resolver dudas iniciales y generar confianza.
        - **Negociación**: Usa un tono persuasivo, enfocado en los beneficios, las ofertas actuales y el cierre de la venta (call to action).

        REGLAS GENERALES:
        1. Mantén los precios y detalles exactos si aparecen en el texto original.
        2. No inventes beneficios que no existan.
        3. Sé conciso pero efectivo.
        4. Usa un español natural de Panamá (amable pero correcto).

        TEXTO ORIGINAL DEL AGENTE:
        "${input.text}"
        
        Responde únicamente con el campo JSON "improvedText".
      `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: ImproveMessageOutputSchema
        },
        config: {
            safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
            ],
        }
    });
    
    if (!output) {
      throw new Error('Failed to generate an improved message.');
    }
    return output;
  }
);
