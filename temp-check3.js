const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  "projectId": "contracttime3-15048626-b65e6",
  "appId": "1:1087853695018:web:49ad6d6c26a5a1afde7353",
  "apiKey": "AIzaSyAQp8xKoYHcggEnssiUmEiBV8rRYyC_89A",
  "authDomain": "contracttime3-15048626-b65e6.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1087853695018"
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
        // Sort by id descending
        wLeads.sort((a,b) => b.id.localeCompare(a.id));
        const firstLead = wLeads[0];
        console.log(`Checking messages for ${firstLead.id}...`);
        const msgsRef = collection(db, `leads/${firstLead.id}/messages`);
        const msgsSnap = await getDocs(msgsRef);
        console.log(`Found ${msgsSnap.docs.length} messages.`);
        msgsSnap.docs.forEach(d => console.log(d.id, "=>", d.data()));
    }
}
check().catch(console.error).finally(()=>process.exit(0));
