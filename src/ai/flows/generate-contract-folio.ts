
'use server';

/**
 * @fileoverview This flow handles the creation of a new contract with a guaranteed sequential folio number.
 * It uses a distributed counter in Firestore, updated within a transaction, to ensure uniqueness and sequence.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, doc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, writeBatch, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';
import type { Contract, ContractType } from '@/lib/types';


// --- Firebase Admin Initialization ---
let adminApp: App;
if (!getApps().length) {
  adminApp = initializeApp({
    projectId: firebaseConfig.projectId,
  });
} else {
  adminApp = getApps()[0];
}
const db = getFirestore(adminApp);


// --- Zod Schemas for Input/Output ---

const GenerateContractInputSchema = z.object({
  contractData: z.object({
    clientName: z.string(),
    clientEmail: z.string().email(),
    contractType: z.string(),
    studentIdNumber: z.string(),
    userId: z.string(),
    createdBy: z.string(),
  }),
  details: z.any(),
});
export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;


const GenerateContractOutputSchema = z.object({
  contract: z.any(),
  folio: z.string(),
  error: z.string().optional(),
});
export type GenerateContractOutput = z.infer<typeof GenerateContractOutputSchema>;


// --- Main exported function and Genkit Flow ---

export async function generateContractWithSequentialFolio(input: GenerateContractInput): Promise<GenerateContractOutput> {
  return generateContractWithFolioFlow(input);
}


const generateContractWithFolioFlow = ai.defineFlow(
  {
    name: 'generateContractWithFolioFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: GenerateContractOutputSchema,
  },
  async ({ contractData, details }) => {

    try {
        if (!contractData.studentIdNumber) {
            throw new Error("Student ID number is required to generate a contract.");
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

        const convertDatesToTimestamps = (detailsObj: any): any => {
            const toTimestamp = (date: any): Timestamp | null => {
                if (!date) return null;
                if (date instanceof Timestamp) return date;
                if (typeof date === 'string' || typeof date === 'number' || date instanceof Date) {
                    const d = new Date(date);
                    if (!isNaN(d.getTime())) {
                        return Timestamp.fromDate(d);
                    }
                }
                 if (date && typeof date.toDate === 'function') { // Handle Firebase Timestamps from client
                    return Timestamp.fromMillis(date.toMillis());
                }
                return null;
            }
            
            if (!detailsObj) return {};
            const newDetails = { ...detailsObj };

            if (newDetails.paymentDeadline) {
                newDetails.paymentDeadline = toTimestamp(newDetails.paymentDeadline);
            }
            if (newDetails.theoreticalClassDate) {
                newDetails.theoreticalClassDate = toTimestamp(newDetails.theoreticalClassDate);
            }
            
            const processDateArray = (arr: any[]) => {
                if (!Array.isArray(arr)) return [];
                return arr.map(toTimestamp).filter((d): d is Timestamp => d !== null);
            };

            newDetails.theoreticalClassDates = processDateArray(newDetails.theoreticalClassDates);
            newDetails.theoreticalClasses = processDateArray(newDetails.theoreticalClasses);
            newDetails.paymentInstallments = processDateArray(newDetails.paymentInstallments);

            const processScheduleArray = (arr: any[]) => {
                 if (!Array.isArray(arr)) return [];
                 return arr
                    .map((c: any) => (c ? { ...c, date: toTimestamp(c.date) } : null))
                    .filter((c: any): c is any => c !== null && c.date !== null);
            }

            newDetails.practicalClassSchedules = processScheduleArray(newDetails.practicalClassSchedules);
            newDetails.motoPracticalClassSchedules = processScheduleArray(newDetails.motoPracticalClassSchedules);
            newDetails.classSchedules = processScheduleArray(newDetails.classSchedules);
            
            return newDetails;
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

        // Convert Timestamps back to ISO strings for client compatibility before returning
        const convertTimestampsToISO = (obj: any): any => {
            if (!obj) return obj;
            if (obj instanceof Timestamp) {
                return obj.toDate().toISOString();
            }
            if (Array.isArray(obj)) {
                return obj.map(item => convertTimestampsToISO(item));
            }
            if (typeof obj === 'object') {
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

        const finalContractForClient = {
            ...contractWithTimestamp,
            createdAt: new Date().toISOString(),
        };
        
        if (finalContractForClient.deluxeDetails) {
            finalContractForClient.deluxeDetails = convertTimestampsToISO(finalContractForClient.deluxeDetails);
        }
        if (finalContractForClient.autoMotoDetails) {
            finalContractForClient.autoMotoDetails = convertTimestampsToISO(finalContractForClient.autoMotoDetails);
        }
        if (finalContractForClient.ampliacionesDetails) {
            finalContractForClient.ampliacionesDetails = convertTimestampsToISO(finalContractForClient.ampliacionesDetails);
        }

        return {
            contract: finalContractForClient,
            folio: folio,
        };

    } catch (error: any) {
        console.error("Error in generateContractWithFolioFlow:", error);
        return {
            contract: null,
            folio: '',
            error: `Failed to create contract: ${error.message}`,
        };
    }
  }
);
