import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  collection, doc, setDoc, addDoc, getDoc, updateDoc,
  serverTimestamp, query, where, getDocs,
} from 'firebase/firestore';
import { freewayInfo } from '@/lib/freeway-info';

// Inicializar Firebase
function getDb() {
  let app;
  let firestore;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    firestore = initializeFirestore(app, { experimentalForceLongPolling: true });
  } else {
    app = getApps()[0];
    firestore = getFirestore(app);
  }
  return firestore;
}

// Instancia → rol responsable
function getRoleForInstance(instanceName: string): string {
  if (instanceName === 'freeway-crm') return 'Ventas';
  if (instanceName === 'freeway-crm-2') return 'Ventas Externas';
  if (instanceName === 'freeway-crm-3') return 'Ventas Externas';
  return 'Ventas';
}

// Horario fuera de oficina: 5:30 PM – 7:30 AM (hora de Panamá, UTC-5)
function isAfterHours(): boolean {
  const now = new Date();
  const panamaMin = ((now.getUTCHours() * 60 + now.getUTCMinutes()) - 5 * 60 + 24 * 60) % (24 * 60);
  const h = panamaMin / 60;
  return h >= 17.5 || h < 7.5; // >= 5:30 PM o < 7:30 AM
}

// Verificar si el Auto-Bot está habilitado globalmente en Firestore
async function isAutoBotEnabled(firestore: any): Promise<boolean> {
  try {
    const snap = await getDoc(doc(firestore, 'settings', 'crm_config'));
    return snap.exists() ? !!snap.data()?.autobot_enabled : false;
  } catch {
    return false;
  }
}

// Descarga el media de Evolution API y retorna un data URL base64
async function fetchMediaFromEvolution(messageId: string, instanceName: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  try {
    const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
    const EVO_KEY = process.env.EVOLUTION_API_KEY || 'freeway2025secret';

    const res = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({ message: { key: { id: messageId } } }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.base64) return null;

    const mimeType = json.mimetype || 'image/jpeg';
    return { dataUrl: `data:${mimeType};base64,${json.base64}`, mimeType };
  } catch {
    return null;
  }
}

