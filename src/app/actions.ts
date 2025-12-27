
'use server';

import { z } from 'zod';
import { ai } from '@/ai/genkit';


const GenerateContractDataSchema = z.object({
  clientName: z.string(),
  clientEmail: z.string().email(),
  contractType: z.string(),
  studentIdNumber: z.string(),
  userId: z.string(),
  createdBy: z.string(),
});

const GenerateContractDetailsSchema = z.any();

export const GenerateContractInputSchema = z.object({
  contractData: GenerateContractDataSchema,
  details: GenerateContractDetailsSchema,
});
export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;


export async function createContractAction({ contractData, details }: GenerateContractInput) {
  try {
    const result = await ai.run('generateContractWithFolioFlow', { contractData, details });
    
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error('[createContractAction] Unexpected error:', error);
    if (error instanceof Error) {
      return { contract: null, folio: '', error: error.message };
    }
    return { contract: null, folio: '', error: 'Ocurrió un error inesperado en el servidor.' };
  }
}
