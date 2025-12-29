
'use server';

import type { GenerateContractInput } from '@/lib/types';
import { createContractFlow } from '@/ai/flows/generate-contract-folio';
import { getFirestore, serverTimestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';

// --- Firebase Admin Initialization ---
let db: Firestore;
if (!getApps().length) {
    try {
        const app = initializeApp();
        db = getFirestore(app);
    } catch (error) {
        console.error("Critical: Failed to initialize Firebase Admin SDK automatically.", error);
        // We don't throw here to allow the app to start, but actions will fail.
    }
} else {
    db = getFirestore(getApps()[0]);
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
    if (!db) {
        return {
            success: false,
            message: 'La instancia de Firestore Admin no está inicializada en el servidor.',
        };
    }

    const testDocRef = db.collection('system_status').doc('firestore_ping');
    const testData = {
        timestamp: serverTimestamp(),
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
        
        return {
            success: false,
            message: 'Fallo la conexión a Firestore.',
            error: errorMessage,
        };
    }
}
