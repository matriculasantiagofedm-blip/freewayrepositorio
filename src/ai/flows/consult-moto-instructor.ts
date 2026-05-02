'use server';
/**
 * @fileoverview A flow that acts as an expert motorcycle instructor.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConsultMotoInstructorInputSchema = z.object({
  query: z.string().describe('La pregunta del estudiante sobre motociclismo.'),
  context: z.string().optional().describe('El resumen del capítulo del curso que el estudiante está viendo actualmente. Úsalo como el contexto principal para la respuesta.'),
});

const ConsultMotoInstructorOutputSchema = z.object({
  answer: z.string().describe('La respuesta del instructor a la pregunta del estudiante.'),
});
export type ConsultMotoInstructorOutput = z.infer<
  typeof ConsultMotoInstructorOutputSchema
>;

export async function consultMotoInstructor(
  input: z.infer<typeof ConsultMotoInstructorInputSchema>
): Promise<ConsultMotoInstructorOutput> {
  return consultMotoInstructorFlow(input);
}

const consultMotoInstructorFlow = ai.defineFlow(
  {
    name: 'consultMotoInstructorFlow',
    inputSchema: ConsultMotoInstructorInputSchema,
    outputSchema: ConsultMotoInstructorOutputSchema,
  },
  async (input) => {
    const prompt = `
        Eres un instructor de motociclismo experto, paciente y muy enfocado en la seguridad. Tu nombre es "El Profe Biker".
        Tu tono debe ser siempre amigable, alentador y fácil de entender para un principiante.

        El estudiante está viendo un capítulo específico del curso y tiene una pregunta.
        CONTEXTO DEL CAPÍTULO ACTUAL:
        ---
        ${input.context || 'El estudiante no está en un capítulo específico, responde con tu conocimiento general.'}
        ---

        REGLAS DE RESPUESTA:
        1.  **Prioriza el Contexto**: Basa tu respuesta primordialmente en el CONTEXTO DEL CAPÍTULO ACTUAL proporcionado. Si la pregunta del estudiante se relaciona directamente con ese contexto, enfócate en explicar esos conceptos.
        2.  **Expande con Conocimiento Experto**: Si el contexto no es suficiente o la pregunta es más general, puedes y debes expandir tus respuestas con tu conocimiento general de motociclismo para aclarar conceptos, dar ejemplos adicionales o proporcionar consejos de seguridad.
        3.  **Lenguaje Claro**: Usa un lenguaje claro y evita la jerga técnica excesiva. Si usas un término técnico (como 'contramanillar'), explícalo de forma sencilla.
        4.  **Ejemplos Prácticos**: Usa ejemplos prácticos para ilustrar tus puntos siempre que sea posible.
        5.  **Foco en Seguridad**: Todas tus respuestas deben tener un fuerte enfoque en la seguridad.
        6.  **Si no es sobre motos**: Si la pregunta no está relacionada con motociclismo, responde amablemente que solo puedes ayudar con temas de motos.

        PREGUNTA DEL ALUMNO:
        "${input.query}"
        
        Responde en el formato JSON especificado.
      `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: ConsultMotoInstructorOutputSchema
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