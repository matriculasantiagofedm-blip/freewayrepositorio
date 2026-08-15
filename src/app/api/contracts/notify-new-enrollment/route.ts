export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

/**
 * API DE NOTIFICACION -- PRE-INSCRIPCION WEB (PASO 1)
 *
 * Llamada desde enroll/page.tsx cuando el estudiante reserva su cupo
 * (antes de realizar el pago). Notifica al asesor via WhatsApp.
 */

const EVO_URL = (process.env.EVOLUTION_API_URL || "https://evolution-api-production-6437c.up.railway.app").replace(/\/$/, "");
const EVO_KEY = process.env.EVOLUTION_API_KEY || "freeway2025secret";
const EVO_INSTANCE = "freeway-crm";
const ADVISOR_NUMBER = "50763814115";

async function sendEvoText(to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVO_KEY },
      body: JSON.stringify({ number: to, text }),
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
      theoreticalSchedule,
      practicalSchedules,
      contractId,
    } = await req.json();

    const practicalLines = Array.isArray(practicalSchedules) && practicalSchedules.length > 0
      ? "\n\u23F0 *Clases Practicas:*\n" + practicalSchedules.map((s: any, i: number) =>
          `  - Clase ${i + 1}: ${s.date || "N/A"} a las ${s.time || "N/A"}`
        ).join("\n")
      : "";

    const msg = [
      "\uD83C\uDD95 *NUEVA PRE-INSCRIPCION WEB \u2014 CUPO RESERVADO*",
      "",
      `\uD83D\uDCCB *Folio:* ${String(folio || "").padStart(6, "0")}`,
      `\uD83D\uDC64 *Estudiante:* ${clientName || "N/A"}`,
      `\uD83D\uDCF1 *Telefono:* ${clientPhone || "N/A"}`,
      `\uD83D\uDCE7 *Email:* ${clientEmail || "N/A"}`,
      `\uD83D\uDE97 *Plan:* ${coursePlan || "N/A"}`,
      `\u2699\uFE0F *Transmision:* ${vehicleTransmission || "N/A"}`,
      `\uD83D\uDCDA *Horario Teorico:* ${theoreticalSchedule || "N/A"}${practicalLines}`,
      "",
      "\u23F3 *El estudiante esta en proceso de pago.*",
      `\uD83D\uDD17 Ver en sistema: https://www.contractimefedm.online/contracts/${contractId || ""}`,
    ].join("\n");

    await sendEvoText(ADVISOR_NUMBER, msg);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error notify-new-enrollment:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