// Enviar mensaje de respuesta via Evolution API
async function sendEvoMessage(instanceName: string, to: string, text: string): Promise<boolean> {
  try {
    const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
    const EVO_KEY = process.env.EVOLUTION_API_KEY || 'freeway2025secret';
    const res = await fetch(`${EVO_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({ number: to, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// IA Gemini — responde solo si Auto-Bot está activo Y es horario fuera de oficina
async function handleAIResponse(
  firestore: any,
  leadId: string,
  from: string,
  newText: string,
  instanceName: string
) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
    // 1. Verificar horario (5:30 PM – 7:30 AM Panama)
    if (!isAfterHours()) return;
    // 2. Verificar que el Auto-Bot está habilitado globalmente
    if (!(await isAutoBotEnabled(firestore))) return;

    // Historial reciente
    const qMsgs = query(collection(firestore, `leads/${leadId}/messages`));
    const snap = await getDocs(qMsgs);
    const msgs = snap.docs.map(d => d.data());
    msgs.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
    const historyDocs = msgs.slice(-8);
    let history = historyDocs.map(m => `${m.sender === 'client' ? 'Cliente' : 'Freeway'}: ${m.text}`).join('\n');
    if (!history.endsWith(newText)) history += `\nCliente: ${newText}`;

    // Precios
    const pricesDoc = await getDoc(doc(firestore, 'settings', 'prices'));
    const prices = pricesDoc.exists() ? pricesDoc.data().values : null;
    let catalogText = 'CATÁLOGO OFICIAL DE PLANES Y PRECIOS:\n';
    if (prices) {
      for (const cat in prices) {
        catalogText += `CATEGORÍA ${cat.toUpperCase()}:\n`;
        for (const item in prices[cat]) catalogText += `- ${item}: $${prices[cat][item]}\n`;
      }
    } else {
      catalogText += '- Curso Auto Básico (8 Hrs) $133 | Plus (10 Hrs) $155 | Premium (12 Hrs) $180\n- Curso Moto Básico (8 Hrs) $115 | Plus (10 Hrs) $135 | Premium (12 Hrs) $155';
    }

    // Base de conocimiento
    const aiDoc = await getDoc(doc(firestore, 'settings', 'ai_knowledge'));
    let customKnowledge = freewayInfo;
    if (aiDoc.exists() && aiDoc.data()?.text && aiDoc.data().text.length > 50) {
      customKnowledge = aiDoc.data().text + '\n\n' + freewayInfo;
    }

    const prompt = `COMPORTAMIENTO OBLIGATORIO:
Eres un humano real (panameño amigable) trabajando en ventas por WhatsApp para "Freeway Escuela de Manejo" en Panamá.
Tu tono jamás debe sonar a robot, ni a inteligencia artificial, ni a menú de opciones. Habla normal, relajado, como escribirías tú en tu propio celular. Usa emojis pero sin exagerar. MANTÉN TUS RESPUESTAS CORTAS Y AL GRANO.

Misión: Conversar fluidamente, responder dudas usando la base de conocimientos, dar precios y guiar a inscripción. Si te hacen una pregunta difícil que no está en tu base o exigen un humano, di naturalmente algo como "Dame un segundito, te verifico eso con uno de mis compañeros..." Y OBLIGATORIAMENTE incluye la palabra secreta [HUMANO] al final de tu mensaje.

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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
        }),
      }
    );
    const data = await res.json();
    let aiText: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) return;
    aiText = aiText.trim();

    let pauseAi = false;
    if (aiText.includes('[HUMANO]')) {
      aiText = aiText.replace('[HUMANO]', '').trim();
      pauseAi = true;
    }

    // Enviar via Evolution API
    const sent = await sendEvoMessage(instanceName, from, aiText);
    if (sent) {
      await addDoc(collection(firestore, `leads/${leadId}/messages`), {
        text: aiText, sender: 'me', isAi: true, status: 'sent',
        time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
        timestamp: serverTimestamp(),
      });
      await updateDoc(doc(firestore, 'leads', leadId), {
        lastMessage: aiText, lastMessageAt: serverTimestamp(),
        ...(pauseAi && { ai_paused: true }),
      });
    }
  } catch (err) {
    console.error('[QR-webhook] AI error:', err);
  }
}

