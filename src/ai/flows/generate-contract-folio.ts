
'use server';

/**
 * @fileoverview This flow provides a transactionally-safe way to generate
 * a new, unique, and sequential folio number for a contract. It uses a
 * distributed counter pattern in Firestore to prevent race conditions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin SDK if not already initialized
function getDb() {
    if (!getApps().length) {
        // This will automatically use the service account credentials from the environment
        initializeApp();
    }
    return getFirestore();
}

export const generateContractFolioFlow = ai.defineFlow(
  {
    name: 'generateContractFolioFlow',
    inputSchema: z.void(),
    outputSchema: z.object({
        folioNumber: z.number().optional(),
        error: z.string().optional(),
    }),
  },
  async () => {
    try {
        const db = getDb();
        const counterRef = db.collection('counters').doc('contract_folio');

        let newFolioNumber: number | null = null;

        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists) {
                // If the counter doesn't exist, initialize it.
                // The first folio will be 1.
                newFolioNumber = 1;
                transaction.set(counterRef, { count: 1 });
            } else {
                // The counter exists, so increment it.
                const currentCount = counterDoc.data()?.count || 0;
                newFolioNumber = currentCount + 1;
                transaction.update(counterRef, { count: newFolioNumber });
            }
        });

        if (newFolioNumber === null) {
            throw new Error('Transaction failed to produce a new folio number.');
        }

        return { folioNumber: newFolioNumber };

    } catch (error) {
        console.error("Error in generateContractFolioFlow: ", error);
        return { 
            error: error instanceof Error ? error.message : 'An unknown error occurred while generating the folio.' 
        };
    }
  }
);

export async function generateContractFolioAction() {
    return generateContractFolioFlow();
}
