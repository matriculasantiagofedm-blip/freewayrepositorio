
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDb, useUser, useFirebase } from '@/firebase';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
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
import { MessageSquare, Send, User as UserIcon, Loader2, Search, Users, Tag } from 'lucide-react';
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
  const [openRoles, setOpenRoles] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Consulta de usuarios registrados
  const usersQuery = useMemoQuery(() => {
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

  // Filtrar contactos según el rol y agruparlos
  const groupedContacts = useMemo(() => {
    if (!allUsers || !role) return {};
    
    const filtered = allUsers.filter(u => {
      if (u.uid === user?.uid) return false;

      // REGLA: Ventas y Ventas Externas NO se ven entre sí
      if (role === 'Ventas' && u.role === 'Ventas Externas') return false;
      if (role === 'Ventas Externas' && u.role === 'Ventas') return false;

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(search);
        const matchesRole = u.role.toLowerCase().includes(search);
        if (!matchesName && !matchesRole) return false;
      }

      return true;
    });

    const groups: Record<string, UserProfile[]> = {};
    filtered.forEach(u => {
      if (!groups[u.role]) groups[u.role] = [];
      groups[u.role].push(u);
    });

    return groups;
  }, [allUsers, user?.uid, role, searchTerm]);

  // Lista de roles que tienen contactos (para el acordeón)
  const roleListWithUsers = useMemo(() => {
    return Object.keys(groupedContacts).sort();
  }, [groupedContacts]);

  // Auto-expandir el acordeón cuando hay búsqueda o cambio de datos
  useEffect(() => {
    if (searchTerm || roleListWithUsers.length > 0) {
        setOpenRoles(roleListWithUsers);
    }
  }, [searchTerm, roleListWithUsers]);

  // ID de sala de chat único para dos participantes
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

  const handleRoleTagClick = (roleName: string) => {
    const isAlreadyFiltered = searchTerm.toLowerCase() === roleName.toLowerCase();
    setSearchTerm(isAlreadyFiltered ? '' : roleName);
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
        {/* LISTADO DE CONTACTOS DESPLEGABLE */}
        <Card className="w-80 flex flex-col shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b bg-slate-50/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre..." 
                className="pl-8 h-9 text-xs bg-white border-slate-200" 
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
                            "cursor-pointer text-[9px] font-black uppercase transition-colors px-2 py-0",
                            searchTerm.toLowerCase() === r.toLowerCase() 
                                ? "bg-primary text-white border-primary" 
                                : "bg-white text-slate-500 hover:bg-slate-100"
                        )}
                        onClick={() => handleRoleTagClick(r)}
                    >
                        <Tag className="h-2 w-2 mr-1" />
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
                ) : roleListWithUsers.length > 0 ? (
                  <Accordion 
                    type="multiple" 
                    value={openRoles} 
                    onValueChange={setOpenRoles} 
                    className="space-y-2"
                  >
                    {roleListWithUsers.map(roleName => {
                      const contactsInRole = groupedContacts[roleName] || [];
                      return (
                        <AccordionItem key={roleName} value={roleName} className="border-none">
                          <AccordionTrigger className="hover:no-underline py-2 px-3 bg-slate-100 rounded-lg group">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{roleName}</span>
                              <Badge variant="secondary" className="h-5 text-[9px] font-bold bg-white text-slate-600 border-slate-200">
                                {contactsInRole.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-2 pb-0">
                            <div className="space-y-1 pl-1">
                              {contactsInRole.map(contact => (
                                <button
                                  key={contact.uid}
                                  onClick={() => setSelectedContact(contact)}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group",
                                    selectedContact?.uid === contact.uid 
                                      ? "bg-primary text-white shadow-md" 
                                      : "hover:bg-slate-50"
                                  )}
                                >
                                  <Avatar className={cn("h-8 w-8", selectedContact?.uid === contact.uid ? "border-2 border-white/20" : "border")}>
                                    <AvatarFallback className={cn(selectedContact?.uid === contact.uid ? "bg-white/10 text-white" : "bg-slate-100")}>
                                      <UserIcon className="h-4 w-4" />
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-xs truncate uppercase leading-none">{contact.name}</p>
                                    <p className={cn("text-[9px] font-medium uppercase tracking-wider opacity-70 mt-1", selectedContact?.uid === contact.uid ? "text-white" : "text-slate-400")}>
                                      {contact.role}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-20" />
                    {searchTerm ? "Sin coincidencias." : "Inicia sesión en otro navegador para ver tu perfil aquí."}
                  </div>
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
                  <AvatarFallback className="bg-white text-primary"><UserIcon className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base font-black uppercase tracking-tight">{selectedContact.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{selectedContact.role}</p>
                  </div>
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
                                : "bg-white border border-slate-200 rounded-tl-none text-slate-800"
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
                        <div className="p-4 bg-slate-100 rounded-full">
                          <MessageSquare className="h-10 w-10 text-slate-400" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">Inicia la conversación</p>
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
                    className="h-11 focus-visible:ring-primary border-slate-200 shadow-inner"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <Button type="submit" disabled={!message.trim()} className="h-11 w-11 p-0 shrink-0 shadow-lg bg-primary hover:bg-slate-800 transition-all">
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50">
              <div className="bg-white p-8 rounded-full shadow-xl mb-6 animate-in zoom-in duration-500">
                <MessageSquare className="h-16 w-16 text-slate-100" />
              </div>
              <h3 className="text-xl font-black uppercase text-slate-400 tracking-tighter">Selecciona un chat</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 max-w-[200px] leading-relaxed">Usa el menú desplegable a la izquierda para elegir un contacto</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
