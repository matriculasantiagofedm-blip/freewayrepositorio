import { firebaseConfig } from '../src/firebase/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

console.log("Firebase Project ID:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("--- PROBANDO FIRESTORE CONTRACTS ---");
  const snap = await getDocs(collection(db, 'contracts'));
  console.log("Total Contratos:", snap.size);

  let totalClassesFound = 0;
  snap.forEach(d => {
    const data = d.data();
    const scheds = data.autoMotoDetails?.practicalClassSchedules || [];
    if (scheds.length > 0) {
      console.log(`\nContrato Folio #${data.folioNumber} (${data.clientName}) Status [${data.status}]:`);
      scheds.forEach((s: any, idx: number) => {
        let dateVal = s.date;
        if (dateVal && typeof dateVal === 'object' && 'seconds' in dateVal) {
          dateVal = new Date(dateVal.seconds * 1000).toISOString();
        }
        console.log(`  Clase ${idx + 1}: Date = ${dateVal}, Time = "${s.time}", Vehicle = "${s.vehicle}"`);
      });
      totalClassesFound += scheds.length;
    }
  });

  console.log("\n--- PROBANDO MANUAL SCHEDULES ---");
  const mSnap = await getDocs(collection(db, 'manual_schedules'));
  console.log("Total Manual Schedules:", mSnap.size);
  mSnap.forEach(d => {
    console.log("Manual:", d.data());
  });

  console.log("\nTotal Clases Prácticas en Firebase:", totalClassesFound);
  process.exit(0);
}

test();
