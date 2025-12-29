
'use server';

import type { GenerateContractInput } from '@/lib/types';
import { createContractFlow } from '@/ai/flows/generate-contract-folio';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';

// This function attempts to get an existing Firestore instance or initializes a new one.
// It's designed to be called within each server action to ensure the DB is ready.
function getDb() {
    if (!getApps().length) {
        try {
            // This will automatically use the service account credentials from the environment
            // in a production environment like Firebase App Hosting or Cloud Run.
            initializeApp();
        } catch (error) {
            console.error("Critical: Failed to initialize Firebase Admin SDK automatically. Check server logs and environment variables.", error);
            // This will cause downstream errors, which is what we want if initialization fails.
        }
    }
    return getFirestore();
}


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
    let db;
    try {
        db = getDb();
    } catch (e: any) {
        return {
            success: false,
            message: 'Fallo al inicializar la instancia de Firestore Admin.',
            error: e.message || 'Error desconocido durante la inicialización.'
        };
    }

    const testDocRef = db.collection('system_status').doc('firestore_ping');
    const testData = {
        timestamp: FieldValue.serverTimestamp(),
        status: 'ok',
    };

    try {
        // 1. Write
        await testDocRef.set(testData);

        // 2. Read
        const doc = await testDocRef.get();
        if (!doc.exists || doc.data()?.status !== 'ok') {
            throw new Error('La verificación de lectura falló. El documento no existe o los datos son incorrectos.');
        }

        // 3. Delete
        await testDocRef.delete();

        return {
            success: true,
            message: 'Conexión exitosa. Las operaciones de escritura, lectura y eliminación funcionan.',
        };
    } catch (error: any) {
        let errorMessage = 'Ocurrió un error desconocido.';
        if (error.message) {
            errorMessage = error.message;
        }
        
        console.error("Firestore Ping Error:", error);

        return {
            success: false,
            message: 'Fallo la conexión a Firestore.',
            error: errorMessage,
        };
    }
}
