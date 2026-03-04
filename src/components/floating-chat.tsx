'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDb, useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  limit,
  onSnapshot
} from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2, X, ChevronLeft, Users, ShieldAlert } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CHANNELS } from '@/lib/chat-config';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function FloatingChat() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeChannels, setActiveChannels] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filtrar canales según el rol del usuario actual
  const allowedChannels = useMemo(() => {
    if (!role) return [];
    return CHANNELS.filter(channel => channel.roles.includes(role));
  }, [role]);

  const activeChannel = useMemo(() => {
    return allowedChannels.find(c => c.id === selectedChannelId);
  }, [selectedChannelId, allowedChannels]);

  // Monitor de actividad para CADA canal (Puntos rojos)
  useEffect(() => {
    if (!db || !user || !role) return;

    const unsubs = allowedChannels.map(channel => {
      const q = query(
        collection(db, 'chatChannels', channel.id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      return onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const lastMsg = snap.docs[0].data();
          const lastMsgTime = toDate(lastMsg.createdAt).getTime();
          const isFromOthers = lastMsg.senderId !== user.uid;
          const isRecent = Date.now() - lastMsgTime < 900000; // 15 minutos

          if (isRecent && isFromOthers && selectedChannelId !== channel.id) {
            setActiveChannels(prev => ({ ...prev, [channel.id]: true }));
          }
        }
      });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [db, user, role, allowedChannels, selectedChannelId]);

  // Limpiar indicador al seleccionar canal
  useEffect(() => {
    if (selectedChannelId) {
      setActiveChannels(prev => ({ ...prev, [selectedChannelId]: false }));
    }
  }, [selectedChannelId]);

  // Consulta de mensajes del canal activo
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !selectedChannelId) return null;
    return query(
      collection(db, 'chatChannels', selectedChannelId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50) 
    );
  }, [db, selectedChannelId]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);

  // Auto-scroll al final con mayor robustez
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [messages, selectedChannelId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !db || !user || !selectedChannelId || !role) return;

    const msgText = message.trim();
    setMessage('');

    try {
      const channelRef = doc(db, 'chatChannels', selectedChannelId);
      await setDoc(channelRef, {
        id: selectedChannelId,
        updatedAt: serverTimestamp(),
        lastMessage: msgText,
        allowedRoles: activeChannel?.roles || [],
      }, { merge: true });

      await addDoc(collection(db, 'chatChannels', selectedChannelId, 'messages'), {
        senderId: user.uid,
        senderRole: role,
        senderName: role, 
        text: msgText,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    }
  };

  const hasUnreadGlobal = Object.values(activeChannels).some(v => v);

  if (!role) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] print:hidden">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            size="icon" 
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110",
              isOpen ? "bg-slate-800" : "bg-primary"
            )}
          >
            {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageSquare className="h-6 w-6 text-white" />}
            {hasUnreadGlobal && !isOpen && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-600 rounded-full border-2 border-white animate-bounce shadow-lg" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="end" 
          sideOffset={16} 
          className="w-[380px] p-0 overflow-hidden rounded-2xl shadow-2xl border-slate-200"
        >
          <Card className="border-none shadow-none flex flex-col h-[550px]">
            {/* ENCABEZADO DEL CHAT */}
            <CardHeader className="py-3 px-4 border-b bg-primary text-white flex flex-row items-center justify-between space-y-0 shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                {selectedChannelId && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-white hover:bg-white/10 shrink-0" 
                    onClick={() => setSelectedChannelId(null)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="overflow-hidden">
                  <CardTitle className="text-sm font-black uppercase tracking-tight truncate">
                    {selectedChannelId ? activeChannel?.label : "Mensajería por Roles"}
                  </CardTitle>
                  <p className="text-[10px] font-bold text-primary-foreground/70 uppercase truncate">
                    {selectedChannelId ? "Chat de Equipo" : `Sesión: ${role}`}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white hover:bg-white/10 shrink-0" 
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50/30 min-h-0">
              {!selectedChannelId ? (
                /* LISTADO DE CANALES */
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 px-3 py-2 tracking-widest">Canales de Comunicación</p>
                    {allowedChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannelId(channel.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 transition-all text-left group relative"
                      >
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
                            channel.color
                        )}>
                          <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-xs uppercase tracking-tight leading-none mb-1">{channel.label}</p>
                          <p className="text-[10px] text-slate-400 truncate font-medium">Pulsa para entrar al chat</p>
                        </div>
                        {activeChannels[channel.id] && (
                          <span className="h-2.5 w-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_rgba(220,38,38,0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                /* ÁREA DE CONVERSACIÓN */
                <div className="flex flex-col h-full overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {isLoadingMessages ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                      ) : messages && messages.length > 0 ? (
                        <>
                          {messages.map((msg, idx) => {
                            const isMine = msg.senderId === user?.uid;
                            const date = toDate(msg.createdAt);
                            return (
                              <div key={msg.id || idx} className={cn("flex flex-col max-w-[85%]", isMine ? "ml-auto items-end" : "items-start")}>
                                {!isMine && <span className="text-[8px] font-black uppercase text-slate-400 mb-0.5 px-1">{msg.senderRole}</span>}
                                <div className={cn(
                                  "p-2.5 rounded-2xl text-[13px] shadow-sm leading-snug",
                                  isMine 
                                      ? "bg-primary text-white rounded-tr-none" 
                                      : "bg-white border border-slate-200 rounded-tl-none text-slate-800"
                                )}>
                                  {msg.text}
                                </div>
                                <span className="text-[7px] text-muted-foreground mt-0.5 px-1 font-bold">
                                  {!isNaN(date.getTime()) ? format(date, 'hh:mm a', { locale: es }) : 'Enviando...'}
                                </span>
                              </div>
                            )
                          })}
                          <div ref={scrollRef} className="h-1" />
                        </>
                      ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-center opacity-20">
                          <MessageSquare className="h-10 w-10 mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Inicia la conversación</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  
                  {/* BARRA DE ENTRADA */}
                  <div className="p-3 bg-white border-t shrink-0">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input 
                        placeholder="Escribe un mensaje..." 
                        className="h-10 text-sm border-slate-200 focus:ring-primary font-medium"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        autoFocus
                      />
                      <Button type="submit" disabled={!message.trim()} size="icon" className="h-10 w-10 shrink-0 bg-primary hover:bg-slate-800 shadow-md">
                        <Send className="h-4 w-4 text-white" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}
