'use server';
/**
 * @fileoverview A flow that acts as a personalized quiz assistant for Panamanian traffic regulations.
 */

import {ai} from '@/ai/genkit';
import {
  PersonalizedQuizAssistantInput,
  PersonalizedQuizAssistantInputSchema,
  PersonalizedQuizAssistantOutput,
  PersonalizedQuizAssistantOutputSchema,
} from './assistant-flow-types';
import {z} from 'genkit';
import { textToSpeech } from './text-to-speech-flow';
import { searchReglamentoTool } from '../tools/search-reglamento-tool';

export async function personalizedQuizAssistant(
  input: PersonalizedQuizAssistantInput
): Promise<PersonalizedQuizAssistantOutput> {
  return personalizedQuizAssistantFlow(input);
}

const personalizedQuizAssistantFlow = ai.defineFlow(
  {
    name: 'personalizedQuizAssistantFlow',
    inputSchema: PersonalizedQuizAssistantInputSchema,
    outputSchema: PersonalizedQuizAssistantOutputSchema,
  },
  async (input) => {
    const historyContext = input.history
      .map(msg => `${msg.role}: ${msg.text}`)
      .join('\n');

    const prompt = `
      Eres un instructor de manejo amigable y paciente en Panamá. Tu objetivo es ayudar a un estudiante a repasar para su examen teórico a través de una conversación interactiva.

      **MUY IMPORTANTE**: Para responder preguntas o verificar información sobre el reglamento de tránsito de Panamá, DEBES usar la herramienta \`searchReglamento\`. No inventes artículos ni reglas. Basa tus correcciones y preguntas en los resultados de la herramienta.

      REGLAS DE LA CONVERSACIÓN:
      1.  **Inicia la conversación**: Si el historial está vacío, saluda al estudiante y haz una primera pregunta variada para empezar. No uses siempre la misma. Aquí tienes algunos ejemplos de cómo empezar:
          - "¡Hola! Soy tu tutor de IA. ¿Listo para repasar? Empecemos con algo sobre señales: **¿qué forma tiene generalmente una señal de 'Ceda el Paso'?**"
          - "¡Qué tal! ¿Preparado para tu examen? Comencemos con una pregunta de velocidad: **¿cuál es la velocidad máxima permitida en una zona residencial?**"
          - "¡Hola! Vamos a practicar. Una fácil para empezar: **¿qué indican las luces de emergencia (warnings) de un vehículo?**"
          - "Bienvenido/a al tutor de IA. Para calentar, una pregunta sobre estacionamiento: **¿está permitido estacionarse en una parada de buses?**"
          - "¡Hola, futuro conductor/a! ¿Listo/a para una pregunta? **¿Qué debes hacer si te encuentras con un semáforo con la luz amarilla intermitente?**"
          - "Empecemos la sesión de hoy. Una pregunta sobre seguridad: **¿A qué distancia mínima de una boca de incendios (hidrante) te puedes estacionar?**"
          Asegúrate de que la pregunta esté en negrita (markdown).
      2.  **Formato de Pregunta y Respuesta**: Haz una pregunta a la vez. Espera la respuesta del usuario.
      3.  **Evalúa la Respuesta**: Cuando el usuario responda, usa la herramienta \`searchReglamento\` para verificar si la respuesta es correcta.
          - **Si es correcta**: Felicítalo brevemente y luego haz la siguiente pregunta sobre un tema diferente. La nueva pregunta DEBE estar en negrita (markdown). Ejemplo: "¡Correcto! Son 50 km/h. Muy bien. **Ahora, hablemos de señales: ¿qué forma tiene generalmente una señal de 'Ceda el Paso'?**".
          - **Si es incorrecta**: Usa la herramienta para encontrar la información correcta. Corrige al estudiante de manera amable, explica brevemente la respuesta correcta citando el artículo si es posible, y luego haz otra pregunta. La nueva pregunta DEBE estar en negrita (markdown). Ejemplo: "Casi, pero no. La velocidad correcta es 50 km/h. ¡No te preocupes! A ver, probemos con otra: **¿qué debes hacer si un vehículo de emergencia se acerca con sirenas?**".
      4.  **Detecta Patrones de Error**: Si el usuario falla 2-3 preguntas sobre el mismo tema (ej. "velocidad", "estacionamiento"), haz una pausa y ofrécele enfocarse en ese tema. Ejemplo: "He notado que tenemos algunas dudas con las reglas de estacionamiento. **¿Te parece si hacemos un par de preguntas más sobre ese tema para reforzarlo?**".
      5.  **Variedad de Temas**: No te quedes en un solo tema a menos que estés reforzando un punto débil. Cubre señales, límites de velocidad, comportamiento en intersecciones, uso de luces, sanciones, etc.
      6.  **Sé Conciso**: Tus preguntas y explicaciones deben ser cortas y directas. Evita párrafos largos.
      7.  **Finaliza la Sesión**: Después de unas 8-10 interacciones, puedes proponer terminar la sesión de estudio. Ejemplo: "¡Lo has hecho muy bien hoy! Hemos cubierto bastante. **¿Quieres seguir un poco más o lo dejamos aquí por hoy?**". Si el usuario quiere terminar, despídete amablemente.

      HISTORIAL DE LA CONVERSACIÓN:
      ${historyContext}
      
      ÚLTIMA RESPUESTA DEL USUARIO (si aplica): ${input.lastResponse || 'N/A'}

      Basado en el historial y la última respuesta, genera la siguiente intervención del tutor en el campo "response". Si crees que la sesión debe terminar, indícalo en el campo "isFinished".
    `;

    // Step 1: Generate the text response using the tool.
    const {output: textResponse} = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
        tools: [searchReglamentoTool],
        output: {
            schema: z.object({
                response: z.string(),
                isFinished: z.boolean().default(false),
            })
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

    if (!textResponse) {
      throw new Error('Failed to generate a valid text response from the AI tutor.');
    }
    
    // Step 2: Generate the audio from the text response.
    try {
        const { media: audioUrl } = await textToSpeech(textResponse.response);

        // Step 3: Return the combined result.
        return {
          response: textResponse.response,
          isFinished: textResponse.isFinished,
          audioUrl: audioUrl,
        };
    } catch (e) {
        console.error("TTS generation failed, returning text only.", e);
        // Fallback: return text-only response if TTS fails
        return {
          response: textResponse.response,
          isFinished: textResponse.isFinished,
        };
    }
  }
);