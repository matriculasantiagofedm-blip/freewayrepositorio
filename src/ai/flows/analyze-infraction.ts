'use server';
/**
 * @fileoverview A flow that analyzes a driving situation to identify a traffic infraction.
 */

import {ai} from '@/ai/genkit';
import {
  AnalyzeInfractionInput,
  AnalyzeInfractionInputSchema,
  AnalyzeInfractionOutput,
  AnalyzeInfractionOutputSchema,
} from './assistant-flow-types';
import {reglamentoDeTransito} from '@/lib/reglamento-transito';

export async function analyzeInfraction(
  input: AnalyzeInfractionInput
): Promise<AnalyzeInfractionOutput> {
  return analyzeInfractionFlow(input);
}

const analyzeInfractionFlow = ai.defineFlow(
  {
    name: 'analyzeInfractionFlow',
    inputSchema: AnalyzeInfractionInputSchema,
    outputSchema: AnalyzeInfractionOutputSchema,
  },
  async (input) => {
    const prompt = `
        Eres un experto absoluto en el reglamento de tránsito de Panamá. Tu única fuente de conocimiento es el documento proporcionado.
        Un usuario te describirá una situación. Tu tarea es identificar la infracción de tránsito principal cometida en esa situación.

        REGLAMENTO DE TRÁNSITO:
        ${reglamentoDeTransito}
        
        SITUACIÓN DEL USUARIO: "${input.situation}"
        
        Basándote ESTRICTAMENTE en el reglamento:
        1.  **Identifica la infracción principal**: Describe la falta cometida (ej. "Conducir utilizando el teléfono celular sin sistema de manos libres").
        2.  **Cita el artículo**: Encuentra el número del artículo principal que se violó.
        3.  **Determina la gravedad**: Clasifica la infracción (ej. "Leve", "Grave", "Gravísima") basándote en los artículos del Título V.
        4.  **Describe la sanción**: Explica cuál sería la multa o consecuencia según el reglamento.

        Si la situación descrita no parece ser una infracción clara, indícalo de manera respetuosa. No inventes información.
        Responde únicamente en el formato JSON especificado.
      `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: AnalyzeInfractionOutputSchema
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
      throw new Error('Failed to generate a valid analysis from the AI.');
    }
    return output;
  }
);