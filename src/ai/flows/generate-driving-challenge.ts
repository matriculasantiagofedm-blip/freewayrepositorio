'use server';
/**
 * @fileoverview A flow that generates driving challenges based on Panamanian traffic scenarios.
 */

import {ai} from '@/ai/genkit';
import {
  GenerateDrivingChallengeInput,
  GenerateDrivingChallengeInputSchema,
  GenerateDrivingChallengeOutput,
  GenerateDrivingChallengeOutputSchema,
} from './assistant-flow-types';
import {reglamentoDeTransito} from '@/lib/reglamento-transito';

export async function generateDrivingChallenge(
  input: GenerateDrivingChallengeInput
): Promise<GenerateDrivingChallengeOutput> {
  return generateDrivingChallengeFlow(input);
}

const generateDrivingChallengeFlow = ai.defineFlow(
  {
    name: 'generateDrivingChallengeFlow',
    inputSchema: GenerateDrivingChallengeInputSchema,
    outputSchema: GenerateDrivingChallengeOutputSchema,
  },
  async (input) => {
    const prompt = `
        Eres un instructor de manejo experto en el reglamento de tránsito de Panamá.
        Tu tarea es crear un desafío de "¿Qué harías?" basado en un escenario realista y luego proporcionar la solución experta.

        El escenario base es: "${input.situation}"

        1.  **Escenario**: Describe el escenario de conducción de forma clara. Usa la situación base proporcionada.
        2.  **Pregunta**: Formula una pregunta clara y concisa que usualmente sea "¿Qué harías?".
        3.  **Explicación**: Proporciona una explicación detallada y experta de la acción correcta y más segura a tomar en esta situación. Justifica tu respuesta con artículos o principios del reglamento de tránsito de Panamá cuando sea aplicable. La explicación debe ser educativa y constructiva.

        NO proporciones opciones de respuesta. Solo genera el escenario, la pregunta del desafío y la explicación experta.

        Responde en el formato JSON especificado.
      `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: GenerateDrivingChallengeOutputSchema
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