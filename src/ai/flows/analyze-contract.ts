'use server';
/**
 * @fileOverview Flow para el análisis inteligente de contratos mediante IA.
 *
 * - analyzeContract - Función que procesa el texto del contrato para extraer información clave.
 * - AnalyzeContractInput - Esquema de entrada (texto del contrato).
 * - AnalyzeContractOutput - Esquema de salida (resumen, riesgos y fechas).
 */

import { ai } from '@/lib/genkit';
import { z } from 'zod';

const AnalyzeContractInputSchema = z.object({
  text: z.string().describe('El texto completo del contrato que se desea analizar.'),
});
export type AnalyzeContractInput = z.infer<typeof AnalyzeContractInputSchema>;

const AnalyzeContractOutputSchema = z.object({
  summary: z.string().describe('Un resumen ejecutivo y conciso del contrato.'),
  risks: z.array(z.string()).describe('Una lista de posibles cláusulas de riesgo o puntos críticos detectados.'),
  expirationDate: z.string().optional().describe('La fecha de vencimiento o terminación del contrato, si se identifica.'),
});
export type AnalyzeContractOutput = z.infer<typeof AnalyzeContractOutputSchema>;

const analyzeContractPrompt = ai.definePrompt({
  name: 'analyzeContractPrompt',
  input: { schema: AnalyzeContractInputSchema },
  output: { schema: AnalyzeContractOutputSchema },
  prompt: `Eres un asistente legal experto en análisis de contratos. 
  Analiza el siguiente texto de contrato y extrae un resumen detallado, 
  identifica puntos de riesgo potenciales para las partes y busca específicamente la fecha de vencimiento o terminación.
  
  Texto del contrato:
  {{{text}}}`,
});

const analyzeContractFlow = ai.defineFlow(
  {
    name: 'analyzeContractFlow',
    inputSchema: AnalyzeContractInputSchema,
    outputSchema: AnalyzeContractOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeContractPrompt(input);
    if (!output) throw new Error('No se pudo generar el análisis del contrato.');
    return output;
  }
);

export async function analyzeContract(input: AnalyzeContractInput): Promise<AnalyzeContractOutput> {
  return analyzeContractFlow(input);
}
