/**
 * schedule-context.ts
 * Construye el texto de agenda compacto para el Consultor IA.
 * Se ejecuta CLIENT-SIDE (con auth) para poder leer contracts y manual_schedules.
 */

export const TIME_SLOTS = ['8am-10am', '10am-12pm', '1pm-3pm', '3pm-5pm'] as const;

export const SLOT_LABELS: Record<string, string> = {
    '8am-10am':  '08:00-10:00',
    '10am-12pm': '10:00-12:00',
    '1pm-3pm':   '13:00-15:00',
    '3pm-5pm':   '15:00-17:00',
};

export const TIME_STRING_MAP: Record<string, string> = {
    // Formatos conocidos del sistema
    '08:00am a 10:00am': '8am-10am',
    '10:00am a 12:00pm': '10am-12pm',
    '01:00pm a 03:00pm': '1pm-3pm',
    '03:00pm a 05:00pm': '3pm-5pm',
    '8:00am a 10:00am':  '8am-10am',
    '1:00pm a 3:00pm':   '1pm-3pm',
    '10:00am a 12:00m':  '10am-12pm',
    '08:00 a 10:00':     '8am-10am',
    '10:00 a 12:00':     '10am-12pm',
    '13:00 a 15:00':     '1pm-3pm',
    '15:00 a 17:00':     '3pm-5pm',
    // También mapear los propios slot IDs (ya están en el formato correcto)
    '8am-10am':  '8am-10am',
    '10am-12pm': '10am-12pm',
    '1pm-3pm':   '1pm-3pm',
    '3pm-5pm':   '3pm-5pm',
};

export const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
export const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/** Capacidad real según reglas ATTT */
export function getCapacity(dayOfWeek: number, slotId: string): number {
    if (dayOfWeek === 0) return 0;                                    // Domingo cerrado
    if (dayOfWeek >= 2 && dayOfWeek <= 5 && slotId === '8am-10am') return 3; // Lun-Vie 8am = Teoría
    if (dayOfWeek === 6 && slotId === '3pm-5pm') return 3;           // Sáb 3pm = Teoría
    return 4;
}

export function fmtDate(d: Date): string {
    return d.toISOString().split('T')[0]; // yyyy-MM-dd
}

