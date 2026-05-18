'use client';

import { useState, useEffect, useMemo } from 'react';
import { Phone, XCircle, CheckCircle2, Target, Loader2, DollarSign, Sparkles, Car, Bike, Layers, Crown, MessageSquareText, GripVertical, Flame, Thermometer, Snowflake, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '../ui/button';
import { WhatsAppIcon } from '../icons/whatsapp';
import { useCollection, useFirestore, useMemoFirebase, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const defaultStages = [
  { id: 'new',       label: 'Leads Entrantes',      color: '#6366F1', bg: '#EEF2FF' },
  { id: 'contacted', label: 'Leads del Dia',         color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'scheduled', label: 'Leads de Seguimiento',  color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'enrolled',  label: 'Certificado Entregado', color: '#10B981', bg: '#ECFDF5' },
];

const individualLicenses = [
  { code: 'B',  name: 'AmpliaciÃ³n B',  price: 57  },
  { code: 'C',  name: 'AmpliaciÃ³n C',  price: 57  },
  { code: 'D',  name: 'AmpliaciÃ³n D',  price: 57  },
  { code: 'E1', name: 'AmpliaciÃ³n E1', price: 57  },
  { code: 'E2', name: 'AmpliaciÃ³n E2', price: 75  },
  { code: 'E3', name: 'AmpliaciÃ³n E3', price: 75  },
  { code: 'F',  name: 'AmpliaciÃ³n F',  price: 80  },
];

const comboDeals = [
  { codes: ['B','E1','E2','E3','F'], name: 'Combo E1,E2,E3+F+B',  price: 150 },
  { codes: ['D','E1','E2','E3','F'], name: 'Combo D+E1,E2,E3+F',  price: 150 },
  { codes: ['E1','E2','E3','F'],     name: 'Combo E1,E2,E3+F',    price: 95  },
  { codes: ['E1','E2','E3'],         name: 'Combo E1,E2,E3',      price: 85  },
  { codes: ['D','E1'],               name: 'Combo D+E1',          price: 85  },
  { codes: ['B','D'],                name: 'Combo B+D',           price: 85  },
  { codes: ['B','E1'],               name: 'Combo B+E1',          price: 85  },
  { codes: ['E2','E3'],              name: 'Combo E2+E3',         price: 85  },
  { codes: ['B','F'],                name: 'Combo B+F',           price: 85  },
  { codes: ['E1','E2'],              name: 'Combo E1+E2',         price: 75  },
].sort((a,b) => b.codes.length - a.codes.length);

const courseList = [
  { id: 'auto_basico',  label: 'Curso BÃ¡sico Auto',  price: 133, category: 'Auto' },
  { id: 'auto_plus',    label: 'Curso Plus Auto',    price: 155, category: 'Auto' },
  { id: 'auto_premium', label: 'Curso Premium Auto', price: 180, category: 'Auto' },
  { id: 'moto_basico',  label: 'Curso BÃ¡sico Moto',  price: 115, category: 'Moto' },
  { id: 'moto_plus',    label: 'Curso Plus Moto',    price: 135, category: 'Moto' },
  { id: 'moto_premium', label: 'Curso Premium Moto', price: 155, category: 'Moto' },
  { id: 'deluxe',       label: 'Paquete Deluxe',     price: 270, category: 'Especial' },
];

export const getPriceForInterest = (interest: string | undefined): number => {
  if (!interest) return 150;
  const s = interest.toLowerCase();
  const course = courseList.find(c => c.id === s || c.label.toLowerCase() === s || s.includes(c.id) || s.includes(c.label.toLowerCase()));
  if (course) return course.price;
  const combo = comboDeals.find(c => c.name.toLowerCase() === s || s.includes(c.name.toLowerCase()));
  if (combo) return combo.price;
  const ind = individualLicenses.find(l => l.name.toLowerCase() === s || l.code.toLowerCase() === s);
  if (ind) return ind.price;
  return 150;
};

const getLabelForInterest = (interest: string | undefined): string => {
  if (!interest) return 'Sin asignar';
  const s = interest.toLowerCase();
  const course = courseList.find(c => c.id === s || c.label.toLowerCase() === s);
  if (course) return course.label;
  const combo = comboDeals.find(c => c.name.toLowerCase() === s);
  if (combo) return combo.name;
  const ind = individualLicenses.find(l => l.code.toLowerCase() === s || l.name.toLowerCase() === s);
  if (ind) return ind.name;
  return interest;
};

function HeatDot({ heat }: { heat?: string }) {
  if (heat === 'hot')  return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100"><Flame className="w-2.5 h-2.5" />Hot</span>;
  if (heat === 'cold') return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100"><Snowflake className="w-2.5 h-2.5" />FrÃ­o</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100"><Thermometer className="w-2.5 h-2.5" />Tibio</span>;
}

function LeadAvatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').slice(0,2).map((w: string) => w[0] || '').join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm" style={{ backgroundColor: color }}>
      {initials || '?'}
    </div>
  );
}

