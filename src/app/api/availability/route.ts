export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

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
  try {
    const panamaDateStr = d.toLocaleString('en-US', { timeZone: 'America/Panama' });
    const panamaDate = new Date(panamaDateStr);
    const year = panamaDate.getFullYear();
    const month = String(panamaDate.getMonth() + 1).padStart(2, '0');
    const day = String(panamaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export async function GET() {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const firestore = getFirestore(app);

    // 1. Obtener la flota actual y mapear vehículos a su transmisión
    let blockedSlots: Record<string, string> = {};
    let slotCapacities: Record<string, number> = {};
    let practicaSlots: Record<string, boolean> = {};
    let teoricoSlots: Record<string, boolean> = {};
    let practicaCapacities: Record<string, number> = {};
    let teoricoCapacities: Record<string, number> = {};
    const vehicleNameToTransmission: Record<string, string> = {};
    const activeVehiclesByTransmission: Record<string, number> = {
      'Automático': 0,
      'Manual': 0,
      'Moto': 0
    };
 
    try {
      const fleetSnap = await getDoc(doc(firestore, 'settings', 'fleet'));
      if (fleetSnap.exists()) {
        const data = fleetSnap.data();
        blockedSlots = data.blockedSlots || {};
        slotCapacities = data.slotCapacities || {};
        practicaSlots = data.practicaSlots || {};
        teoricoSlots = data.teoricoSlots || {};
        practicaCapacities = data.practicaCapacities || {};
        teoricoCapacities = data.teoricoCapacities || {};
        
        const vehiclesList = data.vehicles || [];
        vehiclesList.forEach((v: any) => {
          if (v.name && v.transmission) {
            vehicleNameToTransmission[v.name] = v.transmission;
            // Solo contar si el vehículo está Activo
            if (v.status !== 'Mantenimiento') {
              activeVehiclesByTransmission[v.transmission] = (activeVehiclesByTransmission[v.transmission] || 0) + 1;
            }
          }
        });
      }
    } catch (e) {
      console.error("Error reading fleet settings in availability route:", e);
    }

    // Valores por defecto si la base de datos está vacía para no romper el sistema
    if (activeVehiclesByTransmission['Automático'] === 0) activeVehiclesByTransmission['Automático'] = 3;
    if (activeVehiclesByTransmission['Manual'] === 0) activeVehiclesByTransmission['Manual'] = 2;
    if (activeVehiclesByTransmission['Moto'] === 0) activeVehiclesByTransmission['Moto'] = 1;

    const globalCounts: Record<string, number> = {};
    const transmissionCounts: Record<string, Record<string, number>> = {};
    const vehicleOccupancy: Record<string, string[]> = {};

    const processEntry = (date: any, slotString: string, vehicle?: string, studentName?: string, preferredTransmission?: string) => {
      if (!date || !slotString) return;
      const dObj = toDate(date);
      if (isNaN(dObj.getTime())) return;

      const dateKey = formatDateKey(dObj);
      const slotId = TIME_STRING_TO_SLOT_MAP[slotString] || slotString;
      const gKey = `${dateKey}|${slotId}`;

      globalCounts[gKey] = (globalCounts[gKey] || 0) + 1;

      // Determinar la transmisión de la clase
      let trans = preferredTransmission || 'Automático';
      if (vehicle && vehicleNameToTransmission[vehicle]) {
        trans = vehicleNameToTransmission[vehicle];
      }

      if (!transmissionCounts[gKey]) {
        transmissionCounts[gKey] = { 'Automático': 0, 'Manual': 0, 'Moto': 0 };
      }
      transmissionCounts[gKey][trans] = (transmissionCounts[gKey][trans] || 0) + 1;

      if (vehicle) {
        const vKey = `${dateKey}|${slotId}|${vehicle}`;
        if (!vehicleOccupancy[vKey]) vehicleOccupancy[vKey] = [];
        const name = studentName || 'Estudiante';
        if (!vehicleOccupancy[vKey].includes(name)) {
          vehicleOccupancy[vKey].push(name);
        }
      }
    };

    // 2. Manual Schedules
    const manualRef = collection(firestore, 'manual_schedules');
    const manualSnap = await getDocs(manualRef);
    manualSnap.forEach(doc => {
      const entry = doc.data();
      if (entry.classType !== 'Teórica' && entry.status !== 'cancelled_vehicle' && entry.status !== 'rescheduled') {
        const preferredTrans = entry.transmission || 'Automático';
        processEntry(entry.date, entry.timeSlot, entry.vehicle, entry.studentName, preferredTrans);
      }
    });

    // 3. Contracts (active, completed)
    const contractsRef = collection(firestore, 'contracts');
    const contractsQuery = query(contractsRef, where('status', 'in', ['active', 'completed']));
    const contractsSnap = await getDocs(contractsQuery);

    contractsSnap.forEach(doc => {
      const c = doc.data();
      const clientName = c.clientName || 'Cliente';
      const preferredTrans = c.autoMotoDetails?.vehicleTransmission || 'Automático';

      const proc = (arr: any[], customTrans?: string) => {
        if (Array.isArray(arr)) {
          arr.forEach(s => {
            if (s.status !== 'cancelled_vehicle' && s.status !== 'rescheduled') {
              processEntry(s.date, s.time, s.vehicle, clientName, customTrans || preferredTrans);
            }
          });
        }
      };

      if (c.autoMotoDetails?.practicalClassSchedules) {
        proc(c.autoMotoDetails.practicalClassSchedules, preferredTrans);
      }
      if (c.autoMotoDetails?.motoPracticalClassSchedules) {
        proc(c.autoMotoDetails.motoPracticalClassSchedules, 'Moto');
      }
      if (c.deluxeDetails?.classSchedules) {
        // Deluxe suele ser Automático
        proc(c.deluxeDetails.classSchedules, 'Automático');
      }
    });

    return NextResponse.json({
      success: true,
      globalCounts,
      transmissionCounts,
      activeVehiclesByTransmission,
      vehicleOccupancy,
      blockedSlots,
      slotCapacities,
      practicaSlots,
      teoricoSlots,
      practicaCapacities,
      teoricoCapacities,
      updatedAt: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('Error fetching availability API:', e);
    return NextResponse.json({ 
      success: false, 
      error: e.message, 
      globalCounts: {}, 
      transmissionCounts: {},
      activeVehiclesByTransmission: { 'Automático': 3, 'Manual': 2, 'Moto': 1 },
      vehicleOccupancy: {}, 
      blockedSlots: {}, 
      slotCapacities: {},
      practicaSlots: {},
      teoricoSlots: {},
      practicaCapacities: {},
      teoricoCapacities: {}
    }, { status: 500 });
  }
}
