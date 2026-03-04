
'use client';

import { useEffect, useRef } from 'react';
import { useDb, useUser, useFirebase } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CHANNELS } from '@/lib/chat-config';
import { toDate } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function ChatNotificationListener() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useFirebase();
  const { toast } = useToast();
  const pathname = usePathname();
  
  // Guardamos la última fecha procesada para no notificar mensajes viejos al cargar
  const lastProcessedTimeRef = useRef<number>(Date.now());
  const activeListeners = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!db || !user || !role) return;

    // Solo escuchar si no estamos en la página de chat
    const isChatPage = pathname === '/chat';
    if (isChatPage) {
      // Limpiar listeners si entramos al chat
      activeListeners.current.forEach(unsub => unsubscribe());
      activeListeners.current = [];
      return;
    }

    const allowedChannels = CHANNELS.filter(c => c.roles.includes(role));

    // Suscribirse a cada canal permitido
    allowedChannels.forEach(channel => {
      const messagesRef = collection(db, 'chatChannels', channel.id, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const createdAt = toDate(data.createdAt).getTime();

            // Solo notificar si:
            // 1. El mensaje es nuevo (posterior a la carga de la página)
            // 2. El mensaje NO es nuestro
            if (createdAt > lastProcessedTimeRef.current && data.senderId !== user.uid) {
              toast({
                title: `Mensaje en ${channel.label}`,
                description: `${data.senderName}: ${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}`,
                variant: 'default',
              });
              // Actualizar el tiempo para no repetir la misma notificación
              lastProcessedTimeRef.current = createdAt;
            }
          }
        });
      });

      activeListeners.current.push(unsubscribe);
    });

    return () => {
      activeListeners.current.forEach(unsub => unsub());
      activeListeners.current = [];
    };
  }, [db, user, role, pathname, toast]);

  return null;
}
