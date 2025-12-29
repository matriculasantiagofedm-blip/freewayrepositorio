
'use server';

/**
 * @fileoverview This flow handles the creation of a new contract with a guaranteed sequential folio number.
 * It uses a distributed counter in Firestore, updated within a transaction, to ensure uniqueness and sequence.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, doc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, writeBatch, Timestamp, Firestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import type { Contract, ContractType, GenerateContractInput } from '@/lib/types';


// --- Firebase Admin Initialization ---
let db: Firestore;
try {
    const app = getApps().length ? getApps()[0] : initializeApp();
    db = getFirestore(app);
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    // Handle the error appropriately. For now, we'll let it fail loudly.
    throw new Error("Failed to initialize Firebase Admin SDK. Check server logs for details.");
}


export const generateContractWithFolioFlow = ai.defineFlow(
  {
    name: 'generateContractWithFolioFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    try {
        const { contractData, details } = input;

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
                transaction.set(counterRef, { current_number: 1 });
                return 1;
            }

            const newNumber = counterDoc.data()!.current_number + 1;
            transaction.update(counterRef, { current_number: newNumber });
            return newNumber;
        });

        const folio = `${year}-${String(newFolioNumber).padStart(3, '0')}`;

        const clientsRef = db.collection('clients');
        const clientQuery = query(clientsRef, where("idNumber", "==", contractData.studentIdNumber), limit(1));
        const clientSnapshot = await getDocs(clientQuery);

        let clientId: string;

        const batch = db.batch();

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

        const contractCollectionPath = `contracts`;
        const contractRef = db.collection(contractCollectionPath).doc();

        const toTimestamp = (date: any): Timestamp | null => {
            if (!date) return null;
            if (date instanceof Timestamp) return date;
            if (date && typeof date.seconds === 'number' && typeof date.nanoseconds === 'number') {
                return new Timestamp(date.seconds, date.nanoseconds);
            }
            if (date instanceof Date) {
                 return Timestamp.fromDate(date);
            }
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return Timestamp.fromDate(d);
            }
            return null;
        }
        
        const convertDatesToTimestamps = (obj: any): any => {
            if (!obj) return obj;
            if (Array.isArray(obj)) {
                return obj.map(item => convertDatesToTimestamps(item));
            }
            if (typeof obj === 'object' && obj !== null) {
                const newObj: { [key: string]: any } = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                         const value = obj[key];
                        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('deadline') || key.toLowerCase().includes('installments') || key.toLowerCase().includes('classes')) {
                             if(Array.isArray(value)) {
                                 newObj[key] = value.map(d => toTimestamp(d)).filter(d => d !== null);
                             } else {
                                newObj[key] = toTimestamp(value);
                             }
                        } else {
                            newObj[key] = convertDatesToTimestamps(value);
                        }
                    }
                }
                const scheduleKeys = ['practicalClassSchedules', 'motoPracticalClassSchedules', 'classSchedules'];
                for (const scheduleKey of scheduleKeys) {
                    if (newObj[scheduleKey] && Array.isArray(newObj[scheduleKey])) {
                        newObj[scheduleKey] = newObj[scheduleKey]
                            .map((c: any) => (c ? { ...c, date: toTimestamp(c.date) } : null))
                            .filter((c: any) => c !== null);
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
