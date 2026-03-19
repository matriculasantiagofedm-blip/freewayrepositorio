'use server';
/**
 * @fileOverview Flow para el análisis inteligente de contratos mediante Genkit v1.x.
 */

import { ai } from './genkit';
import { z } from 'zod';
import { withExponentialBackoff } from './gemini-retry';

const AnalyzeContractInputSchema = z.object({
  text: z.string().describe('El texto completo del contrato.'),
});

const AnalyzeContractOutputSchema = z.object({
  summary: z.string().describe('Un resumen ejecutivo del contrato.'),
  risks: z.array(z.string()).describe('Lista de cláusulas de riesgo detectadas.'),
  expirationDate: z.string().optional().describe('La fecha de vencimiento si se identifica.'),
});

/**
 * Analiza un contrato utilizando IA para extraer información clave con política de reintentos optimizada.
 */
export async function analyzeContract(input: z.infer<typeof AnalyzeContractInputSchema>) {
  return withExponentialBackoff(async () => {
    const { output } = await ai.generate({
      prompt: `Eres un experto legal analizando documentos. Por favor analiza el siguiente texto de contrato y devuelve un JSON estructurado con un resumen, los riesgos principales detectados y la fecha de expiración si la encuentras.
      
      TEXTO DEL CONTRATO:
      ${input.text}`,
      output: {
        schema: AnalyzeContractOutputSchema
      }
    });

    if (!output) throw new Error('No se pudo procesar el análisis del contrato.');
    return output;
  });
}
