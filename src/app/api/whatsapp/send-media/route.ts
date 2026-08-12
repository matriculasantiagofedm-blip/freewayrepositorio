export const dynamic = 'force-static';
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, collection, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

function getDb() {
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  }
  return getFirestore(getApps()[0]);
}

function formatPanamaPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8 && (cleaned.startsWith('6') || cleaned.startsWith('8'))) return '507' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('507')) return cleaned;
  return cleaned;
}

/**
 * POST /api/whatsapp/send-media
 * Envía una imagen o audio por WhatsApp QR (Evolution API)
 * Body: { to, leadId, mediaType: 'image'|'audio', base64, mimeType, caption? }
 */
export async function POST(req: Request) {
  try {
    const { to, leadId, mediaType, base64, mimeType, caption, fileName } = await req.json();

    if (!to || !base64 || !mediaType) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros requeridos.' }, { status: 400 });
    }

    const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
    const EVO_KEY = process.env.EVOLUTION_API_KEY || 'freeway2025secret';
    const INSTANCE = process.env.EVOLUTION_INSTANCE || 'freeway-crm';
    const cleanTo = formatPanamaPhone(to);

    let endpoint = '';
    let body: Record<string, any> = {};

    if (mediaType === 'image') {
      endpoint = `${EVO_URL}/message/sendMedia/${INSTANCE}`;
      body = {
        number: cleanTo,
        mediatype: 'image',
        media: base64,
        mimetype: mimeType || 'image/jpeg',
        caption: caption || '',
      };
    } else if (mediaType === 'audio') {
      endpoint = `${EVO_URL}/message/sendWhatsAppAudio/${INSTANCE}`;
      body = {
        number: cleanTo,
        audio: base64,
        encoding: true,
      };
    } else if (mediaType === 'document') {
      endpoint = `${EVO_URL}/message/sendMedia/${INSTANCE}`;
      body = {
        number: cleanTo,
        mediatype: 'document',
        media: base64,
        mimetype: mimeType || 'application/pdf',
        fileName: fileName || 'documento',
        caption: caption || '',
      };
    } else {
      return NextResponse.json({ success: false, error: 'Tipo de media no soportado.' }, { status: 400 });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[send-media] Evolution error:', errText);
      return NextResponse.json({ success: false, error: 'Error enviando media a Evolution API.' }, { status: 500 });
    }

    // Guardar en Firestore
    if (leadId) {
      try {
        const db = getDb();
        const displayText = mediaType === 'image' ? (caption || '📷 Imagen') 
          : mediaType === 'audio' ? '🎤 Audio' 
          : `📄 ${fileName || 'Documento'}`;
        const msType = mediaType === 'image' ? 'imageMessage' 
          : mediaType === 'audio' ? 'audioMessage' 
          : 'documentMessage';
        await addDoc(collection(db, `leads/${leadId}/messages`), {
          text:      displayText,
          sender:    'me',
          status:    'sent',
          mediaUrl:  `data:${mimeType};base64,${base64}`,
          mediaType: msType,
          mimeType,
          fileName:  fileName || '',
          time:      new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
          timestamp: serverTimestamp(),
        });
        await updateDoc(doc(db, 'leads', leadId), {
          lastMessage:   displayText,
          lastMessageAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[send-media] Firestore save error:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[send-media] Error:', error.message);
    return NextResponse.json({ success: false, error: error?.message || 'Error interno' }, { status: 500 });
  }
}
