
'use server';

/**
 * @fileoverview This flow is now a placeholder. 
 * The contract creation logic has been moved to the client-side 
 * in `src/components/contract-form.tsx` to resolve server-side connection issues.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GenerateContractInputSchema } from '@/lib/types';
import type { GenerateContractInput } from '@/lib/types';

async function _placeholderContractCreation(input: GenerateContractInput) {
    // This is a placeholder. The actual DB logic is on the client.
    // We return a structure that mimics the expected output.
    const { contractData, details } = input;
    const now = new Date().toISOString();

    const mockContract = {
        id: `mock_${Date.now()}`,
        ...contractData,
        clientId: `mock_client_${Date.now()}`,
        title: `${contractData.contractType} - ${contractData.clientName}`,
        content: `Contrato de ${contractData.contractType} para ${contractData.clientName}.`,
        deadlines: [],
        status: 'active',
        type: contractData.contractType,
        createdAt: now,
        // Add details based on type
        ...(contractData.contractType === 'Curso Deluxe' && { deluxeDetails: details }),
        ...( ['Curso Auto', 'Curso Moto', 'Curso Mixto'].includes(contractData.contractType) && { autoMotoDetails: details }),
        ...(contractData.contractType === 'Ampliaciones' && { ampliacionesDetails: details }),
    };
    
    return {
        contract: mockContract
    };
}


export const createContractFlow = ai.defineFlow(
  {
    name: 'createContractFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    // This flow no longer interacts with the database directly.
    // It returns a mock contract structure. The real save happens on the client.
    return await _placeholderContractCreation(input);
  }
);
