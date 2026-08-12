const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  "projectId": "contracttime3-15048626-b65e6",
  "appId": "1:1087853695018:web:49ad6d6c26a5a1afde7353",
  "apiKey": "AIzaSyAQp8xKoYHcggEnssiUmEiBV8rRYyC_89A",
  "authDomain": "contracttime3-15048626-b65e6.firebaseapp.com",
  "messagingSenderId": "1087853695018"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const snap = await getDoc(doc(db, 'settings', 'fleet'));
  if (snap.exists()) {
    console.log("FLEET DOCUMENT DATA:", JSON.stringify(snap.data(), null, 2));
  } else {
    console.log("FLEET DOCUMENT DOES NOT EXIST!");
  }
}

main().catch(console.error);
