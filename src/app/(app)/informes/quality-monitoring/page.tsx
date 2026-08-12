'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    isBefore, parseISO, startOfDay, format as fmtDate,
    startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    CheckCircle2, QrCode, AlertTriangle, Clock, ChevronLeft,
    ChevronRight, Search, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const INSTRUCTORS = [
    { id: '1', name: 'Emmanuel Camargo', short: 'EC' },
    { id: '2', name: 'Adrian Gordon',    short: 'AG' },
    { id: '3', name: 'Roberto Brown',    short: 'RB' },
    { id: '4', name: 'Marco Franco',     short: 'MF' },
];

const SLOTS = [
    { label: '8 – 10 am',  startH: 8,  endH: 10 },
    { label: '10 – 12 pm', startH: 10, endH: 12 },
    { label: '1 – 3 pm',   startH: 13, endH: 15 },
    { label: '3 – 5 pm',   startH: 15, endH: 17 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseH(slot: string): number {
    if (!slot) return 99;
    const m = slot.match(/(\d+):?(\d*)(am|pm)/i);
    if (!m) return 99;
    let h = parseInt(m[1]);
    if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
    return h;
}
function parseEndH(slot: string): number {
    const p = slot?.split(' a ');
    return p?.length === 2 ? parseH(p[1].trim()) : 0;
}
function toDate(raw: any): Date | null {
    if (!raw) return null;
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (typeof raw === 'string') { const d = parseISO(raw); return isNaN(d.getTime()) ? null : d; }
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = 'confirmed' | 'qr' | 'missing' | 'inprogress' | 'future';

interface ClassEntry {
    instructorId: string;
    instructorName: string;
    studentName: string;
    slotStartH: number;
    slotLabel: string;
    dateObj: Date;
    classNum: number;
    total: number;
    status: Status;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ReactNode; row: string; badge: string }> = {
    confirmed:  { label: 'Confirmado',  icon: <CheckCircle2 className="w-3 h-3" />, row: 'bg-emerald-50  border-l-4 border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-800' },
    qr:         { label: 'QR ok',       icon: <QrCode       className="w-3 h-3" />, row: 'bg-sky-50      border-l-4 border-l-sky-400',     badge: 'bg-sky-100     text-sky-800'     },
    missing:    { label: 'Sin bitácora',icon: <AlertTriangle className="w-3 h-3" />, row: 'bg-red-50      border-l-4 border-l-red-400',     badge: 'bg-red-100     text-red-800'     },
    inprogress: { label: 'En curso',    icon: <Clock        className="w-3 h-3" />, row: 'bg-orange-50   border-l-4 border-l-orange-400', badge: 'bg-orange-100  text-orange-800'  },
    future:     { label: 'Programado',  icon: <Clock        className="w-3 h-3" />, row: 'bg-slate-50    border-l-4 border-l-slate-300',   badge: 'bg-slate-100   text-slate-600'   },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function QualityMonitoringPage() {
    const db = useDb();
    const [loading, setLoading]         = useState(true);
    const [rawClasses, setRawClasses]   = useState<any[]>([]);
    const [rawBitacoras, setBitacoras]  = useState<any[]>([]);
    const [weekDate, setWeekDate]       = useState(new Date());
    const [now, setNow]                 = useState(new Date());
    const [search, setSearch]           = useState('');
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([new Date().getDay()]));
    const [filterInstructor, setFilter] = useState<string>('all');

    useEffect(() => { window.scrollTo(0, 0); }, []);
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    // ── Firebase listeners ──
    useEffect(() => {
        if (!db) return;
        let done = { m: false, c: false, b: false };
        const tryDone = () => { if (done.m && done.c && done.b) setLoading(false); };

        const u1 = onSnapshot(collection(db, 'manual_schedules'), s => {
            const manual = s.docs.map(d => ({ ...d.data(), _src: 'manual' }));
            setRawClasses(p => [...manual, ...p.filter((x: any) => x._src === 'contract')]);
            done.m = true; tryDone();
        });
        const u2 = onSnapshot(collection(db, 'contracts'), s => {
            const list: any[] = [];
            s.forEach(d => {
                const c = d.data();
                const push = (arr: any[]) => (arr || []).forEach(s => {
                    if (s.instructor) list.push({ studentName: c.clientName, timeSlot: s.time, date: s.date, instructor: s.instructor, _src: 'contract' });
                });
                push(c.autoMotoDetails?.practicalClassSchedules);
                push(c.autoMotoDetails?.motoPracticalClassSchedules);
                push(c.deluxeDetails?.classSchedules);
            });
            setRawClasses(p => [...p.filter((x: any) => x._src === 'manual'), ...list]);
            done.c = true; tryDone();
        });
        const u3 = onSnapshot(collection(db, 'bitacora_practica'), s => {
            setBitacoras(s.docs.map(d => d.data()));
            done.b = true; tryDone();
        });
        return () => { u1(); u2(); u3(); };
    }, [db]);

    // ── Week dates ──
    const ws       = useMemo(() => startOfDay(startOfWeek(weekDate, { weekStartsOn: 1 })), [weekDate]);
    const we       = useMemo(() => endOfWeek(weekDate, { weekStartsOn: 1 }), [weekDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(ws, i)), [ws]);

    // ── Build class entries ──
    const entries = useMemo((): ClassEntry[] => {
        const todayStart  = startOfDay(now);
        const nowH        = now.getHours() + now.getMinutes() / 60;
        const q           = search.trim().toLowerCase();
        const result: ClassEntry[] = [];

        INSTRUCTORS.forEach(inst => {
            // deduplicate per student
            const map = new Map<string, any[]>();
            rawClasses
                .filter(c => c.instructor === inst.name && c.date)
                .forEach(c => {
                    const d = toDate(c.date);
                    if (!d) return;
                    const k = c.studentName || '';
                    if (!map.has(k)) map.set(k, []);
                    const list = map.get(k)!;
                    if (!list.some(e => e.timeSlot === c.timeSlot && isSameDay(e.d, d)))
                        list.push({ ...c, d });
                });
            map.forEach(list => {
                list.sort((a, b) => a.d - b.d);
                list.forEach((cl, i) => { cl.classNum = i + 1; cl.total = list.length; });
            });

            map.forEach(list => list.forEach(c => {
                if (!weekDays.some(day => isSameDay(day, c.d))) return;
                if (q && !(c.studentName || '').toLowerCase().includes(q)) return;
                if (filterInstructor !== 'all' && inst.id !== filterInstructor) return;

                const sh = parseH(c.timeSlot || '');
                const eh = parseEndH(c.timeSlot || '');
                const slotDef = SLOTS.find(s => s.startH === sh);
                if (!slotDef) return;

                const past       = isBefore(startOfDay(c.d), todayStart);
                const isToday    = isSameDay(c.d, now);
                const started    = isToday && sh <= nowH;
                const ended      = isToday && eh > 0 && eh <= nowH;
                const eligible   = past || started || ended;
                const inProgress = isToday && sh <= nowH && nowH < eh;

                const normName = (c.studentName || '').toLowerCase().trim();
                const bita = eligible ? rawBitacoras.find(b => {
                    if (b.instructorName !== inst.name) return false;
                    if ((b.studentName || '').toLowerCase().trim() !== normName) return false;
                    const bd = toDate(b.classDate || b.sessionDate || b.date || b.createdAt);
                    return bd ? isSameDay(bd, c.d) : false;
                }) : undefined;

                let status: Status;
                if (!eligible)               status = 'future';
                else if (inProgress && !bita) status = 'inprogress';
                else if (bita?.studentConfirmed) status = 'confirmed';
                else if (bita)               status = 'qr';
                else                         status = 'missing';

                result.push({
                    instructorId: inst.id, instructorName: inst.name,
                    studentName: c.studentName || '—',
                    slotStartH: sh, slotLabel: slotDef.label,
                    dateObj: c.d, classNum: c.classNum, total: c.total, status,
                });
            }));
        });

        return result;
    }, [rawClasses, rawBitacoras, weekDays, search, filterInstructor, now]);

    // ── Instructor summary ──
    const instSummary = useMemo(() =>
        INSTRUCTORS.map(inst => {
            const mine = entries.filter(e => e.instructorId === inst.id);
            const all  = rawClasses.filter(c => c.instructor === inst.name);
            const bitas = rawBitacoras.filter(b => b.instructorName === inst.name && b.studentConfirmed && typeof b.studentRating === 'number');
            const avg  = bitas.length ? (bitas.reduce((a, b) => a + b.studentRating, 0) / bitas.length).toFixed(1) : '—';
            const errors = mine.filter(e => e.status === 'missing').length;
            const eligible = mine.filter(e => e.status !== 'future').length;
            const rate = eligible > 0 ? Math.round(((eligible - errors) / eligible) * 100) : 100;
            return { ...inst, avg, errors, rate, totalWeek: mine.length };
        }),
    [entries, rawClasses, rawBitacoras]);

    const totalErrors = instSummary.reduce((a, i) => a + i.errors, 0);

    // ── Toggle day expand ──
    const toggleDay = (dow: number) => setExpandedDays(prev => {
        const next = new Set(prev);
        next.has(dow) ? next.delete(dow) : next.add(dow);
        return next;
    });

    if (loading) return (
        <div className="flex items-center justify-center h-40 bg-white">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
            <span className="text-[11px] text-slate-400">Cargando datos…</span>
        </div>
    );

    return (
        <div className="bg-slate-50 min-h-full text-[11px] flex flex-col">

            {/* ══ HEADER ══════════════════════════════════════════════════ */}
            <div className="bg-white border-b border-slate-200 flex-none">

                {/* Row 1 — title + week nav + search */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-slate-800 tracking-tight">Control de Calidad</span>
                        <span className="flex items-center gap-1 text-[9px] text-rose-500 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                            En vivo
                        </span>
                    </div>
                    <div className="flex-1" />
                    {/* Week nav */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
                        <button onClick={() => setWeekDate(d => subWeeks(d, 1))}
                            className="text-slate-500 hover:text-slate-800 transition-colors">
                            <ChevronLeft className="w-3 h-3" />
                        </button>
                        <span className="font-semibold text-[10px] text-slate-600 tabular-nums px-1 whitespace-nowrap">
                            {fmtDate(ws, 'd MMM', { locale: es })} – {fmtDate(we, 'd MMM yyyy', { locale: es })}
                        </span>
                        <button onClick={() => setWeekDate(d => addWeeks(d, 1))}
                            className="text-slate-500 hover:text-slate-800 transition-colors">
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar estudiante…"
                            className="pl-6 pr-3 py-1 text-[10px] border border-slate-200 rounded-lg bg-slate-50 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    </div>
                </div>

                {/* Row 2 — instructor filter chips + global stats */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-2">
                    {/* Filter chips */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => setFilter('all')}
                            className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors',
                                filterInstructor === 'all'
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>
                            Todos
                        </button>
                        {instSummary.map(inst => (
                            <button key={inst.id} onClick={() => setFilter(inst.id)}
                                className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1',
                                    filterInstructor === inst.id
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300')}>
                                <span className="w-4 h-4 rounded-full bg-current/10 flex items-center justify-center text-[8px] font-black">{inst.short}</span>
                                {inst.name.split(' ')[0]}
                                {inst.errors > 0 && (
                                    <span className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black',
                                        filterInstructor === inst.id ? 'bg-white/20' : 'bg-red-100 text-red-700')}>
                                        {inst.errors}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1" />
                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[9px] text-slate-500">
                        <span className={cn('font-bold', totalErrors > 0 ? 'text-red-600' : 'text-emerald-600')}>
                            {totalErrors > 0 ? `${totalErrors} sin bitácora` : 'Todo al día ✓'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ══ MAIN ════════════════════════════════════════════════════ */}
            <div className="flex gap-3 flex-1 overflow-hidden p-3">

                {/* Left: Instructor cards */}
                <div className="w-44 shrink-0 flex flex-col gap-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide px-1">Instructores</p>
                    {instSummary.map(inst => {
                        const rc = inst.rate >= 90 ? 'bg-emerald-500' : inst.rate >= 70 ? 'bg-amber-500' : 'bg-red-500';
                        const tc = inst.rate >= 90 ? 'text-emerald-700' : inst.rate >= 70 ? 'text-amber-700' : 'text-red-700';
                        const bgc = inst.rate >= 90 ? 'bg-emerald-100' : inst.rate >= 70 ? 'bg-amber-100' : 'bg-red-100';
                        return (
                            <button key={inst.id} onClick={() => setFilter(filterInstructor === inst.id ? 'all' : inst.id)}
                                className={cn('rounded-xl p-3 text-left border transition-all w-full',
                                    filterInstructor === inst.id || filterInstructor === 'all'
                                        ? 'bg-white border-slate-200 shadow-sm'
                                        : 'bg-white/50 border-slate-100 opacity-50')}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-700">
                                        {inst.short}
                                    </div>
                                    {inst.errors > 0
                                        ? <span className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                                            ⚠ {inst.errors}
                                          </span>
                                        : <span className="text-[8px] text-emerald-600 font-bold">✓</span>
                                    }
                                </div>
                                <div className="font-bold text-slate-800 text-[10px] leading-tight">{inst.name.split(' ')[0]}</div>
                                <div className="text-[8px] text-slate-400">{inst.name.split(' ').slice(1).join(' ')}</div>
                                <div className="mt-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[8px] text-slate-400">{inst.totalWeek} cls esta sem.</span>
                                        <span className={cn('text-[8px] font-bold', tc)}>{inst.rate}%</span>
                                    </div>
                                    <div className={cn('h-1 rounded-full overflow-hidden', bgc)}>
                                        <div className={cn('h-full rounded-full', rc)} style={{ width: `${inst.rate}%` }} />
                                    </div>
                                </div>
                                <div className="text-[8px] text-slate-400 mt-1">★ {inst.avg}</div>
                            </button>
                        );
                    })}

                    {/* Legend */}
                    <div className="mt-2 rounded-xl bg-white border border-slate-200 p-3 flex flex-col gap-1.5">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Leyenda</p>
                        {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1.5">
                                <span className={cn('text-[8px] flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold', v.badge)}>
                                    {v.icon} {v.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Day agenda */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-w-0">
                    {weekDays.map((day, di) => {
                        const dow = day.getDay();
                        const isToday = isSameDay(day, now);
                        const isPast  = isBefore(startOfDay(day), startOfDay(now));
                        const isOpen  = expandedDays.has(di);
                        const dayEntries = entries.filter(e => isSameDay(e.dateObj, day));
                        const dayErrors  = dayEntries.filter(e => e.status === 'missing').length;
                        const dayCount   = dayEntries.length;

                        return (
                            <div key={di} className={cn('rounded-xl border overflow-hidden',
                                isToday ? 'border-blue-200 shadow-md' : 'border-slate-200',
                                isPast && !isToday && 'opacity-75')}>

                                {/* Day header */}
                                <button
                                    onClick={() => toggleDay(di)}
                                    className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                        isToday ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white hover:bg-slate-50')}>
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className={cn('w-8 h-8 rounded-lg flex flex-col items-center justify-center shrink-0',
                                            isToday ? 'bg-white/20' : 'bg-slate-100')}>
                                            <span className={cn('text-[8px] font-bold uppercase', isToday ? 'text-white/80' : 'text-slate-400')}>
                                                {fmtDate(day, 'EEE', { locale: es })}
                                            </span>
                                            <span className={cn('text-[13px] font-black leading-none', isToday ? 'text-white' : 'text-slate-700')}>
                                                {fmtDate(day, 'd')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className={cn('font-bold text-[11px] capitalize', isToday ? 'text-white' : 'text-slate-700')}>
                                                {fmtDate(day, 'EEEE d MMMM', { locale: es })}
                                                {isToday && ' — Hoy'}
                                            </span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={cn('text-[9px]', isToday ? 'text-white/70' : 'text-slate-400')}>
                                                    {dayCount} {dayCount === 1 ? 'clase' : 'clases'}
                                                </span>
                                                {dayErrors > 0 && (
                                                    <span className={cn('text-[8px] font-bold rounded-full px-1.5 py-0.5',
                                                        isToday ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700')}>
                                                        ⚠ {dayErrors} sin bitácora
                                                    </span>
                                                )}
                                                {dayCount > 0 && dayErrors === 0 && (
                                                    <span className={cn('text-[8px] font-bold',
                                                        isToday ? 'text-white/70' : 'text-emerald-600')}>
                                                        ✓ Al día
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isOpen
                                        ? <ChevronUp  className={cn('w-3.5 h-3.5 shrink-0', isToday ? 'text-white' : 'text-slate-400')} />
                                        : <ChevronDown className={cn('w-3.5 h-3.5 shrink-0', isToday ? 'text-white' : 'text-slate-400')} />
                                    }
                                </button>

                                {/* Day content */}
                                {isOpen && (
                                    <div className="bg-white border-t border-slate-100 divide-y divide-slate-100">
                                        {SLOTS.map(slot => {
                                            const slotEntries = dayEntries.filter(e => e.slotStartH === slot.startH);
                                            return (
                                                <div key={slot.startH} className="px-4 py-2">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide w-20 shrink-0">
                                                            {slot.label}
                                                        </span>
                                                        {slotEntries.length === 0 && (
                                                            <span className="text-[9px] text-slate-300 italic">Sin clases</span>
                                                        )}
                                                    </div>
                                                    {slotEntries.length > 0 && (
                                                        <div className="flex flex-col gap-1 ml-22">
                                                            {slotEntries
                                                                .sort((a, b) => a.instructorName.localeCompare(b.instructorName))
                                                                .map((e, ei) => {
                                                                    const cfg = STATUS_CONFIG[e.status];
                                                                    return (
                                                                        <div key={ei}
                                                                            className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5', cfg.row)}>
                                                                            {/* Instructor chip */}
                                                                            <span className="text-[8px] font-black text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5 shrink-0">
                                                                                {INSTRUCTORS.find(i => i.id === e.instructorId)?.short}
                                                                            </span>
                                                                            {/* Student */}
                                                                            <span className="font-semibold text-[10px] text-slate-700 flex-1 truncate">
                                                                                {e.studentName}
                                                                            </span>
                                                                            {/* Class number */}
                                                                            <span className="text-[8px] text-slate-400 shrink-0">
                                                                                Cl. {e.classNum}/{e.total}
                                                                            </span>
                                                                            {/* Status badge */}
                                                                            <span className={cn('flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md shrink-0', cfg.badge)}>
                                                                                {cfg.icon}
                                                                                {cfg.label}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}