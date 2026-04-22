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
    { id: '4', name: 'Carlos Melendes' },
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
                            if (s.instructor) {
                                contractClasses.push({
                                    studentName: c.clientName,
                                    vehicle: s.vehicle,
                                    timeSlot: s.time,
                                    status: s.status || 'scheduled',
                                    date: s.date,
                                    instructor: s.instructor,
                                });
                            }
                        });
                    };
                    if (c.autoMotoDetails?.practicalClassSchedules) processSlots(c.autoMotoDetails.practicalClassSchedules);
                    if (c.autoMotoDetails?.motoPracticalClassSchedules) processSlots(c.autoMotoDetails.motoPracticalClassSchedules);
                    if (c.deluxeDetails?.classSchedules) processSlots(c.deluxeDetails.classSchedules);
                });

                const bitacoraSnap = await getDocs(collection(db, 'bitacora_practica'));
                const bitacoras = bitacoraSnap.docs.map(d => d.data());

                if (isMounted) {
                    setRawClasses([...manualClasses, ...contractClasses]);
                    setRawBitacoras(bitacoras);
                }
            } catch (e) {
                console.error('Failed to load quality report', e);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [db]);

    const instructorData = useMemo(() => {
        const todayStart = startOfDay(new Date());
        const weekStart = startOfDay(startOfWeek(currentDate, { weekStartsOn: 1 }));

        return INSTRUCTORS.map(inst => {
            const instBitacoras = rawBitacoras.filter(
                b => b.instructorName === inst.name && b.studentConfirmed && typeof b.studentRating === 'number'
            );
            const ratingSum = instBitacoras.reduce((acc: number, b: any) => acc + b.studentRating, 0);
            const avgRating = instBitacoras.length > 0 ? (ratingSum / instBitacoras.length).toFixed(1) : 'N/A';

            const myClasses = rawClasses.filter(c => c.instructor === inst.name);
            const studentClassesMap = new Map<string, any[]>();

            myClasses.forEach(c => {
                if (!c.date) return;
                let dObj = c.date;
                if (typeof c.date.toDate === 'function') dObj = c.date.toDate();
                else if (typeof c.date === 'string') dObj = parseISO(c.date);
                else if (!(c.date instanceof Date)) dObj = new Date(c.date);
                if (isNaN(dObj.getTime())) return;

                if (!studentClassesMap.has(c.studentName)) studentClassesMap.set(c.studentName, []);
                const list = studentClassesMap.get(c.studentName)!;
                const isDuplicate = list.some((e: any) => e.timeSlot === c.timeSlot && isSameDay(e.dateObj, dObj));
                if (!isDuplicate) list.push({ ...c, dateObj: dObj });
            });

            studentClassesMap.forEach(list => {
                list.sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());
                list.forEach((cl: any, idx: number) => {
                    cl.classNumber = idx + 1;
                    cl.totalStudentClasses = list.length;
                });
            });

            let totalMissed = 0;
            let totalClasses = 0;
            const normalizedSearch = searchTerm.trim().toLowerCase();

            const weekDaysData = Array.from({ length: 7 }).map((_, i) => {
                const dayDate = addDays(weekStart, i);
                const classesOnThisDay: any[] = [];

                studentClassesMap.forEach(list => {
                    list.forEach((c: any) => {
                        if (!isSameDay(c.dateObj, dayDate)) return;
                        if (normalizedSearch && !(c.studentName || '').toLowerCase().includes(normalizedSearch)) return;
                        const isPast = isBefore(startOfDay(c.dateObj), todayStart);
                        const isMissed = isPast && c.status !== 'completed';
                        if (isMissed) totalMissed++;
                        classesOnThisDay.push({ ...c, isMissed, isPast, isCompleted: isPast && !isMissed, isFuture: !isPast });
                    });
                });

                classesOnThisDay.sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));
                totalClasses += classesOnThisDay.length;

                const dayName = formatDate(dayDate, 'EEEE', { locale: es }).toLowerCase();
                const letter = dayName === 'miércoles' ? 'X' : dayName.charAt(0).toUpperCase();

                return { date: dayDate, letter, dayNumber: formatDate(dayDate, 'dd'), classes: classesOnThisDay };
            });

            return { ...inst, avgRating, ratingCount: instBitacoras.length, days: weekDaysData, totalMissed, totalClasses };
        });
    }, [rawClasses, rawBitacoras, currentDate, searchTerm]);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Cargando monitor...</span>
            </div>
        );
    }

    return (
        <div className="-m-4 md:-m-8 bg-slate-50 min-h-screen">

            {/* ── Toolbar ─────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white sticky top-16 z-10 print:hidden">
                <Activity className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide shrink-0">Monitor de Calidad</span>
                <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                    En vivo · freewayescuelademanejo.com
                </span>

                <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />

                {/* Week nav */}
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setCurrentDate(d => subWeeks(d, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap min-w-[120px] text-center">
                        {formatDate(weekStart, 'dd MMM', { locale: es })} – {formatDate(weekEnd, 'dd MMM', { locale: es })}
                    </span>
                    <button onClick={() => setCurrentDate(d => addWeeks(d, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />

                {/* Search */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar estudiante..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-3 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* ── Instructor List ──────────────────────────────────────────────── */}
            <div className="divide-y divide-slate-100">
                {instructorData.map(inst => {
                    const isExpanded = expandedInstructor === inst.id;
                    const hasAlerts = inst.totalMissed > 0;

                    return (
                        <div key={inst.id} className="bg-white">
                            {/* Row */}
                            <button
                                onClick={() => setExpandedInstructor(isExpanded ? null : inst.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                    isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'
                                )}
                            >
                                {/* Avatar */}
                                <div className={cn(
                                    'w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                                    hasAlerts ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                                )}>
                                    {inst.name.charAt(0)}
                                </div>

                                <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate text-left">
                                    {inst.name}
                                </span>

                                {/* Rating */}
                                <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold shrink-0">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span>{inst.avgRating}</span>
                                    <span className="text-slate-400 font-normal text-[10px]">({inst.ratingCount})</span>
                                </div>

                                {/* Classes count */}
                                <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">
                                    {inst.totalClasses} clases
                                </span>

                                {/* Alert badge */}
                                {hasAlerts ? (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                                        <AlertCircle className="w-2.5 h-2.5" />
                                        {inst.totalMissed}
                                    </div>
                                ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                )}

                                <ChevronDown className={cn('w-3.5 h-3.5 text-slate-300 shrink-0 transition-transform duration-200', isExpanded && 'rotate-180')} />
                            </button>

                            {/* Expanded Panel */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                                    {inst.totalClasses === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-3">Sin clases esta semana.</p>
                                    ) : (
                                        <div className="grid grid-cols-7 gap-1">
                                            {inst.days.map((day: any, dIdx: number) => (
                                                <div key={dIdx}>
                                                    {/* Day header */}
                                                    <div className="text-center mb-1 pb-1 border-b border-slate-200">
                                                        <div className="text-[11px] font-bold text-slate-600">{day.letter}</div>
                                                        <div className="text-[10px] text-slate-400 leading-none">{day.dayNumber}</div>
                                                    </div>
                                                    {/* Classes */}
                                                    <div className="flex flex-col gap-0.5">
                                                        {day.classes.length === 0 ? (
                                                            <div className="flex justify-center py-1">
                                                                <span className="text-slate-200 text-xs">–</span>
                                                            </div>
                                                        ) : (
                                                            day.classes.map((c: any, cIdx: number) => (
                                                                <div
                                                                    key={cIdx}
                                                                    title={`${c.studentName} · ${c.timeSlot} · Clase ${c.classNumber}/${c.totalStudentClasses}${c.isMissed ? ' · ⚠ Sin bitácora' : ''}`}
                                                                    className={cn(
                                                                        'rounded px-1 py-0.5 text-[9px] leading-tight border cursor-default',
                                                                        c.isMissed
                                                                            ? 'bg-red-50 border-red-200 text-red-700'
                                                                            : c.isCompleted
                                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                            : 'bg-white border-slate-200 text-slate-500'
                                                                    )}
                                                                >
                                                                    <div className="font-semibold truncate">{(c.studentName || '').split(' ')[0]}</div>
                                                                    <div className="flex items-center justify-between gap-0.5 mt-0.5">
                                                                        <span className="opacity-60 truncate">{c.timeSlot}</span>
                                                                        {c.isMissed && <ShieldAlert className="w-2 h-2 shrink-0 text-red-500" />}
                                                                        {c.isCompleted && <CheckCircle2 className="w-2 h-2 shrink-0 text-emerald-500" />}
                                                                        {c.isFuture && <CalendarClock className="w-2 h-2 shrink-0 text-slate-300" />}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Legend */}
                                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Leyenda:</span>
                                        <span className="flex items-center gap-1 text-[9px] text-emerald-600"><CheckCircle2 className="w-2.5 h-2.5" /> Completada</span>
                                        <span className="flex items-center gap-1 text-[9px] text-red-500"><ShieldAlert className="w-2.5 h-2.5" /> Sin bitácora</span>
                                        <span className="flex items-center gap-1 text-[9px] text-slate-400"><CalendarClock className="w-2.5 h-2.5" /> Pendiente</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