// Detección de comprobante de pago con Gemini Vision
async function handlePaymentCheck(
  firestore: any,
  leadId: string,
  from: string,
  instanceName: string,
  base64Image: string,
  mimeType: string,
  leadName: string
) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBLj7U7SlWJP9Eq_AjriJR5mXhUKn3lIWA';
    const NOTIFY_NUMBER = '50763814115'; // Asesor principal

    const visionRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Analiza esta imagen. ¿Es un comprobante, recibo o confirmación de pago (Yappy, transferencia bancaria, tarjeta, depósito, PayPal, ACH u otro)? Responde SOLO en este formato JSON exacto (sin markdown):\n{"esComprobante": true/false, "monto": "X.XX o null si no se ve", "metodo": "Yappy/Transferencia/Tarjeta/etc o null", "banco": "nombre del banco o null", "referencia": "número de referencia o null"}` },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
      }
    );
    const visionData = await visionRes.json();
    const visionText = visionData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    let result: any = null;
    try { result = JSON.parse(visionText); } catch { /* no es JSON */ }

    if (result?.esComprobante === true) {
      // Marcar lead como pagado
      await updateDoc(doc(firestore, 'leads', leadId), {
        status: 'pagado',
        paymentReceivedAt: serverTimestamp(),
        paymentAmount: result.monto || null,
        paymentMethod: result.metodo || null,
        paymentBank: result.banco || null,
        paymentReference: result.referencia || null,
      });

      // Guardar en subcolección de pagos
      await addDoc(collection(firestore, `leads/${leadId}/payment_receipts`), {
        monto: result.monto, metodo: result.metodo, banco: result.banco,
        referencia: result.referencia, receivedAt: serverTimestamp(),
      });

      // Confirmar al cliente
      const confirmMsg = `✅ ¡Listo! Recibimos tu comprobante de pago. En breve un asesor de Freeway confirmará tu matrícula. ¡Bienvenido(a) a la familia Freeway! 🎉`;
      await sendEvoMessage(instanceName, from, confirmMsg);
      await addDoc(collection(firestore, `leads/${leadId}/messages`), {
        text: confirmMsg, sender: 'me', isAi: true, status: 'sent',
        time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
        timestamp: serverTimestamp(),
      });

      // Notificar al asesor
      const notifyMsg = `🔔 *COMPROBANTE DE PAGO RECIBIDO*\n\n👤 *Cliente:* ${leadName}\n📱 *Teléfono:* +${from}\n💰 *Monto:* ${result.monto ? `$${result.monto}` : 'No detectado'}\n💳 *Método:* ${result.metodo || 'No detectado'}\n🏦 *Banco/Referencia:* ${result.referencia || 'N/A'}\n\n⚡ El lead fue marcado como *PAGADO* automáticamente.`;
      await sendEvoMessage(instanceName, NOTIFY_NUMBER, notifyMsg);

      // Notificación en Firestore
      await addDoc(collection(firestore, 'notifications'), {
        type: 'payment_received', leadId, clientName: leadName,
        clientPhone: from, amount: result.monto, method: result.metodo,
        reference: result.referencia, createdAt: serverTimestamp(), read: false,
      });

      // Secuencia de bienvenida (igual que el número principal)
      await new Promise(r => setTimeout(r, 3000));
      const welcome1 = `🎊 *¡Bienvenido(a) a Freeway Escuela de Manejo!*\n\nTu inscripción está siendo procesada por nuestro equipo. En las próximas horas recibirás la confirmación oficial de tu matrícula con el número de folio.\n\nMientras tanto, esto es lo que debes saber:`;
      await sendEvoMessage(instanceName, from, welcome1);
      await addDoc(collection(firestore, `leads/${leadId}/messages`), {
        text: welcome1, sender: 'me', isAi: true, status: 'sent',
        time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
        timestamp: serverTimestamp(),
      });

      await new Promise(r => setTimeout(r, 5000));
      const welcome2 = `📋 *Tus próximos pasos:*\n\n1️⃣ *Clases Teóricas:* Se realizan los Sábados de 3pm a 5pm o según tu horario acordado.\n\n2️⃣ *Clases Prácticas:* Un asesor te contactará para coordinar las fechas y vehículo asignado.\n\n3️⃣ *Documentos a traer:* Cédula original + copia (o pasaporte). Ropa cómoda para las prácticas.\n\n4️⃣ *Ubicación:* Costa Verde, La Chorrera, Green Plaza.\n   📍 https://maps.app.goo.gl/uF8NPvCFtZJWfQpj8\n\n¿Tienes alguna pregunta? Aquí estamos para ayudarte. 😊`;
      await sendEvoMessage(instanceName, from, welcome2);
      await addDoc(collection(firestore, `leads/${leadId}/messages`), {
        text: welcome2, sender: 'me', isAi: true, status: 'sent',
        time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
        timestamp: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('[QR-webhook] Payment check error:', err);
  }
}

