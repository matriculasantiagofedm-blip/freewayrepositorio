'use client';

import { useState, useEffect, useRef } from 'react';
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
    CheckCircle
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
import { doc, updateDoc, setDoc, collection, query, orderBy, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [isBotEnabled, setIsBotEnabled] = useState(currentUser?.chatbotEnabled || false);
    const [quickReplies, setQuickReplies] = useState<any[]>(currentUser?.quickReplies || []);
    const [isManageRepliesOpen, setIsManageRepliesOpen] = useState(false);
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [newReply, setNewReply] = useState({ title: '', content: '' });
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const db = useFirestore();

    useEffect(() => {
        if (preselectedId) {
            setSelectedChat((prev: any) => {
                const updatedChat = leads.find(l => l.id === preselectedId);
                if (!updatedChat) return prev;
                // Si es un chat nuevo, carga desde cero. Si es una actualizacion en vivo (lastMessage), manten los mensajes.
                if (!prev || prev.id !== preselectedId) {
                    return { ...updatedChat, messages: [] };
                }
                return { ...updatedChat, messages: prev.messages || [] };
            });
        }
    }, [preselectedId, leads]);

    // Reemplazo del fetch estático por uno en tiempo real
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
    }, [selectedChat?.messages, isLoading]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || !selectedChat || isLoading) return;
        const textToSend = inputValue;
        setInputValue('');
        setIsLoading(true);
        try {
            const reqUrl = `/api/whatsapp/send`;
            const payload = { 
                to: selectedChat.phone || selectedChat.socialId, 
                text: textToSend, 
                leadId: selectedChat.id,
                platform: selectedChat.source || 'WhatsApp',
                socialId: selectedChat.socialId
            };
            
            const response = await fetch(reqUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result?.success) {
                // No se empuja `tempMsg` localmente porque el webhook/API crea el documento 
                // en Firestore y `useCollection(chatQuery)` se actualiza instantáneamente en tiempo real. 
                // Esto previene que se duplique el mensaje en la interfaz.
            } else {
                toast({ title: "Error al enviar", description: result?.error || "Error desconocido", variant: "destructive" });
            }
        } catch(e) {
             toast({ title: "Error de Red", description: "No se pudo conectar con el servidor", variant: "destructive" });
        } finally { setIsLoading(false); }
    };

    const handleImproveMessage = async (style: 'Profesional' | 'Suave' | 'Negociación') => {
        if (!inputValue.trim() || isImproving) return;
        setIsImproving(true);
        try {
            const req = await fetch('/api/ai/improve', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputValue, style })
            });
            const response = await req.json();
            if (response?.text && req.ok) setInputValue(response.text);
            else setInputValue("Error de respuesta IA.");
        } catch (err) {
            setInputValue("Error de conexión al servidor IA.");
        } finally { 
            setIsImproving(false); 
        }
    };

    const handleUpdateBotStatus = async (enabled: boolean) => {
        if (!db) return;
        setIsBotEnabled(enabled);
        const userRef = doc(db, 'users_crm', currentUser.id);
        setDoc(userRef, { chatbotEnabled: enabled }, { merge: true })
            .catch(async (err) => {
                setIsBotEnabled(!enabled);
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: { chatbotEnabled: enabled },
                }));
            });
    };

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

    const parsedOptions = (() => {
        if (!aiSuggestion) return null;
        const parts = aiSuggestion.split(/(?=1️⃣|2️⃣|3️⃣)/).filter(p => p.trim());
        if (parts.length >= 2 && parts.some(p => p.includes('1️⃣'))) {
            return parts.map(part => {
                let text = part.trim();
                let type = "Opción";
                if (text.startsWith("1️⃣")) { type = "Directa"; text = text.replace(/1️⃣[^:]*:\s*/, '').trim(); }
                else if (text.startsWith("2️⃣")) { type = "Al Cierre"; text = text.replace(/2️⃣[^:]*:\s*/, '').trim(); }
                else if (text.startsWith("3️⃣")) { type = "Persuasiva"; text = text.replace(/3️⃣[^:]*:\s*/, '').trim(); }
                else { text = text.replace(/^[0-9]️⃣[^:]*:\s*/, '').trim(); }
                return { type, text: text.replace(/^\*+/, '').replace(/\*+$/, '') };
            });
        }
        return null;
    })();

    const renderText = (text: string) => {
        if (!text) return null;
        try {
            const result = marked.parse(text);
            return <div className="prose prose-sm prose-p:my-0.5 max-w-none prose-strong:text-primary" dangerouslySetInnerHTML={{ __html: typeof result === 'string' ? result : '' }} />;
        } catch (e) { return <p className="text-sm">{text}</p>; }
    };

    return (
        <div className="flex h-full bg-white overflow-hidden border-t">
            {/* LISTA DE CHATS */}
            <div className="w-80 lg:w-96 border-r flex flex-col shrink-0 bg-slate-50/50">
                <header className="h-16 bg-white px-6 flex items-center justify-between shrink-0 border-b">
                    <h3 className="font-bold text-slate-900">Bandeja de Entrada</h3>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end mr-1">
                            <p className="text-[8px] font-bold text-emerald-600 uppercase">Auto-Bot</p>
                            <Switch checked={isBotEnabled} onCheckedChange={handleUpdateBotStatus} className="scale-75 data-[state=checked]:bg-emerald-500" />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><Settings className="w-4 h-4" /></Button>
                    </div>
                </header>

                <div className="p-4 bg-white shrink-0 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar alumno..." className="bg-slate-50 border-none h-10 pl-10 rounded-lg text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>

                <ScrollArea className="flex-grow">
                    <div className="flex flex-col">
                        {leads
                            .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .sort((a, b) => {
                                const tA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : a.createdAt?.toMillis?.() || 0;
                                const tB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : b.createdAt?.toMillis?.() || 0;
                                return tB - tA;
                            })
                            .map((chat) => (
                                <button 
                                    key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={cn(
                                    "flex items-center gap-4 p-4 cursor-pointer transition-all duration-300 border-b border-white/40",
                                    selectedChat?.id === chat.id 
                                        ? "bg-gradient-to-r from-primary/10 to-transparent shadow-[inset_4px_0_0_url(#primary)]" 
                                        : "hover:bg-slate-100/60"
                                )}
                                style={{ boxShadow: selectedChat?.id === chat.id ? 'inset 4px 0 0 hsl(var(--primary))' : 'none' }}
                            >
                                <Avatar className="h-12 w-12 border shadow-sm">
                                    <AvatarFallback className={cn("font-bold text-xs", selectedChat?.id === chat.id ? "bg-primary text-white" : "bg-slate-200 text-slate-500")}>{chat.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow min-w-0 text-left">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <h4 className={cn("font-bold truncate text-sm", selectedChat?.id === chat.id ? "text-primary" : "text-slate-900")}>{chat.name}</h4>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">HOY</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate leading-tight">
                                        {chat.lastMessage || `Interesado en ${chat.interest || 'Manejo'}`}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* ÁREA DE CHAT */}
            <div className="flex-grow flex flex-col relative bg-slate-50/80 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://i.imgur.com/3F9j5V1.png')] opacity-[0.03] pointer-events-none mix-blend-multiply" />
                {selectedChat ? (
                    <>
                        <header className="h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 border-b border-slate-200/60 shrink-0 z-30 shadow-sm">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10 border shadow-sm">
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
                                <Button onClick={async () => { 
                                    try {
                                        setIsLoading(true); 
                                        
                                        // Extraer el historial de mensajes visibles (los últimos 15)
                                        const recentMessages = selectedChat.messages?.slice(-15).map((m: any) => {
                                            const senderName = m.sender === 'client' ? 'Cliente' : 'Asesor Freeway';
                                            return `${senderName}: ${m.text}`;
                                        }).join('\n') || '';

                                        const req = await fetch('/api/ai/copilot', {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ 
                                                historyString: recentMessages,
                                                leadId: selectedChat.id 
                                            })
                                        });
                                        const r = await req.json();
                                        if (r?.text && req.ok) setAiSuggestion(r.text); 
                                        else setAiSuggestion("Hubo un error contactando a la IA.");
                                    } catch (err) {
                                        setAiSuggestion("Error de conexión al servidor de IA.");
                                    } finally {
                                        setIsLoading(false); 
                                    }
                                }} variant="outline" size="sm" className="bg-primary/5 border-primary/10 text-primary font-bold text-[10px] uppercase h-9 px-4 rounded-lg hover:bg-primary hover:text-white transition-all gap-2">
                                    <Wand2 className="w-3.5 h-3.5" /> Co-piloto IA 3.0
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

                                {selectedChat.messages?.map((m: any) => {
                                    const isMe = m.sender === 'me';
                                    const message = { ...m, isAi: m.isAi || false };
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
                                                        <Wand2 className="w-2.5 h-2.5" /> IA Respondió
                                                    </div>
                                                )}
                                                <p className={cn("text-sm whitespace-pre-wrap leading-relaxed", isMe ? "text-white/95" : "text-slate-700")}>{message.text}</p>
                                                <div className={cn("text-[9px] font-bold mt-2 flex items-center justify-end gap-1.5", isMe ? "text-white/70" : "text-slate-400")}>
                                                    <span className="text-[9px] font-bold uppercase">{m.time || 'Ahora'}</span>
                                                    {isMe && <CheckCheck className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}

                                {isLoading && !aiSuggestion && (
                                    <div className="flex justify-start">
                                        <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border flex items-center gap-3">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IA Generando...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <AnimatePresence>
                            {aiSuggestion && (
                                <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} className="absolute right-0 top-16 bottom-0 w-96 bg-white border-l z-40 shadow-2xl flex flex-col">
                                    <div className="p-6 pb-4 bg-slate-50 shrink-0 border-b">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary rounded-lg text-white shadow-md shadow-primary/20"><Sparkles className="w-4 h-4 animate-pulse" /></div>
                                                <div>
                                                    <h5 className="font-bold text-slate-900 text-sm">Sugerencia IA</h5>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Basado en datos de Freeway</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAiSuggestion(null)}><History className="w-4 h-4 rotate-180" /></Button>
                                        </div>
                                        {parsedOptions ? (
                                            <div className="flex flex-col gap-3 mt-2 max-h-[400px] overflow-y-auto px-1 pb-4">
                                                {parsedOptions.map((opt, i) => (
                                                    <div key={i} className="p-4 border rounded-2xl bg-white hover:border-primary hover:shadow-md cursor-pointer transition-all shadow-sm group" onClick={() => { setInputValue(opt.text); setAiSuggestion(null); }}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-[10px] font-black tracking-widest text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">{opt.type}</span>
                                                            <span className="text-[9px] font-bold uppercase text-slate-300 group-hover:text-primary transition-colors flex items-center gap-1"><Send className="w-3 h-3" /> Usar</span>
                                                        </div>
                                                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{opt.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white rounded-xl border shadow-inner max-h-[300px] overflow-y-auto">
                                                <div className="text-slate-700 text-xs leading-relaxed italic">{renderText(aiSuggestion)}</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 flex flex-col gap-3 mt-auto border-t bg-white">
                                        {!parsedOptions && (
                                            <>
                                                <Button className="w-full h-12 rounded-lg bg-primary font-bold text-xs uppercase" onClick={() => { setInputValue(aiSuggestion); setAiSuggestion(null); }}>
                                                    <Send className="w-4 h-4 mr-2" /> Usar esta respuesta
                                                </Button>
                                                <Button variant="outline" className="w-full h-10 text-[10px] uppercase font-bold" onClick={() => { navigator.clipboard.writeText(aiSuggestion); toast({ title: "Copiado" }); }}><Copy className="w-3.5 h-3.5 mr-2" /> Copiar Todo</Button>
                                            </>
                                        )}
                                        <Button variant="ghost" className="w-full h-10 text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => setAiSuggestion(null)}>Descartar y Cerrar</Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <footer className="bg-white p-6 border-t shrink-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-4">
                                <div className="flex gap-2 shrink-0">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="h-12 px-4 gap-2 rounded-xl border-primary/20 text-primary font-bold text-[10px] uppercase hover:bg-primary/5 transition-all relative">
                                                <Zap className="w-4 h-4" />
                                                <span>Respuestas Rápidas</span>
                                                {quickReplies.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white shadow-sm" />}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-0 rounded-xl shadow-2xl border-primary/10" align="start" side="top">
                                            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-primary" />
                                                    <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider">Plantillas de Respuesta</span>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-primary hover:bg-primary/5" onClick={() => setIsManageRepliesOpen(true)}>Gestionar</Button>
                                            </div>
                                            <ScrollArea className="max-h-72">
                                                {quickReplies.length > 0 ? (
                                                    <div className="flex flex-col">
                                                        {quickReplies.map((reply) => (
                                                            <button 
                                                                key={reply.id} 
                                                                className="w-full text-left p-4 hover:bg-slate-50 border-b last:border-0 transition-colors group"
                                                                onClick={() => setInputValue(reply.content)}
                                                            >
                                                                <p className="font-bold text-xs mb-1 text-slate-900 group-hover:text-primary transition-colors">{reply.title}</p>
                                                                <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">{reply.content}</p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-10 text-center flex flex-col items-center gap-2">
                                                        <div className="bg-slate-100 p-3 rounded-full"><Zap className="w-6 h-6 text-slate-300" /></div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin respuestas guardadas</p>
                                                        <Button variant="link" size="sm" className="text-[10px] uppercase font-bold p-0 h-auto" onClick={() => setIsManageRepliesOpen(true)}>Crear la primera</Button>
                                                    </div>
                                                )}
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="h-12 px-4 gap-2 rounded-xl border-primary/20 text-primary font-bold text-[10px] uppercase hover:bg-primary/5 transition-all" disabled={!inputValue.trim() || isImproving}>
                                                <Wand2 className={cn("w-4 h-4", isImproving && "animate-spin")} />
                                                <span>Mejorar con IA</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-52 rounded-xl border shadow-xl" align="start" side="top">
                                            <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400 px-4 py-2 tracking-widest">Estilo de Mejora</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleImproveMessage('Profesional')} className="gap-3 font-bold text-xs py-3 cursor-pointer"><ShieldCheck className="w-4 h-4 text-slate-400" /> Profesional</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleImproveMessage('Suave')} className="gap-3 font-bold text-xs py-3 cursor-pointer"><Smile className="w-4 h-4 text-emerald-500" /> Suave</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleImproveMessage('Negociación')} className="gap-3 font-bold text-xs py-3 cursor-pointer"><CheckCircle className="w-4 h-4 text-primary" /> Negociación</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <form onSubmit={handleSendMessage} className="flex-grow flex items-center gap-3">
                                    <div className="relative flex-grow">
                                        <Input 
                                            placeholder="Escribe un mensaje..." 
                                            className="bg-slate-50 border-none h-12 rounded-xl px-6 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20 shadow-none transition-all pr-12" 
                                            value={inputValue} 
                                            onChange={(e) => setInputValue(e.target.value)} 
                                            disabled={isLoading || isImproving} 
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                            <Smile className="w-5 h-5 cursor-pointer hover:text-slate-400 transition-colors" />
                                        </div>
                                    </div>
                                    <Button type="submit" size="icon" className="bg-primary hover:bg-blue-700 rounded-xl h-12 w-12 shrink-0 shadow-lg shadow-primary/20 transition-all active:scale-95" disabled={!inputValue.trim() || isLoading || isImproving}>
                                        <Send className="w-5 h-5 text-white" />
                                    </Button>
                                </form>
                            </div>
                        </footer>

                        {/* DIÁLOGO GESTIÓN RESPUESTAS RÁPIDAS */}
                        <Dialog open={isManageRepliesOpen} onOpenChange={(open) => { setIsManageRepliesOpen(open); if(!open) { setEditingReplyId(null); setNewReply({ title: '', content: '' }); } }}>
                            <DialogContent className="sm:max-w-md rounded-2xl">
                                <DialogHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><Zap className="w-5 h-5" /></div>
                                        <div>
                                            <DialogTitle className="text-xl font-bold">Mis Respuestas Rápidas</DialogTitle>
                                            <DialogDescription className="text-xs">Crea y edita mensajes frecuentes para responder en un clic.</DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    {/* FORMULARIO DE CREACIÓN / EDICIÓN */}
                                    <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Título del Mensaje</Label>
                                            <Input value={newReply.title} onChange={e => setNewReply({...newReply, title: e.target.value})} placeholder="Ej: Precios Auto Básico" className="h-11 rounded-xl text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contenido del Mensaje</Label>
                                            <textarea 
                                                value={newReply.content} 
                                                onChange={e => setNewReply({...newReply, content: e.target.value})} 
                                                placeholder="Escribe el mensaje completo aquí..." 
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
                                                    <p className="text-[10px] font-bold uppercase tracking-widest">Aún no tienes plantillas</p>
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
                        <p className="text-slate-400 text-sm max-w-xs mt-2 leading-relaxed font-medium">Selecciona un alumno de la lista de la izquierda para iniciar una conversación profesional.</p>
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