/** Mapea la instancia de WhatsApp al rol responsable del lead */
function getRoleFromInstance(instance?: string, channel?: string): 'Ventas' | 'Ventas Externas' | null {
  if (instance === 'freeway-crm' || (channel === 'whatsapp-qr' && !instance)) return 'Ventas';
  if (instance === 'freeway-crm-2' || instance === 'freeway-crm-3') return 'Ventas Externas';
  return null;
}

/** Badge que muestra el equipo/canal responsable del lead (solo visible para Administrador) */
function RoleBadge({ instance, source, channel }: { instance?: string; source?: string; channel?: string }) {
  const role = getRoleFromInstance(instance, channel);

  // ── Leads de WhatsApp QR o CRM asignados → mostrar rol ──
  if (role === 'Ventas') {
    return (
      <span className="inline-flex items-center text-[9px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full shrink-0 shadow-sm" title="Lead de Ventas">
        Ventas
      </span>
    );
  }
  if (role === 'Ventas Externas') {
    return (
      <span className="inline-flex items-center text-[9px] font-black text-white bg-violet-500 px-2 py-0.5 rounded-full shrink-0 shadow-sm" title="Lead de Ventas Externas">
        Ventas Ext.
      </span>
    );
  }

  // ── Leads sin instancia QR → mostrar canal de origen ──
  const src = source || channel || '';
  if (src.toLowerCase().includes('facebook')) {
    return (
      <span className="inline-flex items-center text-[9px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded-full shrink-0">
        FB
      </span>
    );
  }
  if (src.toLowerCase().includes('instagram')) {
    return (
      <span className="inline-flex items-center text-[9px] font-black text-white bg-pink-500 px-1.5 py-0.5 rounded-full shrink-0">
        IG
      </span>
    );
  }
  if (src.toLowerCase().includes('whatsapp')) {
    return (
      <span className="inline-flex items-center text-[9px] font-black text-white bg-teal-500 px-1.5 py-0.5 rounded-full shrink-0">
        WA
      </span>
    );
  }
  if (src.toLowerCase().includes('registro') || src.toLowerCase().includes('crm')) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
        CRM
      </span>
    );
  }
  return null;
}