// POST /api/whatsapp-instance/webhook
// Recibe eventos de Evolution API (QR).
// fromMe:false → mensaje del cliente → crea/actualiza lead
// fromMe:true  → mensaje enviado desde el celular → lo refleja en el CRM
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event: string = body.event || '';
    // Evolution API puede enviar data como objeto O como array → normalizar siempre
    const rawData: any = body.data || {};
    const data: any = Array.isArray(rawData) ? rawData[0] : rawData;
    // Evolution API envía el nombre de instancia en body.instance
    const instanceName: string = body.instance || process.env.EVOLUTION_INSTANCE || 'freeway-crm';

    // Solo eventos de mensajes nuevos
    if (event !== 'MESSAGES_UPSERT' && event !== 'messages.upsert') {
      return NextResponse.json({ ok: true });
    }

    const fromMe: boolean = data?.key?.fromMe === true;
    const remoteJid: string = data?.key?.remoteJid || '';

    // Solo números individuales reales (no grupos ni broadcasts)
    if (!remoteJid.endsWith('@s.whatsapp.net')) {
      return NextResponse.json({ ok: true });
    }

    const fullNum = remoteJid.replace('@s.whatsapp.net', '');
    if (!fullNum || fullNum === '0' || fullNum.length < 7) {
      return NextResponse.json({ ok: true });
    }

    // Normalizar: quitar código de país 507 (Panamá)
    const phone = fullNum.startsWith('507') && fullNum.length > 10
      ? fullNum.slice(3)
      : fullNum;

    // ── DETECTAR TIPO DE MENSAJE ──────────────────────────────────────────
    const msgType: string =
      data?.messageType ||
      (data?.message?.imageMessage    ? 'imageMessage'   :
       data?.message?.audioMessage    ? 'audioMessage'   :
       data?.message?.pttMessage      ? 'audioMessage'   :  // Nota de voz (PTT)
       data?.message?.videoMessage    ? 'videoMessage'   :
       data?.message?.documentMessage ? 'documentMessage' :
       'conversation');

    const msgText =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      (msgType === 'imageMessage'    ? '📷 Imagen'    :
       msgType === 'audioMessage'    ? '🎤 Audio'     :
       msgType === 'videoMessage'    ? '🎬 Video'     :
       msgType === 'documentMessage' ? '📄 Documento' :
       '[Multimedia]');

    // Extraer nombre del archivo para documentos
    const docFileName: string =
      data?.message?.documentMessage?.fileName ||
      data?.message?.documentMessage?.title ||
      '';

    // Obtener media (imagen, audio o documento) si aplica
    let mediaData: { dataUrl: string; mimeType: string } | null = null;
    const messageId: string = data?.key?.id || '';
    if ((msgType === 'imageMessage' || msgType === 'audioMessage' || msgType === 'videoMessage' || msgType === 'documentMessage') && messageId) {
      mediaData = await fetchMediaFromEvolution(messageId, instanceName);
    }

    const firestore = getDb();
    // ID universal por teléfono → mismo contacto = mismo lead sin importar la instancia
    const docId  = `whatsapp_${phone}`;
    const docRef = doc(firestore, 'leads', docId);

    if (fromMe) {
      // ── MENSAJE SALIENTE (enviado desde el celular) ──────────────────
      const snap = await getDoc(docRef);
      if (!snap.exists()) return NextResponse.json({ ok: true });

      const outMsg: Record<string, any> = {
        text:   msgText,
        sender: 'me',
        status: 'sent',
        sentFromPhone: true,
        time:   new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
        timestamp: serverTimestamp(),
      };
      if (mediaData) {
        outMsg.mediaUrl  = mediaData.dataUrl;
        outMsg.mediaType = msgType;
        outMsg.mimeType  = mediaData.mimeType;
      }
      if (docFileName) outMsg.fileName = docFileName;

      // Deduplicación para mensajes salientes también
      const evoOutId = data?.key?.id;
      if (evoOutId) {
        const outDocRef = doc(firestore, `leads/${docId}/messages`, evoOutId);
        const existingOut = await getDoc(outDocRef);
        if (!existingOut.exists()) {
          await setDoc(outDocRef, outMsg);
        }
      } else {
        await addDoc(collection(firestore, `leads/${docId}/messages`), outMsg);
      }

      await updateDoc(docRef, {
        lastMessage: msgText,
        lastMessageAt: serverTimestamp(),
      });
      return NextResponse.json({ ok: true, status: 'outgoing_saved', phone });
    }

    // ── MENSAJE ENTRANTE (del cliente) ──────────────────────────────────
    const name = data?.pushName || `WhatsApp ${phone.slice(-4)}`;
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      const targetRole = getRoleForInstance(instanceName);

      await setDoc(docRef, {
        name,
        phone,
        fullPhone: fullNum,
        source:     'WhatsApp QR',
        channel:    'whatsapp-qr',
        status:     'new',
        interest:   'General',
        lastMessage: msgText,
        lastMessageAt: serverTimestamp(),
        whatsappInstance: instanceName,
        assignedRole: targetRole,
        createdAt:  serverTimestamp(),
        folio: `QR-${phone.slice(-6)}`,
      }, { merge: true });
    } else {
      await updateDoc(docRef, {
        lastMessage: msgText,
        lastMessageAt: serverTimestamp(),
      });
    }

    const inMsg: Record<string, any> = {
      text:   msgText,
      sender: 'client',
      status: 'read',
      evoMessageId: data?.key?.id || null,
      time:   new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
      timestamp: serverTimestamp(),
    };
    if (mediaData) {
      inMsg.mediaUrl  = mediaData.dataUrl;
      inMsg.mediaType = msgType;
      inMsg.mimeType  = mediaData.mimeType;
    }
    if (docFileName) inMsg.fileName = docFileName;

    // Usar el ID de mensaje de Evolution como doc ID → evita duplicados si EVO reintenta
    const evoMsgId = data?.key?.id;
    if (evoMsgId) {
      const msgDocRef = doc(firestore, `leads/${docId}/messages`, evoMsgId);
      const existing = await getDoc(msgDocRef);
      if (existing.exists()) {
        // Mensaje ya procesado (reintento de EVO) → ignorar
        return NextResponse.json({ ok: true, status: 'duplicate_skipped' });
      }
      await setDoc(msgDocRef, inMsg);
    } else {
      await addDoc(collection(firestore, `leads/${docId}/messages`), inMsg);
    }

    // ── LEAD SCORING (igual que número principal) ─────────────────────
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
      try {
        const textLower = msgText.toLowerCase();
        const scoreUpdate: any = {}; // NO sobreescribir status — el lead permanece en su columna Kanban

        if (/\b(auto|carro|coche|automático|automatico|manual|picanto|sedan|4 ruedas)\b/.test(textLower)) {
          scoreUpdate.interest = textLower.includes('manual') ? 'Curso Auto Manual' : 'Curso Auto';
        } else if (/\b(moto|mototaxi|motocicleta|bike|delivery|domicilio|deliveri)\b/.test(textLower)) {
          scoreUpdate.interest = 'Curso Moto';
        } else if (/\b(deluxe|logística|logistica|delivery avanzado|profesional|cuotas)\b/.test(textLower)) {
          scoreUpdate.interest = 'Curso Deluxe';
        } else if (/\b(ampliación|ampliacion|categoria|categoría|licencia nueva)\b/.test(textLower)) {
          scoreUpdate.interest = 'Ampliación';
        }

        const hotKW = /\b(cuánto|cuanto|precio|costo|pago|inscrib|matricul|quiero|anoto|empez|inscripción|reserv|cupo|hoy|mañana|esta semana)\b/;
        const coldKW = /\b(info|información|solo pregunt|curiosidad|averiguando|luego|después|despues)\b/;
        scoreUpdate.heat = hotKW.test(textLower) ? 'hot' : coldKW.test(textLower) ? 'cold' : 'warm';

        if (/\b(ya pagué|ya pague|hice la transferencia|envié el yappy|envie el yappy|ya realicé|pagué|pague)\b/.test(textLower)) {
          scoreUpdate.mentioned_payment = true;
        }

        await updateDoc(docRef, scoreUpdate);
      } catch (err) {
        console.error('[QR-webhook] Scoring error:', err);
      }

      // ── IA GEMINI RESPONDE ───────────────────────────────────────────
      await handleAIResponse(firestore, docId, fullNum, msgText, instanceName).catch(console.error);
    }

    // ── DETECCIÓN DE COMPROBANTE (imagen recibida) ────────────────────
    if (msgType === 'imageMessage' && mediaData) {
      const base64Only = mediaData.dataUrl.split(',')[1] || '';
      const leadName = snap.exists() ? (snap.data()?.name || name) : name;
      await handlePaymentCheck(firestore, docId, fullNum, instanceName, base64Only, mediaData.mimeType, leadName).catch(console.error);
    }

    return NextResponse.json({ ok: true, status: snap.exists() ? 'updated' : 'created', phone });
  } catch (err: any) {
    console.error('[webhook-qr] Error:', err.message);
    return NextResponse.json({ ok: true }); // siempre 200 para Evolution API
  }
}

// GET — health check
export async function GET() {
  return NextResponse.json({ status: 'ok', version: '6.0-full-features' });
}
