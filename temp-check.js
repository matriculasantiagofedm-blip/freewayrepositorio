const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { readFileSync } = require('fs');
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

async function check() {
    console.log("Checking leads...");
    const leadsRef = collection(db, 'leads');
    const snapshot = await getDocs(leadsRef);
    console.log(`Found ${snapshot.docs.length} leads.`);
    
    let wLeads = snapshot.docs.filter(d => d.id.startsWith('whatsapp_'));
    console.log(`Found ${wLeads.length} WhatsApp leads.`);
    
    if (wLeads.length > 0) {
        const firstLead = wLeads[wLeads.length - 1]; // last one
        console.log(`Checking messages for ${firstLead.id}...`);
        const msgsRef = collection(db, `leads/${firstLead.id}/messages`);
        const msgsSnap = await getDocs(msgsRef);
        console.log(`Found ${msgsSnap.docs.length} messages.`);
        msgsSnap.docs.forEach(d => console.log(d.id, "=>", d.data()));
    }
}
check();
