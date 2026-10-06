export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

function cleanString(str?: string | null): string {
  if (!str) return '';
  return str.replace(/[-\s]/g, '').toLowerCase().trim();
}

function formatDateISO(d: any): string | null {
  if (!d) return null;
  let date: Date;
  if (d instanceof Date) date = d;
  else if (typeof d === 'object' && 'seconds' in d) date = new Date(d.seconds * 1000);
  else if (typeof d === 'object' && '_seconds' in d) date = new Date(d._seconds * 1000);
  else if (typeof d?.toDate === 'function') date = d.toDate();
  else date = new Date(d);

  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cedulaParam = searchParams.get('cedula') || searchParams.get('idNumber') || searchParams.get('cip');
    const emailParam = searchParams.get('email');
    const contractIdParam = searchParams.get('contractId') || searchParams.get('id');
    const folioParam = searchParams.get('folio') || searchParams.get('folioNumber');

    if (!cedulaParam && !emailParam && !contractIdParam && !folioParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros de búsqueda insuficientes. Proporcione "cedula", "email", "folio" o "contractId".',
        },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const firestore = getFirestore(app);

    // 1. Búsqueda directa por ID si se proporciona
    if (contractIdParam) {
      const docSnap = await getDoc(doc(firestore, 'contracts', contractIdParam));
      if (docSnap.exists()) {
        const contractData = docSnap.data();
        const formatted = formatContractPayload(docSnap.id, contractData, request);
        return NextResponse.json(
          { success: true, found: true, contract: formatted },
          { status: 200, headers: getCorsHeaders() }
        );
      }
    }

    // 2. Búsqueda en la colección de contratos
    const snap = await getDocs(collection(firestore, 'contracts'));
    const matches: { id: string; data: any; score: number }[] = [];

    const targetCedulaClean = cleanString(cedulaParam);
    const targetEmailClean = cleanString(emailParam);
    const targetFolio = folioParam ? Number(folioParam) : null;

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const details = d.autoMotoDetails || d.deluxeDetails || d.ampliacionesDetails || d.details || {};

      const docCedula = cleanString(
        d.studentIdNumber ||
        details.studentIdNumber ||
        (d as any).idNumber ||
        ''
      );

      const docEmail = cleanString(d.clientEmail || (d as any).email || '');
      const docFolio = Number(d.folioNumber || 0);

      let isMatch = false;
      let score = 0;

      if (targetCedulaClean && docCedula && docCedula === targetCedulaClean) {
        isMatch = true;
        score += 10;
      }

      if (targetEmailClean && docEmail && docEmail === targetEmailClean) {
        isMatch = true;
        score += 5;
      }

      if (targetFolio && docFolio === targetFolio) {
        isMatch = true;
        score += 15;
      }

      if (isMatch) {
        // Priorizar contratos activos o completados sobre anulados
        if (d.status === 'active') score += 3;
        else if (d.status === 'completed') score += 2;
        else if (d.status === 'expired') score -= 5;

        matches.push({ id: docSnap.id, data: d, score });
      }
    });

    if (matches.length === 0) {
      return NextResponse.json(
        {
          success: true,
          found: false,
          message: 'No se encontró ningún contrato con los criterios proporcionados.',
          contract: null,
        },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Ordenar por score y luego por fecha más reciente
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dateA = a.data.createdAt?.seconds || 0;
      const dateB = b.data.createdAt?.seconds || 0;
      return dateB - dateA;
    });

    const bestMatch = matches[0];
    const formatted = formatContractPayload(bestMatch.id, bestMatch.data, request);

    return NextResponse.json(
      {
        success: true,
        found: true,
        totalMatches: matches.length,
        contract: formatted,
      },
      { status: 200, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('Error en /api/contracts/by-student:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor al consultar el contrato.',
        details: error?.message,
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

function formatContractPayload(id: string, d: any, request: NextRequest) {
  const details = d.autoMotoDetails || d.deluxeDetails || d.ampliacionesDetails || d.details || {};
  const origin = request.nextUrl.origin || 'https://www.contractimefedm.online';

  const rawType = String(d.type || d.contractType || d.title || '').trim();
  const isSoloPractica =
    rawType.toLowerCase().includes('practica') ||
    d.type === 'Curso Solo Practica' ||
    Boolean(details.isSoloPractica);

  const practicalSlots = (details.practicalClassSchedules || details.classSchedules || []).map((s: any, idx: number) => ({
    session: idx + 1,
    date: formatDateISO(s.date),
    time: s.time || null,
    vehicle: s.vehicle || null,
    instructor: s.instructor || null,
  }));

  const motoPracticalSlots = (details.motoPracticalClassSchedules || []).map((s: any, idx: number) => ({
    session: idx + 1,
    date: formatDateISO(s.date),
    time: s.time || null,
    vehicle: s.vehicle || null,
    instructor: s.instructor || null,
  }));

  const theoryDates = (details.theoreticalClassDates || details.theoreticalClasses || []).map((dt: any) => formatDateISO(dt)).filter(Boolean);

  const isSigned = Boolean(
    d.isSigned ||
    d.signatureDataUri ||
    details.signatureDataUri ||
    d.signedAt
  );

  return {
    id: id,
    folioNumber: d.folioNumber || 0,
    title: d.title || `Contrato Folio ${d.folioNumber || ''}`,
    type: d.type || rawType,
    isSoloPractica: isSoloPractica,
    status: d.status || 'active',
    createdAt: formatDateISO(d.createdAt),
    client: {
      name: d.clientName || '',
      email: d.clientEmail || '',
      idType: details.idType || 'C.I.P.',
      idNumber: d.studentIdNumber || details.studentIdNumber || '',
      address: details.studentAddress || '',
      phone1: details.studentPhone1 || '',
      phone2: details.studentPhone2 || '',
    },
    course: {
      plan: details.coursePlan || 'Estándar',
      licenseCategory: details.licenseCategory || '',
      transmission: details.vehicleTransmission || 'Automático',
      vehicleType: details.vehicleType || (rawType.toLowerCase().includes('moto') ? 'Motocicleta' : 'Auto'),
    },
    pricing: {
      courseValue: Number(details.courseValue || 0),
      enrollmentFee: Number(details.enrollmentFee || 0),
      downPayment: Number(details.downPayment || 0),
      balance: Number(details.balance || 0),
      paymentDeadline: formatDateISO(details.paymentDeadline),
      paymentType: details.paymentType || 'cash',
    },
    schedule: {
      theoreticalSchedule: details.theoreticalClassSchedule || (isSoloPractica ? 'No aplica (Solo Práctica)' : 'Pendiente'),
      theoreticalDates: theoryDates,
      practicalSessions: practicalSlots,
      motoPracticalSessions: motoPracticalSlots,
    },
    signature: {
      isSigned: isSigned,
      termsAccepted: Boolean(d.termsAccepted ?? isSigned),
      signedAt: formatDateISO(d.signedAt || details.signedAt),
      signedBy: d.signedBy || details.signedBy || (isSigned ? d.clientName : null),
      signatureDataUri: d.signatureDataUri || details.signatureDataUri || null,
    },
    links: {
      printViewUrl: `${origin}/print-contract/${id}`,
    },
  };
}
