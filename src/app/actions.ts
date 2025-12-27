'use server';

import { generateContractWithFolioFlow } from '@/ai/flows/generate-contract-folio';
import type { GenerateContractInput } from '@/lib/types';


export async function createContractAction(input: GenerateContractInput) {
  try {
    const result = await generateContractWithFolioFlow(input);
    
    if (result.error) {
      // Re-throw the specific error from the flow to be caught by the client
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error('[createContractAction] Unexpected error:', error);
    // Ensure a structured error is returned for client-side handling
    if (error instanceof Error) {
      return { contract: null, folio: '', error: error.message };
    }
    return { contract: null, folio: '', error: 'Ocurrió un error inesperado en el servidor.' };
  }
}
