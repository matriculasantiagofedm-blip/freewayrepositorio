
'use server';

/**
 * @fileoverview This flow handles the creation of a new contract with a guaranteed sequential folio number.
 * It uses a distributed counter in Firestore, updated within a transaction, to ensure uniqueness and sequence.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, doc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, writeBatch, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import type { Contract, ContractType, GenerateContractInput } from '@/lib/types';


// --- Firebase Admin Initialization ---
// This function ensures that we initialize the Firebase Admin app only once.
function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }
    // In a server environment like Firebase Functions or App Hosting,
    // applicationDefault() will be used implicitly if no credentials are provided.
    return initializeApp();
}
const db = getFirestore(getAdminApp());


// --- Zod Schemas for Input/Output ---

const GenerateContractOutputSchema = z.object({
  contract: z.any().nullable(),
  folio: z.string(),
  error: z.string().optional(),
});
export type GenerateContractOutput = z.infer<typeof GenerateContractOutputSchema>;


export const generateContractWithFolioFlow = ai.defineFlow(
  {
    name: 'generateContractWithFolioFlow',
    inputSchema: z.custom<GenerateContractInput>(),
    outputSchema: GenerateContractOutputSchema,
  },
  async ({ contractData, details }) => {
    try {
        if (!contractData.studentIdNumber) {
            throw new Error("El número de cédula o pasaporte del estudiante es un campo obligatorio para generar el contrato.");
        }
        if (!details || Object.keys(details).length === 0) {
            throw new Error(`Los detalles para el contrato tipo '${contractData.contractType}' están vacíos o son inválidos.`);
        }
        
        const counterRef = db.doc('counters/contract_folio');
        const year = new Date().getFullYear();

        const newFolioNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists) {
                // Initialize the counter if it doesn't exist
                transaction.set(counterRef, { current_number: 1 });
                return 1;
            }

            const newNumber = counterDoc.data()!.current_number + 1;
            transaction.update(counterRef, { current_number: newNumber });
            return newNumber;
        });

        const folio = `${year}-${String(newFolioNumber).padStart(3, '0')}`;

        // --- Client Handling (Get or Create) ---
        const clientsRef = db.collection('clients');
        const clientQuery = query(clientsRef, where("idNumber", "==", contractData.studentIdNumber), limit(1));
        const clientSnapshot = await getDocs(clientQuery);

        let clientId: string;

        const batch = writeBatch(db);

        if (!clientSnapshot.empty) {
            const existingClientDoc = clientSnapshot.docs[0];
            clientId = existingClientDoc.id;
        } else {
            const newClientRef = db.collection('clients').doc();
            clientId = newClientRef.id;
            const newClientData = {
                id: clientId,
                name: contractData.clientName,
                email: contractData.clientEmail,
                idNumber: contractData.studentIdNumber,
                userId: contractData.userId,
                createdAt: serverTimestamp(),
            };
            batch.set(newClientRef, newClientData);
        }

        // --- Contract Creation ---
        const contractCollectionPath = `users/${contractData.userId}/contracts`;
        const contractRef = db.collection(contractCollectionPath).doc();

        // Helper function to safely convert various date formats to Firestore Timestamps.
        const toTimestamp = (date: any): Timestamp | null => {
            if (!date) return null;
            if (date instanceof Timestamp) return date;
            if (date && typeof date.seconds === 'number' && typeof date.nanoseconds === 'number') {
                return new Timestamp(date.seconds, date.nanoseconds);
            }
            if (date instanceof Date) {
                 return Timestamp.fromDate(date);
            }
            // Attempt to parse string dates (like those from JSON payload)
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return Timestamp.fromDate(d);
            }
            return null;
        }
        
        // Recursively converts date-like fields in an object to Timestamps.
        const convertDatesToTimestamps = (obj: any): any => {
            if (!obj) return obj;
            if (Array.isArray(obj)) {
                return obj.map(item => convertDatesToTimestamps(item));
            }
            if (typeof obj === 'object' && obj !== null) {
                const newObj: { [key: string]: any } = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        // Check if a key suggests it's a date field
                        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('deadline') || key.toLowerCase().includes('installments')) {
                            const value = obj[key];
                             if(Array.isArray(value)) {
                                 newObj[key] = value.map(d => toTimestamp(d)).filter(d => d !== null);
                             } else {
                                newObj[key] = toTimestamp(value);
                             }
                        } else {
                            newObj[key] = convertDatesToTimestamps(obj[key]);
                        }
                    }
                }
                 // Special handling for schedule arrays which contain date objects
                const scheduleKeys = ['practicalClassSchedules', 'motoPracticalClassSchedules', 'classSchedules'];
                for (const scheduleKey of scheduleKeys) {
                    if (newObj[scheduleKey] && Array.isArray(newObj[scheduleKey])) {
                        newObj[scheduleKey] = newObj[scheduleKey]
                            .map((c: any) => (c ? { ...c, date: toTimestamp(c.date) } : null))
                            .filter((c: any) => c !== null); // Keep items even if date is null
                    }
                }

                return newObj;
            }
            return obj;
        };
        
        const finalDetails = convertDatesToTimestamps(details);

        const newContract: Omit<Contract, 'id' | 'createdAt'> = {
            folio,
            title: `${contractData.contractType} - ${contractData.clientName}`,
            clientName: contractData.clientName,
            clientEmail: contractData.clientEmail,
            clientId,
            content: `Contrato de ${contractData.contractType} para ${contractData.clientName}.`,
            deadlines: [],
            status: 'active',
            type: contractData.contractType as ContractType,
            userId: contractData.userId,
            createdBy: contractData.createdBy,
        };

        if (contractData.contractType === 'Curso Deluxe') {
            (newContract as any).deluxeDetails = finalDetails;
        } else if (['Curso Auto', 'Curso Moto', 'Curso Mixto'].includes(contractData.contractType)) {
             (newContract as any).autoMotoDetails = finalDetails;
        } else if (contractData.contractType === 'Ampliaciones') {
            (newContract as any).ampliacionesDetails = finalDetails;
        }
        
        const contractWithTimestamp = {
            ...newContract,
            id: contractRef.id,
            createdAt: serverTimestamp(),
        };

        batch.set(contractRef, contractWithTimestamp);
        await batch.commit();

        // Recursively convert Timestamps back to ISO strings for client-side rendering.
        const convertTimestampsToISO = (obj: any): any => {
            if (!obj) return obj;
            if (obj instanceof Timestamp) {
                return obj.toDate().toISOString();
            }
            if (Array.isArray(obj)) {
                return obj.map(item => convertTimestampsToISO(item));
            }
            if (typeof obj === 'object' && obj !== null) {
                const newObj: { [key: string]: any } = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        newObj[key] = convertTimestampsToISO(obj[key]);
                    }
                }
                return newObj;
            }
            return obj;
        };

        const finalContractForClient = convertTimestampsToISO(contractWithTimestamp);
        // Set a predictable createdAt for the client, as serverTimestamp is resolved later.
        finalContractForClient.createdAt = new Date().toISOString(); 
        
        return {
            contract: finalContractForClient,
            folio: folio,
        };

    } catch (error: any) {
        console.error("Error in generateContractWithFolioFlow:", error);
        return {
            contract: null,
            folio: '',
            error: error.message,
        };
    }
  }
);
