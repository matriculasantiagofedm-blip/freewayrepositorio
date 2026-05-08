'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    isBefore, parseISO, startOfDay, format as formatDate,
    startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertCircle, Star, CalendarClock, ChevronDown,
    ChevronLeft, ChevronRight, ShieldAlert, CheckCircle2,
    Loader2, Activity, Search, QrCode
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INSTRUCTORS = [
    { id: '1', name: 'Emmanuel Camargo' },
    { id: '2', name: 'Adrian Gordon' },
    { id: '3', name: 'Roberto Brown' },
    { id: '4', name: 'Marco Franco' },
];

// Parsea la hora de inicio de un timeSlot como "8:00am a 10:00am" -> 8
const parseSlotHour = (slot: string): number => {
    if (!slot) return 99;
    const match = slot.match(/(\d+):(\d+)(am|pm)/i);
    if (!match) return 99;
    let h = parseInt(match[1]);
    const ampm = match[3].toLowerCase();
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return h;
};

// Parsea la hora de FINALIZACIÓN de un timeSlot como "8:00am a 10:00am" -> 10
const parseSlotEndHour = (slot: string): number => {
    if (!slot) return 0;
    const parts = slot.split(' a ');
    if (parts.length < 2) return 0;
    return parseSlotHour(parts[1].trim());
};

