
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User, 
  Phone, 
  XCircle,
  CheckCircle2,
  GripVertical,
  Mail,
  Info,
  Tag,
  MessageSquareText,
  Facebook,
  Instagram,
  Megaphone,
  Target,
  Clock,
  Loader2,
  Circle,
  Hash,
  DollarSign,
  ChevronRight,
  Sparkles,
  Car,
  Bike,
  Layers,
  Crown,
  Globe,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle,
    SheetFooter
} from '@/components/ui/sheet';
import { 
    Accordion, 
    AccordionContent, 
    AccordionItem, 
    AccordionTrigger 
} from '@/components/ui/accordion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { WhatsAppIcon } from '../icons/whatsapp';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import { Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

function LeadChat({ leadId, phone, socialId, platform }: { leadId: string, phone: string, socialId?: string, platform?: string }) {
    const db = useFirestore();
    const chatQuery = useMemoFirebase(() => query(collection(db, `leads/${leadId}/messages`), orderBy('timestamp', 'asc')), [db, leadId]);
    const { data: messages, isLoading } = useCollection(chatQuery);
    const [inputValue, setInputValue] = useState('');
    const [sending, setSending] = useState(false);
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || sending) return;
        const text = inputValue;
        setInputValue('');
        setSending(true);
        try {
            const response = await fetch('/api/whatsapp/send', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: phone || socialId, text, leadId, platform, socialId })
            });
            const result = await response.json();
            if (!result?.success) {
                toast({ title: "Error al enviar", description: result?.error || "Error", variant: "destructive" });
            }
        } catch(err) {
            toast({ title: "Fallo de conexión", description: "No se pudo contactar con WhatsApp", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[380px] bg-white">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : messages?.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-10 italic">Aún no hay mensajes. ¡Escribe el primero!</div>
                ) : (
                    <div className="space-y-4">
                        {messages?.map(msg => (
                            <div key={msg.id} className={cn("flex w-full", msg.sender === 'me' ? "justify-end" : "justify-start")}>
                                <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm relative group",
                                    msg.sender === 'me' ? "bg-[#E7FFDB] text-slate-800 rounded-tr-sm shadow-sm border border-[#D1F4C9]" 
                                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                                )}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    <span className="text-[9px] text-slate-400 font-bold block mt-1.5 text-right w-full">{msg.time}</span>
                                </div>
                            </div>
                        ))}
                        {sending && (
                            <div className="flex justify-end w-full">
                                <div className="bg-[#E7FFDB] opacity-50 rounded-2xl px-4 py-3 rounded-tr-sm shadow-sm">
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
            <div className="p-3 border-t bg-slate-50">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)} 
                        disabled={sending}
                        placeholder={sending ? "Enviando..." : "Escribe un mensaje de WhatsApp..."}
                        className="flex-1 text-sm bg-white border border-slate-200 rounded-full px-4 h-10 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/30 transition-all disabled:opacity-50"
                    />
                    <Button 
                        type="submit" 
                        size="icon" 
                        disabled={!inputValue.trim() || sending}
                        className="rounded-full w-10 h-10 bg-[#25D366] hover:bg-[#1DA851] text-white shadow-md hover:shadow-lg transition-all shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}

// ETAPAS POR DEFECTO
const defaultStages = [
    { id: 'new', label: 'Prospección', color: '#94a3b8' },
    { id: 'contacted', label: 'Seguimiento', color: '#f59e0b' },
    { id: 'scheduled', label: 'Negociación', color: '#3b82f6' },
    { id: 'enrolled', label: 'Cierre', color: '#10b981' },
];

// DATA CONSTANTS FOR PRICING
const individualLicenses = [
    { code: 'B', name: 'Ampliación B', price: 57.00 },
    { code: 'C', name: 'Ampliación C', price: 57.00 },
    { code: 'D', name: 'Ampliación D', price: 57.00 },
    { code: 'E1', name: 'Ampliación E1', price: 57.00 },
    { code: 'E2', name: 'Ampliación E2', price: 75.00 },
    { code: 'E3', name: 'Ampliación E3', price: 75.00 },
    { code: 'F', name: 'Ampliación F', price: 80.00 },
];

const comboDeals = [
    { codes: ['B', 'E1', 'E2', 'E3', 'F'], name: 'Combo E1,E2,E3+F+B', price: 150.00 },
    { codes: ['D', 'E1', 'E2', 'E3', 'F'], name: 'Combo D+E1,E2,E3+F', price: 150.00 },
    { codes: ['E1', 'E2', 'E3', 'F'], name: 'Combo E1,E2,E3+F', price: 95.00 },
    { codes: ['E1', 'E2', 'E3'], name: 'Combo E1,E2,E3', price: 85.00 },
    { codes: ['D', 'E1'], name: 'Combo D+E1', price: 85.00 },
    { codes: ['B', 'D'], name: 'Combo B+D', price: 85.00 },
    { codes: ['B', 'E1'], name: 'Combo B+E1', price: 85.00 },
    { codes: ['E2', 'E3'], name: 'Combo E2+E3', price: 85.00 },
    { codes: ['B', 'F'], name: 'Combo B+F', price: 85.00 },
    { codes: ['E1', 'E2'], name: 'Combo E1+E2', price: 75.00 },
].sort((a, b) => b.codes.length - a.codes.length);

const courseList = [
    { id: 'auto_basico', label: 'Curso Básico Auto', price: 133, category: 'Auto' },
    { id: 'auto_plus', label: 'Curso Plus Auto', price: 155, category: 'Auto' },
    { id: 'auto_premium', label: 'Curso Premium Auto', price: 180, category: 'Auto' },
    { id: 'moto_basico', label: 'Curso Básico Moto', price: 115, category: 'Moto' },
    { id: 'moto_plus', label: 'Curso Plus Moto', price: 135, category: 'Moto' },
    { id: 'moto_premium', label: 'Curso Premium Moto', price: 155, category: 'Moto' },
    { id: 'deluxe', label: 'Paquete Deluxe', price: 270, category: 'Especial' },
];

/**
 * Función robusta para calcular el precio basado en el interés del lead.
 */
export const getPriceForInterest = (interest: string | undefined): number => {
    if (!interest) return 150;
    const search = interest.toLowerCase();
    
    // 1. Buscar en lista de cursos estándar
    const course = courseList.find(c => 
        c.id.toLowerCase() === search || 
        c.label.toLowerCase() === search ||
        search.includes(c.id.toLowerCase()) ||
        search.includes(c.label.toLowerCase())
    );
    if (course) return course.price;

    // 2. Buscar en combos de ampliación (Match Directo)
    const combo = comboDeals.find(c => c.name.toLowerCase() === search || search.includes(c.name.toLowerCase()));
    if (combo) return combo.price;

    // 3. Buscar en licencias individuales (Match Directo)
    const individual = individualLicenses.find(l => l.name.toLowerCase() === search || l.code.toLowerCase() === search);
    if (individual) return individual.price;

    // 4. Lógica para combos personalizados: "Combo Personalizado (B+D)"
    if (search.includes('combo') || search.includes('+')) {
        const codesFound = individualLicenses
            .map(l => l.code)
            .filter(code => search.includes(code.toLowerCase()) || search.includes(code.toUpperCase()));
        
        if (codesFound.length > 0) {
            let codesToPrice = [...new Set(codesFound)];
            let currentTotal = 0;

            for (const deal of comboDeals) {
                const canApplyDeal = deal.codes.every(code => codesToPrice.includes(code));
                if (canApplyDeal) {
                    currentTotal += deal.price;
                    deal.codes.forEach(code => {
                        const index = codesToPrice.indexOf(code);
                        if (index > -1) codesToPrice.splice(index, 1);
                    });
                }
            }

            for (const code of codesToPrice) {
                const lic = individualLicenses.find(l => l.code === code);
                if (lic) currentTotal += lic.price;
            }
            
            return currentTotal > 0 ? currentTotal : 150;
        }
    }

    return 150; 
};

const getLabelForInterest = (interest: string | undefined): string => {
    if (!interest) return 'Sin asignar';
    const search = interest.toLowerCase();
    
    const course = courseList.find(c => 
        c.id.toLowerCase() === search || 
        c.label.toLowerCase() === search
    );
    if (course) return course.label;

    const combo = comboDeals.find(c => c.name.toLowerCase() === search);
    if (combo) return combo.name;

    const individual = individualLicenses.find(l => l.code.toLowerCase() === search || l.name.toLowerCase() === search);
    if (individual) return individual.name;

    return interest;
};

export function LeadsFunnel({ 
    leads: initialLeads, 
    onUpdate,
    onOpenChat
}: { 
    leads: any[], 
    onUpdate: () => void,
    onOpenChat?: (leadId: string) => void
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const stagesQuery = useMemoFirebase(() => query(collection(db, 'funnel_stages'), orderBy('order', 'asc')), [db]);
  const { data: dbStages, isLoading: loadingStages } = useCollection(stagesQuery);
  
  const stages = useMemo(() => {
    const rawStages = (!dbStages || dbStages.length === 0) ? defaultStages : dbStages;
    return rawStages.map(s => ({
        ...s,
        icon: s.id === 'new' ? Target : s.id === 'enrolled' ? CheckCircle2 : Info,
        color: s.color || '#3b82f6'
    }));
  }, [dbStages]);

  const [localLeads, setLocalLeads] = useState(initialLeads);
  const [draggedLeadId, setDragId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const [calcSelected, setCalcSelected] = useState<string[]>([]);

  useEffect(() => { setLocalLeads(initialLeads); }, [initialLeads]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const updatedLeads = localLeads.map(lead => 
      lead.id === leadId ? { ...lead, status: newStatus } : lead
    );
    setLocalLeads(updatedLeads);
    
    const leadRef = doc(db, 'leads', leadId);
    updateDoc(leadRef, { status: newStatus })
      .then(() => onUpdate())
      .catch(async (err) => {
        setLocalLeads(initialLeads);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: leadRef.path,
          operation: 'update',
          requestResourceData: { status: newStatus },
        }));
      });
  };

  const handleInterestChange = async (interest: string) => {
    if (!selectedLead || isUpdatingInterest) return;
    
    const updatedLead = { ...selectedLead, interest };
    setSelectedLead(updatedLead);
    setLocalLeads(prev => prev.map(l => l.id === selectedLead.id ? updatedLead : l));
    
    setIsUpdatingInterest(true);
    const leadRef = doc(db, 'leads', selectedLead.id);
    updateDoc(leadRef, { interest })
      .then(() => {
        toast({ title: "Valor Actualizado", description: `Nuevo interés: ${getLabelForInterest(interest)}` });
        onUpdate();
      })
      .catch(async (err) => {
        setLocalLeads(initialLeads);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: leadRef.path,
          operation: 'update',
          requestResourceData: { interest },
        }));
      })
      .finally(() => setIsUpdatingInterest(false));
  };

  const calculateAmpliacionCombo = () => {
    let codesToPrice = [...calcSelected];
    let currentTotal = 0;
    const appliedCombos: string[] = [];

    for (const deal of comboDeals) {
        const canApplyDeal = deal.codes.every(code => codesToPrice.includes(code));
        if (canApplyDeal) {
            currentTotal += deal.price;
            appliedCombos.push(deal.name);
            deal.codes.forEach(code => {
                const index = codesToPrice.indexOf(code);
                if (index > -1) codesToPrice.splice(index, 1);
            });
        }
    }

    for (const code of codesToPrice) {
        const lic = individualLicenses.find(l => l.code === code);
        if (lic) currentTotal += lic.price;
    }

    if (calcSelected.length === 0) return { name: 'Sin selección', total: 0 };
    if (appliedCombos.length === 1 && codesToPrice.length === 0) return { name: appliedCombos[0], total: currentTotal };
    
    return { 
        name: `Combo Personalizado (${calcSelected.sort().join('+')})`, 
        total: currentTotal 
    };
  };

  const leadsByStage = (stageId: string) => localLeads.filter(l => (l.status || 'new') === stageId);
  const calculateColumnValue = (stageLeads: any[]) => stageLeads.reduce((acc, lead) => acc + getPriceForInterest(lead.interest), 0);

  const formatLeadDate = (dateValue: any) => {
    if (!dateValue) return 'Hoy';
    try {
        const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
        return format(date, "dd MMM", { locale: es });
    } catch (e) { return 'Reciente'; }
  };

  const SourceIcon = ({ source, isAd, className }: { source: string, isAd?: boolean, className?: string }) => {
    const iconClass = cn("w-3.5 h-3.5", className);
    if (isAd) return <Megaphone className={cn(iconClass, "text-amber-500")} />;
    switch (source) {
        case 'WhatsApp': return <WhatsAppIcon className={cn(iconClass, "text-emerald-500")} />;
        case 'Facebook': return <Facebook className={cn(iconClass, "text-blue-600")} />;
        case 'Instagram': return <Instagram className={cn(iconClass, "text-pink-600")} />;
        case 'Web Form': return <Globe className={cn(iconClass, "text-slate-500")} />;
        case 'Chat Assistant': return <Bot className={cn(iconClass, "text-primary")} />;
        default: return <User className={cn(iconClass, "text-slate-400")} />;
    }
  };

  if (loadingStages) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest">Organizando tablero...</p>
        </div>
    );
  }

  return (
    <div className="flex gap-4 h-full pb-10 overflow-x-auto scrollbar-hide">
      {stages.map((stage) => {
        const currentLeads = leadsByStage(stage.id);
        const totalValue = calculateColumnValue(currentLeads);
        const isOver = overStageId === stage.id;
        
        return (
          <div 
            key={stage.id} 
            className={cn(
                "flex flex-col gap-3 min-w-[280px] w-72 shrink-0 transition-all duration-300 rounded-2xl p-2",
                isOver ? "bg-slate-200/60 ring-2 ring-primary/20" : "bg-slate-50/50 hover:bg-slate-100/50 border border-slate-100/50 shadow-[inset_0_1px_0_rgba(255,255,255,1)]"
            )}
            onDragOver={(e) => { e.preventDefault(); setOverStageId(stage.id); }}
            onDragLeave={() => setOverStageId(null)}
            onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('leadId');
                setOverStageId(null);
                if (id) handleStatusChange(id, stage.id);
            }}
          >
            <div className="flex flex-col px-3 py-2 mb-1 rounded-xl bg-white/60 backdrop-blur-sm border shadow-sm" style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md" style={{ backgroundColor: `${stage.color}15` }}>
                        <stage.icon className="w-4 h-4" style={{ color: stage.color }} />
                    </div>
                    <h3 className="font-extrabold text-[12px] text-slate-800 uppercase tracking-widest">{stage.label}</h3>
                </div>
                <Badge variant="secondary" className="bg-white border shadow-sm text-slate-500 text-[10px] font-black h-6 px-2 rounded-full">{currentLeads.length}</Badge>
              </div>
              <div className="text-[10px] text-slate-400 font-extrabold mt-1.5 uppercase tracking-tighter flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                B/. {totalValue.toLocaleString()} Proyectado
              </div>
            </div>

            <div className="flex-grow space-y-3 min-h-[500px]">
              <AnimatePresence mode="popLayout">
                {currentLeads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card 
                      draggable 
                      onDragStart={(e) => { e.dataTransfer.setData('leadId', lead.id); setDragId(lead.id); }}
                      onDragEnd={() => { setDragId(null); setOverStageId(null); }}
                      onClick={() => setSelectedLead(lead)}
                      className={cn(
                        "group border-slate-200/60 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-all duration-300 cursor-grab active:cursor-grabbing hover:-translate-y-1 relative bg-white/90 backdrop-blur-md rounded-2xl overflow-hidden hover:ring-1 hover:ring-primary/20",
                        draggedLeadId === lead.id ? "opacity-40 scale-95" : "opacity-100"
                      )}
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full opacity-80" style={{ backgroundColor: stage.color }} />
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
                      
                      <CardContent className="p-4 pl-5 relative z-10">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-100 p-1.5 rounded-md shadow-inner">
                                    <SourceIcon source={lead.source} isAd={lead.isAd} className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {lead.folio || `FW-${lead.id.slice(-6).toUpperCase()}`}
                                </span>
                            </div>
                            <div className="flex items-center bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                                <span className="text-[10px] font-black text-primary">
                                    B/. {getPriceForInterest(lead.interest).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 min-w-0 mb-1.5">
                            <h4 className="font-extrabold text-sm text-slate-800 truncate tracking-tight group-hover:text-primary transition-colors">
                                {lead.name}
                            </h4>
                        </div>
                        
                        <div className="text-[10px] text-slate-400 mb-2 px-0.5 flex items-center gap-1.5">
                            <Phone className="w-2.5 h-2.5 opacity-50" />
                            {lead.phone || 'Sin número'}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                            <span className="text-[8px] font-bold uppercase text-slate-400 truncate max-w-[120px]">
                                {getLabelForInterest(lead.interest)}
                            </span>
                            <div className="text-[8px] text-slate-300 font-bold uppercase tracking-widest flex items-center gap-1">
                                {formatLeadDate(lead.createdAt)}
                                <GripVertical className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}

      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <div className="flex flex-col space-y-8 py-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-50 border rounded-2xl flex items-center justify-center shadow-inner">
                        <SourceIcon source={selectedLead.source} isAd={selectedLead.isAd} className="w-8 h-8" />
                    </div>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-primary text-white text-[10px] font-black tracking-widest">
                                {selectedLead.folio || `FW-${selectedLead.id.slice(-6).toUpperCase()}`}
                            </Badge>
                            <Badge variant="secondary" className="text-[9px] uppercase font-bold text-slate-500">ID: #{selectedLead.id.slice(-6)}</Badge>
                        </div>
                        <SheetTitle className="text-2xl font-bold text-slate-900">{selectedLead.name}</SheetTitle>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                        <Phone className="w-4 h-4 text-slate-400 mb-2" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">WhatsApp</p>
                        <p className="text-sm font-bold text-slate-900">{selectedLead.phone || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                        <DollarSign className="w-4 h-4 text-primary mb-2" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Valor Actual</p>
                        <p className="text-sm font-bold text-primary">B/. {getPriceForInterest(selectedLead.interest).toFixed(2)}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-primary" /> Producto de Interés
                        </h5>
                        {isUpdatingInterest && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full space-y-2 border-none">
                        <AccordionItem value="Auto" className="border rounded-xl bg-slate-50/50 px-4 overflow-hidden border-slate-100 shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-blue-500"><Car className="w-4 h-4" /></div>
                                    <span className="text-xs font-bold text-slate-700 tracking-tight">Cursos de Auto</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 space-y-1">
                                {courseList.filter(c => c.category === 'Auto').map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => handleInterestChange(c.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-lg transition-all text-xs font-bold",
                                            selectedLead.interest === c.id || selectedLead.interest === c.label ? "bg-primary text-white" : "hover:bg-white text-slate-600"
                                        )}
                                    >
                                        <span>{c.label}</span>
                                        <span>B/. {c.price}</span>
                                    </button>
                                ))}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="Moto" className="border rounded-xl bg-slate-50/50 px-4 overflow-hidden border-slate-100 shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-indigo-500"><Bike className="w-4 h-4" /></div>
                                    <span className="text-xs font-bold text-slate-700 tracking-tight">Cursos de Moto</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 space-y-1">
                                {courseList.filter(c => c.category === 'Moto').map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => handleInterestChange(c.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-lg transition-all text-xs font-bold",
                                            selectedLead.interest === c.id || selectedLead.interest === c.label ? "bg-primary text-white" : "hover:bg-white text-slate-600"
                                        )}
                                    >
                                        <span>{c.label}</span>
                                        <span>B/. {c.price}</span>
                                    </button>
                                ))}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="Ampliacion" className="border rounded-xl bg-slate-50/50 px-4 overflow-hidden border-slate-100 shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-500"><Layers className="w-4 h-4" /></div>
                                    <span className="text-xs font-bold text-slate-700 tracking-tight">Ampliaciones (Calculadora)</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 space-y-4 pt-2">
                                <div className="grid grid-cols-4 gap-2">
                                    {individualLicenses.map(lic => {
                                        const isSel = calcSelected.includes(lic.code);
                                        return (
                                            <button
                                                key={lic.code}
                                                onClick={() => setCalcSelected(prev => isSel ? prev.filter(c => c !== lic.code) : [...prev, lic.code])}
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-14",
                                                    isSel ? "bg-primary border-primary text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-primary/30"
                                                )}
                                            >
                                                <span className="text-sm font-black leading-none">{lic.code}</span>
                                                <span className="text-[8px] mt-1 opacity-80">${lic.price}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <div className="p-3 bg-white border rounded-xl shadow-inner">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Estimado</span>
                                        <span className="text-sm font-black text-primary">B/. {calculateAmpliacionCombo().total.toFixed(2)}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 italic mb-3 line-clamp-1">
                                        {calculateAmpliacionCombo().name}
                                    </p>
                                    <Button 
                                        className="w-full h-9 text-[10px] font-bold uppercase rounded-lg" 
                                        disabled={calcSelected.length === 0 || isUpdatingInterest}
                                        onClick={() => handleInterestChange(calculateAmpliacionCombo().name)}
                                    >
                                        Aplicar Cálculo al Alumno
                                    </Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="Especial" className="border rounded-xl bg-slate-50/50 px-4 overflow-hidden border-slate-100 shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-amber-500"><Crown className="w-4 h-4" /></div>
                                    <span className="text-xs font-bold text-slate-700 tracking-tight">Planes Especiales</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 space-y-1">
                                {courseList.filter(c => c.category === 'Especial').map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => handleInterestChange(c.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-lg transition-all text-xs font-bold",
                                            selectedLead.interest === c.id || selectedLead.interest === c.label ? "bg-primary text-white" : "hover:bg-white text-slate-600"
                                        )}
                                    >
                                        <span>{c.label}</span>
                                        <span>B/. {c.price}</span>
                                    </button>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <div className="pt-4 pb-2">
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 rounded-2xl p-5 text-center relative overflow-hidden group shadow-sm">
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white opacity-40 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                        <MessageSquareText className="w-8 h-8 mx-auto text-blue-600 mb-2 drop-shadow-sm" />
                        <h4 className="font-extrabold text-sm text-slate-800 mb-1">Sala de Mensajería</h4>
                        <p className="text-[10px] text-slate-500 mb-4 px-2 tracking-tight">El chat de este prospecto se ha movido al nuevo Centro de Mensajes para mayor comodidad.</p>
                        <Button 
                            className="w-full h-12 font-bold uppercase text-xs rounded-xl shadow-lg shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all hover:scale-105 active:scale-95"
                            onClick={() => {
                                onOpenChat?.(selectedLead.id);
                                setSelectedLead(null); // cerramos el panel
                            }}
                        >
                            <WhatsAppIcon className="w-4 h-4 mr-2" /> Entrar al Chat
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full border-t mt-4 pt-4">
                    <Button 
                        variant="outline" 
                        className="h-12 font-bold text-xs uppercase rounded-xl"
                        onClick={() => { handleStatusChange(selectedLead.id, 'lost'); setSelectedLead(null); }}
                    >
                        <XCircle className="w-4 h-4 mr-2" /> Descartar
                    </Button>
                    <Button 
                        className="h-12 font-bold text-xs uppercase rounded-xl shadow-lg shadow-primary/20"
                        onClick={() => { handleStatusChange(selectedLead.id, 'enrolled'); setSelectedLead(null); }}
                    >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Venta Cerrada
                    </Button>
                </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
