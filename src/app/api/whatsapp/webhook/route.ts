import { NextRequest } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc, setDoc, limit } from 'firebase/firestore';
import { freewayInfo } from '@/lib/freeway-info';

/**
 * WEBHOOK OMNICANAL - FREEWAY CRM
 * Soporta: WhatsApp y Facebook Messenger
 * INSTAGRAM: Desactivado temporalmente (pendiente aprobación de Meta)
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
  // ── Número 61701450 (Meta WhatsApp Business API) DESACTIVADO ──────────────
  // Todos los números ahora operan vía Evolution API (QR).
  // Este webhook ya no procesa mensajes.
  return new Response('OK', { status: 200 });
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

    // INSTAGRAM DESACTIVADO: Meta aún no aprobó los permisos de respuesta.
    // Se acepta el webhook (200 OK) para que Meta no reintente, pero no se procesa.
    if (platform === 'Instagram') {
      console.log('Instagram webhook recibido pero ignorado (pendiente aprobación Meta)');
      return new Response('OK', { status: 200 });
    }

    if (entry?.changes?.[0]) {
      const change = entry.changes[0];
      const value = change.value;

      if (value?.messages?.[0]) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        const from = message.from; 
        const name = contact?.profile?.name || `WhatsApp ${from.slice(-4)}`;
        const businessPhoneId = value?.metadata?.phone_number_id;
        const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'EAAR0VzJgjMwBRGjRZBWiYRd9EwZAX0UGGIZC6TjNG0kTuxLNNudSqYpEpoV1dqRQLMzgaa1vJoLUgIvdT39nERilnSOUkM4OZClgbSxf1lVBLDxQ87ZBH0sEcFiKZAlynlESPe7qWzZC2q7dQr0ohSTEWlmKhIyxf9FSRlr3vCHMGgnuS1P0ZA0roRm2Vb77ZAIczRwZDZD';
        const PHONE_NUMBER_ID = businessPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '1045621595304134';
        const NOTIFY_NUMBER = '50763814115'; // Número del asesor principal para recibir alertas

        const { leadId } = await findOrCreateLead(leadsRef, from, name, 'WhatsApp');

        // ── DETECCIÓN DE COMPROBANTE DE PAGO (imagen) ──────────────────────────────
        const isImage = message.type === 'image' || message.type === 'document';
        if (isImage) {
          const mediaId = message.image?.id || message.document?.id;
          const caption = message.image?.caption || message.document?.caption || '';
          await saveIncomingMessage(firestore, leadId, caption ? `[Imagen] ${caption}` : '[Imagen adjunta]');

          // Descargar URL de la imagen desde Meta
          try {
            const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
              headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
            });
            const mediaData = await mediaRes.json();
            const mediaUrl = mediaData?.url;

            if (mediaUrl) {
              // Descargar los bytes de la imagen para enviarla a Gemini Vision
              const imgRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
              const imgBuffer = await imgRes.arrayBuffer();
              const base64Image = Buffer.from(imgBuffer).toString('base64');
              const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

              // Analizar con Gemini Vision si es un comprobante de pago
              const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
              const visionRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { text: `Analiza esta imagen. ¿Es un comprobante, recibo o confirmación de pago (Yappy, transferencia bancaria, tarjeta, depósito, PayPal, ACH u otro)? Responde SOLO en este formato JSON exacto (sin markdown):
{"esComprobante": true/false, "monto": "X.XX o null si no se ve", "metodo": "Yappy/Transferencia/Tarjeta/etc o null", "banco": "nombre del banco o null", "referencia": "número de referencia o null"}` },
                        { inline_data: { mime_type: mimeType, data: base64Image } }
                      ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
                  })
                }
              );
              const visionData = await visionRes.json();
              const visionText = visionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

              let visionResult: any = null;
              try { visionResult = JSON.parse(visionText); } catch { /* no es JSON válido */ }

              if (visionResult?.esComprobante === true) {
                // ✅ ES UN COMPROBANTE → Actualizar estado del lead a "pagado"
                const leadRef = doc(firestore, 'leads', leadId);
                await updateDoc(leadRef, {
                  status: 'pagado',
                  paymentReceivedAt: serverTimestamp(),
                  paymentAmount: visionResult.monto || null,
                  paymentMethod: visionResult.metodo || null,
                  paymentBank: visionResult.banco || null,
                  paymentReference: visionResult.referencia || null,
                });

                // Guardar el comprobante en subcolección de pagos del lead
                await addDoc(collection(firestore, `leads/${leadId}/payment_receipts`), {
                  mediaId,
                  monto: visionResult.monto,
                  metodo: visionResult.metodo,
                  banco: visionResult.banco,
                  referencia: visionResult.referencia,
                  receivedAt: serverTimestamp(),
                });

                // 📲 Confirmar al cliente que se recibió el comprobante
                const confirmMsg = `✅ ¡Listo! Recibimos tu comprobante de pago. En breve un asesor de Freeway confirmará tu matrícula. ¡Bienvenido(a) a la familia Freeway! 🎉`;
                await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: confirmMsg } })
                });
                await addDoc(collection(firestore, `leads/${leadId}/messages`), {
                  text: confirmMsg, sender: 'me', isAi: true, status: 'sent',
                  time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
                  timestamp: serverTimestamp()
                });

                // 🔔 Notificar al asesor con los datos del cliente y el monto
                const leadSnap = await getDoc(doc(firestore, 'leads', leadId));
                const clientName = leadSnap.data()?.name || name;
                const notifyMsg = `🔔 *COMPROBANTE DE PAGO RECIBIDO*\n\n👤 *Cliente:* ${clientName}\n📱 *Teléfono:* +${from}\n💰 *Monto:* ${visionResult.monto ? `$${visionResult.monto}` : 'No detectado'}\n💳 *Método:* ${visionResult.metodo || 'No detectado'}\n🏦 *Banco/Referencia:* ${visionResult.referencia || 'N/A'}\n\n⚡ El lead fue marcado como *PAGADO* automáticamente.\nCrea el contrato en Contract Time para cerrar la venta.`;
                await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messaging_product: 'whatsapp', to: NOTIFY_NUMBER, type: 'text', text: { body: notifyMsg } })
                });

                // Guardar notificación en Firestore para el CRM
                await addDoc(collection(firestore, 'notifications'), {
                  type: 'payment_received',
                  leadId,
                  clientName,
                  clientPhone: from,
                  amount: visionResult.monto,
                  method: visionResult.metodo,
                  reference: visionResult.referencia,
                  createdAt: serverTimestamp(),
                  read: false,
                });

                // 🎉 SECUENCIA DE BIENVENIDA POST-PAGO (2 mensajes automáticos)
                // Mensaje 1: Confirmación y próximos pasos (tras 3 segundos)
                await new Promise(r => setTimeout(r, 3000));
                const welcomeMsg1 = `🎊 *¡Bienvenido(a) a Freeway Escuela de Manejo!*\n\nTu inscripción está siendo procesada por nuestro equipo. En las próximas horas recibirás la confirmación oficial de tu matrícula con el número de folio.\n\nMientras tanto, esto es lo que debes saber:`;
                await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: welcomeMsg1 } })
                });
                await addDoc(collection(firestore, `leads/${leadId}/messages`), {
                  text: welcomeMsg1, sender: 'me', isAi: true, status: 'sent',
                  time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
                  timestamp: serverTimestamp()
                });

                // Mensaje 2: Instrucciones completas (tras 5 segundos más)
                await new Promise(r => setTimeout(r, 5000));
                const welcomeMsg2 = `📋 *Tus próximos pasos:*\n\n1️⃣ *Clases Teóricas:* Se realizan los Sábados de 3pm a 5pm o según tu horario acordado.\n\n2️⃣ *Clases Prácticas:* Un asesor te contactará para coordinar las fechas y vehículo asignado.\n\n3️⃣ *Documentos a traer:* Cédula original + copia (o pasaporte). Ropa cómoda para las prácticas.\n\n4️⃣ *Ubicación:* Costa Verde, La Chorrera, Green Plaza.\n   📍 https://maps.app.goo.gl/uF8NPvCFtZJWfQpj8\n\n¿Tienes alguna pregunta? Aquí estamos para ayudarte. 😊`;
                await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: welcomeMsg2 } })
                });
                await addDoc(collection(firestore, `leads/${leadId}/messages`), {
                  text: welcomeMsg2, sender: 'me', isAi: true, status: 'sent',
                  time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
                  timestamp: serverTimestamp()
                });

                return new Response('OK', { status: 200 });
              }
            }
          } catch (visionErr) {
            console.error('Error analizando imagen de comprobante:', visionErr);
          }

          // Si la imagen no es comprobante, procesar normalmente sin pasar por IA de texto
          return new Response('OK', { status: 200 });
        }
        // ── FIN DETECCIÓN DE COMPROBANTE ───────────────────────────────────────────

        const text = message.text?.body || 'Mensaje';
        await saveIncomingMessage(firestore, leadId, text);

        // ── DETECCIÓN DE INTENCIÓN Y LEAD SCORING ─────────────────────────────────
        try {
          const textLower = text.toLowerCase();
          const leadRef = doc(firestore, 'leads', leadId);
          const updatePayload: any = { status: 'interested' };

          // Clasificar interés
          if (/\b(auto|carro|coche|automático|automatico|manual|picanto|sedan|4 ruedas)\b/.test(textLower)) {
            updatePayload.interest = textLower.includes('manual') ? 'Curso Auto Manual' : 'Curso Auto';
          } else if (/\b(moto|mototaxi|motocicleta|bike|delivery|domicilio|deliveri)\b/.test(textLower)) {
            updatePayload.interest = 'Curso Moto';
          } else if (/\b(deluxe|logística|logistica|delivery avanzado|profesional|installment|cuotas)\b/.test(textLower)) {
            updatePayload.interest = 'Curso Deluxe';
          } else if (/\b(ampliación|ampliacion|categoria|categoría|licencia nueva)\b/.test(textLower)) {
            updatePayload.interest = 'Ampliación';
          }

          // Lead scoring: heat level
          const hotKeywords = /\b(cuánto|cuanto|precio|costo|pago|inscrib|matricul|quiero|anoto|empez|inscripción|reserv|cupo|hoy|mañana|esta semana)\b/;
          const coldKeywords = /\b(info|información|solo pregunt|curiosidad|averiguando|luego|después|despues)\b/;
          
          if (hotKeywords.test(textLower)) {
            updatePayload.heat = 'hot';
          } else if (coldKeywords.test(textLower)) {
            updatePayload.heat = 'cold';
          } else {
            updatePayload.heat = 'warm';
          }

          // Si menciona ya haber pagado → recordar comprobante
          if (/\b(ya pagué|ya pague|hice la transferencia|envié el yappy|envie el yappy|ya realicé|ya realize|pagué|pague)\b/.test(textLower)) {
            updatePayload.mentioned_payment = true;
          }

          await updateDoc(leadRef, updatePayload);
        } catch (scoreErr) {
          console.error('Error en lead scoring:', scoreErr);
        }
        // ── FIN DETECCIÓN DE INTENCIÓN ─────────────────────────────────────────────

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

        // ── Horario: Auto-Bot solo activo de 5:30 PM a 7:30 AM (Panama UTC-5) ──
        const nowUTCmin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
        const panamaMin = ((nowUTCmin - 5 * 60) + 24 * 60) % (24 * 60);
        const panamaHour = panamaMin / 60;
        const isAfterHours = panamaHour >= 17.5 || panamaHour < 7.5;
        if (!isAfterHours) {
            console.log(`[Meta webhook] Horario de oficina (${panamaHour.toFixed(1)}h Panama) → IA no responde.`);
            return;
        }
        // Verificar que el Auto-Bot global está habilitado
        const cfgSnap = await getDoc(doc(firestore, 'settings', 'crm_config'));
        const autoBotEnabled = cfgSnap.exists() ? !!cfgSnap.data()?.autobot_enabled : false;
        if (!autoBotEnabled) {
            console.log('[Meta webhook] Auto-Bot deshabilitado → IA no responde.');
            return;
        }
        // ─────────────────────────────────────────────────────────────────────────

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
        let customKnowledge = freewayInfo; // Fallback a la base de conocimiento oficial
        if (aiDoc.exists() && aiDoc.data()?.text && aiDoc.data().text.length > 50) {
            // Si hay conocimiento personalizado en Firestore, combinar con el oficial
            customKnowledge = aiDoc.data().text + '\n\n' + freewayInfo;
        }

        const prompt = `COMPORTAMIENTO OBLIGATORIO:
Eres un humano real (panameño amigable) trabajando en ventas por WhatsApp e Instagram para "Freeway Escuela de Manejo" en Panamá.
Tu tono jamás debe sonar a robot, ni a inteligencia artificial, ni a menú de opciones. Habla normal, relajado, como escribirías tú en tu propio celular. Usa emojis pero sin exagerar. MANTÉN TUS RESPUESTAS CORTAS Y AL GRANO.

Misión: Conversar fluidamente, responder dudas usando la base de conocimientos, dar precios y guiar a inscripción. Si te hacen una pregunta difícil que no está en tu base o exigen un humano, di naturalmente algo como "Dame un segundito, te verifico eso con uno de mis compañeros..." Y OBLIGATORIAMENTE incluye la palabra secreta [HUMANO] al final de tu mensaje.
Si el usuario viene de Facebook o Instagram (${platform}), recuérdate al final invitarlo sutilmente a continuar por WhatsApp pidiendo su número para enviarle el mapa o darle seguimiento más rápido.

INSTRUCCIÓN CRÍTICA DE CIERRE DE VENTA:
Si el cliente menciona que ya pagó, que hizo la transferencia, que envió el Yappy, que realizó el pago, o cualquier confirmación de pago, responde SIEMPRE pidiéndole que envíe el comprobante/captura de pantalla POR ESTE MISMO CHAT.
Ejemplo: "¡Perfecto! 🎉 Para confirmar tu matrícula solo envíanos aquí la captura o foto del comprobante de pago."
Cuando detectes que el cliente está listo para pagar, envíale la dirección de inscripción: https://www.contractimefedm.online/

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
