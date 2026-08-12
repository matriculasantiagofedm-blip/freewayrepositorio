export const dynamic = 'force-static';
import { NextResponse } from 'next/server';

const EVO_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'freeway-crm';

// GET /api/whatsapp-instance/chats
// Usa mensajes ENTRANTES (fromMe: false) para extraer números reales de contactos.
// Los mensajes siempre tienen el JID real del remitente aunque los contactos usen @lid.
export async function GET() {
  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({ error: 'No configurado' }, { status: 503 });
  }

  try {
    const res = await fetch(`${EVO_URL}/chat/findMessages/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
      body: JSON.stringify({
        where: { fromMe: false },
        limit: 200,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ chats: [], error: `EvoAPI ${res.status}: ${txt}` });
    }

    const data = await res.json();
    const rawMessages: any[] = Array.isArray(data)
      ? data
      : (data?.messages || data?.data || []);

    // Extraer número del JID "@s.whatsapp.net"
    const parsePhone = (jid: string): string => {
      const num = (jid || '').replace(/@.*$/, '');
      if (!num || num === '0' || num.length < 7) return '';
      return num.startsWith('507') && num.length > 10 ? num.slice(3) : num;
    };

    // Deduplicar por remoteJid (un contacto por número)
    const seen = new Set<string>();
    const chats: any[] = [];

    for (const msg of rawMessages) {
      const jid: string = msg.key?.remoteJid || msg.remoteJid || '';
      // Solo números individuales reales
      if (!jid.endsWith('@s.whatsapp.net')) continue;
      if (seen.has(jid)) continue;
      seen.add(jid);

      const phone = parsePhone(jid);
      if (!phone) continue;

      chats.push({
        remoteJid: jid,
        phone,
        fullPhone: jid.replace(/@.*$/, ''),
        name: msg.pushName || msg.key?.participant || phone,
        lastMessage:
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '[Multimedia]',
        timestamp: msg.messageTimestamp || Date.now() / 1000,
      });
    }

    return NextResponse.json({
      chats,
      total: rawMessages.length,
      filteredCount: chats.length,
      _debug: rawMessages[0] ?? null,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message, chats: [] });
  }
}
