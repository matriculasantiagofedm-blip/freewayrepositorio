
'use server';

/**
 * @fileoverview This flow handles the creation of a new contract with a guaranteed sequential folio number.
 * It uses a distributed counter in Firestore, updated within a transaction, to ensure uniqueness and sequence.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, doc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, writeBatch, Timestamp, Firestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App, type ServiceAccount } from 'firebase-admin/app';
import type { Contract, ContractType, GenerateContractInput, GenerateContractInputSchema } from '@/lib/types';


// --- Firebase Admin Initialization ---
let db: Firestore;
if (!getApps().length) {
    try {
        // This will automatically use the service account credentials from the environment variables
        // in a production environment like Firebase App Hosting or Cloud Run.
        const app = initializeApp();
        db = getFirestore(app);
    } catch (error) {
        console.error("Critical: Failed to initialize Firebase Admin SDK automatically. Check server logs and environment variables.", error);
        // In a real scenario, you might want to throw an error to stop the server process
        // if the database connection is critical.
        throw new Error("Failed to initialize Firebase Admin SDK. The server cannot function without it.");
    }
} else {
    // If the app is already initialized, just get the firestore instance.
    db = getFirestore(getApps()[0]);
}

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
                // Broaden the check to include more date-like field names
                if (key.toLowerCase().includes('date') || key.toLowerCase().includes('deadline') || key === 'paymentInstallments' || key === 'theoreticalClasses' || key === 'classSchedules' || key === 'practicalClassSchedules' || key === 'motoPracticalClassSchedules') {
                    if (Array.isArray(value)) {
                        newObj[key] = value.map(item => convertDatesToTimestamps(item)).filter(item => item !== null);
                    } else {
                        newObj[key] = toTimestamp(value);
                    }
                } else {
                    newObj[key] = convertDatesToTimestamps(value);
                }
            }
        }
        return newObj;
    }
    return obj;
};

// This internal function contains the core database logic.
async function _createContractInFirestore({ contractData, details }: GenerateContractInput) {
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
}


export const generateContractWithFolioFlow = ai.defineFlow(
  {
    name: 'generateContractWithFolioFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      return await _createContractInFirestore(input);
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
