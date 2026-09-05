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
    Calendar, Users, ShieldAlert, Sparkles, Filter, CheckCheck, RefreshCw, Car
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const INSTRUCTORS = [
    { id: '1', name: 'Emmanuel Camargo', short: 'EC', color: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' },
    { id: '2', name: 'Adrian Gordon',    short: 'AG', color: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' },
    { id: '3', name: 'Roberto Brown',    short: 'RB', color: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50' },
    { id: '4', name: 'Marco Franco',     short: 'MF', color: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' },
];

const SLOTS = [
    { label: '8:00 AM – 10:00 AM',  startH: 8,  endH: 10, tag: 'Mañana 1' },
    { label: '10:00 AM – 12:00 PM', startH: 10, endH: 12, tag: 'Mañana 2' },
    { label: '1:00 PM – 3:00 PM',   startH: 13, endH: 15, tag: 'Tarde 1' },
    { label: '3:00 PM – 5:00 PM',   startH: 15, endH: 17, tag: 'Tarde 2' },
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

function matchInstructor(nameA?: string, nameB?: string): boolean {
    if (!nameA || !nameB) return false;
    const a = nameA.toLowerCase().trim();
    const b = nameB.toLowerCase().trim();
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const aWords = a.split(' ').filter(w => w.length > 2);
    const bWords = b.split(' ').filter(w => w.length > 2);
    return aWords.some(w => b.includes(w)) || bWords.some(w => a.includes(w));
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = 'confirmed' | 'qr' | 'missing' | 'inprogress' | 'future';
type FilterStatus = 'all' | 'missing' | 'confirmed' | 'inprogress';

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

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ReactNode; cardBorder: string; cardBg: string; badge: string; dot: string }> = {
    confirmed:  { 
        label: 'Confirmado QR',  
        icon: <CheckCircle2 className="w-3.5 h-3.5" />, 
        cardBorder: 'border-emerald-200 hover:border-emerald-300', 
        cardBg: 'bg-emerald-50/40', 
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500'
    },
    qr:         { 
        label: 'Bitácora Lista',       
        icon: <QrCode className="w-3.5 h-3.5" />, 
        cardBorder: 'border-sky-200 hover:border-sky-300', 
        cardBg: 'bg-sky-50/40',     
        badge: 'bg-sky-100 text-sky-800 border-sky-300',
        dot: 'bg-sky-500'
    },
    missing:    { 
        label: 'Sin bitácora',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />, 
        cardBorder: 'border-rose-300 hover:border-rose-400 shadow-sm shadow-rose-100', 
        cardBg: 'bg-rose-50/60',     
        badge: 'bg-rose-100 text-rose-800 border-rose-300 font-black',
        dot: 'bg-rose-500'
    },
    inprogress: { 
        label: 'En curso',    
        icon: <Clock className="w-3.5 h-3.5 animate-spin" />, 
        cardBorder: 'border-amber-300 hover:border-amber-400 shadow-sm shadow-amber-100', 
        cardBg: 'bg-amber-50/50', 
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        dot: 'bg-amber-500 animate-ping'
    },
    future:     { 
        label: 'Programado',  
        icon: <Calendar className="w-3.5 h-3.5" />, 
        cardBorder: 'border-slate-200 hover:border-slate-300', 
        cardBg: 'bg-white',   
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400'
    },
};

export default function QualityMonitoringPage() {
    const db = useDb();
    const [loading, setLoading]                 = useState(true);
    const [rawClasses, setRawClasses]           = useState<any[]>([]);
    const [rawBitacoras, setBitacoras]          = useState<any[]>([]);
    const [weekDate, setWeekDate]               = useState(new Date());
    const [now, setNow]                         = useState(new Date());
    const [search, setSearch]                   = useState('');
    const [expandedDays, setExpandedDays]       = useState<Set<number>>(new Set([new Date().getDay()]));
    const [filterInstructor, setFilter]         = useState<string>('all');
    const [filterStatus, setFilterStatus]       = useState<FilterStatus>('all');

    useEffect(() => { window.scrollTo(0, 0); }, []);
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    // ── Firebase Listeners ──
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

    // ── Week calculations ──
    const ws       = useMemo(() => startOfDay(startOfWeek(weekDate, { weekStartsOn: 1 })), [weekDate]);
    const we       = useMemo(() => endOfWeek(weekDate, { weekStartsOn: 1 }), [weekDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(ws, i)), [ws]);

    // ── Build clean class entries ──
    const entries = useMemo((): ClassEntry[] => {
        const todayStart  = startOfDay(now);
        const nowH        = now.getHours() + now.getMinutes() / 60;
        const q           = search.trim().toLowerCase();
        const result: ClassEntry[] = [];

        INSTRUCTORS.forEach(inst => {
            const map = new Map<string, any[]>();
            rawClasses
                .filter(c => matchInstructor(c.instructor, inst.name) && c.date)
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
                list.sort((a, b) => a.d.getTime() - b.d.getTime());
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
                    const bInst = b.instructorName || b.instructor || '';
                    if (!matchInstructor(bInst, inst.name)) return false;
                    const bStud = (b.studentName || '').toLowerCase().trim();
                    if (bStud !== normName && !bStud.includes(normName) && !normName.includes(bStud)) return false;
                    const bd = toDate(b.classDate || b.sessionDate || b.date || b.confirmedAt || b.createdAt);
                    return bd ? isSameDay(bd, c.d) : false;
                }) : undefined;

                let status: Status;
                if (!eligible)                   status = 'future';
                else if (inProgress && !bita)     status = 'inprogress';
                else if (bita?.studentConfirmed) status = 'confirmed';
                else if (bita)                   status = 'qr';
                else                             status = 'missing';

                // Status filter check
                if (filterStatus === 'missing' && status !== 'missing') return;
                if (filterStatus === 'confirmed' && status !== 'confirmed' && status !== 'qr') return;
                if (filterStatus === 'inprogress' && status !== 'inprogress') return;

                result.push({
                    instructorId: inst.id, instructorName: inst.name,
                    studentName: c.studentName || '—',
                    slotStartH: sh, slotLabel: slotDef.label,
                    dateObj: c.d, classNum: c.classNum, total: c.total, status,
                });
            }));
        });

        return result;
    }, [rawClasses, rawBitacoras, weekDays, search, filterInstructor, filterStatus, now]);

    // ── Global KPI stats ──
    const globalStats = useMemo(() => {
        const total = entries.length;
        const confirmed = entries.filter(e => e.status === 'confirmed' || e.status === 'qr').length;
        const missing = entries.filter(e => e.status === 'missing').length;
        const inprogress = entries.filter(e => e.status === 'inprogress').length;
        const future = entries.filter(e => e.status === 'future').length;
        const eligible = total - future;
        const qualityRate = eligible > 0 ? Math.round((confirmed / eligible) * 100) : 100;
        return { total, confirmed, missing, inprogress, future, qualityRate };
    }, [entries]);

    // ── Instructor Summary Cards ──
    const instSummary = useMemo(() =>
        INSTRUCTORS.map(inst => {
            const mine = entries.filter(e => e.instructorId === inst.id);
            const bitas = rawBitacoras.filter(b => matchInstructor(b.instructorName || b.instructor, inst.name) && b.studentConfirmed && typeof b.studentRating === 'number');
            const avg  = bitas.length ? (bitas.reduce((a, b) => a + b.studentRating, 0) / bitas.length).toFixed(1) : '5.0';
            const errors = mine.filter(e => e.status === 'missing').length;
            const ok = mine.filter(e => e.status === 'confirmed' || e.status === 'qr').length;
            const eligible = mine.filter(e => e.status !== 'future').length;
            const rate = eligible > 0 ? Math.round((ok / eligible) * 100) : 100;
            return { ...inst, avg, errors, ok, rate, totalWeek: mine.length };
        }),
    [entries, rawBitacoras]);

    const toggleDay = (dow: number) => setExpandedDays(prev => {
        const next = new Set(prev);
        next.has(dow) ? next.delete(dow) : next.add(dow);
        return next;
    });

    const expandAll = () => setExpandedDays(new Set([0, 1, 2, 3, 4, 5, 6]));
    const collapseAll = () => setExpandedDays(new Set());

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-80 bg-slate-50 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <span className="text-sm font-semibold">Cargando bitácoras y horarios en tiempo real...</span>
        </div>
    );

    return (
        <div className="bg-slate-100 min-h-screen pb-12 font-sans text-slate-800">

            {/* ══ TOP EXECUTIVE HEADER ════════════════════════════════════════ */}
            <div className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    
                    {/* Upper Bar: Title, Date navigation & Quick Search */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                                <Car className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-black tracking-tight text-slate-900">
                                        Control de Calidad & Bitácoras
                                    </h1>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        EN VIVO
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium">
                                    Monitoreo de asistencia práctica y validación QR de instructores
                                </p>
                            </div>
                        </div>

                        {/* Week Navigator */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setWeekDate(new Date())}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                            >
                                Hoy
                            </button>
                            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                                <button
                                    onClick={() => setWeekDate(d => subWeeks(d, 1))}
                                    className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors"
                                    title="Semana anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="font-extrabold text-xs text-slate-700 px-3 whitespace-nowrap">
                                    {fmtDate(ws, "d 'de' MMMM", { locale: es })} – {fmtDate(we, "d 'de' MMMM, yyyy", { locale: es })}
                                </span>
                                <button
                                    onClick={() => setWeekDate(d => addWeeks(d, 1))}
                                    className="p-1.5 hover:bg-white rounded-md text-slate-600 transition-colors"
                                    title="Semana siguiente"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative min-w-[220px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por alumno..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Lower Bar: KPI Cards Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Clases</div>
                                <div className="text-lg font-black text-slate-800">{globalStats.total} <span className="text-xs font-normal text-slate-400">esta sem.</span></div>
                            </div>
                        </div>

                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Bitácoras Ok</div>
                                <div className="text-lg font-black text-emerald-900">{globalStats.confirmed} <span className="text-xs font-bold text-emerald-600">({globalStats.qualityRate}%)</span></div>
                            </div>
                        </div>

                        <div className={cn('border rounded-xl p-3 flex items-center gap-3 transition-colors',
                            globalStats.missing > 0 ? 'bg-rose-50/80 border-rose-300 shadow-xs' : 'bg-slate-50 border-slate-200')}>
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center font-black',
                                globalStats.missing > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-600')}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Sin Bitácora</div>
                                <div className="text-lg font-black text-rose-900">{globalStats.missing} <span className="text-xs font-normal text-rose-600">pendientes</span></div>
                            </div>
                        </div>

                        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">En Curso / Hoy</div>
                                <div className="text-lg font-black text-amber-900">{globalStats.inprogress} <span className="text-xs font-normal text-amber-600">activas</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ MAIN BODY ════════════════════════════════════════════════ */}
            <div className="max-w-7xl mx-auto px-4 mt-6">
                
                {/* INSTRUCTOR PERFORMANCE CARDS (TOP STRIP) */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span>Desempeño por Instructor</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={cn('text-xs font-extrabold px-3 py-1 rounded-lg border transition-all',
                                    filterInstructor === 'all'
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}
                            >
                                Ver Todos
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {instSummary.map(inst => {
                            const isSelected = filterInstructor === inst.id;
                            const isWarning = inst.errors > 0;
                            return (
                                <div
                                    key={inst.id}
                                    onClick={() => setFilter(filterInstructor === inst.id ? 'all' : inst.id)}
                                    className={cn(
                                        'bg-white rounded-2xl p-4 border transition-all cursor-pointer relative overflow-hidden',
                                        isSelected
                                            ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md bg-gradient-to-b from-white to-blue-50/20'
                                            : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-xs', inst.color)}>
                                                {inst.short}
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                                                    {inst.name}
                                                </h3>
                                                <span className="text-[11px] text-slate-400 font-medium">
                                                    ⭐ {inst.avg} puntuación
                                                </span>
                                            </div>
                                        </div>

                                        {isWarning ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                                                ⚠ {inst.errors}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                ✓ 100%
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress compliance bar */}
                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <span className="text-slate-500 font-medium">{inst.ok}/{inst.totalWeek} confirmadas</span>
                                            <span className={cn('font-extrabold', inst.rate >= 90 ? 'text-emerald-700' : inst.rate >= 70 ? 'text-amber-700' : 'text-rose-700')}>
                                                {inst.rate}% cumplimiento
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all duration-500',
                                                    inst.rate >= 90 ? 'bg-emerald-500' : inst.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500')}
                                                style={{ width: `${inst.rate}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* FILTER CONTROLS & EXPAND ACTIONS */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    {/* Status filter tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5" /> Estado:
                        </span>
                        {[
                            { key: 'all', label: 'Todos los estados' },
                            { key: 'missing', label: `⚠️ Solo Sin Bitácora (${globalStats.missing})`, highlight: globalStats.missing > 0 },
                            { key: 'confirmed', label: '✅ Confirmadas' },
                            { key: 'inprogress', label: '⏱️ En Curso' },
                        ].map(st => (
                            <button
                                key={st.key}
                                onClick={() => setFilterStatus(st.key as FilterStatus)}
                                className={cn(
                                    'text-xs font-bold px-3 py-1.5 rounded-lg border transition-all',
                                    filterStatus === st.key
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : st.highlight
                                            ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                )}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={expandAll}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-2 py-1"
                        >
                            Expandir todos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            onClick={collapseAll}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-2 py-1"
                        >
                            Colapsar todos
                        </button>
                    </div>
                </div>

                {/* ══ DAILY SCHEDULE ACCORDIONS ═════════════════════════════ */}
                <div className="space-y-4">
                    {weekDays.map((day, di) => {
                        const isToday = isSameDay(day, now);
                        const isPast  = isBefore(startOfDay(day), startOfDay(now));
                        const isOpen  = expandedDays.has(di);
                        const dayEntries = entries.filter(e => isSameDay(e.dateObj, day));
                        const dayMissing = dayEntries.filter(e => e.status === 'missing').length;
                        const dayConfirmed = dayEntries.filter(e => e.status === 'confirmed' || e.status === 'qr').length;
                        const dayCount   = dayEntries.length;

                        return (
                            <div
                                key={di}
                                className={cn(
                                    'rounded-2xl border transition-all overflow-hidden bg-white shadow-xs',
                                    isToday ? 'border-blue-300 ring-2 ring-blue-500/10' : 'border-slate-200',
                                    isPast && !isToday && 'opacity-90'
                                )}
                            >
                                {/* Accordion Header */}
                                <div
                                    onClick={() => toggleDay(di)}
                                    className={cn(
                                        'px-5 py-3.5 flex items-center justify-between cursor-pointer transition-colors select-none',
                                        isToday ? 'bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white' : 'bg-slate-50/80 hover:bg-slate-100/80 text-slate-800'
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Date Tile */}
                                        <div className={cn(
                                            'w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black shadow-xs',
                                            isToday ? 'bg-white/20 text-white border border-white/30' : 'bg-white text-slate-800 border border-slate-200'
                                        )}>
                                            <span className="text-[10px] uppercase tracking-wider leading-tight">
                                                {fmtDate(day, 'EEE', { locale: es })}
                                            </span>
                                            <span className="text-base leading-none">
                                                {fmtDate(day, 'd')}
                                            </span>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-base capitalize">
                                                    {fmtDate(day, 'EEEE, d de MMMM', { locale: es })}
                                                </h3>
                                                {isToday && (
                                                    <span className="bg-blue-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        HOY
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs">
                                                <span className={cn('font-semibold', isToday ? 'text-blue-100' : 'text-slate-500')}>
                                                    {dayCount} {dayCount === 1 ? 'clase agendada' : 'clases agendadas'}
                                                </span>
                                                {dayConfirmed > 0 && (
                                                    <span className={cn('font-bold', isToday ? 'text-emerald-300' : 'text-emerald-700')}>
                                                        • {dayConfirmed} confirmadas
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {dayMissing > 0 ? (
                                            <span className={cn(
                                                'px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs',
                                                isToday ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800 border border-rose-300'
                                            )}>
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                {dayMissing} sin bitácora
                                            </span>
                                        ) : dayCount > 0 ? (
                                            <span className={cn(
                                                'px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5',
                                                isToday ? 'bg-white/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            )}>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Al día
                                            </span>
                                        ) : null}

                                        <div className={cn('p-1 rounded-lg', isToday ? 'text-white/80' : 'text-slate-400')}>
                                            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion Content: Grouped by Slots */}
                                {isOpen && (
                                    <div className="p-4 space-y-4 divide-y divide-slate-100">
                                        {SLOTS.map(slot => {
                                            const slotEntries = dayEntries.filter(e => e.slotStartH === slot.startH);
                                            return (
                                                <div key={slot.startH} className="pt-3 first:pt-0">
                                                    {/* Slot Time Header */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-black border border-slate-200 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                                                            {slot.label}
                                                        </span>
                                                        <span className="text-xs text-slate-400 font-medium">
                                                            ({slotEntries.length} {slotEntries.length === 1 ? 'estudiante' : 'estudiantes'})
                                                        </span>
                                                    </div>

                                                    {/* Classes Grid */}
                                                    {slotEntries.length === 0 ? (
                                                        <div className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl py-3 px-4 text-center">
                                                            Sin clases programadas en este horario
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {slotEntries
                                                                .sort((a, b) => a.instructorName.localeCompare(b.instructorName))
                                                                .map((e, ei) => {
                                                                    const cfg = STATUS_CONFIG[e.status];
                                                                    const inst = INSTRUCTORS.find(i => i.id === e.instructorId) || INSTRUCTORS[0];
                                                                    return (
                                                                        <div
                                                                            key={ei}
                                                                            className={cn(
                                                                                'rounded-xl p-3.5 border transition-all flex items-center justify-between gap-3',
                                                                                cfg.cardBorder, cfg.cardBg
                                                                            )}
                                                                        >
                                                                            {/* Left: Instructor Chip & Student Info */}
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <div
                                                                                    className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs', inst.color)}
                                                                                    title={`Instructor: ${inst.name}`}
                                                                                >
                                                                                    {inst.short}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <div className="font-extrabold text-sm text-slate-900 truncate">
                                                                                        {e.studentName}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                                                        <span className="font-medium text-slate-600">
                                                                                            {inst.name.split(' ')[0]}
                                                                                        </span>
                                                                                        <span>•</span>
                                                                                        <span className="font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.2 rounded text-[11px]">
                                                                                            Clase {e.classNum} de {e.total}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Right: Status Pill */}
                                                                            <div className="shrink-0 flex items-center gap-2">
                                                                                <span className={cn(
                                                                                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border font-bold shadow-2xs',
                                                                                    cfg.badge
                                                                                )}>
                                                                                    <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                                                                                    {cfg.label}
                                                                                </span>
                                                                            </div>
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