export default function QualityMonitoringPage() {
    const db = useDb();
    const [isLoading, setIsLoading] = useState(true);
    const [rawClasses, setRawClasses] = useState<any[]>([]);
    const [rawBitacoras, setRawBitacoras] = useState<any[]>([]);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [now, setNow] = useState<Date>(new Date()); // reloj en tiempo real
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);

    // Reloj en tiempo real — refresca cada minuto para actualizar elegibilidad de turnos
    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(tick);
    }, []);

    // Escuchas en tiempo real con onSnapshot
    useEffect(() => {
        if (!db) return;
        let loaded = { schedules: false, contracts: false, bitacoras: false };
        const tryDone = () => {
            if (loaded.schedules && loaded.contracts && loaded.bitacoras) setIsLoading(false);
        };

        const unsubManual = onSnapshot(collection(db, 'manual_schedules'), snap => {
            const manualClasses = snap.docs.map(d => ({ dbId: d.id, ...d.data() }));
            setRawClasses(prev => {
                // Mantener las contract classes, reemplazar las manual
                const contractOnly = prev.filter((c: any) => c._source === 'contract');
                return [...manualClasses.map(m => ({ ...m, _source: 'manual' })), ...contractOnly];
            });
            loaded.schedules = true; tryDone();
        });

        const unsubContracts = onSnapshot(collection(db, 'contracts'), snap => {
            const contractClasses: any[] = [];
            snap.forEach(d => {
                const c = d.data();
                const processSlots = (slots: any[]) => {
                    if (!slots) return;
                    slots.forEach((s: any) => {
                        if (s.instructor) contractClasses.push({
                            studentName: c.clientName, vehicle: s.vehicle,
                            timeSlot: s.time, status: s.status || 'scheduled',
                            date: s.date, instructor: s.instructor, _source: 'contract'
                        });
                    });
                };
                if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
                if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
                if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
            });
            setRawClasses(prev => {
                const manualOnly = prev.filter((c: any) => c._source === 'manual');
                return [...manualOnly, ...contractClasses];
            });
            loaded.contracts = true; tryDone();
        });

        const unsubBitacoras = onSnapshot(collection(db, 'bitacora_practica'), snap => {
            setRawBitacoras(snap.docs.map(d => d.data()));
            loaded.bitacoras = true; tryDone();
        });

        return () => { unsubManual(); unsubContracts(); unsubBitacoras(); };
    }, [db]);

    const instructorData = useMemo(() => {
        const todayStart = startOfDay(now);
        const weekStart = startOfDay(startOfWeek(currentDate, { weekStartsOn: 1 }));
        // Hora actual en decimal (ej: 13:50 → 13.83)
        const nowDecimal = now.getHours() + now.getMinutes() / 60;
        return INSTRUCTORS.map(inst => {
            const bitas = rawBitacoras.filter(b => b.instructorName === inst.name && b.studentConfirmed && typeof b.studentRating === 'number');
            const avg = bitas.length > 0 ? (bitas.reduce((a: number, b: any) => a + b.studentRating, 0) / bitas.length).toFixed(1) : 'N/A';
            const myClasses = rawClasses.filter(c => c.instructor === inst.name);
            const map = new Map<string, any[]>();
            myClasses.forEach(c => {
                if (!c.date) return;
                let d = c.date;
                if (typeof d.toDate === 'function') d = d.toDate();
                else if (typeof d === 'string') d = parseISO(d);
                else if (!(d instanceof Date)) d = new Date(d);
                if (isNaN(d.getTime())) return;
                if (!map.has(c.studentName)) map.set(c.studentName, []);
                const list = map.get(c.studentName)!;
                if (!list.some((e: any) => e.timeSlot === c.timeSlot && isSameDay(e.dateObj, d))) list.push({ ...c, dateObj: d });
            });
            map.forEach(list => {
                list.sort((a: any, b: any) => a.dateObj - b.dateObj);
                list.forEach((cl: any, i: number) => { cl.classNumber = i + 1; cl.total = list.length; });
            });
            let missed = 0; let total = 0;
            const q = searchTerm.trim().toLowerCase();
            const days = Array.from({ length: 7 }).map((_, i) => {
                const day = addDays(weekStart, i);
                const classes: any[] = [];
                map.forEach(list => list.forEach((c: any) => {
                    if (!isSameDay(c.dateObj, day)) return;
                    if (q && !(c.studentName || '').toLowerCase().includes(q)) return;
                    const past = isBefore(startOfDay(c.dateObj), todayStart);
                    const isToday = isSameDay(c.dateObj, now);
                    // Elegible si: día pasado, O clase de hoy que ya EMPEZÓ (hora inicio <= ahora)
                    const slotStartHour = parseSlotHour(c.timeSlot || '');
                    const slotEndHour = parseSlotEndHour(c.timeSlot || '');
                    const todaySlotStarted = isToday && slotStartHour > 0 && slotStartHour <= nowDecimal;
                    const todaySlotEnded = isToday && slotEndHour > 0 && slotEndHour <= nowDecimal;
                    const isEligible = past || todaySlotStarted; // Elegible desde que empieza el turno
                    const mis = past && c.status !== 'completed';
                    if (mis) missed++;
                    // PASO 2: Instructor leyó el QR = existe documento en bitácora para este estudiante+instructor+fecha
                    // El portal del instructor escribe el campo 'classDate' (ver profesores/page.tsx línea 266)
                    const studentNameNorm = (c.studentName || '').toLowerCase().trim();
                    const matchingBita = isEligible ? rawBitacoras.find(b => {
                        if (b.instructorName !== inst.name) return false;
                        if (typeof b.studentName !== 'string') return false;
                        if (b.studentName.toLowerCase().trim() !== studentNameNorm) return false;
                        // El campo correcto es 'classDate' según el portal del instructor
                        const rawDate = b.classDate || b.sessionDate || b.date || b.createdAt;
                        if (rawDate) {
                            let bDate: Date | null = null;
                            if (rawDate && typeof rawDate.toDate === 'function') bDate = rawDate.toDate();
                            else if (typeof rawDate === 'string') bDate = parseISO(rawDate);
                            else if (rawDate instanceof Date) bDate = rawDate;
                            if (bDate && !isNaN(bDate.getTime())) return isSameDay(bDate, c.dateObj);
                        }
                        return true; // sin campo de fecha: considerar que coincide
                    }) : undefined;
                    // QR escaneado por el instructor (paso 2)
                    const qrScanned = !!matchingBita;
                    // Estudiante confirmó y calificó (paso 4)
                    const studentConfirmed = qrScanned && matchingBita?.studentConfirmed === true;
                    classes.push({ ...c, isMissed: mis, isCompleted: isEligible && !mis, isFuture: !isEligible, qrScanned, studentConfirmed });
                }));
                // Ordenar por hora de inicio numéricamente (8am < 10am < 12pm < 2pm)
                classes.sort((a, b) => parseSlotHour(a.timeSlot || '') - parseSlotHour(b.timeSlot || ''));
                total += classes.length;
                const dn = formatDate(day, 'EEEE', { locale: es }).toLowerCase();
                return { date: day, letter: dn === 'miércoles' ? 'X' : dn.charAt(0).toUpperCase(), dayNum: formatDate(day, 'dd'), classes };
            });
            return { ...inst, avg, bitas: bitas.length, days, missed, total };
        });
    }, [rawClasses, rawBitacoras, currentDate, searchTerm, now]);

    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const we = endOfWeek(currentDate, { weekStartsOn: 1 });

    if (isLoading) return (
        <div className="flex items-center justify-center h-32 -m-4 md:-m-8 bg-white">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="ml-1.5 text-[11px] text-slate-400">Cargando...</span>
        </div>
    );

    return (
        <div className="-m-4 md:-m-8 bg-white min-h-screen text-[11px]">

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 border-b border-slate-200 bg-white sticky top-16 z-10">
                <Activity className="w-3 h-3 text-orange-500 shrink-0" />
                <span className="font-bold text-slate-600 uppercase tracking-wide text-[10px] shrink-0">Monitor de Calidad</span>
                <span className="flex items-center gap-1 text-red-500 font-semibold text-[9px] shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                    En vivo
                </span>
                <div className="w-px h-3 bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-0.5">
                    <button onClick={() => setCurrentDate(d => subWeeks(d, 1))} className="p-0.5 rounded hover:bg-slate-100 text-slate-400">
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    <span className="font-semibold text-slate-500 tabular-nums text-[10px] px-1 whitespace-nowrap">
                        {formatDate(ws, 'dd MMM', { locale: es })} – {formatDate(we, 'dd MMM', { locale: es })}
                    </span>
                    <button onClick={() => setCurrentDate(d => addWeeks(d, 1))} className="p-0.5 rounded hover:bg-slate-100 text-slate-400">
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="w-px h-3 bg-slate-200 hidden sm:block" />
                <div className="relative flex-1 min-w-[140px] max-w-[220px]">
                    <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400" />
                    <input type="text" placeholder="Buscar estudiante..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-6 pr-2 py-0.5 text-[10px] border border-slate-200 rounded bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="w-px h-3 bg-slate-200 hidden sm:block" />
                {/* Leyenda completa */}
                <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap">
                    <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-50 border-emerald-200 text-emerald-700">
                        QR Confirmado
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-700">
                        Sin QR
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-red-50 border-red-200 text-red-600">
                        Sin bitácora
                    </span>
                    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border bg-white border-slate-200 text-slate-400">
                        Clase futura
                    </span>
                    <span className="flex items-center gap-0.5 text-blue-500 text-[9px] font-bold">
                        <QrCode className="w-2.5 h-2.5" /> QR escaneado
                    </span>
                    <span className="flex items-center gap-0.5 text-emerald-600 text-[9px] font-bold">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Estudiante confirmó
                    </span>
                </div>
            </div>

            {/* ── Instructor rows ── */}
            <div className="divide-y divide-slate-100">
                {instructorData.map(inst => {
                    const open = expandedInstructor === inst.id;
                    const alert = inst.missed > 0;
                    return (
                        <div key={inst.id}>
                            <button onClick={() => setExpandedInstructor(open ? null : inst.id)}
                                className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors', open ? 'bg-slate-50' : 'hover:bg-slate-50')}>
                                {/* Avatar */}
                                <div className={cn('w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center shrink-0',
                                    alert ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700')}>
                                    {inst.name.charAt(0)}
                                </div>
                                {/* Name */}
                                <span className="font-semibold text-slate-800 flex-1 min-w-0 truncate text-[11px]">{inst.name}</span>
                                {/* Rating */}
                                <span className="flex items-center gap-0.5 text-amber-600 font-semibold shrink-0">
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                    <span>{inst.avg}</span>
                                    <span className="text-slate-400 font-normal text-[9px]">({inst.bitas})</span>
                                </span>
                                {/* Count */}
                                <span className="text-slate-400 shrink-0 hidden sm:inline">{inst.total} cls</span>
                                {/* Badge */}
                                {alert
                                    ? <span className="flex items-center gap-0.5 font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full shrink-0 text-[9px]">
                                        <AlertCircle className="w-2 h-2" />{inst.missed}
                                    </span>
                                    : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                }
                                <ChevronDown className={cn('w-3 h-3 text-slate-300 shrink-0 transition-transform', open && 'rotate-180')} />
                            </button>

                            {/* Expanded */}
                            {open && (
                                <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                                    {inst.total === 0
                                        ? <p className="text-[10px] text-slate-400 text-center py-2">Sin clases esta semana.</p>
                                        : <div className="space-y-2">
                                {inst.days.map((day: any, di: number) => {
                                    if (day.classes.length === 0) return null;
                                    return (
                                        <div key={di} className="flex gap-2 items-start">
                                            {/* Día header vertical */}
                                            <div className="w-10 shrink-0 text-center pt-1">
                                                <div className="text-[11px] font-black text-slate-600">{day.letter}</div>
                                                <div className="text-[10px] text-slate-400 font-semibold leading-none">{day.dayNum}</div>
                                            </div>
                                            {/* Cards de estudiantes */}
                                            <div className="flex flex-wrap gap-1.5 flex-1">
                                                {day.classes.map((c: any, ci: number) => (
                                                    <div key={ci}
                                                        title={`${c.studentName} · ${c.timeSlot} · #${c.classNumber}/${c.total}${c.isMissed ? ' · ⚠ Sin bitácora' : ''}${c.qrScanned ? ' · 📱 QR escaneado' : c.isCompleted ? ' · ⏳ Sin QR' : ''}${c.studentConfirmed ? ' · ✅ Confirmado' : ''}`}
                                                        className={cn('rounded-lg px-2 py-1.5 text-[10px] leading-tight border cursor-default min-w-[120px] max-w-[180px]',
                                                            c.isMissed
                                                                ? 'bg-red-50 border-red-200 text-red-700'          // Día pasado sin bitácora
                                                                : c.qrScanned
                                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'  // ✅ QR confirmado
                                                                    : c.isCompleted
                                                                        ? 'bg-amber-50 border-amber-200 text-amber-800'   // ⚠ Turno pasó, sin QR
                                                                        : 'bg-white border-slate-200 text-slate-500'      // Futuro
                                                        )}>
                                                        <div className="font-bold truncate text-[11px]">
                                                            {(c.studentName || '').split(' ').slice(0, 2).join(' ')}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-1 mt-0.5">
                                                            <span className="opacity-70 text-[9px] truncate">{c.timeSlot}</span>
                                                            <div className="flex items-center gap-0.5 shrink-0">
                                                                {c.isMissed && <ShieldAlert className="w-2.5 h-2.5" />}
                                                                {c.isFuture && <CalendarClock className="w-2.5 h-2.5 text-slate-300" />}
                                                                {/* QR escaneado por instructor */}
                                                                {c.qrScanned ? (
                                                                    <QrCode className="w-2.5 h-2.5 text-blue-500" title="✅ QR escaneado por instructor" />
                                                                ) : c.isMissed ? (
                                                                    <QrCode className="w-2.5 h-2.5 text-red-400" title="⚠ No fue escaneado (día pasado)" />
                                                                ) : c.isCompleted ? (
                                                                    <QrCode className="w-2.5 h-2.5 text-amber-400" title="⏳ Sin QR en este turno" />
                                                                ) : null}
                                                                {/* Estudiante confirmó */}
                                                                {c.studentConfirmed && (
                                                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" title="✅ Estudiante confirmó" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                                    }
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
