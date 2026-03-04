'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDb, useUser, useFirebase } from '@/firebase';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { 
  collection, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  limit
} from 'firebase/firestore';
import type { UserProfile, ChatMessage, ChatRoom } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send, User as UserIcon, Loader2, Search } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ChatPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useFirebase();
  const [selectedContact, setSelectedContact] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Consulta de usuarios registrados
  const usersQuery = useMemoQuery(() => {
    if (!db || !user) return null;
    return collection(db, 'users');
  }, [db, user]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  // Filtrar contactos según el rol
  const contacts = useMemo(() => {
    if (!allUsers || !role) return [];
    
    return allUsers.filter(u => {
      // No mostrarse a uno mismo
      if (u.uid === user?.uid) return false;

      // Restricción: Ventas y Ventas Externas NO se ven entre sí
      if (role === 'Ventas' && u.role === 'Ventas Externas') return false;
      if (role === 'Ventas Externas' && u.role === 'Ventas') return false;
      if (role === 'Ventas' && u.role === 'Ventas') return false; // Tampoco entre mismos Ventas (opcional, tú decides)
      if (role === 'Ventas Externas' && u.role === 'Ventas Externas') return false;

      // Búsqueda por nombre
      if (searchTerm && !u.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      return true;
    });
  }, [allUsers, user?.uid, role, searchTerm]);

  // ID de sala de chat único para dos participantes (ordenado alfabéticamente para consistencia)
  const activeRoomId = useMemo(() => {
    if (!user || !selectedContact) return null;
    const ids = [user.uid, selectedContact.uid].sort();
    return `${ids[0]}_${ids[1]}`;
  }, [user, selectedContact]);

  // Consulta de mensajes en tiempo real
  const messagesQuery = useMemoQuery(() => {
    if (!db || !activeRoomId) return null;
    return query(
      collection(db, 'chatRooms', activeRoomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
  }, [db, activeRoomId]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !db || !user || !selectedContact || !activeRoomId) return;

    const msgText = message.trim();
    setMessage('');

    try {
      // 1. Asegurar que la sala existe
      const roomRef = doc(db, 'chatRooms', activeRoomId);
      await setDoc(roomRef, {
        participants: [user.uid, selectedContact.uid],
        participantRoles: {
          [user.uid]: role || 'Personal',
          [selectedContact.uid]: selectedContact.role,
        },
        participantNames: {
          [user.uid]: role || 'Personal',
          [selectedContact.uid]: selectedContact.name,
        },
        lastMessage: msgText,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 2. Añadir el mensaje
      await addDoc(collection(db, 'chatRooms', activeRoomId, 'messages'), {
        senderId: user.uid,
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
        <MessageSquare className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-headline text-3xl font-bold">Mensajería Interna</h1>
          <p className="text-muted-foreground text-sm">Coordina con el equipo administrativo en tiempo real.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* LISTADO DE CONTACTOS */}
        <Card className="w-80 flex flex-col shadow-md">
          <CardHeader className="pb-3 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar contacto..." 
                className="pl-8 h-9 text-xs" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {isLoadingUsers ? (
                  <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></div>
                ) : contacts.length > 0 ? (
                  contacts.map(contact => (
                    <button
                      key={contact.uid}
                      onClick={() => setSelectedContact(contact)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
                        selectedContact?.uid === contact.uid 
                          ? "bg-primary text-white shadow-lg" 
                          : "hover:bg-slate-100"
                      )}
                    >
                      <Avatar className={cn("h-10 w-10", selectedContact?.uid === contact.uid ? "border-2 border-white/20" : "border")}>
                        <AvatarFallback className={cn(selectedContact?.uid === contact.uid ? "bg-white/10 text-white" : "bg-slate-100")}>
                          <UserIcon className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate uppercase">{contact.name}</p>
                        <p className={cn("text-[10px] font-medium uppercase tracking-wider opacity-70", selectedContact?.uid === contact.uid ? "text-white" : "text-primary")}>
                          {contact.role}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground italic">No hay contactos disponibles bajo tu restricción de rol.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ÁREA DE CHAT */}
        <Card className="flex-1 flex flex-col shadow-md overflow-hidden relative">
          {selectedContact ? (
            <>
              <CardHeader className="py-3 px-6 border-b bg-slate-50/50 flex flex-row items-center gap-4">
                <Avatar className="h-10 w-10 border">
                  <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base font-black uppercase">{selectedContact.name}</CardTitle>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedContact.role}</p>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50/30">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-4">
                    {isLoadingMessages ? (
                      <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" /></div>
                    ) : messages && messages.length > 0 ? (
                      messages.map((msg, idx) => {
                        const isMine = msg.senderId === user?.uid;
                        const date = toDate(msg.createdAt);
                        
                        return (
                          <div key={msg.id || idx} className={cn("flex flex-col max-w-[80%]", isMine ? "ml-auto items-end" : "items-start")}>
                            <div className={cn(
                              "p-3 rounded-2xl text-sm shadow-sm",
                              isMine 
                                ? "bg-primary text-white rounded-tr-none" 
                                : "bg-white border rounded-tl-none"
                            )}>
                              {msg.text}
                            </div>
                            <span className="text-[9px] text-muted-foreground mt-1 px-1">
                              {!isNaN(date.getTime()) ? format(date, 'hh:mm a', { locale: es }) : '...'}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center opacity-30 gap-3">
                        <MessageSquare className="h-12 w-12" />
                        <p className="text-xs font-bold uppercase tracking-widest">Inicia la conversación</p>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              <div className="p-4 bg-white border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input 
                    placeholder="Escribe un mensaje..." 
                    className="h-11 focus-visible:ring-primary"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <Button type="submit" disabled={!message.trim()} className="h-11 w-11 p-0 shrink-0 shadow-lg">
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50">
              <div className="bg-white p-6 rounded-full shadow-xl mb-6">
                <MessageSquare className="h-12 w-12 text-slate-200" />
              </div>
              <h3 className="text-xl font-black uppercase text-slate-400 tracking-tighter">Selecciona un chat</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Para comenzar a coordinar con el equipo</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