export function LeadsFunnel({ leads: initialLeads, onUpdate, onOpenChat, currentRole: _currentRoleProp }: {
  leads: any[]; onUpdate: () => void; onOpenChat?: (id: string) => void; currentRole?: string | null;
}) {
  const db = useFirestore();
  const { role: contextRole } = useFirebase();
  // Usamos el rol del contexto directamente (más confiable que el prop)
  const isAdmin = contextRole === 'Administrador';
  const { toast } = useToast();
  const stagesQuery = useMemoFirebase(() => query(collection(db, 'funnel_stages'), orderBy('order', 'asc')), [db]);
  const { data: dbStages, isLoading } = useCollection(stagesQuery);

  const stages = useMemo(() => {
    const raw = (!dbStages || dbStages.length === 0) ? defaultStages : dbStages;
    return raw.map((s: any, i: number) => ({
      ...s,
      color: s.color || defaultStages[i % 4].color,
      bg:    (s as any).bg    || defaultStages[i % 4].bg,
    }));
  }, [dbStages]);

  const [localLeads, setLocalLeads]     = useState(initialLeads);
  const [draggedId, setDraggedId]       = useState<string | null>(null);
  const [overId, setOverId]             = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isUpdating, setIsUpdating]     = useState(false);
  const [calcSelected, setCalcSelected] = useState<string[]>([]);
  // Páginación por columna
  const [pageLimits, setPageLimits]     = useState<Record<string, number>>({});
  const getLimit = (id: string) => pageLimits[id] ?? 20;
  const showMore = (id: string) => setPageLimits(prev => ({ ...prev, [id]: (prev[id] ?? 20) + 20 }));
  // Columna activa en mobile (0–3)
  const [mobileColIndex, setMobileColIndex] = useState(0);

  useEffect(() => { setLocalLeads(initialLeads); }, [initialLeads]);

  const handleStatusChange = async (leadId: string, status: string) => {
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    const ref = doc(db, 'leads', leadId);
    updateDoc(ref, { status }).then(() => onUpdate()).catch(async err => {
      setLocalLeads(initialLeads);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status } }));
    });
  };

  const handleInterestChange = async (interest: string) => {
    if (!selectedLead || isUpdating) return;
    const updated = { ...selectedLead, interest };
    setSelectedLead(updated);
    setLocalLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
    setIsUpdating(true);
    const ref = doc(db, 'leads', selectedLead.id);
    updateDoc(ref, { interest })
      .then(() => { toast({ title: 'Actualizado', description: getLabelForInterest(interest) }); onUpdate(); })
      .catch(async err => {
        setLocalLeads(initialLeads);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { interest } }));
      })
      .finally(() => setIsUpdating(false));
  };

  const calcCombo = () => {
    let codes = [...calcSelected]; let total = 0; const applied: string[] = [];
    for (const deal of comboDeals) {
      if (deal.codes.every(c => codes.includes(c))) {
        total += deal.price; applied.push(deal.name);
        deal.codes.forEach(c => { const i = codes.indexOf(c); if (i > -1) codes.splice(i, 1); });
      }
    }
    for (const c of codes) { const l = individualLicenses.find(x => x.code === c); if (l) total += l.price; }
    if (calcSelected.length === 0) return { name: 'Sin selecciÃ³n', total: 0 };
    if (applied.length === 1 && codes.length === 0) return { name: applied[0], total };
    return { name: `Combo (${calcSelected.sort().join('+')})`, total };
  };

  const knownStatuses = new Set(['new', 'contacted', 'scheduled', 'enrolled']);
  const byStage   = (id: string) => localLeads.filter(l => {
    const s = l.status || 'new';
    return (knownStatuses.has(s) ? s : 'new') === id;
  });
  const stageVal  = (ls: any[])  => ls.reduce((acc, l) => acc + getPriceForInterest(l.interest), 0);
  const fmtDate   = (v: any) => {
    if (!v) return '';
    try { return format(v?.toDate ? v.toDate() : new Date(v), 'dd MMM', { locale: es }); } catch { return ''; }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest">Cargando tablero...</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col">

      {/* ── NAVEGADOR DE COLUMNA (solo mobile) ─────────────────────── */}
      <div className="flex md:hidden items-center justify-between px-3 pb-3 shrink-0">
        <button
          onClick={() => setMobileColIndex(i => Math.max(0, i - 1))}
          disabled={mobileColIndex === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        <div className="flex items-center gap-2">
          {stages.map((s: any, i: number) => (
            <button
              key={s.id}
              onClick={() => setMobileColIndex(i)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-200",
                mobileColIndex === i ? "scale-125" : "opacity-40"
              )}
              style={{ backgroundColor: s.color }}
            />
          ))}
        </div>
        <button
          onClick={() => setMobileColIndex(i => Math.min(stages.length - 1, i + 1))}
          disabled={mobileColIndex === stages.length - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold"
        >
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── TABLERO ────────────────────────────────────────────── */}
      <div className="flex-grow overflow-hidden">
        {/* Mobile: 1 columna visible */}
        <div className="flex md:hidden h-full">
          {stages.map((stage: any, idx: number) => {
            if (idx !== mobileColIndex) return null;
            const stageLeads = byStage(stage.id);
            const total = stageVal(stageLeads);
            const StageIcon = stage.id === 'new' ? Target : stage.id === 'contacted' ? MessageSquareText : stage.id === 'scheduled' ? DollarSign : CheckCircle2;
            return (
              <div key={stage.id} className="flex flex-col w-full px-3 pb-3">
                {/* Header columna */}
                <div
                  className="flex items-center justify-between px-4 py-3 mb-3 bg-white rounded-xl border border-slate-200/80 shadow-sm"
                  style={{ borderLeft: `4px solid ${stage.color}` }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{stage.label}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: stage.color }}>{stageLeads.length}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">B/. {total.toLocaleString()} proyectado</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: stage.bg }}>
                    <StageIcon className="w-4 h-4" style={{ color: stage.color }} />
                  </div>
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2.5 overflow-y-auto flex-grow">
                  <AnimatePresence>
                    {stageLeads.slice(0, getLimit(stage.id)).map(lead => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        onClick={() => setSelectedLead(lead)}
                        className={cn(
                          'bg-white rounded-xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer group select-none overflow-hidden hover:-translate-y-0.5 hover:border-slate-300',
                          draggedId === lead.id && 'opacity-40 scale-95'
                        )}
                        style={{ borderLeft: `3px solid ${stage.color}`, flexShrink: 0 }}
                      >
                        <div className="p-3.5 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{lead.name}</p>
                              {lead.phone && (
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                  <Phone className="w-2.5 h-2.5 shrink-0" />{lead.phone}
                                </p>
                              )}
                            </div>
                            {isAdmin && <RoleBadge instance={lead.whatsappInstance} source={lead.source} channel={lead.channel} />}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <HeatDot heat={lead.heat} />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">B/. {getPriceForInterest(lead.interest)}</span>
                              {lead.createdAt && <span className="text-[9px] text-slate-400 font-semibold">{fmtDate(lead.createdAt)}</span>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {stageLeads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-slate-200 text-slate-300">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: stage.bg }}>
                        <Target className="w-4 h-4" style={{ color: stage.color }} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">Sin leads</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tablet/Desktop: scroll horizontal con todas las columnas */}
        <div className="hidden md:flex gap-4 lg:gap-5 h-full pb-6 overflow-x-auto">
          {stages.map((stage: any) => {
            const stageLeads = byStage(stage.id);
            const total = stageVal(stageLeads);
            const isOver = overId === stage.id;
            const StageIcon = stage.id === 'new' ? Target : stage.id === 'contacted' ? MessageSquareText : stage.id === 'scheduled' ? DollarSign : CheckCircle2;
            return (
              <div
                key={stage.id}
                className={cn('flex flex-col w-52 md:w-56 lg:w-64 xl:w-80 shrink-0 rounded-2xl transition-all duration-200', isOver && 'scale-[1.01]')}
                onDragOver={e => { e.preventDefault(); setOverId(stage.id); }}
                onDragLeave={() => setOverId(null)}
                onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('leadId'); setOverId(null); if (id) handleStatusChange(id, stage.id); }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 mb-3 bg-white rounded-xl border border-slate-200/80 shadow-sm"
                  style={{ borderLeft: `4px solid ${stage.color}` }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{stage.label}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: stage.color }}>{stageLeads.length}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">B/. {total.toLocaleString()} proyectado</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: stage.bg }}>
                    <StageIcon className="w-4 h-4" style={{ color: stage.color }} />
                  </div>
                </div>

                {/* Cards */}
                <div
                  className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-grow"
                  style={{ maxHeight: '75vh' }}
                >
                  <AnimatePresence>
                    {stageLeads.map(lead => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        draggable
                        onDragStart={e => { (e as unknown as React.DragEvent).dataTransfer.setData('leadId', lead.id); setDraggedId(lead.id); }}
                        onDragEnd={() => { setDraggedId(null); setOverId(null); }}
                        onClick={() => setSelectedLead(lead)}
                        className={cn(
                          'bg-white rounded-xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer group select-none overflow-hidden hover:-translate-y-0.5 hover:border-slate-300',
                          draggedId === lead.id && 'opacity-40 scale-95'
                        )}
                        style={{ borderLeft: `3px solid ${stage.color}`, minHeight: '88px', flexShrink: 0 }}
                      >
                        <div className="p-3.5 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{lead.name}</p>
                              {lead.phone && (
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                  <Phone className="w-2.5 h-2.5 shrink-0" />{lead.phone}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isAdmin && <RoleBadge instance={lead.whatsappInstance} source={lead.source} channel={lead.channel} />}
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <HeatDot heat={lead.heat} />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                B/. {getPriceForInterest(lead.interest)}
                              </span>
                              {lead.createdAt && <span className="text-[9px] text-slate-400 font-semibold">{fmtDate(lead.createdAt)}</span>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {stageLeads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-slate-200 text-slate-300">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: stage.bg }}>
                        <Target className="w-4 h-4" style={{ color: stage.color }} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">Sin leads</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedLead} onOpenChange={open => !open && setSelectedLead(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto bg-white">
          {selectedLead && (() => {
            const stg = stages.find((s: any) => s.id === (selectedLead.status || 'new')) || stages[0];
            return (
              <div className="flex flex-col space-y-6 py-4">
                <div className="flex items-center gap-4">
                  <LeadAvatar name={selectedLead.name || '?'} color={stg.color} />
                  <div>
                    <SheetTitle className="text-lg font-bold text-slate-900">{selectedLead.name}</SheetTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: stg.color }}>{selectedLead.folio || 'QR-' + (selectedLead.id || '').slice(-6).toUpperCase()}</span>
                      <HeatDot heat={selectedLead.heat} />
                      {isAdmin && <RoleBadge instance={selectedLead.whatsappInstance} source={selectedLead.source} channel={selectedLead.channel} />}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">WhatsApp</p>
                    <p className="text-sm font-bold text-slate-800">{selectedLead.phone || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Valor</p>
                    <p className="text-sm font-bold text-emerald-700">B/. {getPriceForInterest(selectedLead.interest)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-blue-500" />Producto de InterÃ©s
                  </p>
                  <Accordion type="single" collapsible className="space-y-2">
                    {[
                      { value: 'Auto',     icon: Car,   label: 'Cursos de Auto',    cls: 'text-blue-500',   items: courseList.filter(c => c.category === 'Auto') },
                      { value: 'Moto',     icon: Bike,  label: 'Cursos de Moto',    cls: 'text-orange-500', items: courseList.filter(c => c.category === 'Moto') },
                      { value: 'Especial', icon: Crown, label: 'Planes Especiales', cls: 'text-amber-500',  items: courseList.filter(c => c.category === 'Especial') },
                    ].map(cat => (
                      <AccordionItem key={cat.value} value={cat.value} className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2">
                            <cat.icon className={cn('w-4 h-4', cat.cls)} />
                            <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3 space-y-1">
                          {cat.items.map(c => (
                            <button key={c.id} onClick={() => handleInterestChange(c.id)}
                              className={cn('w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-bold transition-all',
                                selectedLead.interest === c.id || selectedLead.interest === c.label
                                  ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600')}>
                              <span>{c.label}</span><span>B/. {c.price}</span>
                            </button>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                    <AccordionItem value="Ampliacion" className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-bold text-slate-700">Ampliaciones (Calculadora)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-3 pt-1">
                        <div className="grid grid-cols-4 gap-2">
                          {individualLicenses.map(lic => {
                            const sel = calcSelected.includes(lic.code);
                            return (
                              <button key={lic.code}
                                onClick={() => setCalcSelected(prev => sel ? prev.filter(c => c !== lic.code) : [...prev, lic.code])}
                                className={cn('flex flex-col items-center justify-center p-2 rounded-lg border h-14 transition-all text-xs font-black',
                                  sel ? 'bg-blue-600 border-blue-600 text-white shadow' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300')}>
                                {lic.code}
                                <span className={cn('text-[8px] mt-0.5', sel ? 'opacity-80' : 'opacity-50')}>${lic.price}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                            <span className="text-sm font-black text-blue-600">B/. {calcCombo().total}</span>
                          </div>
                          <p className="text-[9px] text-slate-400 italic mb-2 truncate">{calcCombo().name}</p>
                          <Button className="w-full h-8 text-[10px] font-bold uppercase rounded-lg bg-blue-600 hover:bg-blue-700"
                            disabled={calcSelected.length === 0 || isUpdating}
                            onClick={() => handleInterestChange(calcCombo().name)}>
                            Aplicar al alumno
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-center">
                  <MessageSquareText className="w-7 h-7 mx-auto text-blue-500 mb-2" />
                  <p className="text-xs font-bold text-slate-700 mb-1">Centro de Mensajes</p>
                  <p className="text-[10px] text-slate-400 mb-3">El chat estÃ¡ en el Centro de Mensajes.</p>
                  <Button className="w-full h-10 font-bold text-xs rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md"
                    onClick={() => { onOpenChat?.(selectedLead.id); setSelectedLead(null); }}>
                    <WhatsAppIcon className="w-4 h-4 mr-2" /> Abrir Chat
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                  <Button variant="outline" className="h-10 font-bold text-xs uppercase rounded-xl hover:text-red-500 hover:border-red-200"
                    onClick={() => { handleStatusChange(selectedLead.id, 'lost'); setSelectedLead(null); }}>
                    <XCircle className="w-4 h-4 mr-2" />Descartar
                  </Button>
                  <Button className="h-10 font-bold text-xs uppercase rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => { handleStatusChange(selectedLead.id, 'enrolled'); setSelectedLead(null); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />Venta Cerrada
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}