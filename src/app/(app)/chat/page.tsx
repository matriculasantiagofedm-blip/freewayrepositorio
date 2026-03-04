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
  limit
} from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send, Loader2, Info, Users, ShieldAlert } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

// Definición de canales globales
const CHANNELS = [
  { id: 'admin_ventas', label: 'Ventas ↔ Administración', roles: ['Administrador', 'Ventas'], icon: MessageSquare, color: 'bg-blue-600' },
  { id: 'admin_ventasext', label: 'Ventas Ext ↔ Administración', roles: ['Administrador', 'Ventas Externas'], icon: MessageSquare, color: 'bg-purple-600' },
  { id: 'internal_admin', label: 'Solo Administradores', roles: ['Administrador'], icon: Users, color: 'bg-slate-800' },
  { id: 'internal_ventas', label: 'Solo Ventas (Interno)', roles: ['Ventas'], icon: Users, color: 'bg-blue-500' },
  { id: 'internal_ventasext', label: 'Solo Ventas Ext (Interno)', roles: ['Ventas Externas'], icon: Users, color: 'bg-purple-500' },
];

export default function ChatPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useFirebase();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filtrar canales según el rol del usuario actual
  const allowedChannels = useMemo(() => {
    if (!role) return [];
    return CHANNELS.filter(channel => channel.roles.includes(role));
  }, [role]);

  const activeChannel = useMemo(() => {
    return allowedChannels.find(c => c.id === selectedChannelId);
  }, [selectedChannelId, allowedChannels]);

  // Consulta de mensajes del canal activo
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !selectedChannelId) return null;
    return query(
      collection(db, 'chatChannels', selectedChannelId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
  }, [db, selectedChannelId]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);

  // Auto-scroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !db || !user || !selectedChannelId || !role) return;

    const msgText = message.trim();
    setMessage('');

    try {
      // Registrar el canal si no existe (opcional, para metadatos)
      const channelRef = doc(db, 'chatChannels', selectedChannelId);
      await setDoc(channelRef, {
        id: selectedChannelId,
        updatedAt: serverTimestamp(),
        lastMessage: msgText,
        allowedRoles: activeChannel?.roles || [],
      }, { merge: true });

      // Añadir el mensaje
      await addDoc(collection(db, 'chatChannels', selectedChannelId, 'messages'), {
        senderId: user.uid,
        senderRole: role,
        senderName: role, // Usamos el rol como nombre para anonimato corporativo
        text: msgText,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)]">
      <div className="flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
            <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-bold">Mensajería por Roles</h1>
          <p className="text-muted-foreground text-sm font-medium">Comunicación directa entre departamentos de Freeway.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* BARRA LATERAL: CANALES */}
        <Card className="w-80 flex flex-col shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Canales Disponibles</CardTitle>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-1">
                {allowedChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
                      selectedChannelId === channel.id 
                        ? "bg-primary text-white shadow-lg scale-[1.02]" 
                        : "hover:bg-slate-100"
                    )}
                  >
                    <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border-2 border-white/20 shadow-sm",
                        channel.color
                    )}>
                        <channel.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-black text-[11px] uppercase tracking-tight leading-none mb-1">{channel.label}</p>
                        <p className={cn("text-[9px] font-bold uppercase opacity-60", selectedChannelId === channel.id ? "text-white" : "text-slate-400")}>
                            Canal de Equipo
                        </p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ÁREA DE CHAT */}
        <Card className="flex-1 flex flex-col shadow-md overflow-hidden relative border-slate-200">
          {activeChannel ? (
            <>
              <CardHeader className="py-3 px-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", activeChannel.color)}>
                        <activeChannel.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-black uppercase tracking-tight">{activeChannel.label}</CardTitle>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Chat Grupal de Rol</p>
                    </div>
                </div>
                <Badge variant="outline" className="bg-white border-slate-200 text-[9px] font-black uppercase">
                    Seguro
                </Badge>
              </CardHeader>
              
              <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50/30">
                <ScrollArea className="h-full px-6 py-6">
                  <div className="space-y-6">
                    {isLoadingMessages ? (
                      <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" /></div>
                    ) : messages && messages.length > 0 ? (
                      messages.map((msg, idx) => {
                        const isMine = msg.senderId === user?.uid;
                        const date = toDate(msg.createdAt);
                        return (
                          <div key={msg.id || idx} className={cn("flex flex-col max-w-[85%]", isMine ? "ml-auto items-end" : "items-start")}>
                            {!isMine && (
                                <span className="text-[9px] font-black uppercase text-slate-400 mb-1 px-1">{msg.senderRole}</span>
                            )}
                            <div className={cn(
                              "p-3 rounded-2xl text-sm shadow-sm",
                              isMine 
                                ? "bg-primary text-white rounded-tr-none" 
                                : "bg-white border border-slate-200 rounded-tl-none text-slate-800"
                            )}>
                              {msg.text}
                            </div>
                            <span className="text-[8px] text-muted-foreground mt-1 px-1 font-bold">
                              {!isNaN(date.getTime()) ? format(date, 'hh:mm a', { locale: es }) : 'Enviando...'}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center opacity-30 gap-3">
                        <MessageSquare className="h-12 w-12 text-slate-400" />
                        <p className="text-xs font-black uppercase tracking-widest">Inicia la conversación en este canal</p>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              <div className="p-4 bg-white border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input 
                    placeholder="Escribe un mensaje para el equipo..." 
                    className="h-12 border-slate-200 text-sm focus:ring-primary font-medium"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" disabled={!message.trim()} className="h-12 w-12 p-0 bg-primary hover:bg-slate-800 shadow-lg">
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50">
              <div className="bg-white p-10 rounded-full shadow-2xl mb-8 animate-in zoom-in duration-700">
                <Users className="h-20 w-20 text-blue-100" />
              </div>
              <h3 className="text-2xl font-black uppercase text-slate-800 tracking-tighter mb-4">Central de Comunicaciones</h3>
              
              <div className="grid grid-cols-1 gap-4 max-w-sm">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 text-left">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 font-black text-xs">OK</div>
                    <div>
                        <p className="text-xs font-black uppercase text-slate-900">Selecciona un Canal</p>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Usa la lista de la izquierda para entrar a un chat grupal. Puedes hablar con otros departamentos o dentro de tu propio equipo.</p>
                    </div>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl shadow-sm border border-amber-100 flex items-start gap-4 text-left">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                        <p className="text-xs font-black uppercase text-amber-900">Privacidad de Roles</p>
                        <p className="text-[10px] text-amber-700 font-medium leading-relaxed">El sistema bloquea automáticamente la visibilidad entre Ventas y Ventas Externas para garantizar la independencia de cada área.</p>
                    </div>
                </div>
              </div>
              
              <div className="mt-8 flex items-center gap-2 text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                <Info className="h-4 w-4" />
                <p className="text-[9px] font-black uppercase tracking-widest">Los mensajes son visibles para todos los miembros autorizados del canal.</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