export function addDays(d: Date, n: number): Date {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export function mondayOf(d: Date): Date {
    const r = new Date(d);
    const day = r.getDay();
    r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
    r.setHours(0, 0, 0, 0);
    return r;
}

export function toDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();  // Firestore Timestamp (client SDK)
    if (val.seconds !== undefined) return new Date(val.seconds * 1000);
    if (val._seconds !== undefined) return new Date(val._seconds * 1000);
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

interface Entry {
    student: string;
    vehicle: string;
    transmission: string;
    instructor: string;
    status: string;
}

/**
 * Construye el texto compacto de agenda semanal (90 días) a partir de datos de Firestore.
 * @param contracts  Todos los documentos de la colección 'contracts' (activos/completados)
 * @param manualEntries  Documentos de 'manual_schedules' en el rango de fechas
 */
export function buildScheduleContext(contracts: any[], manualEntries: any[]): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endDate = addDays(today, 90); endDate.setHours(23, 59, 59, 999);

    const schedMap: Record<string, Entry[]> = {};
    const seen = new Set<string>();

    const addEntry = (date: Date, slotId: string, e: Entry) => {
        const k = `${fmtDate(date)}|${slotId}`;
        const fp = `${e.student}|${fmtDate(date)}|${slotId}|${e.vehicle}`.toLowerCase();
        if (seen.has(fp)) return;
        seen.add(fp);
        if (!schedMap[k]) schedMap[k] = [];
        schedMap[k].push(e);
    };

    // ── Contratos ────────────────────────────────────────────────────────────
    contracts.forEach(c => {
        const details = c.autoMotoDetails || c.deluxeDetails || c.ampliacionesDetails;

        const processSlots = (slots: any[], typeLabel: string) => {
            if (!Array.isArray(slots)) return;
            slots.forEach((s: any, idx: number) => {
                const slotDate = toDate(s.date);
                if (!slotDate || slotDate < today || slotDate > endDate) return;
                const slotId = TIME_STRING_MAP[s.time] || s.timeSlot || s.time;
                if (!slotId || !TIME_SLOTS.includes(slotId as any)) return;
                addEntry(slotDate, slotId, {
                    student: c.clientName || 'Alumno',
                    vehicle: s.vehicle || '',
                    transmission: typeLabel === 'moto' ? 'Moto' : (details?.vehicleTransmission || ''),
                    instructor: s.instructor || '',
                    status: s.status || 'scheduled',
                });
            });
        };

        if (c.autoMotoDetails?.practicalClassSchedules)
            processSlots(c.autoMotoDetails.practicalClassSchedules, 'auto');
        if (c.autoMotoDetails?.motoPracticalClassSchedules)
            processSlots(c.autoMotoDetails.motoPracticalClassSchedules, 'moto');
        if (c.deluxeDetails?.classSchedules)
            processSlots(c.deluxeDetails.classSchedules, 'deluxe');
    });

    // ── Manual schedules ─────────────────────────────────────────────────────
    manualEntries.forEach(e => {
        if (!e.date || !e.timeSlot) return;
        const slotDate = toDate(e.date);
        if (!slotDate || slotDate < today || slotDate > endDate) return;
        const slotId = TIME_STRING_MAP[e.timeSlot] || e.timeSlot;
        if (!slotId || !TIME_SLOTS.includes(slotId as any)) return;
        addEntry(slotDate, slotId, {
            student: e.studentName || 'Alumno',
            vehicle: e.vehicle || '',
            transmission: (e.vehicle || '').toUpperCase().includes('MOTO') ? 'Moto' : (e.transmission || ''),
            instructor: e.instructor || '',
            status: e.status || 'scheduled',
        });
    });

    // ── Texto compacto por semana ─────────────────────────────────────────────
    let text = `AGENDA PRÁCTICA — PRÓXIMOS 90 DÍAS (${today.getDate()}/${today.getMonth()+1} → ${endDate.getDate()}/${endDate.getMonth()+1})\n`;
    text += `Autos Automáticos: Skoda Automatico, Spark | Autos Manuales: Picanto Blanco, Picanto Bronce, Hyundai Manual, Skoda Manual | Motos: Moto Roja, Moto Negra\n`;
    text += `Capacidad: 4/turno (excepto Lun-Vie 08-10 y Sáb 15-17 = 3, teóricos)\n\n`;

    let cursor = mondayOf(today);
    while (cursor <= endDate) {
        const wEnd = addDays(cursor, 6);
        const wLabel = `${cursor.getDate()} ${MONTHS_ES[cursor.getMonth()]} – ${wEnd.getDate()} ${MONTHS_ES[wEnd.getMonth()]}`;

        let weekHasData = false;
        const weekLines: string[] = [];

        for (let d = 0; d < 7; d++) {
            const day = addDays(cursor, d);
            if (day < today || day > endDate) continue;
            const dow = day.getDay();
            if (dow === 0) continue; // domingo

            const dayStr = fmtDate(day);
            const dayLabel = `${DAYS_ES[dow]} ${day.getDate()}/${day.getMonth()+1}`;
            const parts: string[] = [];

            for (const slotId of TIME_SLOTS) {
                const cap = getCapacity(dow, slotId);
                const sessions = schedMap[`${dayStr}|${slotId}`] || [];
                // No contar canceladas/reagendadas en el cómputo de capacidad
                const active = sessions.filter(s => s.status !== 'cancelled_vehicle' && s.status !== 'rescheduled');
                const occupied = active.length;
                const free = cap - occupied;

                const vehicles = [...new Set(active.map(s => s.vehicle))].filter(Boolean);
                const autoVehicles = vehicles.filter(v => /skoda automatico|spark/i.test(v));
                const manualVehicles = vehicles.filter(v => /picanto|hyundai|skoda manual/i.test(v));
                const motoVehicles = vehicles.filter(v => /moto/i.test(v));

                let detail = '';
                if (vehicles.length > 0) {
                    const parts2: string[] = [];
                    if (autoVehicles.length) parts2.push(`AUTO:${autoVehicles.join('+')}(${autoVehicles.length})`);
                    if (manualVehicles.length) parts2.push(`MAN:${manualVehicles.join('+')}(${manualVehicles.length})`);
                    if (motoVehicles.length) parts2.push(`MOTO:${motoVehicles.join('+')}(${motoVehicles.length})`);
                    detail = `[${parts2.join('|')}]`;
                }

                if (occupied === 0) {
                    parts.push(`${SLOT_LABELS[slotId]}:LIBRE(${cap}esp)`);
                } else if (free <= 0) {
                    parts.push(`${SLOT_LABELS[slotId]}:LLENO${detail}`);
                } else {
                    parts.push(`${SLOT_LABELS[slotId]}:${occupied}/${cap}libre=${free}${detail}`);
                }
                if (occupied > 0) weekHasData = true;
            }
            weekLines.push(`  ${dayLabel}: ${parts.join(' | ')}`);
        }

        text += `📅 ${wLabel}:\n`;
        if (!weekHasData) {
            text += `  ✅ Toda la semana LIBRE (sin clases agendadas)\n`;
        } else {
            text += weekLines.join('\n') + '\n';
        }
        text += '\n';
        cursor = addDays(cursor, 7);
    }

    return text;
}
