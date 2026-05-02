import { NextRequest } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc, setDoc, limit } from 'firebase/firestore';

/**
 * WEBHOOK OMNICANAL - FREEWAY CRM
 * Soporta: WhatsApp, Facebook Messenger e Instagram Direct
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'db4e6a9c33ad62507459f8848d8aa255';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

async function getRandomAgentId() {
    try {
        let app;
        let firestore;
        if (getApps().length === 0) {
            app = initializeApp(firebaseConfig);
            firestore = initializeFirestore(app, { experimentalForceLongPolling: true });
        } else {
            app = getApps()[0];
            firestore = getFirestore(app);
        }
        const usersRef = collection(firestore, 'users_crm');
        const q = query(usersRef, where('role', '==', 'Agente'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return 'admin';
        
        const agents = snapshot.docs.map(doc => doc.id);
        const randomIndex = Math.floor(Math.random() * agents.length);
        return agents[randomIndex];
    } catch (error) {
        console.error("Error getting random agent:", error);
        return 'admin';
    }
}

export async function POST(req: NextRequest) {
  try {
    let app;
    let firestore;
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        firestore = initializeFirestore(app, { experimentalForceLongPolling: true });
    } else {
        app = getApps()[0];
        firestore = getFirestore(app);
    }
    if (!firestore) {
      console.error('Firebase no inicializado');
      return new Response('DB_OFF', { status: 500 });
    }

    const leadsRef = collection(firestore, 'leads');
    const body = await req.json();
    console.log("INCOMING WEBHOOK PAYLOAD:", JSON.stringify(body));

    try {
      await addDoc(collection(firestore, 'webhook_logs'), {
        receivedAt: serverTimestamp(),
        payload: body,
        headers: Object.fromEntries(req.headers.entries())
      });
    } catch (logErr) {
      console.error('Error saving webhook_log:', logErr);
    }

    const entry = body.entry?.[0];
    const platform = body.object === 'instagram' ? 'Instagram' : body.object === 'page' ? 'Facebook' : 'WhatsApp';

    if (entry?.changes?.[0]) {
      const change = entry.changes[0];
      const value = change.value;

      if (value?.messages?.[0]) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        const from = message.from; 
        const text = message.text?.body || "Mensaje multimedia";
        const name = contact?.profile?.name || `WhatsApp ${from.slice(-4)}`;
        const businessPhoneId = value?.metadata?.phone_number_id;

        const { leadId } = await findOrCreateLead(leadsRef, from, name, 'WhatsApp');
        await saveIncomingMessage(firestore, leadId, text);
        
        // Dispara la IA solo para WhatsApp
        await handleAIResponse(firestore, leadId, from, text, 'WhatsApp', businessPhoneId).catch(console.error);
      } else if (value?.item === 'comment' || value?.verb === 'add' || change.field === 'comments') {
        const fromId = value?.from?.id || "ID_SOCIAL";
        const fromName = value?.from?.username || value?.from?.name || `${platform} User`;
        const text = value?.text || value?.message || `(Multimedia/Sin Texto)`;
        
        const { leadId } = await findOrCreateLead(leadsRef, fromId, fromName, platform as any);
        await saveIncomingMessage(firestore, leadId, `COMENTARIO: ${text}`);
      }
    } else if (entry?.messaging?.[0]) {
      const messaging = entry.messaging[0];
      const senderId = messaging.sender?.id;
      const message = messaging.message;

      // Ignorar mensajes echo (enviados por nuestra propia página/bot) o recibos de lectura
      if (!senderId || !message || message.is_echo) {
        return new Response('OK', { status: 200 });
      }

      const text = message.text || (message.attachments ? "Mensaje multimedia" : "Mensaje");
      
      let senderName = `${platform} Usuario`;
      try {
          const token = process.env.INSTAGRAM_ACCESS_TOKEN || 'EAAR0VzJgjMwBRIgyGhXhgYZCBkZACKWlFYhULaehAFmVaog3lRxJLPtVLDyfrAAvQuVfgg1jyGSokuubcZAOVImN3ZAjAijg5kEcM0AZCxEfsE5kkqKWeQf4TkLzXLchLWZBkRkCtnBbve7i3Blzc5yC0coDkJYduT0jvMnkZCf4IGa2wmig8slPeZArsImBxJWaucEbsshKaFZCDtnlHVGDj1BUBXgZDZD';
          if (token && platform !== 'WhatsApp') {
              // Instagram solo soporta 'name' y 'profile_pic' en los IGSID, FB soporta nombres separados.
              const fields = platform === 'Instagram' ? 'name,profile_pic' : 'name,first_name,last_name,profile_pic';
              const profileRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${token}`);
              
              if (profileRes.ok) {
                  const profileData = await profileRes.json();
                  if (profileData.name || profileData.first_name) {
                      senderName = profileData.name || `${profileData.first_name} ${profileData.last_name || ''}`.trim();
                  }
              } else {
                  console.error("Error Graph API Profile:", await profileRes.text());
              }
          }
      } catch (e) {
          console.log("Error consultando nombre de perfil:", e);
      }
      
      const { leadId } = await findOrCreateLead(leadsRef, senderId, senderName, platform as any);
      await saveIncomingMessage(firestore, leadId, text);
      
      // Dispara la IA para IG/FB
      // COMENTADO A PETICION DEL USUARIO PARA QUE LA IA NO CONTESTE
      // if (text !== "Mensaje multimedia" && text !== "Mensaje") {
      //     await handleAIResponse(firestore, leadId, senderId, text, platform as string).catch(console.error);
      // }
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('CRITICAL Webhook error:', error);
    try {
       let app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
       let firestore = getFirestore(app);
       await addDoc(collection(firestore, 'webhook_logs'), {
           receivedAt: serverTimestamp(),
           error: error.message || String(error),
           stack: error.stack || ""
       });
    } catch (e) {}
    return new Response('Error', { status: 500 });
  }
}


async function saveIncomingMessage(firestore: any, leadId: string, text: string) {
    const messagesRef = collection(firestore, `leads/${leadId}/messages`);
    const leadDocRef = doc(firestore, 'leads', leadId);

    await addDoc(messagesRef, {
      text,
      sender: 'client',
      status: 'read',
      time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
      timestamp: serverTimestamp()
    });
    
    await updateDoc(leadDocRef, { 
        lastMessage: text, 
        lastMessageAt: serverTimestamp() 
    });
}

async function handleAIResponse(firestore: any, leadId: string, from: string, newText: string, platform: string = 'WhatsApp', businessPhoneId?: string) {
    console.log("Starting handleAIResponse for lead: ", leadId, " from: ", from);
    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
        if (!GEMINI_API_KEY) {
            console.error("NO GEMINI API KEY DETECTED");
            return;
        }

        // Check if ai_paused is true
        const leadDocSnapshot = await getDoc(doc(firestore, 'leads', leadId));
        if (leadDocSnapshot.exists() && leadDocSnapshot.data()?.ai_paused) {
            console.log("AI is paused for this lead. Opting out.");
            return;
        }

        // 1. Fetch conversation history
        const qMsgs = query(collection(firestore, `leads/${leadId}/messages`));
        const querySnapshot = await getDocs(qMsgs);
        const docs = querySnapshot.docs.map(d => d.data());
        docs.sort((a,b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
        
        // Include the new text as the latest since saveIncomingMessage may not have fully committed yet depending on timing,
        // Actually, we can just map docs safely. We'll append the new text explicitly if it's not the last one.
        const historyDocs = docs.slice(-8);
        let history = historyDocs.map(m => `${m.sender === 'client' ? 'Cliente' : 'Freeway'}: ${m.text}`).join('\n');
        if (!history.endsWith(newText)) {
            history += `\nCliente: ${newText}`;
        }

        // 2. Fetch Prices from ContractTime (Catálogo completo)
        const pricesDoc = await getDoc(doc(firestore, 'settings', 'prices'));
        const prices = pricesDoc.exists() ? pricesDoc.data().values : null;
        
        let catalogText = "CATÁLOGO OFICIAL DE PLANES Y PRECIOS (Úsalo siempre para cotizar, pero no mandes la lista completa de golpe a menos que te la pidan):\n";
        
        if (prices) {
            for (const cat in prices) {
                catalogText += `CATEGORÍA ${cat.toUpperCase()}:\n`;
                for (const item in prices[cat]) {
                    catalogText += `- ${item}: $${prices[cat][item]}\n`;
                }
            }
        } else {
            catalogText += "- Curso Auto Básico (8 Hrs) $133 | Plus (10 Hrs) $155 | Premium (12 Hrs) $180\n- Curso Moto Básico (8 Hrs) $115 | Plus (10 Hrs) $135 | Premium (12 Hrs) $155";
        }

        // 3. Fetch AI Knowledge Base
        const aiDoc = await getDoc(doc(firestore, 'settings', 'ai_knowledge'));
        let customKnowledge = "";
        if (aiDoc.exists() && aiDoc.data()?.text) {
            customKnowledge = aiDoc.data().text;
        } else {
            customKnowledge = `- El proceso para licencia por primera vez en Panamá requiere: 1. Hacer examen Teórico online y Práctico con nosotros. 2. Hacer examen de tipaje de sangre, validación auditiva y visual en cualquier clínica autorizada. 3. Ir a SERTRACEN a validar los certificados y sacar la licencia.
- Requisitos de inscripción con Freeway: Copia de Cédula (o Pasaporte/Carnet de Migración), Tipaje de Sangre, y abono inicial desde $30 o $40 (dependiendo del curso).
- Horarios de clases prácticas: Presencial de lunes a sábado de 7:30 am a 5:10 pm. Nos acoplamos a la disponibilidad del estudiante en clases de 2 a 4 horas diarias. (Domingos cerrado). Curso Teórico: 100% Online asincrónico 24/7.
- Métodos de pago: Banco General, Yappy, ACH, Tarjeta en sucursal. Ofrecemos pagos fraccionados mientras toman el curso.`;
        }

        const prompt = `COMPORTAMIENTO OBLIGATORIO:
Eres un humano real (panameño amigable) trabajando en ventas por WhatsApp e Instagram para "Freeway Escuela de Manejo" en Panamá.
Tu tono jamás debe sonar a robot, ni a inteligencia artificial, ni a menú de opciones. Habla normal, relajado, como escribirías tú en tu propio celular. Usa emojis pero sin exagerar. MANTÉN TUS RESPUESTAS CORTAS Y AL GRANO.

Misión: Conversar fluidamente, responder dudas usando la base de conocimientos, dar precios y guiar a inscripción. Si te hacen una pregunta difícil que no está en tu base o exigen un humano, di naturalmente algo como "Dame un segundito, te verifico eso con uno de mis compañeros..." Y OBLIGATORIAMENTE incluye la palabra secreta [HUMANO] al final de tu mensaje.
Si el usuario viene de Facebook o Instagram (${platform}), recuérdate al final invitarlo sutilmente a continuar por WhatsApp pidiendo su número para enviarle el mapa o darle seguimiento más rápido.

Base de Conocimientos Freeway:
${customKnowledge}

${catalogText}

Historial de conversación:
${history}

REGLA FINAL: Tu única tarea es leer este historial y contestar EXCLUSIVAMENTE al ULTIMO mensaje del cliente basándote estrictamente en el historial y la Base de Conocimientos. Hazlo directo, amable, cero robótico. NO inicies la frase diciendo "Freeway:" o tu nombre.`;

        console.log("Sending prompt to Gemini");
        // 3. Call Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 3000 }
            })
        });
        
        const data = await response.json();
        let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!aiText) {
            console.error("Gemini didn't return text", data);
            return; // Silent abort if AI fails
        }
        aiText = aiText.trim();
        
        let pauseAiForFuture = false;
        if (aiText.includes('[HUMANO]')) {
            aiText = aiText.replace('[HUMANO]', '').trim();
            pauseAiForFuture = true;
        }
        
        console.log("Gemini response: ", aiText);

        // 4. Send to Meta API depending on Platform
        let metaRes;
        
        if (platform === 'WhatsApp') {
            const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'EAAR0VzJgjMwBRGjRZBWiYRd9EwZAX0UGGIZC6TjNG0kTuxLNNudSqYpEpoV1dqRQLMzgaa1vJoLUgIvdT39nERilnSOUkM4OZClgbSxf1lVBLDxQ87ZBH0sEcFiKZAlynlESPe7qWzZC2q7dQr0ohSTEWlmKhIyxf9FSRlr3vCHMGgnuS1P0ZA0roRm2Vb77ZAIczRwZDZD';
            const PHONE_NUMBER_ID = businessPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '1045621595304134';

            metaRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: from, type: 'text', text: { body: aiText } }),
            });
        } else {
            // Instagram / Facebook
            const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || 'EAAR0VzJgjMwBRIgyGhXhgYZCBkZACKWlFYhULaehAFmVaog3lRxJLPtVLDyfrAAvQuVfgg1jyGSokuubcZAOVImN3ZAjAijg5kEcM0AZCxEfsE5kkqKWeQf4TkLzXLchLWZBkRkCtnBbve7i3Blzc5yC0coDkJYduT0jvMnkZCf4IGa2wmig8slPeZArsImBxJWaucEbsshKaFZCDtnlHVGDj1BUBXgZDZD';
            metaRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: { id: from }, message: { text: aiText } }),
            });
        }

        const metaJson = await metaRes.json();
        console.log("Meta Response: ", metaJson);

        // 5. Save AI message to Firestore
        if (metaRes.ok) {
            await addDoc(collection(firestore, `leads/${leadId}/messages`), {
                text: aiText,
                sender: 'me',
                isAi: true,
                status: 'sent',
                time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(firestore, 'leads', leadId), { 
                lastMessage: aiText, 
                lastMessageAt: serverTimestamp(),
                ...(pauseAiForFuture && { ai_paused: true })
            });
        }
    } catch (error) {
        console.error("AI Response Error:", error);
    }
}

async function findOrCreateLead(leadsRef: any, identifier: string, name: string, source: 'WhatsApp' | 'Facebook' | 'Instagram') {
    // Si Meta envía 3 webhooks simultáneos, se crean duplicados por race-condition si usamos addDoc.
    // Para evitarlo, usamos un ID predecible basado en el identificador único.
    const customDocId = `${source.toLowerCase()}_${identifier}`;
    const docRef = doc(leadsRef.firestore, 'leads', customDocId);
    
    const leadSnap = await getDoc(docRef);
    if (!leadSnap.exists()) {
      const assignedTo = await getRandomAgentId();
      const newLeadData = {
        name,
        socialId: source === 'WhatsApp' ? null : identifier,
        phone: source === 'WhatsApp' ? identifier : null,
        email: '',
        interest: 'General',
        source: source,
        status: 'new',
        assignedTo,
        createdAt: serverTimestamp(),
        folio: `FW-${customDocId.slice(-6).toUpperCase()}`
      };
      // Usamos setDoc con merge:true por si acaso entra otra petición 1 ms después
      await setDoc(docRef, newLeadData, { merge: true });
      return { leadId: customDocId };
    } else {
      // Si el nombre original era genérico y ahora tenemos el nombre real, lo actualizamos silenciosamente
      if (leadSnap.data().name.includes('User') && !name.includes('User')) {
        await updateDoc(docRef, { name });
      }
      return { leadId: customDocId };
    }
}
