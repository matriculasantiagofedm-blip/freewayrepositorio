export const dynamic = 'force-static';
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

export async function GET() {
    try {
        let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        let firestore = getFirestore(app);
        
        const leadsRef = collection(firestore, 'leads');
        const snap = await getDocs(leadsRef);
        
        let out = [];
        for (let doc of snap.docs) {
            let data = doc.data();
            if (doc.id.startsWith('whatsapp_')) {
                const msgsSnap = await getDocs(collection(firestore, `leads/${doc.id}/messages`));
                out.push({
                    id: doc.id,
                    name: data.name,
                    phone: data.phone,
                    messagesCount: msgsSnap.size,
                    lastMessage: data.lastMessage
                });
            }
        }
        return NextResponse.json({ success: true, count: snap.size, whatsappLeads: out });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
