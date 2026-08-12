export const dynamic = 'force-static';
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

const EVO_BASE = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
const EVO_KEY  = process.env.EVOLUTION_API_KEY || 'freeway2025secret';
const EVO_INST = process.env.EVOLUTION_INSTANCE || 'freeway-crm';

function formatPanamaPhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 8 && (cleaned.startsWith('6') || cleaned.startsWith('8'))) return '507' + cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('507')) return cleaned;
    return cleaned;
}

function getDb() {
    let app;
    let db;
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        db = initializeFirestore(app, { experimentalForceLongPolling: true });
    } else {
        app = getApps()[0];
        db = getFirestore(app);
    }
    return db;
}

export async function POST(req: Request) {
    try {
        const {
            to, text, leadId, platform, socialId,
            // Campos de media (opcional)
            mediaBase64, mediaType, mimeType, fileName,
            // Instancia de WhatsApp QR (opcional)
            instance,
        } = await req.json();

        const EVO_INST_RESOLVED = instance || EVO_INST;

        let response: Response | undefined;
        let savedMediaUrl: string | undefined;

        // ── INSTAGRAM (desactivado) ────────────────────────────────────────
        if (platform === 'Instagram') {
            return NextResponse.json({ success: false, error: 'Instagram está desactivado temporalmente.' }, { status: 403 });
        }

        // ── FACEBOOK ──────────────────────────────────────────────────────
        if (platform === 'Facebook') {
            const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
            if (!PAGE_ACCESS_TOKEN) return NextResponse.json({ success: false, error: 'Facebook: token no configurado.' }, { status: 400 });
            response = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: { id: socialId || to }, message: { text } }),
            });

        // ── WHATSAPP QR (Evolution API) ────────────────────────────────────
        } else if (platform === 'WhatsApp QR') {
            const cleanTo = formatPanamaPhone(to || '');

            if (mediaBase64 && mediaType) {
                if (mediaType === 'audio') {
                    // Enviar como nota de voz (PTT)
                    response = await fetch(`${EVO_BASE}/message/sendWhatsAppAudio/${EVO_INST_RESOLVED}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
                        body: JSON.stringify({ number: cleanTo, audio: mediaBase64 }),
                    });
                } else {
                    // Enviar imagen / video / documento
                    const evoMediaType = mediaType === 'document' ? 'document'
                        : mediaType === 'video' ? 'video' : 'image';
                    response = await fetch(`${EVO_BASE}/message/sendMedia/${EVO_INST_RESOLVED}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
                        body: JSON.stringify({
                            number: cleanTo,
                            mediatype: evoMediaType,
                            mimetype: mimeType || 'image/jpeg',
                            caption: text || '',
                            media: mediaBase64,
                            fileName: fileName || 'file',
                        }),
                    });
                }
                // Para preview inmediato en el CRM antes de que llegue el webhook
                savedMediaUrl = `data:${mimeType || 'image/jpeg'};base64,${mediaBase64}`;
            } else {
                // Solo texto
                response = await fetch(`${EVO_BASE}/message/sendText/${EVO_INST_RESOLVED}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
                    body: JSON.stringify({ number: cleanTo, text }),
                });
            }

        // ── WHATSAPP (cualquier canal → Evolution API) ─────────────────────
        } else {
            const cleanTo = formatPanamaPhone(to || '');
            const resolvedInst = EVO_INST_RESOLVED || 'freeway-crm';

            if (mediaBase64 && mediaType) {
                const evoMediaType = mediaType === 'document' ? 'document'
                    : mediaType === 'video' ? 'video' : 'image';
                response = await fetch(`${EVO_BASE}/message/sendMedia/${resolvedInst}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
                    body: JSON.stringify({
                        number: cleanTo,
                        mediatype: evoMediaType,
                        mimetype: mimeType || 'image/jpeg',
                        caption: text || '',
                        media: mediaBase64,
                        fileName: fileName || 'file',
                    }),
                });
                savedMediaUrl = `data:${mimeType || 'image/jpeg'};base64,${mediaBase64}`;
            } else {
                response = await fetch(`${EVO_BASE}/message/sendText/${resolvedInst}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
                    body: JSON.stringify({ number: cleanTo, text }),
                });
            }
        }

        if (!response) return NextResponse.json({ success: false, error: 'NO_RESPONSE' }, { status: 500 });

        if (response.ok) {
            if (leadId) {
                try {
                    const db = getDb();
                    const msgRef = doc(collection(db, `leads/${leadId}/messages`));
                    const msgData: any = {
                        id: msgRef.id,
                        text: text || (mediaType === 'audio' ? '🎤 Audio' : mediaType === 'image' ? '📷 Imagen' : mediaType === 'document' ? '📄 Documento' : '[Media]'),
                        sender: 'me',
                        status: 'sent',
                        time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
                        timestamp: serverTimestamp(),
                    };
                    if (savedMediaUrl) { msgData.mediaUrl = savedMediaUrl; msgData.mediaType = mediaType; }
                    if (mimeType && mediaType) msgData.mimeType = mimeType;
                    if (fileName && mediaType === 'document') msgData.fileName = fileName;
                    await setDoc(msgRef, msgData);
                    await updateDoc(doc(db, 'leads', leadId), {
                        lastMessage: msgData.text,
                        lastMessageAt: serverTimestamp(),
                    });
                } catch(e) { console.error('[send] Firestore error:', e); }
            }
            return NextResponse.json({ success: true });
        }

        const errorData = await response.json().catch(() => ({}));
        console.error('[send] API error:', errorData);
        return NextResponse.json({ success: false, error: errorData?.error?.message || errorData?.message || 'API_ERROR' }, { status: 400 });
    } catch (error: any) {
        console.error('[send] Exception:', error);
        return NextResponse.json({ success: false, error: error?.message || 'CONNECTION_ERROR' }, { status: 500 });
    }
}
