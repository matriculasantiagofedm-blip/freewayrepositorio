
'use server';

import { generateContractFolioFlow } from '@/ai/flows/generate-contract-folio';

export async function generateContractFolioAction() {
  try {
    const result = await generateContractFolioFlow();
    return result;
  } catch (error) {
    console.error('[generateContractFolioAction] Unexpected error:', error);
    if (error instanceof Error) {
      return { folioNumber: null, error: error.message };
    }
    return { folioNumber: null, error: 'Ocurrió un error inesperado en el servidor.' };
  }
}
