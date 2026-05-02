import {z} from 'genkit';

// Asistente de Consulta ATTT
export const ConsultATTTAssistantInputSchema = z.object({
  query: z.string().describe('La pregunta específica del usuario sobre el reglamento de tránsito de Panamá.'),
});
export type ConsultATTTAssistantInput = z.infer<
  typeof ConsultATTTAssistantInputSchema
>;
export const ConsultATTTAssistantOutputSchema = z.object({
  answer: z
    .string()
    .describe(
      'La respuesta directa a la pregunta del usuario, basada en el reglamento.'
    ),
  sources: z
    .array(
      z.object({
        article: z
          .string()
          .describe('El número del artículo del reglamento citado.'),
        text: z.string().describe('El texto exacto del artículo citado.'),
      })
    )
    .describe(
      'Una lista de los artículos específicos del reglamento de tránsito que respaldan la respuesta.'
    ),
});
export type ConsultATTTAssistantOutput = z.infer<
  typeof ConsultATTTAssistantOutputSchema
>;

// Asistente Comercial Freeway
export const ConsultFreewayAssistantInputSchema = z.object({
  query: z.string().describe('La pregunta comercial del usuario sobre cursos, precios o inscripción.'),
});
export type ConsultFreewayAssistantInput = z.infer<
  typeof ConsultFreewayAssistantInputSchema
>;
export const ConsultFreewayAssistantOutputSchema = z.object({
  answer: z.string().describe('La respuesta a la pregunta comercial del usuario.'),
});
export type ConsultFreewayAssistantOutput = z.infer<
  typeof ConsultFreewayAssistantOutputSchema
>;


// Generador de Desafíos de Conducción
export const GenerateDrivingChallengeInputSchema = z.object({
  situation: z
    .string()
    .describe(
      'Una situación de conducción específica en Panamá para la cual se generará el desafío.'
    ),
});
export type GenerateDrivingChallengeInput = z.infer<
  typeof GenerateDrivingChallengeInputSchema
>;
export const GenerateDrivingChallengeOutputSchema = z.object({
  scenario: z.string().describe('La descripción del escenario de conducción.'),
  question: z.string().describe('La pregunta específica del desafío, usualmente "¿Qué harías?"'),
  explanation: z.string().describe('La explicación detallada de la acción correcta a tomar, justificada con el reglamento de tránsito de Panamá.'),
});
export type GenerateDrivingChallengeOutput = z.infer<
  typeof GenerateDrivingChallengeOutputSchema
>;

// Evaluador de Respuesta de Desafío de Conducción
export const EvaluateDrivingAnswerInputSchema = z.object({
    situation: z.string().describe('El escenario de conducción original que se le presentó al usuario.'),
    userAnswer: z.string().describe('La respuesta que el usuario proporcionó.'),
});
export type EvaluateDrivingAnswerInput = z.infer<typeof EvaluateDrivingAnswerInputSchema>;

export const EvaluateDrivingAnswerOutputSchema = z.object({
    evaluation: z.enum(['correcta', 'regular', 'incorrecta']).describe('La calificación de la respuesta del usuario: "correcta", "regular" o "incorrecta".'),
    feedback: z.string().describe('Una explicación detallada de por qué la respuesta del usuario es correcta, regular o incorrecta, justificando con el reglamento de tránsito de Panamá.'),
});
export type EvaluateDrivingAnswerOutput = z.infer<typeof EvaluateDrivingAnswerOutputSchema>;

// Analizador de Infracciones
export const AnalyzeInfractionInputSchema = z.object({
  situation: z.string().describe('La situación de conducción descrita por el usuario.'),
});
export type AnalyzeInfractionInput = z.infer<
  typeof AnalyzeInfractionInputSchema
>;

export const AnalyzeInfractionOutputSchema = z.object({
  infractionName: z.string().describe('El nombre o descripción de la infracción principal cometida.'),
  article: z.string().describe('El número del artículo principal del reglamento de tránsito que se violó.'),
  gravity: z.string().describe('La gravedad de la infracción (ej. "Grave", "Gravísima").'),
  sanction: z.string().describe('Una descripción de las posibles sanciones (multa, puntos, etc.).'),
});
export type AnalyzeInfractionOutput = z.infer<
  typeof AnalyzeInfractionOutputSchema
>;


// Tutor de IA Personalizado
const MessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string(),
});
export const PersonalizedQuizAssistantInputSchema = z.object({
    history: z.array(MessageSchema).describe('El historial de la conversación hasta ahora.'),
    lastResponse: z.string().optional().describe('La última respuesta del usuario a una pregunta.'),
});
export type PersonalizedQuizAssistantInput = z.infer<
  typeof PersonalizedQuizAssistantInputSchema
>;

export const PersonalizedQuizAssistantOutputSchema = z.object({
    response: z.string().describe('La siguiente pregunta o comentario del asistente de IA.'),
    isFinished: z.boolean().default(false).describe('Indica si la sesión de estudio ha terminado.'),
    audioUrl: z.string().optional().describe('La URL del audio de la respuesta en formato data URI.'),
});
export type PersonalizedQuizAssistantOutput = z.infer<
  typeof PersonalizedQuizAssistantOutputSchema
>;
