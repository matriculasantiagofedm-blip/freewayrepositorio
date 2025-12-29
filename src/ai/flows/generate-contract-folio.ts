
'use server';

/**
 * @fileoverview This flow handles the creation of a new contract.
 * It ensures a client document exists and then creates the contract document.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Contract, ContractType, GenerateContractInput } from '@/lib/types';
import { GenerateContractInputSchema } from '@/lib/types';
import { getDb } from '@/app/actions';


// This internal function contains the core database logic.
async function _createContractInFirestore({ contractData, details }: GenerateContractInput) {
    const db = await getDb();

    if (!contractData.studentIdNumber) {
        throw new Error("El número de cédula o pasaporte del estudiante es un campo obligatorio para generar el contrato.");
    }
    if (!details || Object.keys(details).length === 0) {
        throw new Error(`Los detalles para el contrato tipo '${contractData.contractType}' están vacíos o son inválidos.`);
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


    const clientsRef = db.collection('clients');
    const clientQuery = db.collection('clients').where("idNumber", "==", contractData.studentIdNumber).limit(1);
    const clientSnapshot = await clientQuery.get();

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
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(newClientRef, newClientData);
    }

    const contractCollectionPath = `contracts`;
    const contractRef = db.collection(contractCollectionPath).doc();
    
    const finalDetails = convertDatesToTimestamps(details);

    const newContract: Omit<Contract, 'id' | 'createdAt'> = {
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
        createdAt: FieldValue.serverTimestamp(),
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
    };
}


export const createContractFlow = ai.defineFlow(
  {
    name: 'createContractFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      return await _createContractInFirestore(input);
    } catch (error: any) {
        console.error("Error in createContractFlow:", error);
        return {
            contract: null,
            error: error.message,
        };
    }
  }
);
