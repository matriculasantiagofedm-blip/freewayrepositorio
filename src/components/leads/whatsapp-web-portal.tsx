'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Search, 
    MoreVertical, 
    Paperclip, 
    Smile, 
    Send, 
    CheckCheck, 
    Zap, 
    Loader2,
    Bot,
    Sparkles,
    ShieldCheck,
    MessageCircle,
    UserCircle2,
    Settings,
    Copy,
    Wand2,
    History,
    Plus,
    Trash2,
    CircleCheckBig,
    Edit2,
    CheckCircle,
    FileText,
    ChevronDown,
    Car,
    Bike,
    Dumbbell,
    Repeat,
    Layers,
    ExternalLink,
    X,
    Bot as BotIcon,
    User as UserIcon,
    Calendar,
    DollarSign,
    HelpCircle,
    ImageIcon,
    Mic,
    MicOff,
    Download,
    Volume2,
    FileIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAssistantResponse, getMessages, getImprovedMessageAction } from '@/app/actions/crm';
import { marked } from 'marked';
import { Message } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from '../icons/whatsapp';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, setDoc, getDoc, collection, query, orderBy, limit, where, getDocs, Timestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { buildScheduleContext } from '@/lib/schedule-context';

export function WhatsAppWebPortal({ 
    leads,
    preselectedId,
    currentUser
}: { 
    leads: any[],
    preselectedId?: string | null,
    currentUser: any
}) {
    const [selectedChat, setSelectedChat] = useState<any | null>(null);
    const [showChatList, setShowChatList] = useState(true); // mobile: toggle between list and chat
    const [inputValue, setInputValue] = useState('');
    // ── COPILOTO IA v2 ────────────────────────────────────────
    const [copilotLoading, setCopilotLoading] = useState(false);
    const [copilotOptions, setCopilotOptions] = useState<{directa:string;cierre:string;persuasiva:string}|null>(null);
    const [copilotError, setCopilotError] = useState<string|null>(null);
    const [showCopilot, setShowCopilot] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false); // EnvÃ­o de mensajes
    const [isImproving, setIsImproving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [isBotEnabled, setIsBotEnabled] = useState(currentUser?.chatbotEnabled || false);
    const [quickReplies, setQuickReplies] = useState<any[]>(currentUser?.quickReplies || []);
    const [isManageRepliesOpen, setIsManageRepliesOpen] = useState(false);
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [newReply, setNewReply] = useState({ title: '', content: '' });
    const [isConsultorOpen, setIsConsultorOpen] = useState(false);
    
    // â”€â”€ MULTIMEDIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [pendingMedia, setPendingMedia] = useState<{ base64: string; mediaType: string; mimeType: string; fileName: string; previewUrl: string } | null>(null);
    const [isRecording, setIsRecording]   = useState(false);
    const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null);
    const [isSendingMedia, setIsSendingMedia] = useState(false);

    const fileInputRef  = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const docInputRef   = useRef<HTMLInputElement>(null);
    const mediaRecRef   = useRef<MediaRecorder | null>(null);
    const chunksRef     = useRef<Blob[]>([]);

    const [consultorMessages, setConsultorMessages] = useState<{id:string;role:'user'|'ai';text:string}[]>([
        { id: 'welcome', role: 'ai', text: 'Hola! Soy tu Consultor IA.\n\nPreguntame sobre:\n- Precios de cursos\n- Horarios disponibles esta semana\n- Cualquier duda sobre los servicios\n\nEjemplo: que horarios libres hay para auto automatico esta semana?' }
    ]);
    const [consultorInput, setConsultorInput] = useState('');
    const [consultorLoading, setConsultorLoading] = useState(false);
    const consultorScrollRef = useRef<HTMLDivElement>(null);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // â”€â”€ Seleccionar archivo (imagen / documento / audio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            const mediaType = file.type.startsWith('image/') ? 'image'
                : file.type.startsWith('video/') ? 'video'
                : 'document';
            setPendingMedia({ base64, mediaType, mimeType: file.type, fileName: file.name, previewUrl: result });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, []);

    // â”€â”€ Grabar audio (nota de voz) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleToggleRecording = useCallback(async () => {
        if (isRecording) {
            mediaRecRef.current?.stop();
            setIsRecording(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            chunksRef.current = [];
            const rec = new MediaRecorder(stream);
            mediaRecRef.current = rec;
            rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
            rec.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    setPendingMedia({ base64: result.split(',')[1], mediaType: 'audio', mimeType: 'audio/ogg; codecs=opus', fileName: 'nota_de_voz.ogg', previewUrl: URL.createObjectURL(blob) });
                };
                reader.readAsDataURL(blob);
            };
            rec.start();
            setIsRecording(true);
        } catch { toast({ title: 'MicrÃ³fono no disponible', variant: 'destructive' }); }
    }, [isRecording, toast]);

    const sendConsultorMessage = async (question: string) => {
        if (!question.trim() || consultorLoading) return;
        const userMsg = { id: Date.now().toString(), role: 'user' as const, text: question };
        setConsultorMessages(prev => [...prev, userMsg]);
        setConsultorInput('');
        setConsultorLoading(true);
        try {
            let scheduleContext = '';
            if (db) {
                try {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const endDate = new Date(today); endDate.setDate(endDate.getDate() + 90); endDate.setHours(23,59,59,999);

                    const [contractsSnap, manualSnap] = await Promise.all([
                        getDocs(query(collection(db, 'contracts'), where('status', 'in', ['active', 'completed']))),
                        getDocs(query(
                            collection(db, 'manual_schedules'),
                            where('date', '>=', Timestamp.fromDate(today)),
                            where('date', '<=', Timestamp.fromDate(endDate))
                        ))
                    ]);

                    const contracts = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const manualEntries = manualSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    scheduleContext = buildScheduleContext(contracts, manualEntries);
                } catch (schedErr) {
                    console.warn('[Consultor] Error cargando agenda:', schedErr);
                    scheduleContext = 'NOTA: No se pudo cargar la agenda en este momento.';
                }
            }

            const res = await fetch('/api/ai/consultant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, scheduleContext }),
            });
            const data = await res.json();
            setConsultorMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'ai', text: data.text || 'Sin respuesta.' }]);
        } catch {
            setConsultorMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'ai', text: 'âŒ Error de conexion.' }]);
        } finally {
            setConsultorLoading(false);
        }
    };



    useEffect(() => {
        if (consultorScrollRef.current) {
            const el = consultorScrollRef.current;
            el.scrollTop = el.scrollHeight;
        }
    }, [consultorMessages, consultorLoading]);
    const db = useFirestore();

    useEffect(() => {
        if (preselectedId) {
            setSelectedChat((prev: any) => {
                const updatedChat = leads.find(l => l.id === preselectedId);
                if (!updatedChat) return prev;
                if (!prev || prev.id !== preselectedId) {
                    setShowChatList(false); // auto-open chat on mobile when preselected
                    return { ...updatedChat, messages: [] };
                }
                return { ...updatedChat, messages: prev.messages || [] };
            });
        }
    }, [preselectedId, leads]);

    const chatQuery = useMemoFirebase(() => {
        if (!db || !selectedChat?.id) return null;
        return query(collection(db, `leads/${selectedChat.id}/messages`), orderBy('timestamp', 'asc'), limit(50));
    }, [db, selectedChat?.id]);
    
    const { data: realtimeMessages } = useCollection(chatQuery);

    useEffect(() => {
        if (realtimeMessages && selectedChat?.id) {
             setSelectedChat((prev: any) => prev && prev.id === selectedChat.id ? { ...prev, messages: realtimeMessages } : prev);
        }
    }, [realtimeMessages, selectedChat?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
    }, [selectedChat?.messages, copilotLoading]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const hasText  = inputValue.trim();
        const hasMedia = !!pendingMedia;
        if ((!hasText && !hasMedia) || !selectedChat || isSendingMessage) return;

        const textToSend = inputValue;
        const mediaToSend = pendingMedia;
        setInputValue('');
        setPendingMedia(null);
        setIsSendingMessage(true);
        try {
            const payload: any = { 
                to: selectedChat.phone || selectedChat.socialId, 
                text: textToSend || '', 
                leadId: selectedChat.id,
                platform: selectedChat.source || 'WhatsApp',
                socialId: selectedChat.socialId,
                // Enviar desde la misma instancia que usÃ³ el cliente
                instance: selectedChat.whatsappInstance || 'freeway-crm',
            };
            if (mediaToSend) {
                payload.mediaBase64 = mediaToSend.base64;
                payload.mediaType   = mediaToSend.mediaType;
                payload.mimeType    = mediaToSend.mimeType;
                payload.fileName    = mediaToSend.fileName;
            }
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result?.success) {
                toast({ title: 'Error al enviar', description: result?.error || 'Error desconocido', variant: 'destructive' });
            }
        } catch(err) {
            toast({ title: 'Error de Red', description: 'No se pudo conectar con el servidor', variant: 'destructive' });
        } finally { setIsSendingMessage(false); }
    };

    const handleImproveMessage = async (style: 'Profesional' | 'Suave' | 'NegociaciÃ³n') => {
        if (!inputValue.trim() || isImproving) return;
        setIsImproving(true);
        try {
            const req = await fetch('/api/ai/improve', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputValue, style })
            });
            const response = await req.json();
            if (response?.text && req.ok) {
                setInputValue(response.text);
            } else {
                // Muestra el error real del servidor en un toast, no en el input
                const errMsg = response?.text || 'Error al mejorar el mensaje.';
                toast({ title: 'âš ï¸ Mejorar con IA', description: errMsg, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'âš ï¸ Error de conexion', description: 'No se pudo contactar el servidor de IA.', variant: 'destructive' });
        } finally { 
            setIsImproving(false); 
        }
    };


    const handleUpdateBotStatus = async (enabled: boolean) => {
        if (!db) return;
        setIsBotEnabled(enabled);
        // Guardar como configuraciÃ³n GLOBAL del CRM (no por usuario)
        const cfgRef = doc(db, 'settings', 'crm_config');
        setDoc(cfgRef, { autobot_enabled: enabled }, { merge: true })
            .catch(() => { setIsBotEnabled(!enabled); });
    };

    // Leer estado global del autobot al cargar
    useEffect(() => {
        if (!db) return;
        const cfgRef = doc(db, 'settings', 'crm_config');
        getDoc(cfgRef).then(snap => {
            if (snap.exists()) setIsBotEnabled(!!snap.data()?.autobot_enabled);
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    // Indica si ahora mismo es horario fuera de oficina (5:30PM â€“ 7:30AM Panama)
    const isAfterHoursNow = (() => {
        const now = new Date();
        const panamaMin = ((now.getUTCHours() * 60 + now.getUTCMinutes()) - 5 * 60 + 24 * 60) % (24 * 60);
        const h = panamaMin / 60; // hora decimal en Panama
        return h >= 17.5 || h < 7.5;
    })();

    const handleSaveReply = async () => {
        if (!newReply.title || !newReply.content || !db) return;
        
        let updated;
        if (editingReplyId) {
            updated = quickReplies.map(r => r.id === editingReplyId ? { ...newReply, id: r.id } : r);
            toast({ title: "Respuesta actualizada" });
        } else {
            updated = [...quickReplies, { ...newReply, id: Date.now().toString() }];
            toast({ title: "Respuesta guardada" });
        }
        
        setQuickReplies(updated);
        const userRef = doc(db, 'users_crm', currentUser.id);
        setDoc(userRef, { quickReplies: updated }, { merge: true })
            .catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: { quickReplies: updated },
                }));
            });
            
        setNewReply({ title: '', content: '' });
        setEditingReplyId(null);
    };

    const handleEditReply = (reply: any) => {
        setEditingReplyId(reply.id);
        setNewReply({ title: reply.title, content: reply.content });
    };

    const handleDeleteReply = async (replyId: string) => {
        if (!db) return;
        const filtered = quickReplies.filter(r => r.id !== replyId);
        setQuickReplies(filtered);
        const userRef = doc(db, 'users_crm', currentUser.id);
        setDoc(userRef, { quickReplies: filtered }, { merge: true })
            .catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: { quickReplies: filtered },
                }));
            });
        toast({ title: "Respuesta eliminada" });
    };

    // Copiloto v2: opciones estructuradas - procesadas por el API directamente como JSON

    const renderText = (text: string) => {
        if (!text) return null;
        try {
            const result = marked.parse(text);
            return <div className="prose prose-sm prose-p:my-0.5 max-w-none prose-strong:text-primary" dangerouslySetInnerHTML={{ __html: typeof result === 'string' ? result : '' }} />;
        } catch (e) { return <p className="text-sm">{text}</p>; }
    };

    return (
        <div className="flex h-full bg-white overflow-hidden border-t">
            {/* LISTA DE CHATS â€” oculta en mobile cuando hay chat abierto */}
            <div className={cn(
                "border-r flex flex-col shrink-0 bg-slate-50/50",
                "w-full md:w-56 lg:w-72", // tablet: narrower, desktop: full width
                selectedChat && !showChatList ? "hidden md:flex" : "flex"
            )}>
                <header className="h-16 bg-white px-4 flex items-center justify-between shrink-0 border-b">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Mensajes</span>
                    <div className="flex flex-col items-center gap-0.5">
                        <p className="text-[8px] font-bold text-emerald-600 uppercase">Auto-Bot</p>
                        <Switch checked={isBotEnabled} onCheckedChange={handleUpdateBotStatus} className="scale-75 data-[state=checked]:bg-emerald-500" />
                        {isBotEnabled && (
                            <p className={`text-[7px] font-bold uppercase ${isAfterHoursNow ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {isAfterHoursNow ? 'â— activo' : 'â—‹ 5:30PM'}
                            </p>
                        )}
                    </div>
                </header>

                <div className="px-3 py-2 bg-white shrink-0 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input placeholder="Buscar contacto..." className="bg-slate-50 border-none h-9 pl-9 rounded-xl text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>

                <ScrollArea className="flex-grow">
                    <div className="flex flex-col divide-y divide-slate-100">
                        {leads
                            .filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone?.includes(searchQuery))
                            .sort((a, b) => {
                                const tA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : a.createdAt?.toMillis?.() || 0;
                                const tB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : b.createdAt?.toMillis?.() || 0;
                                return tB - tA;
                            })
                            .map((chat) => {
                                const lastMsg = chat.lastMessage || '';
                                const preview = lastMsg === '[Multimedia]' ? 'ðŸ“Ž Multimedia' : lastMsg;
                                const timeLabel = (() => {
                                    const t = chat.lastMessageAt || chat.createdAt;
                                    if (!t) return '';
                                    try {
                                        const d = t?.toDate ? t.toDate() : new Date(t);
                                        const now = new Date();
                                        const isToday = d.toDateString() === now.toDateString();
                                        return isToday
                                            ? d.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })
                                            : d.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit' });
                                    } catch { return ''; }
                                })();
                                return (
                                    <button 
                                        key={chat.id}
                                        onClick={() => { setSelectedChat(chat); setShowChatList(false); }}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-3 cursor-pointer transition-all duration-150 text-left w-full",
                                            selectedChat?.id === chat.id 
                                                ? "bg-primary/8 border-l-4 border-primary" 
                                                : "hover:bg-slate-100/80 border-l-4 border-transparent"
                                        )}
                                    >
                                        <Avatar className="h-10 w-10 border shadow-sm shrink-0">
                                            <AvatarFallback className={cn("font-bold text-sm", selectedChat?.id === chat.id ? "bg-primary text-white" : "bg-slate-200 text-slate-600")}>{chat.name?.charAt(0) || '?'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={cn("text-xs font-bold truncate", selectedChat?.id === chat.id ? 'text-primary' : 'text-slate-800')}>{chat.name}</span>
                                                <span className="text-[9px] text-slate-400 shrink-0">{timeLabel}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{chat.phone || ''}</p>
                                            {preview && <p className="text-[10px] text-slate-500 truncate mt-0.5 italic">{preview}</p>}
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </ScrollArea>
            </div>

            {/* ÃREA DE CHAT â€” oculta en mobile cuando se muestra la lista */}
            <div className={cn(
                "flex-grow flex flex-col relative bg-slate-50/80 overflow-hidden",
                showChatList && !selectedChat ? "hidden md:flex" : selectedChat ? "flex" : "hidden md:flex"
            )}>
                <div className="absolute inset-0 bg-[url('https://i.imgur.com/3F9j5V1.png')] opacity-[0.03] pointer-events-none mix-blend-multiply" />
                {selectedChat ? (
                    <>
                        <header className="h-14 md:h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-3 md:px-6 border-b border-slate-200/60 shrink-0 z-30 shadow-sm">
                            <div className="flex items-center gap-2 md:gap-4">
                                {/* BotÃ³n volver en mobile */}
                                <button
                                    className="md:hidden p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                                    onClick={() => { setShowChatList(true); }}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <Avatar className="h-9 w-9 md:h-10 md:w-10 border shadow-sm">
                                    <AvatarFallback className="bg-primary text-white font-bold text-xs">{selectedChat.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 leading-tight">{selectedChat.name}</h4>
                                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Activo ahora
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="default" size="sm" className="bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-[11px] uppercase h-9 px-3 lg:px-4 rounded-xl hover:opacity-90 transition-all gap-1.5 shadow-lg shadow-primary/20">
                                            <FileText className="w-3.5 h-3.5" />
                                            <span className="hidden lg:inline">Crear Contrato</span>
                                            <ChevronDown className="w-3 h-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-2xl border-slate-100 p-1">
                                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-3 py-2">Tipo de Contrato</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <a href={`/contracts/new?type=Curso%20Auto&lead=${encodeURIComponent(selectedChat.name)}&phone=${selectedChat.phone || ''}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-bold text-xs rounded-lg">
                                                <div className="bg-blue-100 p-1.5 rounded-md"><Car className="w-3.5 h-3.5 text-blue-600" /></div>
                                                <span>Curso Auto</span>
                                                <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                                            </a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href={`/contracts/new?type=Curso%20Moto&lead=${encodeURIComponent(selectedChat.name)}&phone=${selectedChat.phone || ''}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-bold text-xs rounded-lg">
                                                <div className="bg-orange-100 p-1.5 rounded-md"><Bike className="w-3.5 h-3.5 text-orange-600" /></div>
                                                <span>Curso Moto</span>
                                                <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                                            </a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href={`/contracts/new?type=Curso%20Solo%20Practica&lead=${encodeURIComponent(selectedChat.name)}&phone=${selectedChat.phone || ''}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-bold text-xs rounded-lg">
                                                <div className="bg-emerald-100 p-1.5 rounded-md"><Dumbbell className="w-3.5 h-3.5 text-emerald-600" /></div>
                                                <span>Solo PrÃ¡ctica</span>
                                                <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                                            </a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href={`/contracts/new?type=Ampliaciones&lead=${encodeURIComponent(selectedChat.name)}&phone=${selectedChat.phone || ''}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-bold text-xs rounded-lg">
                                                <div className="bg-amber-100 p-1.5 rounded-md"><Repeat className="w-3.5 h-3.5 text-amber-600" /></div>
                                                <span>AmpliaciÃ³n de Licencia</span>
                                                <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                                            </a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href={`/contracts/new?type=Curso%20Deluxe&lead=${encodeURIComponent(selectedChat.name)}&phone=${selectedChat.phone || ''}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-bold text-xs rounded-lg">
                                                <div className="bg-indigo-100 p-1.5 rounded-md"><Layers className="w-3.5 h-3.5 text-indigo-600" /></div>
                                                <span>Curso Deluxe</span>
                                                <ExternalLink className="w-3 h-3 ml-auto text-slate-300" />
                                            </a>
                                        </DropdownMenuItem>

                                    </DropdownMenuContent>
                                </DropdownMenu>

                                 {/* ── CO-PILOTO IA v2 ── */}
                                <Button
                                    onClick={async () => {
                                        if (copilotLoading) return;
                                        setShowCopilot(true);
                                        setCopilotLoading(true);
                                        setCopilotError(null);
                                        setCopilotOptions(null);
                                        try {
                                            const history = (selectedChat.messages || [])
                                                .slice(-20)
                                                .map((m: any) => `${m.sender === 'client' ? 'Cliente' : 'Asesor'}: ${m.text || ''}`.trim())
                                                .filter(Boolean)
                                                .join('\n');
                                            const res = await fetch('/api/ai/copilot', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ historyString: history })
                                            });
                                            const data = await res.json();
                                            if (data.ok && data.options) {
                                                setCopilotOptions(data.options);
                                            } else {
                                                setCopilotError(data.error || 'Error desconocido. Intenta de nuevo.');
                                            }
                                        } catch {
                                            setCopilotError('Sin conexion al servidor. Verifica tu internet.');
                                        } finally {
                                            setCopilotLoading(false);
                                        }
                                    }}
                                    variant="outline" size="sm"
                                    className={`font-bold text-[10px] uppercase h-9 px-3 lg:px-4 rounded-lg transition-all gap-2 ${
                                        showCopilot
                                            ? 'bg-primary border-primary text-white hover:bg-primary/90'
                                            : 'bg-primary/5 border-primary/10 text-primary hover:bg-primary hover:text-white'
                                    }`}
                                >
                                    {copilotLoading
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Wand2 className="w-3.5 h-3.5" />
                                    }
                                    <span className="hidden lg:inline">Co-piloto IA</span>
                                </Button>

                                {/* ── Respuestas Rápidas (junto al copiloto) ── */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="bg-blue-50 border-blue-200 text-blue-700 font-bold text-[10px] uppercase h-9 px-3 lg:px-4 rounded-lg hover:bg-blue-100 transition-all gap-2 relative">
                                            <Zap className="w-3.5 h-3.5" />
                                            <span className="hidden lg:inline">Rápidas</span>
                                            {quickReplies.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0 rounded-xl shadow-2xl" align="end" side="bottom">
                                        <div className="p-3 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                                            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-600" /><span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider">Plantillas de Respuesta</span></div>
                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-primary" onClick={() => setIsManageRepliesOpen(true)}>Gestionar</Button>
                                        </div>
                                        <ScrollArea className="max-h-64">
                                            {quickReplies.length > 0 ? (
                                                <div className="flex flex-col">
                                                    {quickReplies.map((reply) => (
                                                        <button key={reply.id} className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-0 transition-colors group" onClick={() => setInputValue(reply.content)}>
                                                            <p className="font-bold text-xs mb-0.5 text-slate-900 group-hover:text-primary">{reply.title}</p>
                                                            <p className="text-[10px] text-slate-400 line-clamp-2">{reply.content}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sin plantillas</p>
                                                    <Button variant="link" size="sm" className="text-[10px] font-bold p-0 h-auto" onClick={() => setIsManageRepliesOpen(true)}>Crear la primera</Button>
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>

                                {/* ── Mejorar con IA (junto al copiloto) ── */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm"
                                            disabled={!inputValue.trim() || isImproving}
                                            className="bg-violet-50 border-violet-200 text-violet-700 font-bold text-[10px] uppercase h-9 px-3 lg:px-4 rounded-lg hover:bg-violet-100 transition-all gap-2">
                                            <Wand2 className={cn("w-3.5 h-3.5", isImproving && "animate-spin")} />
                                            <span className="hidden lg:inline">Mejorar</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-48 rounded-xl border shadow-xl" align="end" side="bottom">
                                        <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400 px-3 py-2 tracking-widest">Estilo de mejora</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleImproveMessage('Profesional')} className="gap-2 font-bold text-xs py-2.5 cursor-pointer"><ShieldCheck className="w-4 h-4 text-slate-400" /> Profesional</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleImproveMessage('Suave')} className="gap-2 font-bold text-xs py-2.5 cursor-pointer"><Smile className="w-4 h-4 text-emerald-500" /> Suave</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleImproveMessage('Negociación')} className="gap-2 font-bold text-xs py-2.5 cursor-pointer"><CheckCircle className="w-4 h-4 text-primary" /> Negociación</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    onClick={() => setIsConsultorOpen(v => !v)}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "font-bold text-[10px] uppercase h-9 px-3 lg:px-4 rounded-lg transition-all gap-2",
                                        isConsultorOpen
                                            ? "bg-violet-600 border-violet-600 text-white hover:bg-violet-700"
                                            : "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                                    )}
                                >
                                    <Sparkles className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Consultor</span>
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 text-slate-400"><MoreVertical className="w-4 h-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">Acciones del Lead</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-xs font-bold gap-2">Ver Perfil Completo</DropdownMenuItem>
                                        <DropdownMenuItem className="text-xs font-bold gap-2">Asignar a otro Agente</DropdownMenuItem>
                                        <DropdownMenuItem className="text-xs font-bold gap-2 text-red-500">Marcar como Spam</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </header>

                        <ScrollArea className="flex-grow z-10 bg-slate-50/30" ref={scrollRef}>
                            <div className="px-6 lg:px-20 py-10 space-y-6">
                                <div className="flex justify-center mb-8">
                                    <div className="bg-white px-4 py-1.5 rounded-full shadow-sm border flex items-center gap-2">
                                        <ShieldCheck className="w-3 h-3 text-slate-400" />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Chat Cifrado de Extremo a Extremo</span>
                                    </div>
                                </div>

                                {/* LIGHTBOX para imÃ¡genes */}
                                {lightboxUrl && (
                                    <div
                                        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
                                        onClick={() => setLightboxUrl(null)}
                                    >
                                        <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxUrl(null)}>
                                            <X className="w-8 h-8" />
                                        </button>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={lightboxUrl} alt="Media" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
                                    </div>
                                )}

                                {selectedChat.messages?.map((m: any) => {
                                    const isMe = m.sender === 'me';
                                    const message = { ...m, isAi: m.isAi || false };
                                    // Normalizar tipo (acepta 'image'/'imageMessage', 'audio'/'audioMessage', etc.)
                                    const mt: string = m.mediaType || '';
                                    const isImage = (mt === 'image' || mt === 'imageMessage') && m.mediaUrl;
                                    const isAudio = (mt === 'audio' || mt === 'audioMessage') && m.mediaUrl;
                                    const isVideo = (mt === 'video' || mt === 'videoMessage') && m.mediaUrl;
                                    const isDoc   = (mt === 'document' || mt === 'documentMessage');
                                    return (
                                        <motion.div key={m.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                                            <div 
                                                className={cn(
                                                    "max-w-[75%] lg:max-w-[65%] p-4 rounded-2xl relative shadow-md transition-all",
                                                    !isMe ? "bg-white border text-slate-800 rounded-tl-sm ring-1 ring-slate-100" : "bg-gradient-to-br from-primary to-blue-600 text-white rounded-tr-sm ring-1 ring-primary/20",
                                                    message.isAi ? "bg-gradient-to-br from-emerald-500 to-teal-600 ring-emerald-400/20" : ""
                                                )}
                                            >
                                                {message.isAi && (
                                                    <div className="absolute -top-3 -right-3 bg-white text-emerald-600 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-lg border border-emerald-100 flex items-center gap-1">
                                                        <Wand2 className="w-2.5 h-2.5" /> IA RespondiÃ³
                                                    </div>
                                                )}
                                                {/* â”€â”€ IMAGEN â”€â”€ */}
                                                {isImage && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={m.mediaUrl}
                                                        alt={m.text || 'Imagen'}
                                                        className="max-w-full max-h-56 w-full object-cover rounded-xl mb-2 cursor-zoom-in hover:opacity-90 transition-opacity"
                                                        onClick={() => setLightboxUrl(m.mediaUrl)}
                                                    />
                                                )}
                                                {/* â”€â”€ AUDIO â”€â”€ */}
                                                {isAudio && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Volume2 className="w-4 h-4 shrink-0 opacity-70" />
                                                        <audio controls src={m.mediaUrl} className="h-9 w-44 rounded-lg" style={{ accentColor: isMe ? '#fff' : '#1d4ed8' }} />
                                                    </div>
                                                )}
                                                {/* â”€â”€ VIDEO â”€â”€ */}
                                                {isVideo && (
                                                    <video controls src={m.mediaUrl} className="max-w-full max-h-48 rounded-xl mb-2 w-full" />
                                                )}
                                                {/* â”€â”€ DOCUMENTO â”€â”€ */}
                                                {isDoc && (
                                                    <button
                                                        type="button"
                                                        title={m.mediaUrl ? undefined : 'Documento sin enlace de descarga'}
                                                        onClick={() => {
                                                            const url = m.mediaUrl as string;
                                                            if (!url) return;
                                                            const anchor = document.createElement('a');
                                                            if (url.startsWith('data:')) {
                                                                // base64 inline â†’ convertir a blob y descargar
                                                                const arr = url.split(',');
                                                                const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
                                                                const bstr = atob(arr[1]);
                                                                const u8 = new Uint8Array(bstr.length);
                                                                for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
                                                                const blob = new Blob([u8], { type: mime });
                                                                anchor.href = URL.createObjectURL(blob);
                                                                anchor.download = m.fileName || 'documento';
                                                            } else {
                                                                // URL real â†’ abrir en nueva pestaÃ±a
                                                                anchor.href = url;
                                                                anchor.target = '_blank';
                                                                anchor.rel = 'noreferrer';
                                                            }
                                                            document.body.appendChild(anchor);
                                                            anchor.click();
                                                            setTimeout(() => {
                                                                document.body.removeChild(anchor);
                                                                if (anchor.href.startsWith('blob:')) URL.revokeObjectURL(anchor.href);
                                                            }, 1000);
                                                        }}
                                                        className={cn(
                                                            "flex items-center gap-2 mb-2 p-3 rounded-xl w-full text-left transition-colors",
                                                            isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-100 hover:bg-slate-200',
                                                            !m.mediaUrl && 'opacity-60 cursor-not-allowed'
                                                        )}
                                                    >
                                                        <FileIcon className="w-5 h-5 shrink-0" />
                                                        <span className="text-xs font-medium truncate flex-1">{m.fileName || m.text || 'Documento'}</span>
                                                        {m.mediaUrl
                                                            ? <Download className="w-4 h-4 shrink-0 opacity-60" />
                                                            : <span className="text-[9px] opacity-50 shrink-0">Sin enlace</span>
                                                        }
                                                    </button>
                                                )}
                                                {/* â”€â”€ TEXTO â”€â”€ (ocultar si es placeholder de multimedia) */}
                                                {message.text && !isDoc && !isImage && !isAudio && !isVideo && message.text !== '[Multimedia]' && (
                                                    <p className={cn("text-sm whitespace-pre-wrap leading-relaxed", isMe ? "text-white/95" : "text-slate-700")}>{message.text}</p>
                                                )}
                                                <div className={cn("text-[9px] font-bold mt-2 flex items-center justify-end gap-1.5", isMe ? "text-white/70" : "text-slate-400")}>
                                                    <span className="text-[9px] font-bold uppercase">{(() => {
                                                        const ts = m.timestamp;
                                                        if (ts?.toDate) return ts.toDate().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
                                                        if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
                                                        if (m.time) return m.time;
                                                        return '';
                                                    })()}</span>
                                                    {isMe && <CheckCheck className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}


                            </div>
                        </ScrollArea>

                        {/* ═══ COPILOTO IA v2 - PANEL ═══ */}
                        <AnimatePresence>
                            {showCopilot && (
                                <motion.div
                                    initial={{ x: 420, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 420, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                                    className="absolute right-0 top-14 md:top-16 bottom-0 w-full md:w-[380px] bg-[#0f172a] border-l border-slate-700 z-40 shadow-2xl flex flex-col"
                                >
                                    {/* Header */}
                                    <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg">
                                                <Wand2 className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm leading-tight">Co-piloto IA</p>
                                                <p className="text-slate-400 text-[10px] uppercase tracking-widest">3 opciones de respuesta</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setShowCopilot(false); setCopilotOptions(null); setCopilotError(null); }}
                                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {/* Loading */}
                                        {copilotLoading && (
                                            <div className="flex flex-col items-center justify-center h-48 gap-4">
                                                <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                                <div className="text-center">
                                                    <p className="text-white font-bold text-sm">Generando opciones...</p>
                                                    <p className="text-slate-400 text-xs mt-1">Analizando conversacion con IA</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Error */}
                                        {copilotError && !copilotLoading && (
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                                                <p className="text-red-400 font-bold text-xs mb-3">{copilotError}</p>
                                                <button
                                                    onClick={() => {
                                                        setCopilotError(null);
                                                        // Re-trigger by clicking the header button logic inline
                                                        setCopilotLoading(true);
                                                        const history = (selectedChat?.messages || [])
                                                            .slice(-20)
                                                            .map((m: any) => `${m.sender === 'client' ? 'Cliente' : 'Asesor'}: ${m.text || ''}`)
                                                            .filter(Boolean).join('\n');
                                                        fetch('/api/ai/copilot', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({historyString:history}) })
                                                            .then(r => r.json())
                                                            .then(d => { if(d.ok) setCopilotOptions(d.options); else setCopilotError(d.error); })
                                                            .catch(() => setCopilotError('Error de red.'))
                                                            .finally(() => setCopilotLoading(false));
                                                    }}
                                                    className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                                                >
                                                    Reintentar
                                                </button>
                                            </div>
                                        )}

                                        {/* Options */}
                                        {copilotOptions && !copilotLoading && (() => {
                                            const opts = [
                                                { key: 'directa',    label: 'Directa',    color: 'from-blue-500 to-blue-600',   badge: 'bg-blue-500/20 text-blue-300',   text: copilotOptions.directa },
                                                { key: 'cierre',     label: 'Al Cierre',  color: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-500/20 text-emerald-300', text: copilotOptions.cierre },
                                                { key: 'persuasiva', label: 'Persuasiva', color: 'from-violet-500 to-violet-600', badge: 'bg-violet-500/20 text-violet-300', text: copilotOptions.persuasiva },
                                            ];
                                            return opts.filter(o => o.text).map((opt, i) => (
                                                <div
                                                    key={opt.key}
                                                    className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl p-4 cursor-pointer transition-all group hover:bg-slate-750 active:scale-[0.99]"
                                                    onClick={() => { setInputValue(opt.text); setShowCopilot(false); setCopilotOptions(null); }}
                                                >
                                                    <div className="flex items-center justify-between mb-2.5">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${opt.badge}`}>{opt.label}</span>
                                                        <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors flex items-center gap-1 font-bold uppercase">
                                                            <Send className="w-3 h-3" /> Usar
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-200 text-sm leading-relaxed">{opt.text}</p>
                                                </div>
                                            ));
                                        })()}
                                    </div>

                                    {/* Footer */}
                                    {copilotOptions && !copilotLoading && (
                                        <div className="px-4 py-3 border-t border-slate-700/60 shrink-0">
                                            <button
                                                onClick={() => {
                                                    setCopilotOptions(null);
                                                    setCopilotLoading(true);
                                                    const history = (selectedChat?.messages || [])
                                                        .slice(-20)
                                                        .map((m: any) => `${m.sender === 'client' ? 'Cliente' : 'Asesor'}: ${m.text || ''}`)
                                                        .filter(Boolean).join('\n');
                                                    fetch('/api/ai/copilot', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({historyString:history}) })
                                                        .then(r => r.json())
                                                        .then(d => { if(d.ok) setCopilotOptions(d.options); else setCopilotError(d.error); })
                                                        .catch(() => setCopilotError('Error de red.'))
                                                        .finally(() => setCopilotLoading(false));
                                                }}
                                                className="w-full h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                            >
                                                <Loader2 className="w-3 h-3" /> Regenerar opciones
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* PANEL CONSULTOR IA */}
                        <AnimatePresence>
                            {isConsultorOpen && (
                                <motion.div
                                    initial={{ x: 400, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 400, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="absolute right-0 top-14 md:top-16 bottom-0 w-full md:w-[360px] bg-white border-l z-50 shadow-2xl flex flex-col"
                                >
                                    <div className="h-14 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-white font-black text-sm leading-none">Consultor IA</p>
                                                <p className="text-white/70 text-[9px] font-bold uppercase tracking-wider">Precios Â· Horarios Â· Cursos</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20 rounded-lg" onClick={() => setIsConsultorOpen(false)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b bg-slate-50/80 shrink-0">
                                        {[
                                            { icon: DollarSign, label: 'Precio Auto', q: 'Â¿CuÃ¡nto cuesta el Curso Auto BÃ¡sico y el Plus?' },
                                            { icon: Calendar, label: 'Horarios semana', q: 'Dime quÃ© horarios libres hay esta semana para auto automatico.' },
                                            { icon: HelpCircle, label: 'Diferencia planes', q: 'Â¿CuÃ¡l es la diferencia entre BÃ¡sico, Plus y Deluxe?' },
                                        ].map(p => (
                                            <button key={p.label} onClick={() => sendConsultorMessage(p.q)} disabled={consultorLoading}
                                                className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-bold text-slate-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all disabled:opacity-50">
                                                <p.icon className="w-2.5 h-2.5" />{p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div ref={consultorScrollRef} className="flex-grow overflow-y-auto px-3 py-3 space-y-3">
                                        {consultorMessages.map(msg => (
                                            <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                                {msg.role === 'ai' && (
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                                                        <BotIcon className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                                <div className={cn(
                                                    'max-w-[82%] px-3 py-2 rounded-2xl text-xs shadow-sm',
                                                    msg.role === 'user'
                                                        ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-tr-sm'
                                                        : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                                                )}>
                                                    {msg.role === 'ai'
                                                        ? <div className="prose prose-xs max-w-none prose-p:my-0 prose-strong:text-violet-700" dangerouslySetInnerHTML={{ __html: (() => { try { const r = marked.parse(msg.text); return typeof r === 'string' ? r : msg.text; } catch { return msg.text; } })() }} />
                                                        : <p>{msg.text}</p>
                                                    }
                                                </div>
                                                {msg.role === 'user' && (
                                                    <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shrink-0 mt-1">
                                                        <UserIcon className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {consultorLoading && (
                                            <div className="flex gap-2 justify-start">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                                                    <BotIcon className="w-3 h-3 text-white" />
                                                </div>
                                                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2">
                                                    <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 border-t bg-white shrink-0">
                                        <form onSubmit={e => { e.preventDefault(); sendConsultorMessage(consultorInput); }} className="flex gap-2">
                                            <input
                                                value={consultorInput}
                                                onChange={e => setConsultorInput(e.target.value)}
                                                placeholder="Ej: horarios libres auto esta semana"
                                                disabled={consultorLoading}
                                                className="flex-grow h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all disabled:opacity-50 font-medium"
                                            />
                                            <Button type="submit" disabled={!consultorInput.trim() || consultorLoading}
                                                className="h-9 w-9 p-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 hover:opacity-90 shadow shrink-0">
                                                {consultorLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5 text-white" />}
                                            </Button>
                                        </form>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <footer className="bg-white border-t shrink-0 z-[60]" style={{boxShadow:'0 -4px 20px rgba(0,0,0,0.04)'}}>

                            {/* â•â•â• FILA 1: Acciones nuevas â•â•â• */}
                            <nav style={{display:'block', width:'100%', padding:'7px 16px', background:'#f8fafc', borderBottom:'1px solid #e5e7eb'}}>
                                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>

                                    {/* BotÃ³n 1: Nota de Voz */}
                                    <button
                                        type="button"
                                        onClick={handleToggleRecording}
                                        style={{
                                            display:'inline-flex', alignItems:'center', gap:'6px',
                                            padding:'6px 14px', borderRadius:'10px',
                                            background: isRecording ? '#dc2626' : '#ffffff',
                                            color: isRecording ? '#ffffff' : '#374151',
                                            border: isRecording ? '1.5px solid #dc2626' : '1.5px solid #d1d5db',
                                            fontSize:'12px', fontWeight:600,
                                            cursor:'pointer', transition:'all 0.2s',
                                            boxShadow:'0 1px 3px rgba(0,0,0,0.08)',
                                        }}
                                    >
                                        {isRecording
                                            ? <MicOff style={{width:'14px',height:'14px'}} />
                                            : <Mic style={{width:'14px',height:'14px'}} />
                                        }
                                        {isRecording ? 'Detener' : 'Nota de Voz'}
                                    </button>
                                </div>
                            </nav>

                            {/* â•â•â• FILA 2: Input de mensaje â•â•â• */}
                            <div style={{display:'block', padding:'10px 16px'}}>
                                <form onSubmit={handleSendMessage} style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                    <div style={{position:'relative', flex:1}}>
                                        <Input
                                            id="crm-message-input"
                                            placeholder={pendingMedia ? `${pendingMedia.fileName} â€” añade un pie de foto...` : "Escribe un mensaje..."}
                                            className="bg-slate-50 border border-slate-200 h-11 rounded-xl px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20 shadow-none transition-all pr-10 w-full"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            disabled={isSendingMessage || isImproving}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                            <Smile className="w-4 h-4 cursor-pointer hover:text-slate-400 transition-colors" />
                                        </div>
                                    </div>
                                    <Button type="submit" size="icon"
                                        className="bg-primary hover:bg-blue-700 rounded-xl h-11 w-11 shrink-0 shadow-lg shadow-primary/20 transition-all active:scale-95"
                                        disabled={(!inputValue.trim() && !pendingMedia) || isSendingMessage || isImproving}>
                                        {isSendingMessage ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                                    </Button>
                                </form>
                            </div>

                        </footer>








                        {/* DIÃLOGO GESTIÃ“N RESPUESTAS RÃPIDAS */}
                        <Dialog open={isManageRepliesOpen} onOpenChange={(open) => { setIsManageRepliesOpen(open); if(!open) { setEditingReplyId(null); setNewReply({ title: '', content: '' }); } }}>
                            <DialogContent className="sm:max-w-md rounded-2xl">
                                <DialogHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><Zap className="w-5 h-5" /></div>
                                        <div>
                                            <DialogTitle className="text-xl font-bold">Mis Respuestas RÃ¡pidas</DialogTitle>
                                            <DialogDescription className="text-xs">Crea y edita mensajes frecuentes para responder en un clic.</DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    {/* FORMULARIO DE CREACIÃ“N / EDICIÃ“N */}
                                    <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">TÃ­tulo del Mensaje</Label>
                                            <Input value={newReply.title} onChange={e => setNewReply({...newReply, title: e.target.value})} placeholder="Ej: Precios Auto BÃ¡sico" className="h-11 rounded-xl text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contenido del Mensaje</Label>
                                            <textarea 
                                                value={newReply.content} 
                                                onChange={e => setNewReply({...newReply, content: e.target.value})} 
                                                placeholder="Escribe el mensaje completo aquÃ­..." 
                                                className="w-full min-h-[100px] p-4 rounded-xl text-sm bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            {editingReplyId && (
                                                <Button variant="outline" className="flex-grow h-11 rounded-xl font-bold text-xs uppercase" onClick={() => { setEditingReplyId(null); setNewReply({ title: '', content: '' }); }}>Cancelar</Button>
                                            )}
                                            <Button 
                                                className="flex-[2] h-11 rounded-xl font-bold text-xs uppercase gap-2" 
                                                onClick={handleSaveReply}
                                                disabled={!newReply.title || !newReply.content}
                                            >
                                                {editingReplyId ? <><CheckCircle className="w-4 h-4" /> Actualizar</> : <><Plus className="w-4 h-4" /> Guardar Respuesta</>}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* LISTA DE RESPUESTAS ACTUALES */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mis Plantillas ({quickReplies.length})</Label>
                                        </div>
                                        <ScrollArea className="h-56 rounded-2xl border bg-white shadow-sm">
                                            {quickReplies.length > 0 ? (
                                                <div className="flex flex-col">
                                                    {quickReplies.map((reply) => (
                                                        <div key={reply.id} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50/50 transition-colors group">
                                                            <div className="min-w-0 pr-4">
                                                                <p className="font-bold text-sm text-slate-900 truncate">{reply.title}</p>
                                                                <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{reply.content}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button onClick={() => handleEditReply(reply)} className="p-2 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                                                                <button onClick={() => handleDeleteReply(reply.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full p-8 text-slate-300 gap-2">
                                                    <Zap className="w-8 h-8 opacity-20" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest">AÃºn no tienes plantillas</p>
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center bg-slate-50/20 text-center p-10">
                        <div className="w-24 h-24 bg-white border border-slate-100 rounded-3xl shadow-2xl flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                            <MessageCircle className="w-10 h-10 text-primary/20" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Centro de Mensajes Freeway</h2>
                        <p className="text-slate-400 text-sm max-w-xs mt-2 leading-relaxed font-medium">Selecciona un alumno de la lista de la izquierda para iniciar una conversaciÃ³n profesional.</p>
                        <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-md">
                            {[
                                { label: 'IA Copiloto', icon: Wand2 },
                                { label: 'Plantillas', icon: Zap },
                                { label: 'Auto-Bot', icon: Bot }
                            ].map((feat, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border shadow-sm group hover:border-primary transition-all">
                                    <feat.icon className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">{feat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
