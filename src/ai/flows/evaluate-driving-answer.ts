'use server';
/**
 * @fileoverview A flow that evaluates a user's answer to a driving challenge.
 */

import {ai} from '@/ai/genkit';
import {
  EvaluateDrivingAnswerInput,
  EvaluateDrivingAnswerInputSchema,
  EvaluateDrivingAnswerOutput,
  EvaluateDrivingAnswerOutputSchema,
} from './assistant-flow-types';
import {reglamentoDeTransito} from '@/lib/reglamento-transito';

export async function evaluateDrivingAnswer(
  input: EvaluateDrivingAnswerInput
): Promise<EvaluateDrivingAnswerOutput> {
  return evaluateDrivingAnswerFlow(input);
}

const evaluateDrivingAnswerFlow = ai.defineFlow(
  {
    name: 'evaluateDrivingAnswerFlow',
    inputSchema: EvaluateDrivingAnswerInputSchema,
    outputSchema: EvaluateDrivingAnswerOutputSchema,
  },
  async (input) => {
    const prompt = `
        Eres un instructor de manejo experto y evaluador para el reglamento de tránsito de Panamá.
        Tu tarea es evaluar la respuesta de un usuario a un escenario de conducción.

        El escenario fue: "${input.situation}"
        La respuesta del usuario fue: "${input.userAnswer}"

        Basándote ESTRICTAMENTE en el reglamento de tránsito de Panamá, evalúa la respuesta del usuario.
        Reglamento de Tránsito:
        ${reglamentoDeTransito}

        1.  **Calificación**: Determina si la respuesta es 'correcta', 'regular' o 'incorrecta'.
            -   'correcta': La respuesta es la acción ideal, más segura y apegada al reglamento.
            -   'regular': La respuesta es aceptable pero no es la mejor, o es parcialmente correcta.
            -   'incorrecta': La respuesta es peligrosa, ilegal o completamente equivocada.

        2.  **Feedback**: Proporciona una explicación detallada y constructiva.
            -   Si es correcta, refuerza por qué es la mejor acción citando el reglamento.
            -   Si es regular, explica qué se podría mejorar y por qué, citando el reglamento.
            -   Si es incorrecta, explica claramente el peligro y cuál habría sido la acción correcta, citando el reglamento.

        Tu feedback debe ser siempre educativo. Responde en el formato JSON especificado.
      `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: EvaluateDrivingAnswerOutputSchema
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
      throw new Error('Failed to generate a valid evaluation from the AI.');
    }
    return output;
  }
);