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
import type { UserProfile, ChatMessage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { MessageSquare, Send, User as UserIcon, Loader2, Search, Info } from 'lucide-react';
import { cn, toDate } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const POSSIBLE_ROLES = ['Administrador', 'Ventas', 'Ventas Externas'];

export default function ChatPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useFirebase();
  const [selectedContact, setSelectedContact] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [openRoles, setOpenRoles] = useState<string[]>(POSSIBLE_ROLES);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Consulta de usuarios registrados
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users');
  }, [db, user]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  // Roles permitidos según el usuario actual
  const allowedRoles = useMemo(() => {
    if (!role) return [];
    if (role === 'Administrador') return POSSIBLE_ROLES;
    if (role === 'Ventas') return ['Administrador', 'Ventas'];
    if (role === 'Ventas Externas') return ['Administrador', 'Ventas Externas'];
    return [];
  }, [role]);

  // Agrupar contactos por rol
  const contactsByRole = useMemo(() => {
    const groups: Record<string, UserProfile[]> = {};
    allowedRoles.forEach(r => { groups[r] = []; });

    if (!allUsers || !role) return groups;
    
    allUsers.forEach(u => {
      if (u.uid === user?.uid) return;

      // Restricción cruzada Ventas / Ventas Externas
      if (role === 'Ventas' && u.role === 'Ventas Externas') return;
      if (role === 'Ventas Externas' && u.role === 'Ventas') return;

      if (groups[u.role]) {
          const search = searchTerm.toLowerCase();
          if (!searchTerm || u.name.toLowerCase().includes(search)) {
              groups[u.role].push(u);
          }
      }
    });

    return groups;
  }, [allUsers, user?.uid, role, searchTerm, allowedRoles]);

  // Auto-expandir el acordeón al buscar
  useEffect(() => {
    if (searchTerm) { setOpenRoles(allowedRoles); }
  }, [searchTerm, allowedRoles]);

  const activeRoomId = useMemo(() => {
    if (!user || !selectedContact) return null;
    const ids = [user.uid, selectedContact.uid].sort();
    return `${ids[0]}_${ids[1]}`;
  }, [user, selectedContact]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !activeRoomId) return null;
    return query(
      collection(db, 'chatRooms', activeRoomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
  }, [db, activeRoomId]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);

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
          <p className="text-muted-foreground text-sm">Comunícate con el equipo en tiempo real.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* BARRA LATERAL: CONTACTOS */}
        <Card className="w-80 flex flex-col shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre..." 
                className="pl-8 h-10 text-sm bg-white border-slate-200" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
                {allowedRoles.map(r => (
                    <Badge 
                        key={r} 
                        variant="outline" 
                        className={cn(
                            "cursor-pointer text-[9px] font-black uppercase transition-colors px-2 py-1",
                            searchTerm.toLowerCase() === r.toLowerCase() 
                                ? "bg-primary text-white border-primary" 
                                : "bg-white text-slate-500 hover:bg-slate-100"
                        )}
                        onClick={() => setSearchTerm(r === searchTerm ? '' : r)}
                    >
                        {r}
                    </Badge>
                ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {isLoadingUsers ? (
                  <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></div>
                ) : (
                  <Accordion 
                    type="multiple" 
                    value={openRoles} 
                    onValueChange={setOpenRoles} 
                    className="space-y-2"
                  >
                    {allowedRoles.map(roleName => {
                      const contactsInRole = contactsByRole[roleName] || [];
                      return (
                        <AccordionItem key={roleName} value={roleName} className="border-none">
                          <AccordionTrigger className="hover:no-underline py-2.5 px-3 bg-slate-100 rounded-xl group transition-all hover:bg-slate-200/70">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">{roleName}</span>
                              <Badge variant="secondary" className="h-5 text-[9px] font-bold bg-white text-slate-600 border-slate-200">
                                {contactsInRole.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-0">
                            <div className="space-y-1 pl-1">
                              {contactsInRole.length > 0 ? (
                                contactsInRole.map(contact => (
                                    <button
                                    key={contact.uid}
                                    onClick={() => setSelectedContact(contact)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group",
                                        selectedContact?.uid === contact.uid 
                                        ? "bg-primary text-white shadow-md scale-[1.02]" 
                                        : "hover:bg-slate-50"
                                    )}
                                    >
                                    <Avatar className={cn("h-9 w-9", selectedContact?.uid === contact.uid ? "border-2 border-white/20" : "border")}>
                                        <AvatarFallback className={cn(selectedContact?.uid === contact.uid ? "bg-white/10 text-white" : "bg-slate-100")}>
                                        <UserIcon className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-xs truncate uppercase leading-none">{contact.name}</p>
                                        <p className={cn("text-[9px] font-medium uppercase tracking-wider opacity-70 mt-1.5", selectedContact?.uid === contact.uid ? "text-white" : "text-slate-400")}>
                                        Conectado
                                        </p>
                                    </div>
                                    </button>
                                ))
                              ) : (
                                <div className="py-6 px-4 text-center border-2 border-dashed rounded-xl border-slate-100">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                                        No hay personal registrado todavía.
                                    </p>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ÁREA DE CHAT */}
        <Card className="flex-1 flex flex-col shadow-md overflow-hidden relative border-slate-200">
          {selectedContact ? (
            <>
              <CardHeader className="py-3 px-6 border-b bg-slate-50/50 flex flex-row items-center gap-4">
                <Avatar className="h-10 w-10 border shadow-sm">
                  <AvatarFallback className="bg-white text-primary font-black">
                    {selectedContact.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base font-black uppercase tracking-tight">{selectedContact.name}</CardTitle>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedContact.role}</p>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 p-0 overflow-hidden bg-white">
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
                                : "bg-slate-100 border border-slate-200 rounded-tl-none text-slate-800"
                            )}>
                              {msg.text}
                            </div>
                            <span className="text-[9px] text-muted-foreground mt-1 px-1 font-bold">
                              {!isNaN(date.getTime()) ? format(date, 'hh:mm a', { locale: es }) : '...'}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center opacity-30 gap-3">
                        <MessageSquare className="h-10 w-10 text-slate-400" />
                        <p className="text-xs font-black uppercase tracking-widest">Inicia la conversación con {selectedContact.name}</p>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              <div className="p-4 bg-white border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input 
                    placeholder="Escribe un mensaje aquí..." 
                    className="h-12 border-slate-200 text-sm"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" disabled={!message.trim()} className="h-12 w-12 p-0 bg-primary hover:bg-slate-800">
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50">
              <div className="bg-white p-10 rounded-full shadow-2xl mb-8 animate-in zoom-in duration-700">
                <MessageSquare className="h-20 w-20 text-blue-100" />
              </div>
              <h3 className="text-2xl font-black uppercase text-slate-800 tracking-tighter mb-4">¿Cómo chatear con el equipo?</h3>
              
              <div className="grid grid-cols-1 gap-4 max-w-sm">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 text-left">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600 font-black">1</div>
                    <div>
                        <p className="text-xs font-black uppercase text-slate-900">Selecciona un compañero</p>
                        <p className="text-[10px] text-slate-500 font-medium">Usa la lista de la izquierda. Si no ves a nadie, tus compañeros deben entrar a la app para aparecer conectados.</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 text-left">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600 font-black">2</div>
                    <div>
                        <p className="text-xs font-black uppercase text-slate-900">Empieza a escribir</p>
                        <p className="text-[10px] text-slate-500 font-medium">Al seleccionar un nombre, el panel de mensajes se activará automáticamente.</p>
                    </div>
                </div>
              </div>
              
              <div className="mt-8 flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
                <Info className="h-4 w-4" />
                <p className="text-[9px] font-black uppercase tracking-widest">Nota: Ventas y Ventas Externas no pueden hablar entre sí.</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
