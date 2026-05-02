'use server';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { collection, doc, setDoc, addDoc, serverTimestamp, getDocs, getDoc, query, orderBy, updateDoc, limit, where } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { Message } from '@/lib/types';

function safeJson(data: any) {
  if (data === undefined || data === null) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    return { success: false, error: "SERIALIZATION_ERROR" };
  }
}

function formatPanamaPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8 && (cleaned.startsWith('6') || cleaned.startsWith('8'))) return '507' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('507')) return cleaned;
  return cleaned;
}

export async function sendWhatsApp(to: string, text: string, leadId?: string) {
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'EAAR0VzJgjMwBRGjRZBWiYRd9EwZAX0UGGIZC6TjNG0kTuxLNNudSqYpEpoV1dqRQLMzgaa1vJoLUgIvdT39nERilnSOUkM4OZClgbSxf1lVBLDxQ87ZBH0sEcFiKZAlynlESPe7qWzZC2q7dQr0ohSTEWlmKhIyxf9FSRlr3vCHMGgnuS1P0ZA0roRm2Vb77ZAIczRwZDZD';
  const PHONE_NUMBER_ID = '1045621595304134';
  const cleanTo = formatPanamaPhone(to);

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return safeJson({ success: false, error: "CONFIG_MISSING" });

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo, type: 'text', text: { body: text } }),
    });

    if (response.ok) {
        if (leadId) await saveMessageToFirestore(leadId, { id: Date.now().toString(), text, sender: 'me', status: 'sent', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        return safeJson({ success: true });
    }
    const errorData = await response.json();
    try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        await addDoc(collection(getFirestore(app), 'leads'), { name: "ERROR_META", json: JSON.stringify(errorData), timestamp: serverTimestamp() });
    } catch(e){}
    return safeJson({ success: false, error: errorData?.error?.message || "META_API_ERROR", meta_code: errorData?.error?.code });
  } catch (error) {
    try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        await addDoc(collection(getFirestore(app), 'leads'), { name: "ERROR_FETCH", string: String(error), timestamp: serverTimestamp() });
    } catch(e){}
    return safeJson({ success: false, error: "CONNECTION_ERROR" });
  }
}

async function saveMessageToFirestore(leadId: string, msg: Message) {
    try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const firestore = getFirestore(app);
        if (!firestore) return;
        
        const messagesRef = collection(firestore, `leads/${leadId}/messages`);
        await addDoc(messagesRef, { ...msg, timestamp: serverTimestamp() });

        const leadRef = doc(firestore, 'leads', leadId);
        await updateDoc(leadRef, { 
            lastMessage: msg.text, 
            lastMessageAt: serverTimestamp() 
        });
    } catch (e) {}
}

export async function getMessages(leadId: string) {
    try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const firestore = getFirestore(app);
        if (!firestore) return safeJson({ success: true, messages: [] });
        const messagesRef = collection(firestore, `leads/${leadId}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));
        const snapshot = await getDocs(q);
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return safeJson({ success: true, messages });
    } catch (e) { return safeJson({ success: false, messages: [] }); }
}

export async function checkSystemStatus() {
    const META_TOKEN = !!process.env.WHATSAPP_ACCESS_TOKEN;
    const PHONE_ID = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    const VERIFY_TOKEN = !!(process.env.WHATSAPP_VERIFY_TOKEN || process.env.NEXT_PUBLIC_WHATSAPP_VERIFY_TOKEN);
    const AI_OK = !!process.env.GEMINI_API_KEY;
    
    return safeJson({
        success: true,
        services: {
            whatsapp: META_TOKEN && PHONE_ID,
            facebook: META_TOKEN && VERIFY_TOKEN,
            instagram: META_TOKEN && VERIFY_TOKEN,
            ai: AI_OK,
            database: true 
        }
    });
}

// Removed Genkit imports to prevent node module crashing

export async function getAssistantResponse(input: { text: string, leadId?: string }) {
    console.log("=> ACTION getAssistantResponse START", input);
    try {
        const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'contracttime2-17074294-10501';
        
        let kbText = "Precios de Freeway Panamá: Autos desde $133, Motos desde $115.";
        try {
            const aiRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/ai_knowledge`);
            if (aiRes.ok) {
                const aiData = await aiRes.json();
                if (aiData.fields?.text?.stringValue) kbText = aiData.fields.text.stringValue;
            }
        } catch(e) {}
        
        let catalogText = "\n\nCATÁLOGO OFICIAL DE PLANES Y PRECIOS (Úsalo siempre para cotizar):\n";
        try {
            const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
            const fs = getFirestore(app);
            const prDoc = await getDoc(doc(fs, 'settings', 'prices'));
            const prices = prDoc.exists() ? prDoc.data().values : null;
            if (prices) {
                for (const cat in prices) {
                    catalogText += `CATEGORÍA ${cat.toUpperCase()}:\n`;
                    for (const item in prices[cat]) {
                        catalogText += `- ${item}: $${prices[cat][item]}\n`;
                    }
                }
            }
        } catch(e) {}

        let historyText = "";
        if (input.leadId) {
            try {
                // Fetch basic messages using REST since it's safer on Edge
                const msgsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/leads/${input.leadId}/messages`);
                if (msgsRes.ok) {
                    const msgsData = await msgsRes.json();
                    if (msgsData.documents) {
                        const docs = msgsData.documents.slice(-5);
                        historyText = docs.map((d: any) => {
                            const sender = d.fields?.sender?.stringValue === 'client' ? 'Cliente' : 'Agente';
                            const text = d.fields?.text?.stringValue || '';
                            return `${sender}: ${text}`;
                        }).join('\n');
                    }
                }
            } catch(e) {}
        }

        const prompt = `Eres el copiloto experto en ventas de Freeway Panamá.
Te enviaré el último mensaje o el historial reciente de un cliente. 
Tu misión es generar la MEJOR respuesta posible para que el agente de ventas la envíe.
Debe sonar 100% humano panameño, amigable, profesional y corto. Usa emojis con sutileza.
NO inicies tu respuesta diciendo "Agente:" ni uses comillas. Solo dame el texto crudo listo para copiar y pegar.

Mente Comercial / Base de Datos:
${kbText}
${catalogText}

Historial:
${historyText}

Último comentario o solicitud: ${input.text}`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 600 }
            })
        });
        
        const data = await response.json();
        const finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar respuesta.";
        return safeJson({ text: finalAnswer.trim() });
    } catch (e) { return safeJson({ text: "Error en la IA. " + String(e) }); }
}
export async function getImprovedMessageAction(input: { text: string, style: 'Profesional' | 'Suave' | 'Negociación' }) {
    try {
        const prompt = `Actúa como un experto en ventas panameño. Toma el siguiente texto del empleado y devuélvelo mejorado, manteniendo el espíritu pero adaptándolo estrictamente a este estilo: ${input.style}.
        
Debe sonar amigable, humano y no como un robot. NO des explicaciones. Solo manda la frase lista para enviar.
        
TEXTO ORIGINAL:
"${input.text}"`;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 300 }
            })
        });
        
        const data = await response.json();
        const finalAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo mejorar el mensaje.";
        return safeJson({ text: finalAnswer.trim() });
    } catch (e) { return safeJson({ text: "Error de IA al mejorar el mensaje." }); }
}
