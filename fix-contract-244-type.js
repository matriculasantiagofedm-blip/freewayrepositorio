/**
 * Script de corrección: Contrato 244 (doc: xyMVOwOlfMMrH2gsbufG)
 * Actualiza type='Curso Auto' → 'Curso Deluxe'
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc, serverTimestamp } = require('firebase/firestore');
const dotenv = require('dotenv');

dotenv.config({ path: 'd:/FirebaseProjects/contracttime3-15048626-b65e6/.env' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "contracttime3-15048626-b65e6",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixContract244() {
    const contractId = 'xyMVOwOlfMMrH2gsbufG';
    const ref = doc(db, 'contracts', contractId);
    
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        console.error('❌ Contrato no encontrado:', contractId);
        process.exit(1);
    }
    
    const data = snap.data();
    console.log('📋 Datos actuales:');
    console.log('   type        :', data.type);
    console.log('   title       :', data.title);
    console.log('   clientName  :', data.clientName);
    console.log('   folioNumber :', data.folioNumber);
    
    if (data.type === 'Curso Deluxe') {
        console.log('\n✅ El tipo ya es correcto (Curso Deluxe). No se necesita cambio.');
        process.exit(0);
    }
    
    await updateDoc(ref, {
        type: 'Curso Deluxe',
        title: `Paquete Deluxe - Folio ${data.folioNumber}`,
        updatedBy: 'Fix-Admin',
    });
    
    console.log('\n✅ Contrato 244 corregido:');
    console.log('   type  : Curso Deluxe');
    console.log('   title : Paquete Deluxe - Folio', data.folioNumber);
    process.exit(0);
}

fixContract244().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
