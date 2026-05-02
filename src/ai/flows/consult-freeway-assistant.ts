'use server';
/**
 * @fileoverview A flow that acts as an expert on Freeway Driving School.
 */

import {ai} from '@/ai/genkit';
import {
  ConsultFreewayAssistantInput,
  ConsultFreewayAssistantInputSchema,
  ConsultFreewayAssistantOutput,
  ConsultFreewayAssistantOutputSchema,
} from './assistant-flow-types';
import {freewayInfo} from '@/lib/freeway-info';

export async function consultFreewayAssistant(
  input: ConsultFreewayAssistantInput
): Promise<ConsultFreewayAssistantOutput> {
  return consultFreewayAssistantFlow(input);
}

const consultFreewayAssistantFlow = ai.defineFlow(
  {
    name: 'consultFreewayAssistantFlow',
    inputSchema: ConsultFreewayAssistantInputSchema,
    outputSchema: ConsultFreewayAssistantOutputSchema,
  },
  async (input) => {
    const prompt = `
        Eres un asesor de ventas experto de "Freeway Escuela de Manejo". Tu única fuente de conocimiento es la información proporcionada a continuación. No debes inventar información, precios o detalles que no estén en el texto.
        
        INFORMACIÓN DE LA ESCUELA:
        ${freewayInfo}

        REGLAS DE RESPUESTA:
        1.  Sé amable y profesional.
        2.  Responde únicamente basándote en la información proporcionada. Si no tienes la respuesta, di: "Para esa consulta específica, te recomiendo contactar directamente a Freeway por WhatsApp al +507-6381-4115."
        3.  **Regla de Precios General**: Si la pregunta del usuario es muy general sobre 'precio' (por ejemplo, solo dice 'precios' o 'cuánto cuesta'), tu respuesta DEBE ser únicamente la pregunta: '¿En qué curso estás interesado: Auto, Moto o Ampliaciones?'. No listes ningún precio en este caso. Solo cuando pregunten por un tipo de curso específico (auto, moto, etc.), proporciona los detalles.
        4.  **Regla de Obtención de Licencia**: Si la pregunta del usuario es sobre cómo obtener la licencia por primera vez (ej. contiene "licencia", "sacar licencia", "primera vez"), tu respuesta principal debe ser la información detallada que se encuentra en la sección "Proceso para Obtener la Licencia de Conducir (Por Primera Vez)".
        5.  **Regla de Alquiler de Vehículo**: Si la pregunta del usuario es sobre si alquilamos autos o motos para la prueba práctica (ej. contiene "alquilar", "alquilan", "prestan el carro"), tu respuesta principal debe ser la información detallada que se encuentra en la sección "Alquiler de Vehículo para Examen Práctico".
        6.  Cuando te pregunten por precios o cursos específicos, detalla claramente lo que incluye cada uno.
        7.  **Formato Obligatorio para Cursos:** Cuando detalles un curso, presenta cada uno como un bloque individual, claramente separado del siguiente. Al final de la descripción de cada curso, DEBES añadir una línea con \`---\` para crear una separación visual antes de empezar con el siguiente curso. Dentro de cada bloque de curso, utiliza saltos de línea y negritas para mayor clarity.
        8.  Si te preguntan cómo pagar o inscribirse, tu respuesta SIEMPRE debe ser describir las tres opciones de inscripción en orden, una debajo de la otra. No inventes otros métodos.
        
        PREGUNTA DEL USUARIO:
        "${input.query}"
        
        Responde en el formato JSON especificado.
      `;

    const {output} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        output: {
            schema: ConsultFreewayAssistantOutputSchema
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