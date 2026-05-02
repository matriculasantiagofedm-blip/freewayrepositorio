import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

function formatPanamaPhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 8 && (cleaned.startsWith('6') || cleaned.startsWith('8'))) return '507' + cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('507')) return cleaned;
    return cleaned;
}

export async function POST(req: Request) {
    try {
        const { to, text, leadId, platform, socialId } = await req.json();
        
        let response;
        if (platform === 'Instagram' || platform === 'Facebook') {
            const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || 'EAAR0VzJgjMwBRIgyGhXhgYZCBkZACKWlFYhULaehAFmVaog3lRxJLPtVLDyfrAAvQuVfgg1jyGSokuubcZAOVImN3ZAjAijg5kEcM0AZCxEfsE5kkqKWeQf4TkLzXLchLWZBkRkCtnBbve7i3Blzc5yC0coDkJYduT0jvMnkZCf4IGa2wmig8slPeZArsImBxJWaucEbsshKaFZCDtnlHVGDj1BUBXgZDZD';
            response = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: { id: socialId || to }, message: { text: text } }),
            });
        } else {
            const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'EAAR0VzJgjMwBRGjRZBWiYRd9EwZAX0UGGIZC6TjNG0kTuxLNNudSqYpEpoV1dqRQLMzgaa1vJoLUgIvdT39nERilnSOUkM4OZClgbSxf1lVBLDxQ87ZBH0sEcFiKZAlynlESPe7qWzZC2q7dQr0ohSTEWlmKhIyxf9FSRlr3vCHMGgnuS1P0ZA0roRm2Vb77ZAIczRwZDZD';
            const PHONE_NUMBER_ID = '1045621595304134';
            const cleanTo = formatPanamaPhone(to || '');

            if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return NextResponse.json({ success: false, error: "CONFIG_MISSING" }, { status: 400 });

            const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

            response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo, type: 'text', text: { body: text } }),
            });
        }

        if (response.ok) {
            if (leadId) {
                try {
                    let app;
                    let db;
                    if (getApps().length === 0) {
                        app = initializeApp(firebaseConfig);
                        db = initializeFirestore(app, { experimentalForceLongPolling: true });
                    } else {
                        app = getApps()[0];
                        db = getFirestore(app);
                    }
                    
                    const msgRef = doc(collection(db, `leads/${leadId}/messages`));
                    await setDoc(msgRef, {
                        id: msgRef.id,
                        text,
                        sender: 'me',
                        status: 'sent',
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        timestamp: serverTimestamp()
                    });
                    
                    await updateDoc(doc(db, 'leads', leadId), {
                        lastMessage: text,
                        lastMessageAt: serverTimestamp()
                    });
                } catch(e) {}
            }
            return NextResponse.json({ success: true });
        }

        const errorData = await response.json();
        return NextResponse.json({ success: false, error: errorData?.error?.message || "META_API_ERROR" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || "CONNECTION_ERROR" }, { status: 500 });
    }
}
