const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');
const dotenv = require('dotenv');

dotenv.config({ path: 'd:/FirebaseProjects/contracttime3-15048626-b65e6/.env' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "contracttime2-17074294-10501",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function findYesterday() {
    console.log("Autenticando...");
    await signInAnonymously(auth);
    console.log("Buscando todos los contratos, leads y pagos registrados en los últimos 3 días (Ayer / Recientes)...\n");

    const collections = ['contracts', 'leads', 'cancellation_payments', 'update_payments', 'book_sale_payments'];

    for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        console.log(`\n======================================================`);
        console.log(`  COLECCIÓN: ${col.toUpperCase()} (${snap.docs.length} registros totales)`);
        console.log(`======================================================`);

        const items = [];
        snap.docs.forEach(doc => {
            const d = doc.data();
            let dateObj = null;
            if (d.createdAt) {
                if (d.createdAt.toDate) dateObj = d.createdAt.toDate();
                else if (d.createdAt.seconds) dateObj = new Date(d.createdAt.seconds * 1000);
                else dateObj = new Date(d.createdAt);
            } else if (d.paymentDate) {
                if (d.paymentDate.toDate) dateObj = d.paymentDate.toDate();
                else if (d.paymentDate.seconds) dateObj = new Date(d.paymentDate.seconds * 1000);
            }

            items.push({
                id: doc.id,
                dateObj: dateObj,
                dateStr: dateObj ? dateObj.toLocaleString('es-PA') : 'Sin fecha',
                data: d
            });
        });

        // Ordenar por fecha más reciente
        items.sort((a, b) => {
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj.getTime() - a.dateObj.getTime();
        });

        // Mostrar los 15 más recientes
        items.slice(0, 15).forEach((item, idx) => {
            const d = item.data;
            const folio = d.folioNumber || d.folio || 'N/A';
            const name = d.clientName || d.name || d.studentName || d.client || 'N/A';
            const email = d.clientEmail || d.email || 'N/A';
            const phone = d.studentPhone1 || d.phone || d.phone1 || 'N/A';
            const amount = d.totalAmount || d.amount || d.price || d.courseValue || 'N/A';
            const type = d.contractType || d.type || d.interest || 'N/A';

            console.log(`${idx + 1}. [FOLIO: ${folio}] - Fecha: ${item.dateStr}`);
            console.log(`   Nombre: ${name}`);
            console.log(`   Email: ${email} | Tel: ${phone}`);
            console.log(`   Tipo: ${type} | Monto: $${amount}`);
            console.log(`   ID Doc: ${item.id}`);
            console.log("------------------------------------------------------");
        });
    }
}

findYesterday().catch(console.error);
