'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';

// Este es el mapa central de roles. 
// Asocia un correo electrónico de usuario a un rol específico en la aplicación.
const roleMapping: { [key: string]: string } = {
    'ventas@contracttime.app': 'Ventas',
    'ventas-externas@contracttime.app': 'Ventas Externas',
    'admin@contracttime.app': 'Administrador',
};

export function useCurrentRole() {
  const { user, isUserLoading } = useUser();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) {
      setRole(null);
      return;
    }
    
    // Si el usuario es anónimo, intentamos obtener el rol de la variable global.
    if (user && user.isAnonymous) {
      const selectedRole = (window as any).selectedRoleForAnonymousSession;
      if (selectedRole) {
        setRole(selectedRole.name);
      }
      return;
    }

    // Si es un usuario con email, usamos el mapeo.
    if (user && user.email) {
      const userRole = roleMapping[user.email] || null;
      setRole(userRole);
    } else {
      setRole(null);
    }
  }, [user, isUserLoading]);

  return { role };
}
