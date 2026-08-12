export const dynamic = 'force-static';
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// ─── Instructores conocidos (datos fijos + cédulas configurables via env) ─────
const INSTRUCTORS: { name: string; cedulas: string[] }[] = [
  {
    name: 'Emmanuel Camargo',
    cedulas: (process.env.INSTRUCTOR_CEDULA_EMMANUEL ?? '').split(',').filter(Boolean),
  },
  {
    name: 'Adrian Gordon',
    cedulas: (process.env.INSTRUCTOR_CEDULA_ADRIAN ?? '').split(',').filter(Boolean),
  },
  {
    name: 'Roberto Brown',
    cedulas: (process.env.INSTRUCTOR_CEDULA_ROBERTO ?? '').split(',').filter(Boolean),
  },
  {
    name: 'Marco Franco',
    cedulas: (process.env.INSTRUCTOR_CEDULA_MARCO ?? '').split(',').filter(Boolean),
  },
];

/** Normaliza cédula: quita guiones, espacios y convierte a minúsculas */
function normalize(c: string) {
  return c.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    // ── Verificar secret compartido ───────────────────────────────────────────
    const apiKey = req.headers.get('x-api-key');
    const expectedSecret = process.env.LMS_API_SECRET;

    if (!expectedSecret || apiKey !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const rawCedula: string = body?.cedula ?? '';

    if (!rawCedula.trim()) {
      return NextResponse.json({ error: 'cedula is required' }, { status: 400 });
    }

    const cleanCedula = normalize(rawCedula);

    // ── 1. Verificar si es un instructor ─────────────────────────────────────
    for (const instructor of INSTRUCTORS) {
      const match = instructor.cedulas.some(c => normalize(c) === cleanCedula);
      if (match) {
        return NextResponse.json({
          found: true,
          role: 'instructor',
          name: instructor.name,
          cedula: rawCedula.trim(),
        });
      }
    }

    // ── 2. Buscar en la colección de instructors de Firestore ─────────────────
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);

    const instSnap = await getDocs(collection(db, 'instructors'));
    for (const d of instSnap.docs) {
      const data = d.data();
      const fields = [data.cedula, data.idNumber, data.studentIdNumber].filter(Boolean);
      if (fields.some(f => normalize(String(f)) === cleanCedula)) {
        return NextResponse.json({
          found: true,
          role: 'instructor',
          name: data.name ?? data.studentName ?? 'Instructor',
          cedula: rawCedula.trim(),
        });
      }
    }

    // ── 3. Buscar en contratos ────────────────────────────────────────────────
    // El campo studentIdNumber puede estar en la raíz del contrato
    // o dentro de autoMotoDetails / deluxeDetails / ampliacionesDetails
    const contractsSnap = await getDocs(
      query(collection(db, 'contracts'), where('status', '!=', 'draft'))
    );

    for (const d of contractsSnap.docs) {
      const data = d.data();

      // Candidatos de cédula: raíz + detalles anidados
      const candidates: string[] = [
        data.studentIdNumber,
        data.autoMotoDetails?.studentIdNumber,
        data.deluxeDetails?.studentIdNumber,
        data.ampliacionesDetails?.studentIdNumber,
      ].filter(Boolean) as string[];

      const matched = candidates.some(c => normalize(String(c)) === cleanCedula);

      if (matched) {
        return NextResponse.json({
          found: true,
          role: 'student',
          name: data.clientName ?? 'Estudiante',
          cedula: rawCedula.trim(),
          contractId: d.id,
          plan: data.type ?? null,
          folioNumber: data.folioNumber ?? null,
        });
      }
    }

    // ── No encontrado ─────────────────────────────────────────────────────────
    return NextResponse.json({ found: false });

  } catch (error: unknown) {
    console.error('[verify-cedula] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
