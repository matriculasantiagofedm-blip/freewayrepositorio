'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
    isBefore, parseISO, startOfDay, format as formatDate,
    startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertCircle, Star, CalendarClock, ChevronDown,
    ChevronLeft, ChevronRight, ShieldAlert, CheckCircle2,
    Loader2, Activity, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

const INSTRUCTORS = [
    { id: '1', name: 'Emmanuel Camargo' },
    { id: '2', name: 'Julisse Alonso' },
    { id: '3', name: 'Adrian Gordon' },
    { id: '4', name: 'Roberto Brown' },
];

export default function QualityMonitoringPage() {
    const db = useDb();
    const [isLoading, setIsLoading] = useState(true);
    const [rawClasses, setRawClasses] = useState<any[]>([]);
    const [rawBitacoras, setRawBitacoras] = useState<any[]>([]);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const manualSnap = await getDocs(collection(db, 'manual_schedules'));
                const manualClasses = manualSnap.docs.map(d => ({ dbId: d.id, ...d.data() }));
                const contractsSnap = await getDocs(collection(db, 'contracts'));
                const contractClasses: any[] = [];
                contractsSnap.forEach(d => {
                    const c = d.data();
                    const processSlots = (slots: any[]) => {
                        if (!slots) return;
                        slots.forEach((s: any) => {
                            if (s.instructor) contractClasses.push({ studentName: c.clientName, vehicle: s.vehicle, timeSlot: s.time, status: s.status || 'scheduled', date: s.date, instructor: s.instructor });
                        });
                    };
                    if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
                    if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
                    if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
                });
                const bitacoraSnap = await getDocs(collection(db, 'bitacora_practica'));
                if (isMounted) {
                    setRawClasses([...manualClasses, ...contractClasses]);
                    setRawBitacoras(bitacoraSnap.docs.map(d => d.data()));
                }
            } catch (e) { console.error(e); }
            finally { if (isMounted) setIsLoading(false); }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [db]);

    const instructorData = useMemo(() => {
        const todayStart = startOfDay(new Date());
        const weekStart = startOfDay(startOfWeek(currentDate, { weekStartsOn: 1 }));
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
                    const mis = past && c.status !== 'completed';
                    if (mis) missed++;
                    classes.push({ ...c, isMissed: mis, isCompleted: past && !mis, isFuture: !past });
                }));
                classes.sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));
                total += classes.length;
                const dn = formatDate(day, 'EEEE', { locale: es }).toLowerCase();
                return { date: day, letter: dn === 'miércoles' ? 'X' : dn.charAt(0).toUpperCase(), dayNum: formatDate(day, 'dd'), classes };
            });
            return { ...inst, avg, bitas: bitas.length, days, missed, total };
        });
    }, [rawClasses, rawBitacoras, currentDate, searchTerm]);

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
                                        : <div className="grid grid-cols-7 gap-1">
                                            {inst.days.map((day: any, di: number) => (
                                                <div key={di}>
                                                    <div className="text-center mb-1 pb-0.5 border-b border-slate-200">
                                                        <div className="text-[10px] font-bold text-slate-500">{day.letter}</div>
                                                        <div className="text-[9px] text-slate-400 leading-none">{day.dayNum}</div>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        {day.classes.length === 0
                                                            ? <div className="flex justify-center"><span className="text-slate-200 text-[9px]">–</span></div>
                                                            : day.classes.map((c: any, ci: number) => (
                                                                <div key={ci} title={`${c.studentName} · ${c.timeSlot} · #${c.classNumber}/${c.total}${c.isMissed ? ' · ⚠ Sin bitácora' : ''}`}
                                                                    className={cn('rounded px-0.5 py-0.5 text-[8px] leading-none border cursor-default',
                                                                        c.isMissed ? 'bg-red-50 border-red-200 text-red-700'
                                                                            : c.isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                                : 'bg-white border-slate-200 text-slate-400')}>
                                                                    <div className="font-semibold truncate">{(c.studentName || '').split(' ')[0]}</div>
                                                                    <div className="flex items-center justify-between gap-0.5 mt-0.5">
                                                                        <span className="opacity-60 truncate">{c.timeSlot}</span>
                                                                        {c.isMissed && <ShieldAlert className="w-1.5 h-1.5 shrink-0" />}
                                                                        {c.isCompleted && <CheckCircle2 className="w-1.5 h-1.5 shrink-0" />}
                                                                        {c.isFuture && <CalendarClock className="w-1.5 h-1.5 shrink-0 text-slate-300" />}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            ))}
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
