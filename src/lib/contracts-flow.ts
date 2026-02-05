'use server';
/**
 * @fileOverview Flow para el análisis inteligente de contratos mediante Genkit.
 */

import { ai } from './genkit';
import { z } from 'zod';

const AnalyzeContractInputSchema = z.object({
  text: z.string().describe('El texto completo del contrato.'),
});

const AnalyzeContractOutputSchema = z.object({
  summary: z.string().describe('Resumen ejecutivo.'),
  risks: z.array(z.string()).describe('Lista de riesgos detectados.'),
  expirationDate: z.string().optional().describe('Fecha de vencimiento si existe.'),
});

export async function analyzeContract(input: z.infer<typeof AnalyzeContractInputSchema>) {
  const { output } = await ai.generate({
    prompt: `Eres un experto legal. Analiza este contrato y devuelve un JSON con:
             1. summary: Un resumen breve.
             2. risks: Un array de strings con cláusulas de riesgo.
             3. expirationDate: La fecha de terminación si se menciona.
             
             Texto del contrato: ${input.text}`,
    output: {
      schema: AnalyzeContractOutputSchema
    }
  });

  if (!output) throw new Error('No se pudo procesar el análisis.');
  return output;
}
