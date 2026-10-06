export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido o vacío (JSON requerido).' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const {
      contractId,
      cedula,
      idNumber,
      signatureDataUri,
      termsAccepted,
      signedBy,
      ipAddress,
    } = body;

    if (!termsAccepted) {
      return NextResponse.json(
        { success: false, error: 'El estudiante debe aceptar las cláusulas del contrato (termsAccepted: true).' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!signatureDataUri || typeof signatureDataUri !== 'string' || !signatureDataUri.startsWith('data:image')) {
      return NextResponse.json(
        { success: false, error: 'Se requiere una firma válida en formato Data URI (data:image/png;base64,...).' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const firestore = getFirestore(app);

    let targetDocId = contractId;

    // Si no enviaron contractId pero enviaron cédula, buscar el contrato
    if (!targetDocId && (cedula || idNumber)) {
      const cleanCed = cleanString(cedula || idNumber);
      const snap = await getDocs(collection(firestore, 'contracts'));
      snap.forEach((dSnap) => {
        const d = dSnap.data();
        const details = d.autoMotoDetails || d.deluxeDetails || d.ampliacionesDetails || d.details || {};
        const docCed = cleanString(d.studentIdNumber || details.studentIdNumber || '');
        if (docCed === cleanCed && d.status !== 'expired') {
          targetDocId = dSnap.id;
        }
      });
    }

    if (!targetDocId) {
      return NextResponse.json(
        { success: false, error: 'No se encontró el contrato a firmar. Especifique "contractId" o "cedula".' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const contractRef = doc(firestore, 'contracts', targetDocId);
    const contractSnap = await getDoc(contractRef);

    if (!contractSnap.exists()) {
      return NextResponse.json(
        { success: false, error: `El contrato con ID "${targetDocId}" no existe en la base de datos.` },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const contractData = contractSnap.data();
    const signerName = signedBy || contractData.clientName || 'Estudiante';
    const clientIp = ipAddress || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'LMS-Web';

    // Preparar actualización completa
    const updatePayload: any = {
      isSigned: true,
      termsAccepted: true,
      signatureDataUri: signatureDataUri,
      signedAt: serverTimestamp(),
      signedBy: signerName,
      signerIp: clientIp,
      updatedAt: serverTimestamp(),
      updatedBy: 'LMS Student Portal',
    };

    // Actualizar también dentro del subobjeto correspondiente para compatibilidad total
    if (contractData.autoMotoDetails) {
      updatePayload['autoMotoDetails.signatureDataUri'] = signatureDataUri;
      updatePayload['autoMotoDetails.isSigned'] = true;
      updatePayload['autoMotoDetails.signedAt'] = serverTimestamp();
    }
    if (contractData.deluxeDetails) {
      updatePayload['deluxeDetails.signatureDataUri'] = signatureDataUri;
      updatePayload['deluxeDetails.isSigned'] = true;
      updatePayload['deluxeDetails.signedAt'] = serverTimestamp();
    }
    if (contractData.ampliacionesDetails) {
      updatePayload['ampliacionesDetails.signatureDataUri'] = signatureDataUri;
      updatePayload['ampliacionesDetails.isSigned'] = true;
      updatePayload['ampliacionesDetails.signedAt'] = serverTimestamp();
    }

    await updateDoc(contractRef, updatePayload);

    return NextResponse.json(
      {
        success: true,
        message: 'Contrato firmado y aceptado exitosamente.',
        contractId: targetDocId,
        folioNumber: contractData.folioNumber || null,
        signedBy: signerName,
        signedAt: new Date().toISOString(),
      },
      { status: 200, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('Error en /api/contracts/sign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno al registrar la firma digital del contrato.',
        details: error?.message,
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
