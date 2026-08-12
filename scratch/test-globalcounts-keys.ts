import { firebaseConfig } from '../src/firebase/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const TIME_STRING_TO_SLOT_MAP: { [key: string]: string } = {
  '08:00am a 10:00am': '8am-10am',
  '8:00am a 10:00am': '8am-10am',
  '10:00am a 12:00pm': '10am-12pm',
  '01:00pm a 03:00pm': '1pm-3pm',
  '1:00pm a 3:00pm': '1pm-3pm',
  '03:00pm a 05:00pm': '3pm-5pm',
  '3:00pm a 5:00pm': '3pm-5pm',
};

function toDate(val: any): Date {
  if (!val) return new Date(NaN);
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date(NaN);
}

function formatDateKey(d: Date): string {
  // Usar Panamá (UTC-5) para obtener exactamente el año, mes y día local de Panamá
  const panamaDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Panama' }));
  const year = panamaDate.getFullYear();
  const month = String(panamaDate.getMonth() + 1).padStart(2, '0');
  const day = String(panamaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

async function test() {
  const globalCounts: Record<string, number> = {};

  const processEntry = (date: any, slotString: string) => {
    if (!date || !slotString) return;
    const dObj = toDate(date);
    if (isNaN(dObj.getTime())) return;

    const dateKey = formatDateKey(dObj);
    const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString;
    const gKey = `${dateKey}|${slotId}`;

    globalCounts[gKey] = (globalCounts[gKey] || 0) + 1;
  };

  const manualSnap = await getDocs(collection(firestore, 'manual_schedules'));
  manualSnap.forEach(doc => {
    const entry = doc.data();
    if (entry.classType !== 'Teórica') {
      processEntry(entry.date, entry.timeSlot);
    }
  });

  const contractsSnap = await getDocs(query(collection(firestore, 'contracts'), where('status', 'in', ['active', 'completed'])));
  contractsSnap.forEach(doc => {
    const c = doc.data();
    const proc = (arr: any[]) => {
      if (Array.isArray(arr)) arr.forEach(s => processEntry(s.date, s.time));
    };
    if (c.autoMotoDetails?.practicalClassSchedules) proc(c.autoMotoDetails.practicalClassSchedules);
    if (c.autoMotoDetails?.motoPracticalClassSchedules) proc(c.autoMotoDetails.motoPracticalClassSchedules);
    if (c.deluxeDetails?.classSchedules) proc(c.deluxeDetails.classSchedules);
  });

  console.log("Muestra de llaves en globalCounts (primeras 30):");
  Object.keys(globalCounts).slice(0, 30).forEach(k => {
    console.log(`  ${k} => ${globalCounts[k]} clases`);
  });

  process.exit(0);
}

test();
