export const dynamic = 'force-static';
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  collection, getDocs, query, where, doc, updateDoc,
  addDoc, serverTimestamp, Timestamp, getDoc
} from 'firebase/firestore';

/**
 * API DE SEGUIMIENTO AUTOMÁTICO — FREEWAY CRM
 * 
 * Llama este endpoint con un cron job externo (cron-job.org / Cloud Scheduler):
 *   GET https://contracttime3-15048626-b65e6.web.app/api/cron/followup
 *   Header: x-cron-token: [CRON_SECRET]
 * 
 * Ejecutar cada hora. Maneja:
 *   1. Leads nuevos sin respuesta (>2h) → mensaje de enganche
 *   2. Leads interesados sin pago (>24h) → urgencia + link
 *   3. Leads interesados sin pago (>48h) → oferta de contacto humano
 *   4. Recordatorio de saldo pendiente en contratos (cada lunes)
 */

const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
const EVO_KEY  = process.env.EVOLUTION_API_KEY  || 'freeway2025secret';
const CRON_SECRET = process.env.CRON_SECRET || 'freeway-cron-2025-secret';

// Envía un mensaje vía Evolution API usando la instancia correcta según el número
async function sendWhatsApp(phone: string, message: string, instance = 'freeway-crm') {
  try {
    // El número debe tener código de país (507XXXXXXXX)
    const to = phone.startsWith('507') ? phone : `507${phone}`;
    const res = await fetch(`${EVO_URL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({ number: to, text: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function saveFollowupMessage(firestore: any, leadId: string, text: string) {
  await addDoc(collection(firestore, `leads/${leadId}/messages`), {
    text,
    sender: 'me',
    isAi: true,
    status: 'sent',
    time: new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }),
    timestamp: serverTimestamp()
  });
  await updateDoc(doc(firestore, 'leads', leadId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp()
  });
}

export async function GET(req: NextRequest) {
  // Seguridad: verificar token
  const token = req.headers.get('x-cron-token') || req.nextUrl.searchParams.get('token');
  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let firestore: any;
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    firestore = getApps().length > 1 ? getFirestore(app) : initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    const app = getApps()[0];
    firestore = getFirestore(app);
  }

  const now = new Date();
  const stats = { followups: 0, urgency: 0, humanEscalations: 0, paymentReminders: 0, errors: 0 };

  try {
    const leadsSnap = await getDocs(collection(firestore, 'leads'));
    const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    for (const lead of leads) {
      // Solo leads de WhatsApp QR con teléfono y no pausados
      if (lead.channel !== 'whatsapp-qr' || !lead.phone || lead.ai_paused || lead.status === 'pagado') continue;

      // Usar la instancia del lead para enviar por el mismo número
      const instance = lead.whatsappInstance || 'freeway-crm';

      const lastAt: Date = lead.lastMessageAt?.toDate?.() || lead.createdAt?.toDate?.() || new Date(0);
      const hoursElapsed = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);

      const interest = lead.interest || 'General';
      const interestEmoji = interest.includes('Auto') ? '🚗' : interest.includes('Moto') ? '🏍️' : interest.includes('Deluxe') ? '🏆' : '📚';

      // ── CASO 1: Lead nuevo, sin respuesta nuestra >2h y <6h ──────────────
      if (lead.status === 'new' && hoursElapsed >= 2 && hoursElapsed < 6 && !lead.followup_1_sent) {
        const msg = `¡Hola! 👋 Somos Freeway Escuela de Manejo. Vi que nos escribiste y quería saber si tienes alguna pregunta sobre nuestros cursos ${interestEmoji}. ¡Estamos aquí para ayudarte!`;
        const sent = await sendWhatsApp(lead.phone, msg, instance);
        if (sent) {
          await saveFollowupMessage(firestore, lead.id, msg);
          await updateDoc(doc(firestore, 'leads', lead.id), { followup_1_sent: true, followup_1_at: serverTimestamp() });
          stats.followups++;
        }
      }

      // ── CASO 2: Lead interesado, sin pago >24h ───────────────────────────
      if (['interested', 'new'].includes(lead.status) && hoursElapsed >= 24 && hoursElapsed < 48 && !lead.followup_2_sent) {
        const msg = `¡Hola${lead.name ? ` ${lead.name.split(' ')[0]}` : ''}! 🙌 Quería avisarte que todavía tenemos cupos disponibles esta semana ${interestEmoji}. Los espacios se llenan rápido...\n\n¿Quieres asegurar el tuyo? Aquí puedes elegir tu horario y completar tu inscripción en 2 minutos:\n👉 https://www.contractimefedm.online/`;
        const sent = await sendWhatsApp(lead.phone, msg, instance);
        if (sent) {
          await saveFollowupMessage(firestore, lead.id, msg);
          await updateDoc(doc(firestore, 'leads', lead.id), {
            followup_2_sent: true,
            followup_2_at: serverTimestamp(),
            status: 'interested'
          });
          stats.urgency++;
        }
      }

      // ── CASO 3: Lead interesado, sin pago >48h → escalar a humano ────────
      if (['interested', 'new'].includes(lead.status) && hoursElapsed >= 48 && hoursElapsed < 72 && !lead.followup_3_sent) {
        const msg = `¡Hola! 😊 Soy ${['Emmanuel', 'Adrian'][Math.floor(Math.random() * 2)]}, asesor de Freeway. Vi que estuviste consultando sobre nuestros cursos y quería hablar contigo personalmente para ayudarte a inscribirte.\n\n¿Tienes alguna duda o te gustaría que te explique los planes disponibles? 🤝`;
        const sent = await sendWhatsApp(lead.phone, msg, instance);
        if (sent) {
          await saveFollowupMessage(firestore, lead.id, msg);
          await updateDoc(doc(firestore, 'leads', lead.id), {
            followup_3_sent: true,
            followup_3_at: serverTimestamp(),
            ai_paused: true // Pasar a humano
          });
          // Notificar al equipo
          await addDoc(collection(firestore, 'notifications'), {
            type: 'lead_escalated',
            leadId: lead.id,
            clientName: lead.name,
            clientPhone: lead.phone,
            message: 'Lead sin conversión >48h. Asignado a asesor humano.',
            createdAt: serverTimestamp(),
            read: false
          });
          stats.humanEscalations++;
        }
      }
    }

    // ── RECORDATORIOS DE SALDO (contratos activos con balance > 0) ──────────
    // Solo ejecutar los lunes
    if (now.getDay() === 1) {
      const contractsSnap = await getDocs(
        query(collection(firestore, 'contracts'), where('status', '==', 'active'))
      );

      for (const contractDoc of contractsSnap.docs) {
        const c = contractDoc.data() as any;
        const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;
        const balance = details?.balance || 0;
        const phone = details?.studentPhone1;

        if (balance > 0 && phone && !c.balanceReminderSentAt) {
          const clientName = c.clientName?.split(' ')[0] || 'Estudiante';
          const msg = `¡Hola ${clientName}! 👋 Te recordamos que tienes un saldo pendiente de *$${balance.toFixed(2)}* en tu curso de Freeway 📚.\n\nPuedes ponerte al día cuando gustes. Cualquier consulta escríbenos aquí. ¡Gracias! 🙏`;
          const sent = await sendWhatsApp(phone, msg, 'freeway-crm');
          if (sent) {
            await updateDoc(doc(firestore, 'contracts', contractDoc.id), {
              balanceReminderSentAt: serverTimestamp()
            });
            stats.paymentReminders++;
          }
        }
      }
    }

  } catch (err: any) {
    stats.errors++;
    console.error('Cron error:', err.message);
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    stats
  });
}
