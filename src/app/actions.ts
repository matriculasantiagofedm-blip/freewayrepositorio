
'use server';

import { ai } from '@/ai/genkit';
import type { GenerateContractInput } from '@/lib/types';


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
