
'use server';

import type { GenerateContractInput } from '@/lib/types';
import { createContractFlow } from '@/ai/flows/generate-contract-folio';


export async function createContractAction(input: GenerateContractInput) {
  try {
    const result = await createContractFlow(input);
    
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error('[createContractAction] Unexpected error:', error);
    if (error instanceof Error) {
      return { contract: null, error: error.message };
    }
    return { contract: null, error: 'Ocurrió un error inesperado en el servidor.' };
  }
}


export async function pingFirestoreAction() {
    // This function is being deprecated as we move DB operations to the client.
    // It will now simply return a success message to avoid breaking the UI.
    return {
        success: true,
        message: 'Las operaciones de base de datos ahora se ejecutan en el cliente.',
    };
}
