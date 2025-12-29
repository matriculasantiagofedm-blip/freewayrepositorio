'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';

// Este es el mapa central de roles. 
// Asocia un correo electrónico de usuario a un rol específico en la aplicación.
// Puedes agregar o modificar los correos y roles de tu equipo aquí.
const roleMapping: { [key: string]: string } = {
    // Administrador
    'admin@contracttime.app': 'Administrador',
    
    // Vendedores Internos
    'ventas@contracttime.app': 'Ventas',

    // Vendedores Externos
    'ventas-externas@contracttime.app': 'Ventas Externas',
};

export function useCurrentRole() {
  const { user, isUserLoading } = useUser();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) {
      setRole(null);
      return;
    }
    
    if (user && user.email && !user.isAnonymous) {
      // Busca el rol correspondiente al email del usuario que inició sesión.
      // Si no se encuentra, se le asigna null (sin rol).
      const userRole = roleMapping[user.email] || null;
      setRole(userRole);
    } else {
      setRole(null);
    }
  }, [user, isUserLoading]);

  return { role };
}
