'use server';
/**
 * @fileoverview A flow that acts as an expert on the Panamanian traffic regulations.
 */

import {ai} from '@/ai/genkit';
import {
  ConsultATTTAssistantInput,
  ConsultATTTAssistantInputSchema,
  ConsultATTTAssistantOutput,
  ConsultATTTAssistantOutputSchema,
} from './assistant-flow-types';
import {reglamentoDeTransito} from '@/lib/reglamento-transito';

export async function consultATTTAssistant(
  input: ConsultATTTAssistantInput
): Promise<ConsultATTTAssistantOutput> {
  return consultATTTAssistantFlow(input);
}

const consultATTTAssistantFlow = ai.defineFlow(
  {
    name: 'consultATTTAssistantFlow',
    inputSchema: ConsultATTTAssistantInputSchema,
    outputSchema: ConsultATTTAssistantOutputSchema,
  },
  async (input) => {
    const prompt = `
      Eres un experto en el reglamento de tránsito de Panamá. Tu única fuente de conocimiento es el siguiente documento:
      
      REGLAMENTO DE TRÁNSITO:
      ${reglamentoDeTransito}
      
      Un usuario te hará una pregunta. Debes responderla de manera clara y concisa, basándote ESTRICTAMENTE en los artículos del reglamento proporcionado.
      
      Debes identificar y citar los artículos específicos que respaldan tu respuesta. No inventes información ni uses conocimiento externo. Si la respuesta no está en el documento, indica que no encontraste la información en el reglamento.
      
      Pregunta del usuario: "${input.query}"
      
      Responde en el formato JSON especificado.
    `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: ConsultATTTAssistantOutputSchema
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
      throw new Error('Failed to generate a valid response from the AI.');
    }
    return output;
  }
);