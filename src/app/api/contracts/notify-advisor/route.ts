export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

/**
 * API DE NOTIFICACIÓN AL ASESOR — CONTRATO NUEVO
 * 
 * Llamada desde enroll/page.tsx al completar la inscripción.
 * Envía al asesor (63814115) los datos del contrato + imagen del comprobante.
 * Usa Evolution API (freeway-crm) en lugar de Meta WhatsApp.
 */

const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-6437c.up.railway.app').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY || 'freeway2025secret';
const EVO_INSTANCE = 'freeway-crm'; // Número principal del asesor
const ADVISOR_NUMBER = '50763814115'; // Asesor principal (63814115 con código de país)

async function sendEvoText(to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({ number: to, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendEvoImage(to: string, base64: string, mimeType: string, caption: string): Promise<boolean> {
  try {
    const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const res = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({
        number: to,
        mediatype: 'image',
        mimetype: mimeType || 'image/jpeg',
        media: pureBase64,
        caption,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const {
      folio,
      clientName,
      clientPhone,
      clientEmail,
      coursePlan,
      vehicleTransmission,
      paymentReference,
      paymentAmount,
      paymentMethod,
      paypalConfirmed,
      contractId,
      base64Image,
      mimeType,
      theoreticalSchedule,
      practicalSchedules,
    } = await req.json();

    const isPayPal = paymentMethod === 'paypal' || paypalConfirmed === true;

    // 1. Mensaje al asesor
    const alertMsg = isPayPal
      ? `✅ *PAGO PAYPAL CONFIRMADO — INSCRIPCIÓN AUTOMÁTICA*

📋 *Folio:* ${String(folio || '').padStart(6, '0')}
👤 *Cliente:* ${clientName || 'N/A'}
📱 *Teléfono:* ${clientPhone || 'N/A'}
📧 *Email:* ${clientEmail || 'N/A'}
🚗 *Plan:* ${coursePlan || 'N/A'}
⚙️ *Transmisión:* ${vehicleTransmission || 'N/A'}
💳 *Método:* PayPal ✅
🔢 *ID Captura PayPal:* \`${paymentReference || 'N/A'}\`
💰 *Monto cobrado:* $${paymentAmount || 'N/A'}

🤖 *Este pago fue verificado automáticamente por PayPal.*
✅ *El contrato ya está activo en el sistema.*
🔗 Ver contrato: https://contracttime3-15048626-b65e6.web.app/contracts/${contractId || ''}`
      : `🔔 *NUEVA INSCRIPCIÓN WEB — VALIDAR*

📋 *Folio:* ${String(folio || '').padStart(6, '0')}
👤 *Cliente:* ${clientName || 'N/A'}
📱 *Teléfono:* ${clientPhone || 'N/A'}
📧 *Email:* ${clientEmail || 'N/A'}
🚗 *Plan:* ${coursePlan || 'N/A'}
⚙️ *Transmisión:* ${vehicleTransmission || 'N/A'}
📚 *Horario Teórico:* ${theoreticalSchedule || 'N/A'}
${practicalSchedules && practicalSchedules.length > 0 ? `🕐 *Clases Prácticas:*
${practicalSchedules.map((s: any, i: number) => `  • Clase ${i + 1}: ${s.date || 'N/A'} a las ${s.time || 'N/A'}`).join('\n')}` : ''}
💳 *Método de pago:* ${paymentMethod === 'yappy' ? 'Yappy' : paymentMethod === 'cubo' ? 'Tarjeta (Cubo)' : 'Efectivo / Transferencia'}
🔢 *Referencia:* ${paymentReference || 'N/A'}
💰 *Abono pagado:* $${paymentAmount || 'N/A'}

⬇️ *El comprobante está abajo. Valida y activa el contrato.*
🔗 Ver en sistema: https://www.contractimefedm.online/contracts/${contractId || ''}`;

    await sendEvoText(ADVISOR_NUMBER, alertMsg);

    // 2. Enviar imagen del comprobante si existe
    if (base64Image) {
      await sendEvoImage(
        ADVISOR_NUMBER,
        base64Image,
        mimeType || 'image/jpeg',
        `📷 Comprobante de ${clientName} — Folio ${String(folio || '').padStart(6, '0')} — Ref: ${paymentReference}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error notify-advisor:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
