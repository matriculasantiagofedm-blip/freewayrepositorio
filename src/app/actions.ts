'use server';

import { ai } from '@/ai/genkit';
import type { GenerateContractInput } from '@/lib/types';


export async function createContractAction(input: GenerateContractInput) {
  try {
    // We must use ai.run() here to dynamically invoke the flow by name.
    // Statically importing a flow that uses `firebase-admin` into a file
    // that is itself imported by a client component can poison the client bundle.
    // `ai.run` breaks the static import chain, ensuring server-only code stays on the server.
    const result = await ai.run('generateContractWithFolioFlow', input);
    
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
